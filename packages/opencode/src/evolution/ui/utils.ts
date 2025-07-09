/**
 * Evolution UI Utilities
 * Agent ID: user-approval-workflow-004
 */

import { style } from "./theme"

export function formatDiff(diff: string, maxWidth: number): string[] {
  const lines = diff.split("\n")
  const formatted: string[] = []

  for (const line of lines) {
    if (line.length <= maxWidth) {
      formatted.push(colorDiffLine(line))
    } else {
      const wrapped = wrapLine(line, maxWidth)
      formatted.push(...wrapped.map(colorDiffLine))
    }
  }

  return formatted
}

function colorDiffLine(line: string): string {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return style.success(line)
  } else if (line.startsWith("-") && !line.startsWith("---")) {
    return style.danger(line)
  } else if (line.startsWith("@")) {
    return style.info(line)
  } else {
    return line
  }
}

function wrapLine(line: string, maxWidth: number): string[] {
  const wrapped: string[] = []
  let remaining = line

  while (remaining.length > maxWidth) {
    wrapped.push(remaining.substring(0, maxWidth))
    remaining = remaining.substring(maxWidth)
  }

  if (remaining.length > 0) {
    wrapped.push(remaining)
  }

  return wrapped
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"

  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000)
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

export function formatPercentage(
  value: number,
  improved: boolean = true,
): string {
  const formatted = `${value.toFixed(1)}%`
  if (value === 0) return style.dim(formatted)
  if (improved) {
    return value > 0 ? style.success(formatted) : style.danger(formatted)
  } else {
    return value > 0 ? style.danger(formatted) : style.success(formatted)
  }
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength - 3) + "..."
}

export function center(str: string, width: number): string {
  const padding = Math.max(0, width - str.length)
  const leftPad = Math.floor(padding / 2)
  const rightPad = padding - leftPad
  return " ".repeat(leftPad) + str + " ".repeat(rightPad)
}

export function horizontalLine(width: number, char: string = "─"): string {
  return char.repeat(width)
}

export function formatTimestamp(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`

  return date.toLocaleDateString()
}
