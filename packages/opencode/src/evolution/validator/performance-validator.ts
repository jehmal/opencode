/**
 * Performance Validator for Evolution System
 * Benchmarks code before and after evolution to ensure improvements are real and significant
 */

import { EventEmitter } from "events"
import type { EvolutionResult, EvolutionRequestType } from "../types"
import { BenchmarkRunner } from "./benchmark-runner"
import { MetricsComparator } from "./metrics-comparator"
import { ValidationReportGenerator } from "./validation-report"
import { RegressionDetector } from "./regression-detector"
import { ValidationRulesEngine } from "./validation-rules"

export interface ValidatorConfig {
  sandbox: SandboxConfig
  thresholds?: ValidationThresholds
  benchmarkIterations?: number
  statisticalSignificance?: number
}

export interface SandboxConfig {
  isolationLevel: "process" | "container" | "vm"
  resourceLimits: {
    memory: number
    cpu: number
    timeout: number
  }
}

export interface ValidationThresholds {
  performance: number // Minimum improvement percentage
  memory: number // Maximum memory increase percentage
  errorRate: number // Maximum error rate increase
  variance: number // Maximum variance increase
}

export interface ValidationResult {
  valid: boolean
  report: ValidationReport
  metrics: {
    baseline: BenchmarkResults
    evolved: BenchmarkResults
    comparison: MetricsComparison
  }
  decision: ValidationDecision
}

export interface ValidationReport {
  id: string
  timestamp: number
  evolution: {
    id: string
    type: EvolutionRequestType
    description: string
  }
  summary: string
  details: {
    performance: PerformanceDetails
    memory: MemoryDetails
    reliability: ReliabilityDetails
  }
  recommendations: string[]
  visualizations: Visualizations
}

export interface BenchmarkResults {
  timestamp: number
  runs: BenchmarkRun[]
  aggregated: AggregatedMetrics
}

export interface BenchmarkRun {
  name: string
  iteration: number
  duration: number
  opsPerSecond: number
  memoryUsed: number
  cpuUsage: number
  errors?: Error[]
}

export interface AggregatedMetrics {
  meanOpsPerSecond: number
  medianOpsPerSecond: number
  stdDevOpsPerSecond: number
  p95OpsPerSecond: number
  p99OpsPerSecond: number
  meanMemory: number
  peakMemory: number
  errorRate: number
}

export interface MetricsComparison {
  performance: PerformanceComparison
  memory: MemoryComparison
  reliability: ReliabilityComparison
  overall: OverallAssessment
}

export interface PerformanceComparison {
  baselineOps: number
  evolvedOps: number
  improvement: number
  significant: boolean
  pValue: number
  confidence: number
}

export interface MemoryComparison {
  baselineMemory: number
  evolvedMemory: number
  increase: number
  leakDetected: boolean
  confidence: number
}

export interface ReliabilityComparison {
  baselineErrorRate: number
  evolvedErrorRate: number
  errorRateChange: number
  newErrorTypes: string[]
  confidence: number
}

export interface OverallAssessment {
  improved: boolean
  degraded: boolean
  neutral: boolean
  confidence: number
}

export interface ValidationDecision {
  approved: boolean
  failures: ValidationFailure[]
  score: number
  recommendation: string
}

export interface ValidationFailure {
  rule: string
  message: string
  severity: "low" | "medium" | "high"
}

export interface PerformanceDetails {
  improvementPercentage: number
  absoluteImprovement: number
  statisticalSignificance: string
  performanceChart: string
}

export interface MemoryDetails {
  changePercentage: number
  absoluteChange: number
  leakAnalysis: string
  memoryChart: string
}

export interface ReliabilityDetails {
  errorRateChange: number
  newErrors: string[]
  stabilityScore: number
  reliabilityChart: string
}

export interface Visualizations {
  performanceChart: string
  memoryChart: string
  distributionPlot: string
  comparisonTable: string
}

export class PerformanceValidator extends EventEmitter {
  private benchmarkRunner: BenchmarkRunner
  private metricsComparator: MetricsComparator
  private reportGenerator: ValidationReportGenerator
  private regressionDetector: RegressionDetector
  private rulesEngine: ValidationRulesEngine
  private validationThresholds: ValidationThresholds

