import * as path from "path"

// Supported image formats
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]

// Maximum file size (5MB)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

/**
 * Check if a file is an image based on its extension
 */
export function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
}

/**
 * Get MIME type for an image file
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".gif":
      return "image/gif"
    case ".webp":
      return "image/webp"
    case ".bmp":
      return "image/bmp"
    default:
      return "application/octet-stream"
  }
}

/**
 * Convert Windows path to WSL path if needed
 */
export function convertWindowsPath(filePath: string): string {
  // Convert Windows path (C:\path\to\file) to WSL path (/mnt/c/path/to/file)
  if (filePath.match(/^[A-Za-z]:\\/)) {
    const drive = filePath[0].toLowerCase()
    const pathWithoutDrive = filePath.slice(2).replace(/\\/g, "/")
    return `/mnt/${drive}${pathWithoutDrive}`
  }
  return filePath
}

/**
 * Extract image paths from text
 */
export function extractImagePaths(text: string): string[] {
  const paths: string[] = []

  // Match quoted paths (single or double quotes) - including full paths
  const quotedPaths = text.match(
    /["']([^"']*\.(png|jpg|jpeg|gif|webp|bmp))["']/gi,
  )
  if (quotedPaths) {
    paths.push(...quotedPaths.map((p) => p.slice(1, -1)))
  }

  // Match backtick paths
  const backtickPaths = text.match(/`([^`]*\.(png|jpg|jpeg|gif|webp|bmp))`/gi)
  if (backtickPaths) {
    paths.push(...backtickPaths.map((p) => p.slice(1, -1)))
  }

  // Match unquoted paths - more careful to get full paths
  // This regex looks for paths that might include directories
  const unquotedPaths = text.match(
    /(?:^|\s)((?:[A-Za-z]:[\\\/]|\/)?[^\s]*\.(png|jpg|jpeg|gif|webp|bmp))(?:\s|$)/gi,
  )
  if (unquotedPaths) {
    paths.push(...unquotedPaths.map((p) => p.trim()))
  }

  // Remove duplicates and filter out partial matches
  const uniquePaths = [...new Set(paths)]

  // Filter out paths that are just filenames if we have full paths
  const fullPaths = uniquePaths.filter(
    (p) => p.includes("/") || p.includes("\\"),
  )
  if (fullPaths.length > 0) {
    // If we have full paths, prefer them over just filenames
    return fullPaths
  }

  return uniquePaths
}

/**
 * Read and encode an image file to base64 data URL
 */
export async function encodeImageToDataUrl(filePath: string): Promise<string> {
  // Convert Windows paths if needed
  const normalizedPath = convertWindowsPath(filePath)

  // Make path absolute if relative
  const absolutePath = path.isAbsolute(normalizedPath)
    ? normalizedPath
    : path.join(process.cwd(), normalizedPath)

  // Check if file exists
  const file = Bun.file(absolutePath)
  if (!(await file.exists())) {
    throw new Error(`Image file not found: ${filePath}`)
  }

  // Check file size
  const stats = await file.stat()
  if (stats.size > MAX_IMAGE_SIZE) {
    throw new Error(
      `Image file too large: ${stats.size} bytes (max: ${MAX_IMAGE_SIZE} bytes)`,
    )
  }

  // Read file and encode to base64
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString("base64")
  const mimeType = getMimeType(absolutePath)

  return `data:${mimeType};base64,${base64}`
}

/**
 * Process text to find and load images
 */
export async function processImagesInText(text: string): Promise<{
  text: string
  images: Array<{
    path: string
    dataUrl: string
    mimeType: string
  }>
}> {
  const imagePaths = extractImagePaths(text)
  const images: Array<{
    path: string
    dataUrl: string
    mimeType: string
  }> = []

  for (const imagePath of imagePaths) {
    try {
      const dataUrl = await encodeImageToDataUrl(imagePath)
      const mimeType = getMimeType(imagePath)
      images.push({
        path: imagePath,
        dataUrl,
        mimeType,
      })
    } catch (error) {
      // Log error but continue processing other images
      console.error(`Failed to load image ${imagePath}:`, error)
    }
  }

  return { text, images }
}
