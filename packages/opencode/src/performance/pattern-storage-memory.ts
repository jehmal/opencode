/**
 * In-memory storage for usage patterns and performance metrics
 * Provides time-series analysis and pattern aggregation
 */

import type { ExtendedMetrics } from "./session-performance-extended"
import type { DetectedPattern } from "../evolution/patterns/pattern-recognition"
import type { ImprovementHypothesis } from "../evolution/types"

/**
 * Pattern storage configuration
 */
export interface PatternStorageConfig {
  maxPatterns?: number
  maxMetrics?: number
  aggregationInterval?: number // Interval for aggregation in ms
  cleanupInterval?: number // Interval for cleanup in ms
}

/**
 * Time series data point
 */
interface TimeSeriesPoint {
  timestamp: number
  value: number
  metadata?: Record<string, any>
}

/**
 * Aggregated pattern data
 */
export interface AggregatedPattern {
  patternId: string
  type: string
  frequency: number
  averageImpact: number
  timeRange: {
    start: number
    end: number
  }
  tools: string[]
  metrics: {
    avgExecutionTime: number
    errorRate: number
    memoryUsage: number
    improvementPotential: number
  }
  hypotheses: string[] // Hypothesis IDs
}

/**
 * In-memory pattern storage
 */
export class PatternStorageMemory {
  private config: Required<PatternStorageConfig>

  // Storage maps
  private metrics = new Map<string, ExtendedMetrics[]>() // sessionId:toolId -> metrics[]
  private patterns = new Map<string, DetectedPattern[]>() // type -> patterns[]
  private patternDetails = new Map<string, DetectedPattern>() // patternId -> pattern
  private hypotheses = new Map<string, ImprovementHypothesis>() // hypothesisId -> hypothesis
  private hypothesesByType = new Map<string, Set<string>>() // type -> hypothesisIds
  private sessionPatterns = new Map<string, Set<string>>() // sessionId -> patternIds
  private sessionTools = new Map<string, Set<string>>() // sessionId -> toolIds

  // Cleanup timer
  private cleanupTimer?: NodeJS.Timeout

  constructor(config: PatternStorageConfig = {}) {
    this.config = {
      maxPatterns: config.maxPatterns || 10000,
      maxMetrics: config.maxMetrics || 50000,
      aggregationInterval: config.aggregationInterval || 60000, // 1 minute
      cleanupInterval: config.cleanupInterval || 300000, // 5 minutes
    }

    // Start cleanup timer
    this.startCleanupTimer()
  }

  /**
   * Store extended metrics
   */
  async storeMetrics(
    sessionId: string,
    metrics: ExtendedMetrics[],
  ): Promise<void> {
    for (const metric of metrics) {
      const key = `${sessionId}:${metric.toolId}`
      const existing = this.metrics.get(key) || []
      existing.push(metric)

      // Maintain size limit
      if (existing.length > this.config.maxMetrics) {
        existing.splice(0, existing.length - this.config.maxMetrics)
      }

      this.metrics.set(key, existing)

      // Update indices
      const tools = this.sessionTools.get(sessionId) || new Set()
      tools.add(metric.toolId)
      this.sessionTools.set(sessionId, tools)
    }
  }

  /**
   * Store detected patterns
   */
  async storePatterns(
    sessionId: string,
    patterns: DetectedPattern[],
  ): Promise<void> {
    for (const pattern of patterns) {
      // Store by type
      const typePatterns = this.patterns.get(pattern.type) || []
      typePatterns.push(pattern)

      // Maintain size limit
      if (typePatterns.length > this.config.maxPatterns) {
        typePatterns.splice(0, typePatterns.length - this.config.maxPatterns)
      }

      this.patterns.set(pattern.type, typePatterns)

      // Store pattern details
      this.patternDetails.set(pattern.id, pattern)

      // Update indices
      const sessionPats = this.sessionPatterns.get(sessionId) || new Set()
      sessionPats.add(pattern.id)
      this.sessionPatterns.set(sessionId, sessionPats)
    }
  }

  /**
   * Store improvement hypotheses
   */
  async storeHypotheses(hypotheses: ImprovementHypothesis[]): Promise<void> {
    for (const hypothesis of hypotheses) {
      this.hypotheses.set(hypothesis.id, hypothesis)

      // Index by type
      const typeHyps = this.hypothesesByType.get(hypothesis.type) || new Set()
      typeHyps.add(hypothesis.id)
      this.hypothesesByType.set(hypothesis.type, typeHyps)
    }
  }

  /**
   * Get metrics for a session
   */
  async getSessionMetrics(
    sessionId: string,
    toolId?: string,
  ): Promise<ExtendedMetrics[]> {
    const tools = toolId
      ? [toolId]
      : Array.from(this.sessionTools.get(sessionId) || [])
    const metrics: ExtendedMetrics[] = []

    for (const tool of tools) {
      const key = `${sessionId}:${tool}`
      const toolMetrics = this.metrics.get(key) || []
      metrics.push(...toolMetrics)
    }

    return metrics.sort((a, b) => a.startTime - b.startTime)
  }

  /**
   * Get patterns by type
   */
  async getPatternsByType(
    type: string,
    limit: number = 100,
  ): Promise<DetectedPattern[]> {
    const typePatterns = this.patterns.get(type) || []
    return typePatterns.slice(-limit)
  }

  /**
   * Get pattern details
   */
  async getPatternDetails(patternId: string): Promise<DetectedPattern | null> {
    return this.patternDetails.get(patternId) || null
  }

  /**
   * Get hypotheses by type
   */
  async getHypothesesByType(type: string): Promise<ImprovementHypothesis[]> {
    const hypothesisIds = this.hypothesesByType.get(type) || new Set()
    const hypotheses: ImprovementHypothesis[] = []

    for (const id of hypothesisIds) {
      const hypothesis = this.hypotheses.get(id)
      if (hypothesis) {
        hypotheses.push(hypothesis)
      }
    }

    return hypotheses
  }

