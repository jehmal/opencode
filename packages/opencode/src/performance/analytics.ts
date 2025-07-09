/**
 * Analytics engine for performance data analysis
 */

import { MetricsCollector } from "./metrics-collector"
import { UsagePatternTracker } from "./usage-patterns"
import type { AnalyticsData, ToolExecutionMetrics } from "./types"

/**
 * Analyzes performance data and generates insights
 */
export class PerformanceAnalytics {
  private static analyticsCache = new Map<string, AnalyticsData>()
  private static cacheTimeout = 5 * 60 * 1000 // 5 minutes

  /**
   * Generate comprehensive analytics for a session
   */
  static async generateAnalytics(
    sessionId: string,
    forceRefresh: boolean = false,
  ): Promise<AnalyticsData> {
    // Check cache
    if (!forceRefresh) {
      const cached = this.analyticsCache.get(sessionId)
      if (cached && Date.now() - cached.period.end < this.cacheTimeout) {
        return cached
      }
    }

    const metrics = MetricsCollector.getSessionMetrics(sessionId)
    if (metrics.length === 0) {
      return this.createEmptyAnalytics(sessionId)
    }

    const analytics = this.computeAnalytics(sessionId, metrics)

    // Cache the results
    this.analyticsCache.set(sessionId, analytics)

    // Clean old cache entries
    this.cleanCache()

    return analytics
  }

  /**
   * Compute analytics from metrics
   */
  private static computeAnalytics(
    sessionId: string,
    metrics: ToolExecutionMetrics[],
  ): AnalyticsData {
    const startTime = Math.min(...metrics.map((m) => m.startTime))
    const endTime = Math.max(...metrics.map((m) => m.endTime || m.startTime))

    // Group by tool
    const toolGroups = new Map<string, ToolExecutionMetrics[]>()
    metrics.forEach((metric) => {
      const group = toolGroups.get(metric.toolId) || []
      group.push(metric)
      toolGroups.set(metric.toolId, group)
    })

    // Calculate tool usage stats
    const toolUsage: AnalyticsData["toolUsage"] = {}
    toolGroups.forEach((toolMetrics, toolId) => {
      const durations = toolMetrics
        .filter((m) => m.duration !== undefined)
        .map((m) => m.duration!)
        .sort((a, b) => a - b)

      const successCount = toolMetrics.filter((m) => m.success).length
      const totalDuration = durations.reduce((sum, d) => sum + d, 0)

      toolUsage[toolId] = {
        count: toolMetrics.length,
        totalDuration,
        averageDuration:
          durations.length > 0 ? totalDuration / durations.length : 0,
        successRate: successCount / toolMetrics.length,
        errorRate: 1 - successCount / toolMetrics.length,
        p50: this.getPercentile(durations, 50),
        p95: this.getPercentile(durations, 95),
        p99: this.getPercentile(durations, 99),
      }
    })

    // Get pattern analytics
    const patterns = UsagePatternTracker.getMostCommonPatterns(10)
    const errorPatterns = this.analyzeErrorPatterns(metrics)

    // Calculate overall performance
    const totalDuration = metrics.reduce((sum, m) => sum + (m.duration || 0), 0)

    const peakMemory = Math.max(...metrics.map((m) => m.memoryUsed || 0))
    const timeSpan = (endTime - startTime) / 1000 // seconds

    return {
      sessionId,
      period: {
        start: startTime,
        end: endTime,
      },
      toolUsage,
      patterns: {
        mostCommonSequences: patterns.map((p) => ({
          sequence: p.sequence,
          count: p.count,
          averageDuration: p.averagePerformance.duration,
        })),
        errorPatterns,
      },
      performance: {
        totalOperations: metrics.length,
        totalDuration,
        averageOperationTime:
          metrics.length > 0 ? totalDuration / metrics.length : 0,
        peakMemoryUsage: peakMemory,
        throughput: timeSpan > 0 ? metrics.length / timeSpan : 0,
      },
    }
  }

  /**
   * Analyze error patterns
   */
  private static analyzeErrorPatterns(
    metrics: ToolExecutionMetrics[],
  ): AnalyticsData["patterns"]["errorPatterns"] {
    const errorMetrics = metrics.filter((m) => !m.success)
    const errorGroups = new Map<
      string,
      {
        tool: string
        errors: string[]
        contexts: string[][]
      }
    >()

    errorMetrics.forEach((metric, index) => {
      const errorType = metric.error || "Unknown error"
      const key = `${metric.toolId}-${errorType}`

      const group = errorGroups.get(key) || {
        tool: metric.toolId,
        errors: [],
        contexts: [],
      }

      group.errors.push(errorType)

      // Get context (previous 3 tools)
      const contextStart = Math.max(0, index - 3)
      const context = metrics.slice(contextStart, index).map((m) => m.toolId)

      group.contexts.push(context)
      errorGroups.set(key, group)
    })

    return Array.from(errorGroups.entries()).map(([_, group]) => ({
      tool: group.tool,
      errorType: group.errors[0], // Most common error
      count: group.errors.length,
      context: this.findMostCommonContext(group.contexts),
    }))
  }

