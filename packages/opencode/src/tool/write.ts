import { z } from "zod"
import * as path from "path"
import * as fs from "fs"
import { Tool } from "./tool"
import { LSP } from "../lsp"
import { Permission } from "../permission"
import DESCRIPTION from "./write.txt"
import { App } from "../app/app"
import { Bus } from "../bus"
import { File } from "../file"
import { FileTime } from "../file/time"

export const WriteTool = Tool.define({
  id: "write",
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z
      .string()
      .describe(
        "The absolute path to the file to write (must be absolute, not relative)",
      ),
    content: z.string().describe("The content to write to the file"),
  }),
  async execute(params, ctx) {
    const app = App.info()
    
    // Security: Validate before normalization
    if (params.filePath.includes('..') || params.filePath.includes('\0')) {
      throw new Error("Invalid characters in file path")
    }
    
    // Normalize and validate file path
    const normalizedPath = path.normalize(params.filePath)
    
    // Double-check after normalization
    if (normalizedPath.includes('..')) {
      throw new Error("Path traversal not allowed")
    }
    
    const filepath = path.isAbsolute(normalizedPath)
      ? normalizedPath
      : path.join(app.path.cwd, normalizedPath)
    
    // Canonicalize and ensure the file is within the project directory
    const resolvedPath = path.resolve(filepath)
    const projectRoot = path.resolve(app.path.cwd)
    
    // Proper boundary check
    if (!resolvedPath.startsWith(projectRoot + path.sep) && resolvedPath !== projectRoot) {
      throw new Error("File path must be within the project directory")
    }
    
    // Check if path would escape via symlinks
    const dir = path.dirname(resolvedPath)
    try {
      // Check parent directory realpath
      if (await Bun.file(dir).exists()) {
        const realDir = path.resolve(await fs.promises.realpath(dir))
        if (!realDir.startsWith(projectRoot + path.sep) && realDir !== projectRoot) {
          throw new Error("Directory path must not escape project via symlinks")
        }
      }
    } catch (e) {
      // If realpath fails, continue with regular validation
    }

    const file = Bun.file(filepath)
    const exists = await file.exists()
    if (exists) await FileTime.assert(ctx.sessionID, filepath)

    await Permission.ask({
      id: "write",
      sessionID: ctx.sessionID,
      title: exists
        ? "Overwrite this file: " + filepath
        : "Create new file: " + filepath,
      metadata: {
        filePath: filepath,
        content: params.content,
        exists,
      },
    })

    await Bun.write(filepath, params.content)
    await Bus.publish(File.Event.Edited, {
      file: filepath,
    })
    FileTime.read(ctx.sessionID, filepath)

    let output = ""
    await LSP.touchFile(filepath, true)
    const diagnostics = await LSP.diagnostics()
    for (const [file, issues] of Object.entries(diagnostics)) {
      if (issues.length === 0) continue
      if (file === filepath) {
        output += `\nThis file has errors, please fix\n<file_diagnostics>\n${issues.map(LSP.Diagnostic.pretty).join("\n")}\n</file_diagnostics>\n`
        continue
      }
      output += `\n<project_diagnostics>\n${file}\n${issues.map(LSP.Diagnostic.pretty).join("\n")}\n</project_diagnostics>\n`
    }

    return {
      metadata: {
        diagnostics,
        filepath,
        exists: exists,
        title: path.relative(app.path.root, filepath),
      },
      output,
    }
  },
})
