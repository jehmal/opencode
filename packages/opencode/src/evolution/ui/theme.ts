/**
 * Evolution UI Theme
 * Agent ID: user-approval-workflow-004
 *
 * Theme configuration for Evolution TUI components
 */

import type { UITheme } from "./types"

export const theme: UITheme = {
  colors: {
    primary: "#00D9FF", // Cyan
    secondary: "#7B61FF", // Purple
    success: "#00FF88", // Green
    warning: "#FFB800", // Orange
    danger: "#FF3366", // Red
    info: "#00A6FF", // Blue
    background: "#0A0E27", // Dark blue
    foreground: "#FFFFFF", // White
    border: "#2A2E5E", // Dark purple
  },
  spacing: {
    xs: 1,
    sm: 2,
    md: 4,
    lg: 8,
    xl: 16,
  },
}

// ANSI color codes for terminal
export const ansiColors = {
  primary: "\x1b[96m", // Bright cyan
  secondary: "\x1b[95m", // Bright magenta
  success: "\x1b[92m", // Bright green
  warning: "\x1b[93m", // Bright yellow
  danger: "\x1b[91m", // Bright red
  info: "\x1b[94m", // Bright blue
  dim: "\x1b[90m", // Bright black (gray)
  reset: "\x1b[0m", // Reset
  bold: "\x1b[1m", // Bold
  underline: "\x1b[4m", // Underline
  inverse: "\x1b[7m", // Inverse
}

// Helper functions for styling
export const style = {
  primary: (text: string) => `${ansiColors.primary}${text}${ansiColors.reset}`,
  secondary: (text: string) =>
    `${ansiColors.secondary}${text}${ansiColors.reset}`,
  success: (text: string) => `${ansiColors.success}${text}${ansiColors.reset}`,
  warning: (text: string) => `${ansiColors.warning}${text}${ansiColors.reset}`,
  danger: (text: string) => `${ansiColors.danger}${text}${ansiColors.reset}`,
  info: (text: string) => `${ansiColors.info}${text}${ansiColors.reset}`,
  dim: (text: string) => `${ansiColors.dim}${text}${ansiColors.reset}`,
  bold: (text: string) => `${ansiColors.bold}${text}${ansiColors.reset}`,
  underline: (text: string) =>
    `${ansiColors.underline}${text}${ansiColors.reset}`,
  inverse: (text: string) => `${ansiColors.inverse}${text}${ansiColors.reset}`,
}

// Box drawing characters
export const boxChars = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  cross: "┼",
  teeUp: "┴",
  teeDown: "┬",
  teeLeft: "┤",
  teeRight: "├",
  doubleHorizontal: "═",
  doubleVertical: "║",
  doubleTopLeft: "╔",
  doubleTopRight: "╗",
  doubleBottomLeft: "╚",
  doubleBottomRight: "╝",
}

// Progress bar characters
export const progressChars = {
  full: "█",
  threeFourths: "▓",
  half: "▒",
  oneFourth: "░",
  empty: " ",
}

// Icon characters
export const icons = {
  check: "✓",
  cross: "✗",
  warning: "⚠",
  info: "ℹ",
  arrow: "→",
  arrowUp: "↑",
  arrowDown: "↓",
  arrowLeft: "←",
  arrowRight: "→",
  bullet: "•",
  star: "★",
  circle: "●",
  square: "■",
  diamond: "◆",
  triangle: "▲",
  play: "▶",
  pause: "⏸",
  stop: "⏹",
  refresh: "⟳",
  gear: "⚙",
  lock: "🔒",
  unlock: "🔓",
  fire: "🔥",
  rocket: "🚀",
  sparkles: "✨",
}
