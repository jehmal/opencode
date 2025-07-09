/**
 * Validation Rules Engine
 * Configurable rules for approving or rejecting evolutions
 */

import type { EvolutionResult } from "../types"
import type {
  MetricsComparison,
  ValidationDecision,
} from "./performance-validator"

export interface ValidationRule {
  name: string
  check: (comparison: MetricsComparison) => boolean
  message: string
  severity?: "low" | "medium" | "high"
}

export interface RuleCheckResult {
  rule: string
  passed: boolean
  message: string
  severity: "low" | "medium" | "high"
}

export class ValidationRulesEngine {
  private rules: ValidationRule[] = [
    {
      name: "minimum-improvement",
      check: (c) => c.performance.improvement > 5,
      message: "Evolution must provide at least 5% improvement",
      severity: "medium",
    },
    {
      name: "no-memory-leak",
      check: (c) => c.memory.leakDetected === false,
      message: "Evolution must not introduce memory leaks",
      severity: "high",
    },
    {
      name: "statistical-significance",
      check: (c) => c.performance.pValue < 0.05,
      message: "Performance improvement must be statistically significant",
      severity: "medium",
    },
    {
      name: "no-reliability-regression",
      check: (c) => c.reliability.errorRateChange <= 0,
      message: "Evolution must not increase error rate",
      severity: "high",
    },
    {
      name: "memory-increase-limit",
      check: (c) => c.memory.increase < 20,
      message: "Memory usage must not increase by more than 20%",
      severity: "medium",
    },
    {
      name: "confidence-threshold",
      check: (c) => c.overall.confidence > 0.7,
      message: "Overall confidence must be above 70%",
      severity: "low",
    },
    {
      name: "no-new-error-types",
      check: (c) => c.reliability.newErrorTypes.length === 0,
      message: "Evolution must not introduce new error types",
      severity: "medium",
    },
  ]

  constructor(customRules?: ValidationRule[]) {
    if (customRules) {
      this.rules = [...this.rules, ...customRules]
    }
  }

  async validateEvolution(
    evolution: EvolutionResult,
    comparison: MetricsComparison,
  ): Promise<ValidationDecision> {
    const results = await Promise.all(
      this.rules.map((rule) => this.checkRule(rule, comparison)),
    )

    const failures = results
      .filter((r) => !r.passed)
      .map((r) => ({
        rule: r.rule,
        message: r.message,
        severity: r.severity,
      }))

    return {
      approved: failures.length === 0,
      failures,
      score: this.calculateValidationScore(results),
      recommendation: this.generateRecommendation(results, comparison),
    }
  }

  private async checkRule(
    rule: ValidationRule,
    comparison: MetricsComparison,
  ): Promise<RuleCheckResult> {
    try {
      const passed = rule.check(comparison)
      return {
        rule: rule.name,
        passed,
        message: rule.message,
        severity: rule.severity || "medium",
      }
    } catch (error) {
      // If rule check fails, treat as failed validation
      return {
        rule: rule.name,
        passed: false,
        message: `Rule check error: ${error}`,
        severity: "high",
      }
    }
  }

  private calculateValidationScore(results: RuleCheckResult[]): number {
    if (results.length === 0) return 0

    let totalScore = 0
    let totalWeight = 0

    results.forEach((result) => {
      const weight =
        result.severity === "high" ? 3 : result.severity === "medium" ? 2 : 1

      totalWeight += weight
      if (result.passed) {
        totalScore += weight
      }
    })

    return (totalScore / totalWeight) * 100
  }

  private generateRecommendation(
    results: RuleCheckResult[],
    comparison: MetricsComparison,
  ): string {
    const failures = results.filter((r) => !r.passed)

    if (failures.length === 0) {
      if (comparison.performance.improvement > 20) {
        return "Excellent evolution! Significant improvements with no issues."
      }
      return "Evolution approved. All validation rules passed."
    }

    const highSeverityFailures = failures.filter((f) => f.severity === "high")
    if (highSeverityFailures.length > 0) {
      return `Critical issues found: ${highSeverityFailures[0].message}. Fix before proceeding.`
    }

    const mediumSeverityFailures = failures.filter(
      (f) => f.severity === "medium",
    )
    if (mediumSeverityFailures.length > 0) {
      return `Moderate issues found: ${mediumSeverityFailures[0].message}. Consider addressing.`
    }

    return "Minor issues found. Review and proceed with caution."
  }

  /**
   * Add a custom validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule)
  }

  /**
   * Remove a rule by name
   */
  removeRule(ruleName: string): void {
    this.rules = this.rules.filter((r) => r.name !== ruleName)
  }

  /**
   * Get all active rules
   */
  getRules(): ValidationRule[] {
    return [...this.rules]
  }

  /**
   * Create a strict ruleset for production
   */
  static createStrictRuleset(): ValidationRule[] {
    return [
      {
        name: "minimum-improvement-strict",
        check: (c) => c.performance.improvement > 10,
        message:
          "Evolution must provide at least 10% improvement for production",
        severity: "high",
      },
      {
        name: "no-memory-increase",
        check: (c) => c.memory.increase <= 0,
        message: "Memory usage must not increase in production",
        severity: "high",
      },
      {
        name: "perfect-reliability",
        check: (c) =>
          c.reliability.errorRateChange === 0 &&
          c.reliability.newErrorTypes.length === 0,
        message: "Evolution must maintain perfect reliability for production",
        severity: "high",
      },
      {
        name: "high-confidence",
        check: (c) => c.overall.confidence > 0.9,
        message: "Confidence must be above 90% for production deployment",
        severity: "high",
      },
    ]
  }

  /**
   * Create a lenient ruleset for development
   */
  static createDevelopmentRuleset(): ValidationRule[] {
    return [
      {
        name: "no-major-regression",
        check: (c) => c.performance.improvement > -10,
        message: "Performance regression must not exceed 10%",
        severity: "medium",
      },
      {
        name: "memory-warning",
        check: (c) => c.memory.increase < 50,
        message: "Memory increase should not exceed 50%",
        severity: "low",
      },
      {
        name: "basic-reliability",
        check: (c) => c.reliability.errorRateChange < 0.1,
        message: "Error rate increase should be minimal",
        severity: "low",
      },
    ]
  }
}
