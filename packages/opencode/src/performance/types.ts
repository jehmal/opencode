/**
 * Type definitions for the performance tracking system
 */

import type { OperationType } from "@opencode/dgm-integration"

/**
 * Extended operation types for comprehensive tracking
 */
export type ExtendedOperationType =
  | OperationType
  | "tool-bash"
  | "tool-read"
  | "tool-write"
  | "tool-edit"
  | "tool-grep"
  | "tool-glob"
  | "tool-ls"
  | "tool-task"
  | "tool-webfetch"
  | "tool-todo"
  | "tool-diagnose"
  | "session-init"
  | "session-cleanup"
  | "message-processing"

/**
 * Tool execution metrics
 */
export interface ToolExecutionMetrics {
  toolId: string
  sessionId: string
  messageId: string
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  error?: string
  inputSize: number
  outputSize: number
  memoryUsed?: number
  metadata?: Record<string, any>
}

/**
 * Usage pattern for analytics
 */
export interface UsagePattern {
  id: string
  sessionId: string
  timestamp: number
  toolSequence: string[]
  context: {
    previousTools: string[]
    nextTools: string[]
    errorContext?: boolean
  }
  performance: {
    totalDuration: number
    averageToolDuration: number
    successRate: number
  }
}

/**
 * Analytics data structure
 */
export interface AnalyticsData {
  sessionId: string
  period: {
    start: number
    end: number
  }
  toolUsage: Record<
    string,
    {
      count: number
      totalDuration: number
      averageDuration: number
      successRate: number
      errorRate: number
      p50: number
      p95: number
      p99: number
    }
  >
  patterns: {
    mostCommonSequences: Array<{
      sequence: string[]
      count: number
      averageDuration: number
    }>
    errorPatterns: Array<{
      tool: string
      errorType: string
      count: number
      context: string[]
    }>
  }
  performance: {
    totalOperations: number
    totalDuration: number
    averageOperationTime: number
    peakMemoryUsage: number
    throughput: number // operations per second
  }
}

/**
 * Performance decorator options
 */
export interface PerformanceDecoratorOptions {
  trackMemory?: boolean
  trackInputOutput?: boolean
  sampleRate?: number // 0-1, for sampling high-frequency operations
  customMetadata?: Record<string, any>
}

/**
 * Storage format for performance data
 */
export interface PerformanceStorageEntry {
  id: string
  sessionId: string
  timestamp: number
  type: "metric" | "pattern" | "analytics"
  data: ToolExecutionMetrics | UsagePattern | AnalyticsData
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  enabled: boolean
  saveReports: boolean
  maxMetrics: number
  trackMemory: boolean
  trackPatterns: boolean
  analyticsInterval: number // ms between analytics calculations
  storagePath: string
}
