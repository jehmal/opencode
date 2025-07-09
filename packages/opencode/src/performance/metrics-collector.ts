/**
 * Metrics collector for tool execution and performance tracking
 */

import type { OperationType } from "@opencode/dgm-integration"
import { SessionPerformance } from "../session/performance"
import { Log } from "../util/log"
import type { ToolExecutionMetrics } from "./types"

/**
 * Central metrics collection system
 */
export class MetricsCollector {
  private static log = Log.create({ service: "metrics-collector" })
  private static activeMetrics = new Map<string, ToolExecutionMetrics>()
  private static completedMetrics: ToolExecutionMetrics[] = []
  private static maxStoredMetrics = 10000

  /**
   * Start tracking a tool execution
   */
  static startToolExecution(
    toolId: string,
    sessionId: string,
    messageId: string,
    inputData?: any,
  ): string {
    const executionId = `${toolId}-${sessionId}-${messageId}-${Date.now()}`

    const metrics: ToolExecutionMetrics = {
      toolId,
      sessionId,
      messageId,
      startTime: Date.now(),
      success: false,
      inputSize: inputData ? JSON.stringify(inputData).length : 0,
      outputSize: 0,
    }

    // Track memory if available
    if (typeof process !== "undefined" && process.memoryUsage) {
      metrics.memoryUsed = process.memoryUsage().heapUsed
    }

    this.activeMetrics.set(executionId, metrics)

    // Also track in session performance
    const tracker = SessionPerformance.getTracker(sessionId)
    // Use generic tool-execution type for compatibility
    tracker.startOperation("tool-execution" as OperationType, {
      toolId,
      messageId,
      executionId,
    })

    this.log.info("Started tool execution tracking", {
      executionId,
      toolId,
      sessionId,
    })

    return executionId
  }

  /**
   * Complete tracking for a tool execution
   */
  static completeToolExecution(
    executionId: string,
    success: boolean,
    outputData?: any,
    error?: Error,
  ): ToolExecutionMetrics | null {
    const metrics = this.activeMetrics.get(executionId)
    if (!metrics) {
      this.log.warn("No active metrics found for execution", { executionId })
      return null
    }

    // Update metrics
    metrics.endTime = Date.now()
    metrics.duration = metrics.endTime - metrics.startTime
    metrics.success = success
    metrics.outputSize = outputData ? JSON.stringify(outputData).length : 0

    if (error) {
      metrics.error = error.message
    }

    // Track memory delta if available
    if (
      typeof process !== "undefined" &&
      process.memoryUsage &&
      metrics.memoryUsed
    ) {
      const currentMemory = process.memoryUsage().heapUsed
      metrics.memoryUsed = currentMemory - metrics.memoryUsed
    }

    // Move to completed
    this.activeMetrics.delete(executionId)
    this.completedMetrics.push(metrics)

    // Maintain size limit
    if (this.completedMetrics.length > this.maxStoredMetrics) {
      this.completedMetrics = this.completedMetrics.slice(
        -this.maxStoredMetrics,
      )
    }

    this.log.info("Completed tool execution tracking", {
      executionId,
      toolId: metrics.toolId,
      duration: metrics.duration,
      success,
    })

    return metrics
  }

  /**
   * Get metrics for a specific session
   */
  static getSessionMetrics(sessionId: string): ToolExecutionMetrics[] {
    return this.completedMetrics.filter((m) => m.sessionId === sessionId)
  }

  /**
   * Get metrics for a specific tool
   */
  static getToolMetrics(toolId: string): ToolExecutionMetrics[] {
    return this.completedMetrics.filter((m) => m.toolId === toolId)
  }

  /**
   * Get aggregated statistics for a tool
   */
  static getToolStats(toolId: string): {
    count: number
    totalDuration: number
    averageDuration: number
    successRate: number
    errorRate: number
    averageInputSize: number
    averageOutputSize: number
    p50: number
    p95: number
    p99: number
  } | null {
    const metrics = this.getToolMetrics(toolId)
    if (metrics.length === 0) return null

    const durations = metrics
      .filter((m) => m.duration !== undefined)
      .map((m) => m.duration!)
      .sort((a, b) => a - b)

    const successCount = metrics.filter((m) => m.success).length
    const totalDuration = durations.reduce((sum, d) => sum + d, 0)
    const totalInputSize = metrics.reduce((sum, m) => sum + m.inputSize, 0)
    const totalOutputSize = metrics.reduce((sum, m) => sum + m.outputSize, 0)

    return {
      count: metrics.length,
      totalDuration,
      averageDuration: totalDuration / durations.length,
      successRate: successCount / metrics.length,
      errorRate: 1 - successCount / metrics.length,
      averageInputSize: totalInputSize / metrics.length,
      averageOutputSize: totalOutputSize / metrics.length,
      p50: this.getPercentile(durations, 50),
      p95: this.getPercentile(durations, 95),
      p99: this.getPercentile(durations, 99),
    }
  }

  /**
   * Calculate percentile from sorted array
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
   * Get all completed metrics
   */
  static getAllMetrics(): ToolExecutionMetrics[] {
    return [...this.completedMetrics]
  }

  /**
   * Clear metrics for a session
   */
  static clearSessionMetrics(sessionId: string): void {
    this.completedMetrics = this.completedMetrics.filter(
      (m) => m.sessionId !== sessionId,
    )

    // Also clear from active metrics
    for (const [id, metrics] of this.activeMetrics) {
      if (metrics.sessionId === sessionId) {
        this.activeMetrics.delete(id)
      }
    }
  }

  /**
   * Export metrics for analysis
   */
  static exportMetrics(): {
    active: ToolExecutionMetrics[]
    completed: ToolExecutionMetrics[]
    summary: {
      totalExecutions: number
      activeExecutions: number
      averageDuration: number
      successRate: number
      toolBreakdown: Record<
        string,
        {
          count: number
          averageDuration: number
          successRate: number
        }
      >
    }
  } {
    const active = Array.from(this.activeMetrics.values())
    const completed = [...this.completedMetrics]

    // Calculate summary
    const toolStats = new Map<
      string,
      {
        count: number
        totalDuration: number
        successCount: number
      }
    >()

    completed.forEach((metric) => {
      const stats = toolStats.get(metric.toolId) || {
        count: 0,
        totalDuration: 0,
        successCount: 0,
      }

      stats.count++
      stats.totalDuration += metric.duration || 0
      if (metric.success) stats.successCount++

      toolStats.set(metric.toolId, stats)
    })

    const toolBreakdown: Record<string, any> = {}
    toolStats.forEach((stats, toolId) => {
      toolBreakdown[toolId] = {
        count: stats.count,
        averageDuration: stats.totalDuration / stats.count,
        successRate: stats.successCount / stats.count,
      }
    })

    const totalDuration = completed.reduce(
      (sum, m) => sum + (m.duration || 0),
      0,
    )
    const successCount = completed.filter((m) => m.success).length

    return {
      active,
      completed,
      summary: {
        totalExecutions: completed.length,
        activeExecutions: active.length,
        averageDuration:
          completed.length > 0 ? totalDuration / completed.length : 0,
        successRate: completed.length > 0 ? successCount / completed.length : 0,
        toolBreakdown,
      },
    }
  }
}