  /**
   * Perform time-series analysis
   */
  async analyzeTimeSeries(
    sessionId: string,
    toolId: string,
    metric: "duration" | "memory" | "errors",
    interval: number = 60000, // 1 minute buckets
  ): Promise<TimeSeriesPoint[]> {
    const metrics = await this.getSessionMetrics(sessionId, toolId)
    const buckets = new Map<
      number,
      { sum: number; count: number; errors: number }
    >()

    for (const m of metrics) {
      const bucket = Math.floor(m.startTime / interval) * interval
      const data = buckets.get(bucket) || { sum: 0, count: 0, errors: 0 }

      switch (metric) {
        case "duration":
          data.sum += m.duration || 0
          break
        case "memory":
          data.sum += m.resourceUsage.memoryDelta
          break
        case "errors":
          data.errors += m.success ? 0 : 1
          break
      }

      data.count++
      buckets.set(bucket, data)
    }

    return Array.from(buckets.entries()).map(([timestamp, data]) => ({
      timestamp,
      value: metric === "errors" ? data.errors : data.sum / data.count,
      metadata: { count: data.count },
    }))
  }

  /**
   * Aggregate patterns across sessions
   */
  async aggregatePatterns(
    _timeWindow: number = 3600000,
  ): Promise<AggregatedPattern[]> {
    const now = Date.now()
    const aggregated = new Map<string, AggregatedPattern>()

    // Get all pattern types
    const patternTypes = [
      "hotspot",
      "bottleneck",
      "inefficiency",
      "error_prone",
      "resource_intensive",
      "redundant",
      "suboptimal_sequence",
    ]

    for (const type of patternTypes) {
      const patterns = await this.getPatternsByType(type, 1000)

      for (const pattern of patterns) {
        // Skip old patterns (would need timestamp in pattern)
        const key = `${type}:${pattern.context.tools.join("-")}`
        const existing = aggregated.get(key) || {
          patternId: pattern.id,
          type,
          frequency: 0,
          averageImpact: 0,
          timeRange: { start: now, end: now },
          tools: pattern.context.tools,
          metrics: {
            avgExecutionTime: 0,
            errorRate: 0,
            memoryUsage: 0,
            improvementPotential: 0,
          },
          hypotheses: [],
        }

        existing.frequency++

        // Update metrics (running average)
        const n = existing.frequency
        existing.metrics.avgExecutionTime =
          (existing.metrics.avgExecutionTime * (n - 1) +
            pattern.context.averageExecutionTime) /
          n
        existing.metrics.errorRate =
          (existing.metrics.errorRate * (n - 1) + pattern.context.errorRate) / n
        existing.metrics.memoryUsage =
          (existing.metrics.memoryUsage * (n - 1) +
            pattern.context.resourceUsage.memory) /
          n

        const impact =
          (pattern.impact.performanceImpact +
            pattern.impact.userExperienceImpact +
            pattern.impact.resourceImpact) /
          3
        existing.averageImpact = (existing.averageImpact * (n - 1) + impact) / n
        existing.metrics.improvementPotential =
          existing.averageImpact * existing.frequency

        aggregated.set(key, existing)
      }
    }

    return Array.from(aggregated.values()).sort(
      (a, b) => b.metrics.improvementPotential - a.metrics.improvementPotential,
    )
  }

  /**
   * Query patterns with filters
   */
  async queryPatterns(filters: {
    sessionId?: string
    type?: string
    minConfidence?: number
    minFrequency?: number
    tools?: string[]
  }): Promise<DetectedPattern[]> {
    let patterns: DetectedPattern[] = []

    if (filters.sessionId) {
      const patternIds =
        this.sessionPatterns.get(filters.sessionId) || new Set()
      for (const id of patternIds) {
        const pattern = this.patternDetails.get(id)
        if (pattern) patterns.push(pattern)
      }
    } else if (filters.type) {
      patterns = await this.getPatternsByType(filters.type)
    } else {
      // Get all patterns
      for (const typePatterns of this.patterns.values()) {
        patterns.push(...typePatterns)
      }
    }

    // Apply filters
    return patterns.filter((p) => {
      if (filters.minConfidence && p.confidence < filters.minConfidence)
        return false
      if (filters.minFrequency && p.frequency < filters.minFrequency)
        return false
      if (
        filters.tools &&
        !filters.tools.some((t) => p.context.tools.includes(t))
      )
        return false
      return true
    })
  }

  /**
   * Clean up old data
   */
  cleanup(olderThan: number = 86400000): void {
    const cutoff = Date.now() - olderThan
    let cleaned = 0

    // Clean metrics older than cutoff
    for (const [key, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter((m) => m.startTime > cutoff)
      if (filtered.length < metrics.length) {
        cleaned += metrics.length - filtered.length
        this.metrics.set(key, filtered)
      }
    }

    // Clean empty entries
    for (const [key, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) {
        this.metrics.delete(key)
      }
    }

    console.log(`Cleaned ${cleaned} old metrics`)
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    metricsCount: number
    patternsCount: number
    hypothesesCount: number
    sessionsCount: number
    memoryUsage: number
  } {
    let metricsCount = 0
    for (const metrics of this.metrics.values()) {
      metricsCount += metrics.length
    }

    let patternsCount = 0
    for (const patterns of this.patterns.values()) {
      patternsCount += patterns.length
    }

    return {
      metricsCount,
      patternsCount,
      hypothesesCount: this.hypotheses.size,
      sessionsCount: this.sessionTools.size,
      memoryUsage: process.memoryUsage().heapUsed,
    }
  }
}
