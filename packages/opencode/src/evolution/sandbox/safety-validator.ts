/**
 * Safety Validator - Multi-layer Safety Checks
 * Agent: safe-evolution-sandbox-003
 * Purpose: Validates evolved code for safety before deployment
 */

import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SecurityPolicy,
  CodeLocation,
} from "./types"
import { Logger } from "./logger"
import { CodeIsolator } from "./code-isolator"

export class SafetyValidator {
  private logger: Logger
  private codeIsolator: CodeIsolator

  // Dangerous patterns that should never appear in evolved code
  private criticalPatterns = [
    /process\.exit/g,
    /process\.kill/g,
    /require\(['"`]child_process['"`]\)/g,
    /\.exec\(/g,
    /\.execSync\(/g,
    /\.spawn\(/g,
    /eval\s*\(/g,
    /new\s+Function\s*\(/g,
    /fs\.rm.*Sync/g,
    /fs\.unlink.*Sync/g,
    /__proto__/g,
    /constructor\s*\[/g,
  ]

  // Suspicious patterns that need review
  private suspiciousPatterns = [
    /setTimeout.*0\s*\)/g, // Immediate timeouts can be used for escaping
    /setInterval.*[0-9]{1,2}\s*\)/g, // Very short intervals
    /while\s*\(\s*true\s*\)/g, // Infinite loops
    /for\s*\(\s*;\s*;\s*\)/g, // Infinite for loops
    /recursion|recursive/gi, // Potential stack overflow
    /\.\.\//g, // Directory traversal
    /process\.env/g, // Environment access
    /require\s*\(/g, // Dynamic requires
  ]

  constructor(private policy: SecurityPolicy) {
    this.logger = new Logger("SafetyValidator")
    this.codeIsolator = new CodeIsolator(policy)
  }

  /**
   * Perform comprehensive safety validation
   */
  async validate(code: string): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    let score = 100

    try {
      // 1. Code size check
      const sizeCheck = this.validateCodeSize(code)
      errors.push(...sizeCheck.errors)
      score -= sizeCheck.errors.length * 10

      // 2. Critical pattern check
      const criticalCheck = this.checkCriticalPatterns(code)
      errors.push(...criticalCheck.errors)
      score -= criticalCheck.errors.length * 25

      // 3. Suspicious pattern check
      const suspiciousCheck = this.checkSuspiciousPatterns(code)
      warnings.push(...suspiciousCheck.warnings)
      score -= suspiciousCheck.warnings.length * 5

      // 4. Complexity analysis
      const complexityCheck = this.analyzeComplexity(code)
      warnings.push(...complexityCheck.warnings)
      score -= complexityCheck.warnings.length * 3

      // 5. Resource usage analysis
      const resourceCheck = this.analyzeResourceUsage(code)
      warnings.push(...resourceCheck.warnings)
      errors.push(...resourceCheck.errors)
      score -= resourceCheck.errors.length * 15

      // 6. Security policy validation
      const policyCheck = await this.codeIsolator.validateCode(code)
      if (!policyCheck.valid) {
        for (const violation of policyCheck.violations) {
          if (
            violation.severity === "critical" ||
            violation.severity === "high"
          ) {
            errors.push({
              code: "SECURITY_VIOLATION",
              message: violation.description,
              severity: "critical",
              location: violation.location,
            })
            score -= 20
          } else {
            warnings.push({
              code: "SECURITY_WARNING",
              message: violation.description,
              suggestion: violation.recommendation,
            })
            score -= 5
          }
        }
      }

      // 7. Syntax validation
      const syntaxCheck = this.validateSyntax(code)
      if (!syntaxCheck.valid) {
        errors.push(...syntaxCheck.errors)
        score = 0 // Invalid syntax = complete failure
      }

      // Ensure score doesn't go below 0
      score = Math.max(0, score)

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        score,
      }
    } catch (error) {
      this.logger.error("Validation failed:", error)
      return {
        valid: false,
        errors: [
          {
            code: "VALIDATION_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Unknown validation error",
            severity: "critical",
          },
        ],
        warnings: [],
        score: 0,
      }
    }
  }

  /**
   * Validate code size
   */
  private validateCodeSize(code: string): { errors: ValidationError[] } {
    const errors: ValidationError[] = []
    const maxSize = this.policy.maxCodeSize

    if (code.length > maxSize) {
      errors.push({
        code: "CODE_TOO_LARGE",
        message: `Code size (${code.length} bytes) exceeds maximum allowed (${maxSize} bytes)`,
        severity: "error",
      })
    }

    // Check line count
    const lines = code.split("\n")
    if (lines.length > 10000) {
      errors.push({
        code: "TOO_MANY_LINES",
        message: `Code has ${lines.length} lines, which may indicate generated or obfuscated code`,
        severity: "error",
      })
    }

    return { errors }
  }

  /**
   * Check for critical security patterns
   */
  private checkCriticalPatterns(code: string): { errors: ValidationError[] } {
    const errors: ValidationError[] = []

    for (const pattern of this.criticalPatterns) {
      const matches = Array.from(code.matchAll(pattern))

      for (const match of matches) {
        const location = this.getCodeLocation(code, match.index!)
        errors.push({
          code: "CRITICAL_PATTERN",
          message: `Critical security pattern detected: ${match[0]}`,
          severity: "critical",
          location,
        })
      }
    }

    return { errors }
  }

  /**
   * Check for suspicious patterns
   */
  private checkSuspiciousPatterns(code: string): {
    warnings: ValidationWarning[]
  } {
    const warnings: ValidationWarning[] = []

    for (const pattern of this.suspiciousPatterns) {
      const matches = Array.from(code.matchAll(pattern))

      for (const match of matches) {
        warnings.push({
          code: "SUSPICIOUS_PATTERN",
          message: `Suspicious pattern detected: ${match[0]}`,
          suggestion:
            "Review this code carefully for potential security issues",
        })
      }
    }

    return { warnings }
  }

  /**
   * Analyze code complexity
   */
  private analyzeComplexity(code: string): { warnings: ValidationWarning[] } {
    const warnings: ValidationWarning[] = []

    // Check cyclomatic complexity (simplified)
    const conditionals = (
      code.match(
        /if\s*\(|else\s*if\s*\(|switch\s*\(|case\s+|while\s*\(|for\s*\(/g,
      ) || []
    ).length

    if (conditionals > 50) {
      warnings.push({
        code: "HIGH_COMPLEXITY",
        message: `High cyclomatic complexity detected (${conditionals} decision points)`,
        suggestion: "Consider refactoring to reduce complexity",
      })
    }

    // Check nesting depth
    const maxNesting = this.calculateMaxNesting(code)
    if (maxNesting > 5) {
      warnings.push({
        code: "DEEP_NESTING",
        message: `Deep nesting detected (${maxNesting} levels)`,
        suggestion: "Refactor to reduce nesting depth",
      })
    }

    return { warnings }
  }

  /**
   * Analyze potential resource usage
   */
  private analyzeResourceUsage(code: string): {
    errors: ValidationError[]
    warnings: ValidationWarning[]
  } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Check for potential memory leaks
    const globalArrays = code.match(/global\.|window\.|globalThis\./g) || []
    if (globalArrays.length > 10) {
      warnings.push({
        code: "POTENTIAL_MEMORY_LEAK",
        message: "Multiple global variable assignments detected",
        suggestion: "Avoid storing data in global scope",
      })
    }

    // Check for large data structures
    const largeArrays = code.match(/new\s+Array\s*\(\s*[0-9]{6,}\s*\)/g) || []
    if (largeArrays.length > 0) {
      errors.push({
        code: "LARGE_ALLOCATION",
        message: "Large array allocation detected",
        severity: "error",
      })
    }

    // Check for potential infinite loops
    if (code.includes("while(true)") || code.includes("for(;;)")) {
      errors.push({
        code: "INFINITE_LOOP",
        message: "Potential infinite loop detected",
        severity: "critical",
      })
    }

    return { errors, warnings }
  }

  /**
   * Validate syntax
   */
  private validateSyntax(code: string): {
    valid: boolean
    errors: ValidationError[]
  } {
    try {
      // Try to parse as a function
      new Function(code)
      return { valid: true, errors: [] }
    } catch (error) {
      const syntaxError = error as SyntaxError
      return {
        valid: false,
        errors: [
          {
            code: "SYNTAX_ERROR",
            message: syntaxError.message,
            severity: "critical",
          },
        ],
      }
    }
  }

  /**
   * Calculate maximum nesting depth
   */
  private calculateMaxNesting(code: string): number {
    let maxDepth = 0
    let currentDepth = 0

    for (const char of code) {
      if (char === "{") {
        currentDepth++
        maxDepth = Math.max(maxDepth, currentDepth)
      } else if (char === "}") {
        currentDepth--
      }
    }

    return maxDepth
  }

  /**
   * Get code location from index
   */
  private getCodeLocation(code: string, index: number): CodeLocation {
    const lines = code.substring(0, index).split("\n")
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    return {
      file: "evolved-code.js",
      line,
      column,
    }
  }
}
