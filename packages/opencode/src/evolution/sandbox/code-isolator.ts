/**
 * Code Isolator - Safe Code Execution
 * Agent: safe-evolution-sandbox-003
 * Purpose: Isolates and validates code before execution
 */

import * as vm from "vm"
import type { SecurityPolicy, SecurityViolation, CodeLocation } from "./types"
import { SecurityViolationType } from "./types"
import { Logger } from "./logger"

export class CodeIsolator {
  private logger: Logger
  private dangerousFunctions = [
    "eval",
    "Function",
    "require",
    "process.exit",
    "process.kill",
    "child_process",
    "fs.rmSync",
    "fs.unlinkSync",
    "fs.rmdirSync",
  ]

  private dangerousPatterns = [
    /process\s*\.\s*env/g,
    /require\s*\(\s*['"`]child_process['"`]\s*\)/g,
    /require\s*\(\s*['"`]fs['"`]\s*\)/g,
    /global\s*\.\s*process/g,
    /__dirname/g,
    /__filename/g,
    /Buffer\s*\.\s*allocUnsafe/g,
    /eval\s*\(/g,
    /new\s+Function\s*\(/g,
  ]

  constructor(private policy: SecurityPolicy) {
    this.logger = new Logger("CodeIsolator")
  }

  /**
   * Validate code against security policy
   */
  async validateCode(code: string): Promise<{
    valid: boolean
    violations: SecurityViolation[]
  }> {
    const violations: SecurityViolation[] = []

    // Check code size
    if (code.length > this.policy.maxCodeSize) {
      violations.push({
        type: SecurityViolationType.RESOURCE_LIMIT,
        description: `Code size (${code.length} bytes) exceeds maximum allowed (${this.policy.maxCodeSize} bytes)`,
        severity: "high",
        recommendation: "Reduce code size or split into smaller modules",
      })
    }

    // Check for dangerous functions
    for (const func of this.dangerousFunctions) {
      const regex = new RegExp(`\\b${func.replace(".", "\\.")}\\b`, "g")
      const matches = code.matchAll(regex)

      for (const match of matches) {
        const location = this.getCodeLocation(code, match.index!)
        violations.push({
          type: SecurityViolationType.DANGEROUS_FUNCTION,
          description: `Use of dangerous function: ${func}`,
          location,
          severity: "critical",
          recommendation: `Remove or replace usage of ${func}`,
        })
      }
    }

    // Check against blocked patterns
    const allPatterns = [
      ...this.dangerousPatterns,
      ...this.policy.blockedPatterns,
    ]
    for (const pattern of allPatterns) {
      const matches = code.matchAll(pattern)

      for (const match of matches) {
        const location = this.getCodeLocation(code, match.index!)
        violations.push({
          type: SecurityViolationType.BLOCKED_PATTERN,
          description: `Blocked pattern detected: ${match[0]}`,
          location,
          severity: "high",
          recommendation: "Remove or refactor the blocked pattern",
        })
      }
    }

    // Check for network access if not allowed
    if (!this.policy.allowNetwork) {
      const networkPatterns = [
        /require\s*\(\s*['"`]https?['"`]\s*\)/g,
        /require\s*\(\s*['"`]net['"`]\s*\)/g,
        /fetch\s*\(/g,
        /XMLHttpRequest/g,
        /axios/g,
      ]

      for (const pattern of networkPatterns) {
        const matches = code.matchAll(pattern)

        for (const match of matches) {
          const location = this.getCodeLocation(code, match.index!)
          violations.push({
            type: SecurityViolationType.NETWORK_VIOLATION,
            description: `Network access attempted: ${match[0]}`,
            location,
            severity: "high",
            recommendation: "Network access is not allowed in this sandbox",
          })
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    }
  }

  /**
   * Create isolated execution context
   */
  createIsolatedContext(): vm.Context {
    const sandbox = {
      console: {
        log: (...args: any[]) => this.logger.info("Sandbox output:", ...args),
        error: (...args: any[]) => this.logger.error("Sandbox error:", ...args),
        warn: (...args: any[]) => this.logger.warn("Sandbox warning:", ...args),
        info: (...args: any[]) => this.logger.info("Sandbox info:", ...args),
      },
      setTimeout: this.policy.allowedAPIs.includes("setTimeout")
        ? setTimeout
        : undefined,
      setInterval: this.policy.allowedAPIs.includes("setInterval")
        ? setInterval
        : undefined,
      clearTimeout: this.policy.allowedAPIs.includes("clearTimeout")
        ? clearTimeout
        : undefined,
      clearInterval: this.policy.allowedAPIs.includes("clearInterval")
        ? clearInterval
        : undefined,
      Promise: Promise,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Date: Date,
      Math: Math,
      JSON: JSON,
      // Restricted globals
      process: undefined,
      require: undefined,
      __dirname: undefined,
      __filename: undefined,
      module: undefined,
      exports: undefined,
      global: undefined,
      Buffer: undefined,
    }

    // Add allowed modules
    if (this.policy.allowedModules.length > 0) {
      const safeRequire = (moduleName: string) => {
        if (this.policy.allowedModules.includes(moduleName)) {
          // In real implementation, would use a module loader
          // For now, return empty object
          return {}
        }
        throw new Error(`Module '${moduleName}' is not allowed`)
      }

      ;(sandbox as any).require = safeRequire
    }

    return vm.createContext(sandbox)
  }

  /**
   * Execute code in isolated environment
   */
  async executeIsolated(
    code: string,
    context?: vm.Context,
    timeout: number = 5000,
  ): Promise<any> {
    const isolatedContext = context || this.createIsolatedContext()

    try {
      const script = new vm.Script(code, {
        filename: "evolved-code.js",
      })

      return script.runInContext(isolatedContext, {
        timeout,
        breakOnSigint: true,
      })
    } catch (error) {
      this.logger.error("Execution error:", error)
      throw error
    }
  }

  /**
   * Inject dependencies safely
   */
  injectDependencies(code: string, dependencies: Record<string, any>): string {
    const safeDepNames = Object.keys(dependencies).filter((name) =>
      /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name),
    )

    const injectionCode = safeDepNames
      .map((name) => `const ${name} = __injected.${name};`)
      .join("\n")

    return `
(function(__injected) {
  ${injectionCode}
  
  ${code}
})(${JSON.stringify(dependencies)});
    `
  }

  /**
   * Get code location from index
   */
  private getCodeLocation(code: string, index: number): CodeLocation {
    const lines = code.substring(0, index).split("\n")
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    const startLine = Math.max(0, line - 2)
    const endLine = Math.min(code.split("\n").length, line + 2)
    const snippet = code.split("\n").slice(startLine, endLine).join("\n")

    return {
      file: "evolved-code.js",
      line,
      column,
      snippet,
    }
  }
}
