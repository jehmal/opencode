/**
 * Evolution Metrics Collector
 * Tracks and analyzes evolution success rates and improvements
 */

import { Log } from "../../util/log"
import type { EvolutionResult, PerformanceMetrics } from "../types"

const log = Log.create({ service: "evolution-metrics" })

/**
 * Evolution metrics data
 */
export interface EvolutionMetrics {
  id: string
  timestamp: number
  type: string
  status: string
  duration: number
  performance: {
    before: PerformanceMetrics
    after: PerformanceMetrics
    improvement: Record<string, number>
  }
  safety: {
    score: number
    risks: string[]
  }
  impact: {
    filesChanged: number
    linesAdded: number
    linesRemoved: number
    testsAdded: number
  }
  userSatisfaction?: number
}

/**
 * Evolution report
 */
export interface EvolutionReport {
  totalEvolutions: number
  successRate: number
  averageImprovement: Record<string, number>
  topEvolutions: Array<{
    id: string
    type: string
    improvement: number
    description: string
  }>
  riskAnalysis: {
    averageSafetyScore: number
    commonRisks: Array<{ risk: string; frequency: number }>
    failureReasons: Array<{ reason: string; count: number }>
  }
  performanceTrends: {
    improvementOverTime: Array<{ date: string; improvement: number }>
    successRateOverTime: Array<{ date: string; rate: number }>
  }
  recommendations: string[]
}

/**
 * Evolution Metrics Collector
 */
export class EvolutionMetricsCollector {
  private metrics: Map<string, EvolutionMetrics> = new Map()
  private readonly maxMetrics = 1000 // Keep last 1000 evolutions

  /**
   * Collect metrics from an evolution result
   */
  async collectMetrics(result: EvolutionResult): Promise<EvolutionMetrics> {
    const metrics: EvolutionMetrics = {
      id: result.id,
      timestamp: result.timestamp,
      type: result.hypothesis.type,
      status: result.status,
      duration: result.duration,
      performance: {
        before: result.metrics.before,
        after: result.metrics.after,
        improvement: result.metrics.improvement,
      },
      safety: {
        score: this.calculateSafetyScore(result),
        risks: result.hypothesis.risks,
      },
      impact: {
        filesChanged: result.changes.length,
        linesAdded: this.countLinesAdded(result),
        linesRemoved: this.countLinesRemoved(result),
        testsAdded: this.countTestsAdded(result),
      },
    }

    // Store metrics
    this.metrics.set(result.id, metrics)

    // Cleanup old metrics if needed
    if (this.metrics.size > this.maxMetrics) {
      const oldestKey = Array.from(this.metrics.keys())[0]
      this.metrics.delete(oldestKey)
    }

    log.info("Collected evolution metrics", {
      id: result.id,
      type: metrics.type,
      status: metrics.status,
      improvement: this.calculateOverallImprovement(metrics),
    })

    return metrics
  }

  /**
   * Generate a comprehensive report
   */
  async generateReport(): Promise<EvolutionReport> {
    const allMetrics = Array.from(this.metrics.values())

    if (allMetrics.length === 0) {
      return this.createEmptyReport()
    }

    return {
      totalEvolutions: allMetrics.length,
      successRate: this.calculateSuccessRate(allMetrics),
      averageImprovement: this.calculateAverageImprovement(allMetrics),
      topEvolutions: this.getTopEvolutions(allMetrics),
      riskAnalysis: this.analyzeRisks(allMetrics),
      performanceTrends: this.analyzePerformanceTrends(allMetrics),
      recommendations: this.generateRecommendations(allMetrics),
    }
  }

  /**
   * Get metrics for a specific evolution
   */
  getMetrics(evolutionId: string): EvolutionMetrics | undefined {
    return this.metrics.get(evolutionId)
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): EvolutionMetrics[] {
    return Array.from(this.metrics.values())
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear()
    log.info("Cleared all evolution metrics")
  }

  /**
   * Calculate safety score from result
   */
  private calculateSafetyScore(result: EvolutionResult): number {
    let score = 100

    // Deduct for validation failures
    if (!result.validationResults.apiCompatibility) score -= 20
    if (!result.validationResults.backwardCompatibility) score -= 20
    if (!result.validationResults.securityCheck) score -= 30
    if (result.validationResults.performanceRegression) score -= 15

    // Deduct for test failures
    const testPassRate =
      result.testResults.totalTests > 0
        ? result.testResults.passedTests / result.testResults.totalTests
        : 0
    score -= (1 - testPassRate) * 15

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Count lines added
   */
  private countLinesAdded(result: EvolutionResult): number {
    return result.changes.reduce((sum, change) => {
      const added = change.diff
        .split("\n")
        .filter((line) => line.startsWith("+")).length
      return sum + added
    }, 0)
  }

  /**
   * Count lines removed
   */
  private countLinesRemoved(result: EvolutionResult): number {
    return result.changes.reduce((sum, change) => {
      const removed = change.diff
        .split("\n")
        .filter((line) => line.startsWith("-")).length
      return sum + removed
    }, 0)
  }

  /**
   * Count tests added
   */
  private countTestsAdded(result: EvolutionResult): number {
    // Simple heuristic: count test files or test functions added
    return result.changes.filter(
      (change) => change.file.includes("test") || change.file.includes("spec"),
    ).length
  }

  /**
   * Calculate overall improvement
   */
  private calculateOverallImprovement(metrics: EvolutionMetrics): number {
    const improvements = Object.values(metrics.performance.improvement)
    if (improvements.length === 0) return 0

    const sum = improvements.reduce((acc, val) => acc + val, 0)
    return sum / improvements.length
  }

  /**
   * Calculate success rate
   */
  private calculateSuccessRate(metrics: EvolutionMetrics[]): number {
    if (metrics.length === 0) return 0

    const successful = metrics.filter(
      (m) => m.status === "completed" || m.status === "COMPLETED",
    ).length

    return successful / metrics.length
  }

  /**
   * Calculate average improvement
   */
  private calculateAverageImprovement(
    metrics: EvolutionMetrics[],
  ): Record<string, number> {
    const improvements: Record<string, number[]> = {}

    for (const metric of metrics) {
      for (const [key, value] of Object.entries(
        metric.performance.improvement,
      )) {
        if (!improvements[key]) improvements[key] = []
        improvements[key].push(value)
      }
    }

    const averages: Record<string, number> = {}
    for (const [key, values] of Object.entries(improvements)) {
      averages[key] = values.reduce((sum, val) => sum + val, 0) / values.length
    }

    return averages
  }

  /**
   * Get top evolutions by improvement
   */
  private getTopEvolutions(
    metrics: EvolutionMetrics[],
    limit = 5,
  ): Array<{
    id: string
    type: string
    improvement: number
    description: string
  }> {
    return metrics
      .map((m) => ({
        id: m.id,
        type: m.type,
        improvement: this.calculateOverallImprovement(m),
        description: `${m.type} - ${m.impact.filesChanged} files changed`,
      }))
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, limit)
  }

