/**
 * Debug utility for controlling console output based on environment
 * In production mode, all debug output is suppressed
 */
export namespace Debug {
  const OPENCODE_DEBUG = process.env["OPENCODE_DEBUG"] === "true"
  const OPENCODE_ENV = process.env["OPENCODE_ENV"] || "production"

  export const isEnabled = OPENCODE_DEBUG || OPENCODE_ENV === "development"

  export function log(...args: any[]) {
    if (isEnabled) console.log(...args)
  }

  export function error(...args: any[]) {
    if (isEnabled) console.error(...args)
  }

  export function warn(...args: any[]) {
    if (isEnabled) console.warn(...args)
  }

  export function info(...args: any[]) {
    if (isEnabled) console.info(...args)
  }

  export function debug(...args: any[]) {
    if (isEnabled) console.debug(...args)
  }
}
