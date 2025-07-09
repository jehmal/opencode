/**
 * Integration module for performance tracking system
 * Provides high-level API for tool performance tracking
 */

import { MetricsCollector } from "./metrics-collector"
import { UsagePatternTracker } from "./usage-patterns"
import { PerformanceAnalytics } from "./analytics"
import { PerformanceStorage } from "./storage"
import { trackSelectiveTools } from "./decorators"
import { Config } from "../config/config"
import { Log } from "../util/log"
import { App } from "../app/app"
import type { Tool } from "../tool/tool"
import type { AnalyticsData, PerformanceDecoratorOptions } from "./types"

/**
 * Main integration point for performance tracking
 */
export class PerformanceIntegration {
  private static log = Log.create({ service: "performance-integration" })
  private static initialized = false
  private static analyticsInterval: NodeJS.Timeout | null = null

  /**
   * Initialize performance tracking system
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return

    const config = await Config.get()
    if (!config.performance?.enabled) {
      this.log.info("Performance tracking is disabled")
      return
    }

    // Set up periodic analytics generation (every 5 minutes by default)
    const interval = 5 * 60 * 1000 // 5 minutes
    this.analyticsInterval = setInterval(
      () => this.runPeriodicAnalytics(),
      interval,
    )

    // Register cleanup handler using App.state
    const cleanupState = App.state(
      "performance-integration",
      () => ({ initialized: true }),
      async () => {
        await this.shutdown()
      },
    )
    cleanupState() // Initialize the state

    this.initialized = true
    this.log.info("Performance tracking initialized")
  }

  /**
   * Shutdown performance tracking
   */
  static async shutdown(): Promise<void> {
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval)
      this.analyticsInterval = null
    }

    // Save all pending data
    const sessions = await PerformanceStorage.listSessions()
    await Promise.all(
      sessions.map((sessionId) =>
        PerformanceStorage.saveSessionData(sessionId),
      ),
    )

    this.initialized = false
    this.log.info("Performance tracking shutdown complete")
  }

  /**
   * Wrap tools with performance tracking
   */
  static async wrapTools(tools: Tool.Info[]): Promise<Tool.Info[]> {
    const config = await Config.get()
    if (!config?.performance?.enabled) {
      return tools
    }

    // Selective tracking based on tool configuration
    return trackSelectiveTools(tools, (toolId) => {
      // You can customize which tools to track here
      const highFrequencyTools = ["ls", "read", "grep"]

      if (highFrequencyTools.includes(toolId)) {
        // Sample high-frequency tools
        return {
          sampleRate: 0.1, // 10% sampling
          trackMemory: false,
          trackInputOutput: false,
        } as PerformanceDecoratorOptions
      }

      // Track all other tools
      return {
        trackMemory: true,
        trackInputOutput: true,
      } as PerformanceDecoratorOptions
    })
  }

  /**
   * Get performance report for a session
   */
  static async getSessionReport(sessionId: string): Promise<{
    metrics: ReturnType<typeof MetricsCollector.exportMetrics>
    patterns: ReturnType<typeof UsagePatternTracker.exportPatterns>
    analytics: AnalyticsData
  }> {
    // Analyze patterns
    UsagePatternTracker.analyzePatterns(sessionId)

    // Generate analytics
    const analytics = await PerformanceAnalytics.generateAnalytics(sessionId)

    return {
      metrics: MetricsCollector.exportMetrics(),
      patterns: UsagePatternTracker.exportPatterns(),
      analytics,
    }
  }

  /**
   * Run periodic analytics
   */
  private static async runPeriodicAnalytics(): Promise<void> {
    try {
      const sessions = await PerformanceStorage.listSessions()

      for (const sessionId of sessions) {
        // Generate and save analytics
        const analytics =
          await PerformanceAnalytics.generateAnalytics(sessionId)
        await PerformanceStorage.saveAnalytics(analytics)

        // Analyze and save patterns
        UsagePatternTracker.analyzePatterns(sessionId)
        await PerformanceStorage.savePatterns(sessionId)
      }

      // Clean up old data
      await PerformanceStorage.cleanup()

      this.log.info("Periodic analytics completed", {
        sessionCount: sessions.length,
      })
    } catch (error) {
      this.log.error("Failed to run periodic analytics", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Get tool recommendations based on usage patterns
   */
  static getToolRecommendations(currentSequence: string[]): {
    nextTools: ReturnType<typeof UsagePatternTracker.predictNextTools>
    similarPatterns: ReturnType<typeof UsagePatternTracker.findSimilarPatterns>
    errorProneWarnings: string[]
  } {
    const nextTools = UsagePatternTracker.predictNextTools(currentSequence)
    const similarPatterns =
      UsagePatternTracker.findSimilarPatterns(currentSequence)

    // Check for error-prone patterns
    const errorPatterns = UsagePatternTracker.getErrorPronePatterns()
    const warnings: string[] = []

    errorPatterns.forEach((pattern) => {
      if (this.isSubsequence(currentSequence, pattern.sequence)) {
        warnings.push(
          `Warning: This sequence has a ${(pattern.errorRate * 100).toFixed(1)}% error rate`,
        )
      }
    })

    return {
      nextTools,
      similarPatterns,
      errorProneWarnings: warnings,
    }
  }

  /**
   * Check if one sequence is a subsequence of another
   */
  private static isSubsequence(sub: string[], full: string[]): boolean {
    if (sub.length > full.length) return false

    for (let i = 0; i <= full.length - sub.length; i++) {
      let match = true
      for (let j = 0; j < sub.length; j++) {
        if (full[i + j] !== sub[j]) {
          match = false
          break
        }
      }
      if (match) return true
    }

    return false
  }

  /**
   * Export all performance data
   */
  static async exportAllData(): Promise<
    ReturnType<typeof PerformanceStorage.exportAll>
  > {
    return PerformanceStorage.exportAll()
  }

  /**
   * Import performance data
   */
  static async importData(
    data: Parameters<typeof PerformanceStorage.importData>[0],
  ): Promise<void> {
    return PerformanceStorage.importData(data)
  }

  /**
   * Get performance insights
   */
  static async getInsights(sessionIds?: string[]): Promise<{
    topTools: Array<{ tool: string; usage: number; avgDuration: number }>
    bottlenecks: Array<{ tool: string; avgDuration: number; p95: number }>
    errorProne: Array<{ tool: string; errorRate: number }>
    recommendations: string[]
  }> {
    const sessions = sessionIds || (await PerformanceStorage.listSessions())
    const allMetrics = MetricsCollector.getAllMetrics()

    // Analyze tool usage
    const toolStats = new Map<
      string,
      {
        count: number
        totalDuration: number
        errors: number
        p95Times: number[]
      }
    >()

    allMetrics.forEach((metric) => {
      if (!sessions.includes(metric.sessionId)) return

      const stats = toolStats.get(metric.toolId) || {
        count: 0,
        totalDuration: 0,
        errors: 0,
        p95Times: [],
      }

      stats.count++
      stats.totalDuration += metric.duration || 0
      if (!metric.success) stats.errors++
      if (metric.duration) stats.p95Times.push(metric.duration)

      toolStats.set(metric.toolId, stats)
    })

    // Calculate insights
    const topTools = Array.from(toolStats.entries())
      .map(([tool, stats]) => ({
        tool,
        usage: stats.count,
        avgDuration: stats.totalDuration / stats.count,
      }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10)

    const bottlenecks = Array.from(toolStats.entries())
      .map(([tool, stats]) => {
        const sorted = stats.p95Times.sort((a, b) => a - b)
        const p95Index = Math.floor(sorted.length * 0.95)
        return {
          tool,
          avgDuration: stats.totalDuration / stats.count,
          p95: sorted[p95Index] || 0,
        }
      })
      .filter((t) => t.avgDuration > 1000) // Tools taking >1s on average
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10)

    const errorProne = Array.from(toolStats.entries())
      .map(([tool, stats]) => ({
        tool,
        errorRate: stats.errors / stats.count,
      }))
      .filter((t) => t.errorRate > 0.05) // >5% error rate
      .sort((a, b) => b.errorRate - a.errorRate)

    // Generate recommendations
    const recommendations: string[] = []

    if (bottlenecks.length > 0) {
      recommendations.push(
        `Consider optimizing ${bottlenecks[0].tool} - it's taking ${bottlenecks[0].avgDuration.toFixed(0)}ms on average`,
      )
    }

    if (errorProne.length > 0) {
      recommendations.push(
        `${errorProne[0].tool} has a ${(errorProne[0].errorRate * 100).toFixed(1)}% error rate - investigate common failure patterns`,
      )
    }

    const patterns = UsagePatternTracker.getMostCommonPatterns(5)
    if (patterns.length > 0) {
      recommendations.push(
        `Most common workflow: ${patterns[0].sequence.join(" → ")}`,
      )
    }

    return {
      topTools,
      bottlenecks,
      errorProne,
      recommendations,
    }
  }
}