  /**
   * Analyze risks
   */
  private analyzeRisks(metrics: EvolutionMetrics[]): {
    averageSafetyScore: number
    commonRisks: Array<{ risk: string; frequency: number }>
    failureReasons: Array<{ reason: string; count: number }>
  } {
    // Calculate average safety score
    const safetyScores = metrics.map((m) => m.safety.score)
    const averageSafetyScore =
      safetyScores.length > 0
        ? safetyScores.reduce((sum, score) => sum + score, 0) /
          safetyScores.length
        : 0

    // Count common risks
    const riskCounts = new Map<string, number>()
    for (const metric of metrics) {
      for (const risk of metric.safety.risks) {
        riskCounts.set(risk, (riskCounts.get(risk) || 0) + 1)
      }
    }

    const commonRisks = Array.from(riskCounts.entries())
      .map(([risk, frequency]) => ({ risk, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)

    // Count failure reasons
    const failureReasons = metrics
      .filter((m) => m.status === "failed" || m.status === "FAILED")
      .reduce((acc, m) => {
        const reason = m.type // Simplified - could be more detailed
        acc.set(reason, (acc.get(reason) || 0) + 1)
        return acc
      }, new Map<string, number>())

    const failureReasonsList = Array.from(failureReasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)

    return {
      averageSafetyScore,
      commonRisks,
      failureReasons: failureReasonsList,
    }
  }

  /**
   * Analyze performance trends
   */
  private analyzePerformanceTrends(metrics: EvolutionMetrics[]): {
    improvementOverTime: Array<{ date: string; improvement: number }>
    successRateOverTime: Array<{ date: string; rate: number }>
  } {
    // Group by day
    const byDay = new Map<string, EvolutionMetrics[]>()

    for (const metric of metrics) {
      const date = new Date(metric.timestamp).toISOString().split("T")[0]
      if (!byDay.has(date)) byDay.set(date, [])
      byDay.get(date)!.push(metric)
    }

    // Calculate daily averages
    const improvementOverTime: Array<{ date: string; improvement: number }> = []
    const successRateOverTime: Array<{ date: string; rate: number }> = []

    for (const [date, dayMetrics] of byDay) {
      const avgImprovement =
        dayMetrics
          .map((m) => this.calculateOverallImprovement(m))
          .reduce((sum, val) => sum + val, 0) / dayMetrics.length

      const successRate = this.calculateSuccessRate(dayMetrics)

      improvementOverTime.push({ date, improvement: avgImprovement })
      successRateOverTime.push({ date, rate: successRate })
    }

    // Sort by date
    improvementOverTime.sort((a, b) => a.date.localeCompare(b.date))
    successRateOverTime.sort((a, b) => a.date.localeCompare(b.date))

    return {
      improvementOverTime,
      successRateOverTime,
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(metrics: EvolutionMetrics[]): string[] {
    const recommendations: string[] = []

    const successRate = this.calculateSuccessRate(metrics)
    const avgSafetyScore =
      metrics
        .map((m) => m.safety.score)
        .reduce((sum, score) => sum + score, 0) / metrics.length

    // Success rate recommendations
    if (successRate < 0.5) {
      recommendations.push(
        "Success rate is low. Consider reducing evolution complexity.",
      )
    } else if (successRate > 0.9) {
      recommendations.push(
        "High success rate! Consider more ambitious evolutions.",
      )
    }

    // Safety recommendations
    if (avgSafetyScore < 70) {
      recommendations.push(
        "Average safety score is low. Review risk assessment criteria.",
      )
    }

    // Type-specific recommendations
    const typeCounts = new Map<string, number>()
    for (const metric of metrics) {
      typeCounts.set(metric.type, (typeCounts.get(metric.type) || 0) + 1)
    }

    const mostCommonType = Array.from(typeCounts.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0]

    if (mostCommonType) {
      recommendations.push(
        `Most evolutions are ${mostCommonType}. Consider diversifying evolution types.`,
      )
    }

    return recommendations
  }

  /**
   * Create empty report
   */
  private createEmptyReport(): EvolutionReport {
    return {
      totalEvolutions: 0,
      successRate: 0,
      averageImprovement: {},
      topEvolutions: [],
      riskAnalysis: {
        averageSafetyScore: 0,
        commonRisks: [],
        failureReasons: [],
      },
      performanceTrends: {
        improvementOverTime: [],
        successRateOverTime: [],
      },
      recommendations: ["No evolution data available yet."],
    }
  }
}