  constructor(config: ValidatorConfig) {
    super()
    this.benchmarkRunner = new BenchmarkRunner(config.sandbox)
    this.metricsComparator = new MetricsComparator()
    this.reportGenerator = new ValidationReportGenerator()
    this.regressionDetector = new RegressionDetector(config.thresholds)
    this.rulesEngine = new ValidationRulesEngine()
    this.validationThresholds = config.thresholds || this.getDefaultThresholds()
  }

  async validateEvolution(
    evolution: EvolutionResult,
  ): Promise<ValidationResult> {
    this.emit("validation-started", { evolutionId: evolution.id })

    try {
      // 1. Benchmark baseline (before evolution)
      const baselineMetrics = await this.benchmarkBaseline(evolution)

      // 2. Apply evolution in isolated environment
      const evolvedCode = await this.applyEvolutionInSandbox(evolution)

      // 3. Benchmark evolved version
      const evolvedMetrics = await this.benchmarkEvolved(evolution, evolvedCode)

      // 4. Compare metrics
      const comparison = await this.compareMetrics(
        baselineMetrics,
        evolvedMetrics,
      )

      // 5. Check for regressions
      const regressionAnalysis =
        await this.regressionDetector.detectRegressions(comparison)

      // 6. Apply validation rules
      const decision = await this.rulesEngine.validateEvolution(
        evolution,
        comparison,
      )

      // 7. Generate validation report
      const report = await this.reportGenerator.generateReport(
        evolution,
        comparison,
        decision,
      )

      // 8. Emit validation completed event
      this.emit("validation-completed", {
        evolutionId: evolution.id,
        valid: decision.approved,
        score: decision.score,
      })

      return {
        valid: decision.approved,
        report,
        metrics: {
          baseline: baselineMetrics,
          evolved: evolvedMetrics,
          comparison,
        },
        decision,
      }
    } catch (error) {
      this.emit("validation-failed", { evolutionId: evolution.id, error })
      throw error
    }
  }

  private async benchmarkBaseline(
    evolution: EvolutionResult,
  ): Promise<BenchmarkResults> {
    this.emit("benchmark-started", {
      type: "baseline",
      evolutionId: evolution.id,
    })

    const originalCode = evolution.changes
      .map((c) => c.originalContent)
      .join("\n")
    const results = await this.benchmarkRunner.runBenchmarks(
      originalCode,
      evolution.hypothesis.type,
    )

    this.emit("benchmark-completed", { type: "baseline", results })
    return results
  }

  private async applyEvolutionInSandbox(
    evolution: EvolutionResult,
  ): Promise<string> {
    // Apply changes to create evolved version
    const evolvedCode = evolution.changes
      .map((c) => c.evolvedContent)
      .join("\n")
    return evolvedCode
  }

  private async benchmarkEvolved(
    evolution: EvolutionResult,
    evolvedCode: string,
  ): Promise<BenchmarkResults> {
    this.emit("benchmark-started", {
      type: "evolved",
      evolutionId: evolution.id,
    })

    const results = await this.benchmarkRunner.runBenchmarks(
      evolvedCode,
      evolution.hypothesis.type,
    )

    this.emit("benchmark-completed", { type: "evolved", results })
    return results
  }

  private async compareMetrics(
    baseline: BenchmarkResults,
    evolved: BenchmarkResults,
  ): Promise<MetricsComparison> {
    return this.metricsComparator.compare(baseline, evolved)
  }

  private getDefaultThresholds(): ValidationThresholds {
    return {
      performance: 5, // Require at least 5% improvement
      memory: 10, // Allow up to 10% memory increase
      errorRate: 0, // No error rate increase allowed
      variance: 20, // Allow up to 20% variance increase
    }
  }

  /**
   * Get validation history
   */
  async getValidationHistory(limit: number = 10): Promise<ValidationResult[]> {
    // Implementation would retrieve from storage
    return []
  }

  /**
   * Get validation statistics
   */
  async getValidationStats(): Promise<{
    totalValidations: number
    approvedCount: number
    rejectedCount: number
    averageImprovement: number
    averageValidationTime: number
  }> {
    // Implementation would calculate from history
    return {
      totalValidations: 0,
      approvedCount: 0,
      rejectedCount: 0,
      averageImprovement: 0,
      averageValidationTime: 0,
    }
  }
}
