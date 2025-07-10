import { z } from "zod"
import { App } from "../app/app"
import DESCRIPTION from "./bash.txt"
import { Tool } from "./tool"

const MAX_OUTPUT_LENGTH = 30000
const BANNED_COMMANDS = [
  "alias",
  "curl",
  "curlie",
  "wget",
  "axel",
  "aria2c",
  "nc",
  "netcat",
  "telnet",
  "lynx",
  "w3m",
  "links",
  "httpie",
  "xh",
  "http-prompt",
  "chrome",
  "firefox",
  "safari",
  "ssh",
  "scp",
  "rsync",
  "ftp",
  "sftp",
]

// Additional security patterns to block
const DANGEROUS_PATTERNS = [
  /\$\(/,           // Command substitution $(...)
  /`/,              // Command substitution `...`
  /\|/,             // Pipe operator
  /&&/,             // Command chaining
  /\|\|/,           // Command chaining
  /;/,              // Command separator
  />/,              // Output redirection
  /</,              // Input redirection
  /\*/,             // Wildcard expansion
  /\?/,             // Wildcard expansion
  /\[/,             // Wildcard expansion
  /~/,              // Home directory expansion
  /\.\./,           // Directory traversal
  /\$\{/,           // Variable expansion
  /\$[A-Za-z_]/,    // Environment variable injection
  /<<[-\s]?\w+/,    // Here-document
  /<<<\s*/,         // Here-string
  /\$\(\(/,         // Arithmetic expansion
  /\$\[\[/,         // Alternative arithmetic expansion
  /<\(/,            // Process substitution
  />\(/,            // Process substitution
  /\|&/,            // Pipe both stdout and stderr
  /&>/,             // Redirect both stdout and stderr
  />&/,             // Duplicate file descriptor
  /<&/,             // Read from file descriptor
  /\{[^}]*\.\.[^}]*\}/, // Brace expansion with ranges
  /eval\s+/i,       // eval command
  /exec\s+/i,       // exec command
  /source\s+/i,     // source command
  /\.\s+\//,        // source with dot command
  /\\x[0-9a-fA-F]{2}/, // Hex escape sequences
  /\\[0-7]{3}/,     // Octal escape sequences
]
const DEFAULT_TIMEOUT = 1 * 60 * 1000
const MAX_TIMEOUT = 10 * 60 * 1000

export const BashTool = Tool.define({
  id: "bash",
  description: DESCRIPTION,
  parameters: z.object({
    command: z.string().describe("The command to execute"),
    timeout: z
      .number()
      .min(0)
      .max(MAX_TIMEOUT)
      .describe("Optional timeout in milliseconds")
      .optional(),
    description: z
      .string()
      .describe(
        "Clear, concise description of what this command does in 5-10 words. Examples:\nInput: ls\nOutput: Lists files in current directory\n\nInput: git status\nOutput: Shows working tree status\n\nInput: npm install\nOutput: Installs package dependencies\n\nInput: mkdir foo\nOutput: Creates directory 'foo'",
      ),
  }),
  required: ["command", "description"],
  async execute(params, ctx) {
    const timeout = Math.min(params.timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT)
    
    // Enhanced security validation
    const command = params.command.trim()
    
    // Check against banned commands
    const firstWord = command.split(/\s+/)[0]
    if (BANNED_COMMANDS.includes(firstWord)) {
      throw new Error(`Command '${firstWord}' is not allowed`)
    }
    
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        throw new Error(`Command contains dangerous pattern: ${pattern.source}`)
      }
    }
    
    // Additional validation: ensure command doesn't start with special characters
    if (/^[^a-zA-Z0-9/]/.test(command)) {
      throw new Error("Command must start with a letter, number, or '/'")
    }
    
    // Validate for newlines and null bytes
    if (/[\n\r\0]/.test(command)) {
      throw new Error("Command cannot contain newlines or null bytes")
    }
    
    // Check for unicode direction override characters
    if (/[\u202A-\u202E\u2066-\u2069]/.test(command)) {
      throw new Error("Command contains dangerous unicode characters")
    }
    
    // Validate command length
    if (command.length > 1000) {
      throw new Error("Command is too long (max 1000 characters)")
    }

    const process = Bun.spawn({
      cmd: ["bash", "-c", command],
      cwd: App.info().path.cwd,
      maxBuffer: MAX_OUTPUT_LENGTH,
      signal: ctx.abort,
      timeout: timeout,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        // Disable shell expansion features
        POSIXLY_CORRECT: "1",
      },
    })
    await process.exited
    const stdout = await new Response(process.stdout).text()
    const stderr = await new Response(process.stderr).text()

    return {
      metadata: {
        stderr,
        stdout,
        exit: process.exitCode,
        description: params.description,
        title: params.command,
      },
      output: [
        `<stdout>`,
        stdout ?? "",
        `</stdout>`,
        `<stderr>`,
        stderr ?? "",
        `</stderr>`,
      ].join("\n"),
    }
  },
})