  /**
   * Find most common context
   */
  private static findMostCommonContext(contexts: string[][]): string[] {
    if (contexts.length === 0) return []

    const contextCounts = new Map<
      string,
      { context: string[]; count: number }
    >()

    contexts.forEach((context) => {
      const key = context.join("->")
      const existing = contextCounts.get(key)
      if (existing) {
        existing.count++
      } else {
        contextCounts.set(key, { context, count: 1 })
      }
    })

    let maxCount = 0
    let mostCommon: string[] = []

    contextCounts.forEach(({ context, count }) => {
      if (count > maxCount) {
        maxCount = count
        mostCommon = context
      }
    })

    return mostCommon
  }

  /**
   * Calculate percentile
   */
  private static getPercentile(
    sortedArray: number[],
    percentile: number,
  ): number {
    if (sortedArray.length === 0) return 0
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
    return sortedArray[Math.max(0, index)]
  }

  /**
   * Create empty analytics
   */
  private static createEmptyAnalytics(sessionId: string): AnalyticsData {
    return {
      sessionId,
      period: {
        start: Date.now(),
        end: Date.now(),
      },
      toolUsage: {},
      patterns: {
        mostCommonSequences: [],
        errorPatterns: [],
      },
      performance: {
        totalOperations: 0,
        totalDuration: 0,
        averageOperationTime: 0,
        peakMemoryUsage: 0,
        throughput: 0,
      },
    }
  }

  /**
   * Clean old cache entries
   */
  private static cleanCache(): void {
    const now = Date.now()
    const entriesToDelete: string[] = []

    this.analyticsCache.forEach((analytics, sessionId) => {
      if (now - analytics.period.end > this.cacheTimeout * 2) {
        entriesToDelete.push(sessionId)
      }
    })

    entriesToDelete.forEach((sessionId) => {
      this.analyticsCache.delete(sessionId)
    })
  }

  /**
   * Get comparative analytics between sessions
   */
  static async compareSessionPerformance(sessionIds: string[]): Promise<{
    sessions: AnalyticsData[]
    comparison: {
      fastestSession: string
      mostEfficientSession: string
      highestThroughput: string
      lowestErrorRate: string
      insights: string[]
    }
  }> {
    const analytics = await Promise.all(
      sessionIds.map((id) => this.generateAnalytics(id)),
    )

    // Find best performers
    let fastestAvg = Infinity
    let fastestSession = ""
    let highestSuccess = 0
    let mostEfficient = ""
    let highestThroughput = 0
    let bestThroughput = ""
    let lowestError = 1
    let bestError = ""

    analytics.forEach((data) => {
      if (data.performance.averageOperationTime < fastestAvg) {
        fastestAvg = data.performance.averageOperationTime
        fastestSession = data.sessionId
      }

      const overallSuccess = this.calculateOverallSuccessRate(data)
      if (overallSuccess > highestSuccess) {
        highestSuccess = overallSuccess
        mostEfficient = data.sessionId
      }

      if (data.performance.throughput > highestThroughput) {
        highestThroughput = data.performance.throughput
        bestThroughput = data.sessionId
      }

      const overallError = 1 - overallSuccess
      if (overallError < lowestError) {
        lowestError = overallError
        bestError = data.sessionId
      }
    })

    // Generate insights
    const insights: string[] = []

    if (fastestSession) {
      insights.push(
        `Session ${fastestSession} has the fastest average operation time (${fastestAvg.toFixed(2)}ms)`,
      )
    }

    if (mostEfficient) {
      insights.push(
        `Session ${mostEfficient} has the highest success rate (${(highestSuccess * 100).toFixed(1)}%)`,
      )
    }

    if (analytics.length > 1) {
      const avgThroughput =
        analytics.reduce((sum, a) => sum + a.performance.throughput, 0) /
        analytics.length
      insights.push(
        `Average throughput across sessions: ${avgThroughput.toFixed(2)} ops/sec`,
      )
    }

    return {
      sessions: analytics,
      comparison: {
        fastestSession,
        mostEfficientSession: mostEfficient,
        highestThroughput: bestThroughput,
        lowestErrorRate: bestError,
        insights,
      },
    }
  }

  /**
   * Calculate overall success rate
   */
  private static calculateOverallSuccessRate(analytics: AnalyticsData): number {
    let totalOps = 0
    let totalSuccess = 0

    Object.values(analytics.toolUsage).forEach((usage) => {
      totalOps += usage.count
      totalSuccess += usage.count * usage.successRate
    })

    return totalOps > 0 ? totalSuccess / totalOps : 0
  }

  /**
   * Export analytics data
   */
  static exportAnalytics(sessionId: string): Promise<AnalyticsData> {
    return this.generateAnalytics(sessionId, true)
  }
}
