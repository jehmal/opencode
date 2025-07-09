/**
 * Storage system for performance data persistence
 */

import { Storage } from "../storage/storage"
import { MetricsCollector } from "./metrics-collector"
import { UsagePatternTracker } from "./usage-patterns"
import { PerformanceAnalytics } from "./analytics"
import { Log } from "../util/log"
import type {
  PerformanceStorageEntry,
  ToolExecutionMetrics,
  UsagePattern,
  AnalyticsData,
} from "./types"

/**
 * Manages storage and retrieval of performance data
 */
export class PerformanceStorage {
  private static log = Log.create({ service: "performance-storage" })
  private static readonly STORAGE_PREFIX = "performance"
  private static readonly METRICS_PATH = `${PerformanceStorage.STORAGE_PREFIX}/metrics`
  private static readonly PATTERNS_PATH = `${PerformanceStorage.STORAGE_PREFIX}/patterns`
  private static readonly ANALYTICS_PATH = `${PerformanceStorage.STORAGE_PREFIX}/analytics`

  /**
   * Save metrics for a session
   */
  static async saveMetrics(sessionId: string): Promise<void> {
    try {
      const metrics = MetricsCollector.getSessionMetrics(sessionId)
      if (metrics.length === 0) return

      const entries: PerformanceStorageEntry[] = metrics.map((metric) => ({
        id: `metric-${metric.sessionId}-${metric.startTime}`,
        sessionId: metric.sessionId,
        timestamp: metric.startTime,
        type: "metric",
        data: metric,
      }))

      await Storage.writeJSON(`${this.METRICS_PATH}/${sessionId}`, entries)

      this.log.info("Saved metrics for session", {
        sessionId,
        count: metrics.length,
      })
    } catch (error) {
      this.log.error("Failed to save metrics", {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Load metrics for a session
   */
  static async loadMetrics(sessionId: string): Promise<ToolExecutionMetrics[]> {
    try {
      const entries = await Storage.readJSON<PerformanceStorageEntry[]>(
        `${this.METRICS_PATH}/${sessionId}`,
      )

      return entries
        .filter((entry) => entry.type === "metric")
        .map((entry) => entry.data as ToolExecutionMetrics)
    } catch {
      return []
    }
  }

  /**
   * Save usage patterns
   */
  static async savePatterns(sessionId: string): Promise<void> {
    try {
      const patterns = UsagePatternTracker.exportPatterns()
      const sessionPatterns = patterns.patterns.filter(
        (p) => p.sessionId === sessionId,
      )

      if (sessionPatterns.length === 0) return

      const entries: PerformanceStorageEntry[] = sessionPatterns.map(
        (pattern) => ({
          id: pattern.id,
          sessionId: pattern.sessionId,
          timestamp: pattern.timestamp,
          type: "pattern",
          data: pattern,
        }),
      )

      await Storage.writeJSON(`${this.PATTERNS_PATH}/${sessionId}`, entries)

      this.log.info("Saved patterns for session", {
        sessionId,
        count: sessionPatterns.length,
      })
    } catch (error) {
      this.log.error("Failed to save patterns", {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Load usage patterns
   */
  static async loadPatterns(sessionId: string): Promise<UsagePattern[]> {
    try {
      const entries = await Storage.readJSON<PerformanceStorageEntry[]>(
        `${this.PATTERNS_PATH}/${sessionId}`,
      )

      return entries
        .filter((entry) => entry.type === "pattern")
        .map((entry) => entry.data as UsagePattern)
    } catch {
      return []
    }
  }

  /**
   * Save analytics data
   */
  static async saveAnalytics(analytics: AnalyticsData): Promise<void> {
    try {
      const entry: PerformanceStorageEntry = {
        id: `analytics-${analytics.sessionId}-${Date.now()}`,
        sessionId: analytics.sessionId,
        timestamp: Date.now(),
        type: "analytics",
        data: analytics,
      }

      await Storage.writeJSON(
        `${this.ANALYTICS_PATH}/${analytics.sessionId}`,
        entry,
      )

      this.log.info("Saved analytics for session", {
        sessionId: analytics.sessionId,
      })
    } catch (error) {
      this.log.error("Failed to save analytics", {
        sessionId: analytics.sessionId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Load analytics data
   */
  static async loadAnalytics(sessionId: string): Promise<AnalyticsData | null> {
    try {
      const entry = await Storage.readJSON<PerformanceStorageEntry>(
        `${this.ANALYTICS_PATH}/${sessionId}`,
      )

      if (entry.type === "analytics") {
        return entry.data as AnalyticsData
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Save all performance data for a session
   */
  static async saveSessionData(sessionId: string): Promise<void> {
    await Promise.all([
      this.saveMetrics(sessionId),
      this.savePatterns(sessionId),
      PerformanceAnalytics.generateAnalytics(sessionId).then((analytics) =>
        this.saveAnalytics(analytics),
      ),
    ])

    this.log.info("Saved all performance data for session", { sessionId })
  }

  /**
   * Load all performance data for a session
   */
  static async loadSessionData(sessionId: string): Promise<{
    metrics: ToolExecutionMetrics[]
    patterns: UsagePattern[]
    analytics: AnalyticsData | null
  }> {
    const [metrics, patterns, analytics] = await Promise.all([
      this.loadMetrics(sessionId),
      this.loadPatterns(sessionId),
      this.loadAnalytics(sessionId),
    ])

    return { metrics, patterns, analytics }
  }

  /**
   * List all sessions with performance data
   */
  static async listSessions(): Promise<string[]> {
    try {
      const allSessions = new Set<string>()

      // Collect from metrics
      for await (const item of Storage.list(this.METRICS_PATH)) {
        const sessionId = item.split("/").pop()
        if (sessionId) allSessions.add(sessionId)
      }

      // Collect from patterns
      for await (const item of Storage.list(this.PATTERNS_PATH)) {
        const sessionId = item.split("/").pop()
        if (sessionId) allSessions.add(sessionId)
      }

      // Collect from analytics
      for await (const item of Storage.list(this.ANALYTICS_PATH)) {
        const sessionId = item.split("/").pop()
        if (sessionId) allSessions.add(sessionId)
      }

      return Array.from(allSessions)
    } catch {
      return []
    }
  }

  /**
   * Clean up old performance data
   */
  static async cleanup(daysToKeep: number = 7): Promise<void> {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
    const sessions = await this.listSessions()

    for (const sessionId of sessions) {
      try {
        const analytics = await this.loadAnalytics(sessionId)
        if (analytics && analytics.period.end < cutoffTime) {
          await Promise.all([
            Storage.remove(`${this.METRICS_PATH}/${sessionId}`),
            Storage.remove(`${this.PATTERNS_PATH}/${sessionId}`),
            Storage.remove(`${this.ANALYTICS_PATH}/${sessionId}`),
          ])

          this.log.info("Cleaned up old performance data", { sessionId })
        }
      } catch (error) {
        this.log.error("Failed to cleanup session", {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  /**
   * Export all performance data
   */
  static async exportAll(): Promise<{
    sessions: Array<{
      sessionId: string
      metrics: ToolExecutionMetrics[]
      patterns: UsagePattern[]
      analytics: AnalyticsData | null
    }>
    exportDate: number
  }> {
    const sessions = await this.listSessions()
    const sessionData = await Promise.all(
      sessions.map(async (sessionId) => ({
        sessionId,
        ...(await this.loadSessionData(sessionId)),
      })),
    )

    return {
      sessions: sessionData,
      exportDate: Date.now(),
    }
  }

  /**
   * Import performance data
   */
  static async importData(data: {
    sessions: Array<{
      sessionId: string
      metrics: ToolExecutionMetrics[]
      patterns: UsagePattern[]
      analytics: AnalyticsData | null
    }>
  }): Promise<void> {
    for (const session of data.sessions) {
      // Save metrics
      if (session.metrics.length > 0) {
        const entries: PerformanceStorageEntry[] = session.metrics.map(
          (metric) => ({
            id: `metric-${metric.sessionId}-${metric.startTime}`,
            sessionId: metric.sessionId,
            timestamp: metric.startTime,
            type: "metric",
            data: metric,
          }),
        )

        await Storage.writeJSON(
          `${this.METRICS_PATH}/${session.sessionId}`,
          entries,
        )
      }

      // Save patterns
      if (session.patterns.length > 0) {
        const entries: PerformanceStorageEntry[] = session.patterns.map(
          (pattern) => ({
            id: pattern.id,
            sessionId: pattern.sessionId,
            timestamp: pattern.timestamp,
            type: "pattern",
            data: pattern,
          }),
        )

        await Storage.writeJSON(
          `${this.PATTERNS_PATH}/${session.sessionId}`,
          entries,
        )
      }

      // Save analytics
      if (session.analytics) {
        await this.saveAnalytics(session.analytics)
      }
    }

    this.log.info("Imported performance data", {
      sessionCount: data.sessions.length,
    })
  }
}
