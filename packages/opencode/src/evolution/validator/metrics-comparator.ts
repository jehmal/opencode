/**
 * Metrics Comparator for Performance Validation
 * Performs statistical analysis and comparison of benchmark results
 */

import type {
  BenchmarkResults,
  MetricsComparison,
  PerformanceComparison,
  MemoryComparison,
  ReliabilityComparison,
  OverallAssessment,
} from "./performance-validator"

export class MetricsComparator {
  compare(
    baseline: BenchmarkResults,
    evolved: BenchmarkResults,
  ): MetricsComparison {
    const comparison: MetricsComparison = {
      performance: this.comparePerformance(baseline, evolved),
      memory: this.compareMemory(baseline, evolved),
      reliability: this.compareReliability(baseline, evolved),
      overall: {
        improved: false,
        degraded: false,
        neutral: false,
        confidence: 0,
      },
    }

    // Calculate overall assessment
    comparison.overall = this.calculateOverallAssessment(comparison)

    return comparison
  }

  private comparePerformance(
    baseline: BenchmarkResults,
    evolved: BenchmarkResults,
  ): PerformanceComparison {
    const baselineOps = baseline.aggregated.meanOpsPerSecond
    const evolvedOps = evolved.aggregated.meanOpsPerSecond

    const improvement = ((evolvedOps - baselineOps) / baselineOps) * 100
    const pValue = this.calculatePValue(
      baseline.runs.map((r) => r.opsPerSecond),
      evolved.runs.map((r) => r.opsPerSecond),
    )

    return {
      baselineOps,
      evolvedOps,
      improvement,
      significant: pValue < 0.05,
      pValue,
      confidence: this.calculateConfidence(baseline.runs, evolved.runs),
    }
  }

  private compareMemory(
    baseline: BenchmarkResults,
    evolved: BenchmarkResults,
  ): MemoryComparison {
    const baselineMemory = baseline.aggregated.meanMemory
    const evolvedMemory = evolved.aggregated.meanMemory

    const increase = ((evolvedMemory - baselineMemory) / baselineMemory) * 100
    const leakDetected = this.detectMemoryLeak(evolved.runs)

    return {
      baselineMemory,
      evolvedMemory,
      increase,
      leakDetected,
      confidence: this.calculateMemoryConfidence(baseline.runs, evolved.runs),
    }
  }

  private compareReliability(
    baseline: BenchmarkResults,
    evolved: BenchmarkResults,
  ): ReliabilityComparison {
    const baselineErrorRate = baseline.aggregated.errorRate
    const evolvedErrorRate = evolved.aggregated.errorRate

    const errorRateChange = evolvedErrorRate - baselineErrorRate
    const newErrorTypes = this.findNewErrorTypes(baseline.runs, evolved.runs)

    return {
      baselineErrorRate,
      evolvedErrorRate,
      errorRateChange,
      newErrorTypes,
      confidence: this.calculateReliabilityConfidence(
        baseline.runs,
        evolved.runs,
      ),
    }
  }

  private calculatePValue(baseline: number[], evolved: number[]): number {
    // Welch's t-test for unequal variances
    const n1 = baseline.length
    const n2 = evolved.length

    if (n1 < 2 || n2 < 2) return 1 // Not enough data

    const mean1 = baseline.reduce((a, b) => a + b, 0) / n1
    const mean2 = evolved.reduce((a, b) => a + b, 0) / n2

    const var1 =
      baseline.reduce((a, b) => a + Math.pow(b - mean1, 2), 0) / (n1 - 1)
    const var2 =
      evolved.reduce((a, b) => a + Math.pow(b - mean2, 2), 0) / (n2 - 1)

    const t = (mean2 - mean1) / Math.sqrt(var1 / n1 + var2 / n2)
    const df =
      Math.pow(var1 / n1 + var2 / n2, 2) /
      (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1))

