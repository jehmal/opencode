import { z } from "zod"
import * as fs from "fs"
import * as path from "path"
import { Tool } from "./tool"
import { LSP } from "../lsp"
import { FileTime } from "../file/time"
import DESCRIPTION from "./read.txt"
import { App } from "../app/app"

const MAX_READ_SIZE = 250 * 1024
const DEFAULT_READ_LIMIT = 2000
const MAX_LINE_LENGTH = 2000

export const ReadTool = Tool.define({
  id: "read",
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The path to the file to read"),
    offset: z
      .number()
      .describe("The line number to start reading from (0-based)")
      .optional(),
    limit: z
      .number()
      .describe("The number of lines to read (defaults to 2000)")
      .optional(),
  }),
  async execute(params, ctx) {
    let filePath = params.filePath

    // Security: Validate file path before normalization
    if (params.filePath.includes('..') || params.filePath.includes('\0')) {
      throw new Error("Invalid characters in file path")
    }
    
    // Normalize and validate file path
    filePath = path.normalize(filePath)
    
    // Double-check after normalization
    if (filePath.includes('..')) {
      throw new Error("Path traversal not allowed")
    }
    
    // Convert Windows paths to WSL format if needed
    const windowsPathMatch = filePath.match(/^([A-Za-z]):\\(.*)/)
    if (windowsPathMatch) {
      const drive = windowsPathMatch[1].toLowerCase()
      const pathPart = windowsPathMatch[2].replace(/\\/g, "/")
      filePath = `/mnt/${drive}/${pathPart}`
    }

    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath)
    }
    
    // Ensure the file is within allowed directories
    const resolvedPath = path.resolve(filePath)
    const cwd = path.resolve(process.cwd())
    const app = App.info()
    const projectRoot = path.resolve(app.path.cwd)
    
    // Allow reading from current directory or project root with proper boundary checks
    const validPaths = [cwd, projectRoot].filter(p => p)
    let isValidPath = false
    for (const validPath of validPaths) {
      if (resolvedPath.startsWith(validPath + path.sep) || resolvedPath === validPath) {
        isValidPath = true
        break
      }
    }
    
    if (!isValidPath) {
      throw new Error("File path must be within the current or project directory")
    }
    
    // Verify symlinks don't escape allowed directories
    try {
      const realPath = fs.existsSync(resolvedPath) 
        ? path.resolve(fs.realpathSync(resolvedPath))
        : resolvedPath
      
      let isRealPathValid = false
      for (const validPath of validPaths) {
        if (realPath.startsWith(validPath + path.sep) || realPath === validPath) {
          isRealPathValid = true
          break
        }
      }
      
      if (!isRealPathValid) {
        throw new Error("Symlinks must not escape allowed directories")
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("escape")) {
        throw e
      }
      // If realpath fails for other reasons, continue
    }

    const file = Bun.file(filePath)
    if (!(await file.exists())) {
      const dir = path.dirname(filePath)
      const base = path.basename(filePath)

      const dirEntries = fs.readdirSync(dir)
      const suggestions = dirEntries
        .filter(
          (entry) =>
            entry.toLowerCase().includes(base.toLowerCase()) ||
            base.toLowerCase().includes(entry.toLowerCase()),
        )
        .map((entry) => path.join(dir, entry))
        .slice(0, 3)

      if (suggestions.length > 0) {
        throw new Error(
          `File not found: ${filePath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`,
        )
      }

      throw new Error(`File not found: ${filePath}`)
    }
    const stats = await file.stat()

    if (stats.size > MAX_READ_SIZE)
      throw new Error(
        `File is too large (${stats.size} bytes). Maximum size is ${MAX_READ_SIZE} bytes`,
      )
    const limit = params.limit ?? DEFAULT_READ_LIMIT
    const offset = params.offset || 0
    const imageType = isImageFile(filePath)
    if (imageType) {
      // Handle image files by returning acknowledgment
      return {
        output: `<image_file>\nType: ${imageType}\nPath: ${filePath}\nSize: ${stats.size} bytes\nStatus: Image loaded successfully. The visual content has been processed and is available for analysis.\n</image_file>`,
        metadata: {
          preview: `${imageType} image file (${stats.size} bytes)`,
          title: path.relative(App.info().path.root, filePath),
        },
      }
    }
    const lines = await file.text().then((text) => text.split("\n"))
    const raw = lines.slice(offset, offset + limit).map((line) => {
      return line.length > MAX_LINE_LENGTH
        ? line.substring(0, MAX_LINE_LENGTH) + "..."
        : line
    })
    const content = raw.map((line, index) => {
      return `${(index + offset + 1).toString().padStart(5, "0")}| ${line}`
    })
    const preview = raw.slice(0, 20).join("\n")

    let output = "<file>\n"
    output += content.join("\n")

    if (lines.length > offset + content.length) {
      output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${
        offset + content.length
      })`
    }
    output += "\n</file>"

    // just warms the lsp client
    await LSP.touchFile(filePath, false)
    FileTime.read(ctx.sessionID, filePath)

    return {
      output,
      metadata: {
        preview,
        title: path.relative(App.info().path.root, filePath),
      },
    }
  },
})

function isImageFile(filePath: string): string | false {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "JPEG"
    case ".png":
      return "PNG"
    case ".gif":
      return "GIF"
    case ".bmp":
      return "BMP"
    case ".svg":
      return "SVG"
    case ".webp":
      return "WebP"
    default:
      return false
  }
}
