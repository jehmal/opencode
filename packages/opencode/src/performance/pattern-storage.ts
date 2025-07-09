/**
 * Storage interface for usage patterns and performance metrics
 * Supports both Redis and in-memory implementations
 */

import type { ExtendedMetrics } from "./session-performance-extended"
import type { DetectedPattern } from "../evolution/patterns/pattern-recognition"
import type { ImprovementHypothesis } from "../evolution/types"
import { PatternStorageMemory } from "./pattern-storage-memory"

/**
 * Pattern storage configuration
 */
export interface PatternStorageConfig {
  type?: "memory" | "redis"
  redisUrl?: string
  keyPrefix?: string
  ttl?: number
  maxPatterns?: number
  aggregationInterval?: number
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
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
  hypotheses: string[]
}

/**
 * Pattern storage interface
 */
export interface IPatternStorage {
  storeMetrics(sessionId: string, metrics: ExtendedMetrics[]): Promise<void>
  storePatterns(sessionId: string, patterns: DetectedPattern[]): Promise<void>
  storeHypotheses(hypotheses: ImprovementHypothesis[]): Promise<void>
  getSessionMetrics(
    sessionId: string,
    toolId?: string,
  ): Promise<ExtendedMetrics[]>
  getPatternsByType(type: string, limit?: number): Promise<DetectedPattern[]>
  getPatternDetails(patternId: string): Promise<DetectedPattern | null>
  getHypothesesByType(type: string): Promise<ImprovementHypothesis[]>
  analyzeTimeSeries(
    sessionId: string,
    toolId: string,
    metric: "duration" | "memory" | "errors",
    interval?: number,
  ): Promise<TimeSeriesPoint[]>
  aggregatePatterns(timeWindow?: number): Promise<AggregatedPattern[]>
  queryPatterns(filters: {
    sessionId?: string
    type?: string
    minConfidence?: number
    minFrequency?: number
    tools?: string[]
  }): Promise<DetectedPattern[]>
}

/**
 * Pattern storage factory
 */
export class PatternStorage {
  private static instance: IPatternStorage | null = null

  /**
   * Get or create storage instance
   */
  static getInstance(config?: PatternStorageConfig): IPatternStorage {
    if (!this.instance) {
      // For now, always use in-memory storage
      // In the future, we can add Redis support when available
      this.instance = new PatternStorageMemory(config)
    }
    return this.instance
  }

  /**
   * Reset storage instance (mainly for testing)
   */
  static reset(): void {
    if (this.instance && "destroy" in this.instance) {
      ;(this.instance as PatternStorageMemory).destroy()
    }
    this.instance = null
  }
}