    // Approximate p-value using normal distribution
    return this.approximatePValue(t, df)
  }

  private approximatePValue(t: number, df: number): number {
    // Simplified p-value approximation
    // In production, use a proper statistical library
    const absT = Math.abs(t)

    // Very rough approximation using normal distribution
    if (df > 30) {
      // For large df, t-distribution approaches normal
      if (absT > 3.291) return 0.001
      if (absT > 2.576) return 0.01
      if (absT > 1.96) return 0.05
      if (absT > 1.645) return 0.1
      return 0.5
    } else {
      // For smaller df, be more conservative
      if (absT > 4) return 0.001
      if (absT > 3) return 0.01
      if (absT > 2.5) return 0.05
      if (absT > 2) return 0.1
      return 0.5
    }
  }

  private calculateConfidence(baseline: any[], evolved: any[]): number {
    // Calculate confidence based on sample size and variance
    const n1 = baseline.length
    const n2 = evolved.length

    // Base confidence on sample size
    const sampleSizeConfidence = Math.min(n1, n2) / 30 // 30 samples = 100% confidence

    // Adjust for variance
    const values1 = baseline.map((r) => r.opsPerSecond)
    const values2 = evolved.map((r) => r.opsPerSecond)

    const cv1 = this.coefficientOfVariation(values1)
    const cv2 = this.coefficientOfVariation(values2)

    // Lower confidence if high variance
    const varianceAdjustment = 1 - Math.max(cv1, cv2) / 100

    return Math.min(1, sampleSizeConfidence * varianceAdjustment)
  }

  private coefficientOfVariation(values: number[]): number {
    if (values.length === 0) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    if (mean === 0) return 0

    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)

    return (stdDev / mean) * 100
  }

  private detectMemoryLeak(runs: any[]): boolean {
    // Check if memory usage increases over time
    const memoryValues = runs.map((r) => r.memoryUsed)

    if (memoryValues.length < 5) return false

    // Calculate linear regression slope
    const n = memoryValues.length
    const sumX = (n * (n + 1)) / 2
    const sumY = memoryValues.reduce((a, b) => a + b, 0)
    const sumXY = memoryValues.reduce((sum, y, i) => sum + (i + 1) * y, 0)
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    // If slope is positive and significant, likely a memory leak
    const avgMemory = sumY / n
    const slopePercentage = (slope / avgMemory) * 100

    return slopePercentage > 1 // 1% increase per iteration suggests leak
  }

  private calculateMemoryConfidence(baseline: any[], evolved: any[]): number {
    // Similar to performance confidence but for memory metrics
    const n1 = baseline.length
    const n2 = evolved.length

    const sampleSizeConfidence = Math.min(n1, n2) / 20

    const values1 = baseline.map((r) => r.memoryUsed)
    const values2 = evolved.map((r) => r.memoryUsed)

    const cv1 = this.coefficientOfVariation(values1)
    const cv2 = this.coefficientOfVariation(values2)

    const varianceAdjustment = 1 - Math.max(cv1, cv2) / 50

    return Math.min(1, sampleSizeConfidence * varianceAdjustment)
  }

  private findNewErrorTypes(baseline: any[], evolved: any[]): string[] {
    const baselineErrors = new Set<string>()
    const evolvedErrors = new Set<string>()

    baseline.forEach((run) => {
      if (run.errors) {
        run.errors.forEach((error: Error) => {
          baselineErrors.add(error.constructor.name)
        })
      }
    })

    evolved.forEach((run) => {
      if (run.errors) {
        run.errors.forEach((error: Error) => {
          evolvedErrors.add(error.constructor.name)
        })
      }
    })

    // Find errors that appear in evolved but not baseline
    const newErrors: string[] = []
    evolvedErrors.forEach((errorType) => {
      if (!baselineErrors.has(errorType)) {
        newErrors.push(errorType)
      }
    })

    return newErrors
  }

  private calculateReliabilityConfidence(
    baseline: any[],
    evolved: any[],
  ): number {
    // Confidence based on number of test runs and consistency
    const totalRuns = baseline.length + evolved.length
    const runConfidence = Math.min(1, totalRuns / 100)

    // Check consistency of error rates
    const baselineErrorRates = this.calculateErrorRatesByBatch(baseline)
    const evolvedErrorRates = this.calculateErrorRatesByBatch(evolved)

    const baselineCV = this.coefficientOfVariation(baselineErrorRates)
    const evolvedCV = this.coefficientOfVariation(evolvedErrorRates)

    const consistencyConfidence = 1 - Math.max(baselineCV, evolvedCV) / 100

    return runConfidence * consistencyConfidence
  }

  private calculateErrorRatesByBatch(
    runs: any[],
    batchSize: number = 10,
  ): number[] {
    const errorRates: number[] = []

    for (let i = 0; i < runs.length; i += batchSize) {
      const batch = runs.slice(i, i + batchSize)
      const errors = batch.filter((r) => r.errors && r.errors.length > 0).length
      errorRates.push(errors / batch.length)
    }

    return errorRates
  }

  private calculateOverallAssessment(
    comparison: MetricsComparison,
  ): OverallAssessment {
    const perf = comparison.performance
    const mem = comparison.memory
    const rel = comparison.reliability

    // Calculate weighted scores
    const perfScore = perf.improvement * (perf.significant ? 1 : 0.5)
    const memScore = -mem.increase * (mem.leakDetected ? 2 : 1)
    const relScore = -rel.errorRateChange * 10 // Heavily weight reliability

    const totalScore = perfScore + memScore + relScore

    // Calculate overall confidence
    const overallConfidence =
      (perf.confidence + mem.confidence + rel.confidence) / 3

    return {
      improved: totalScore > 5 && perf.significant,
      degraded: totalScore < -2 || mem.leakDetected || rel.errorRateChange > 0,
      neutral: Math.abs(totalScore) <= 5 && !perf.significant,
      confidence: overallConfidence,
    }
  }
}
