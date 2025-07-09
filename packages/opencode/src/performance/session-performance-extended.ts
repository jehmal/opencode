/**
 * Extended SessionPerformance with detailed usage pattern tracking
 * Part of the Evolution Bridge system for automatic improvement detection
 */

import type { ToolExecutionMetrics } from "./types"

/**
 * Extended metrics for detailed pattern analysis
 */
export interface ExtendedMetrics extends ToolExecutionMetrics {
  // Execution context
  executionContext: {
    previousTool?: string
    nextTool?: string
    parallelTools: string[]
    userIntent?: string
    errorRecovery: boolean
  }

  // Parameter patterns
  parameterPatterns: {
    parameterTypes: Record<string, string>
    parameterValues: Record<string, any>
    parameterFrequency: Record<string, number>
    commonCombinations: string[][]
  }

  // Resource usage
  resourceUsage: {
    cpuUsage?: number
    memoryDelta: number
    ioOperations: number
    networkCalls: number
    fileSystemAccess: number
  }

  // Error patterns
  errorPatterns?: {
    errorType: string
    errorCode?: string
    stackTrace?: string
    recoveryAttempts: number
    recoverySuccess: boolean
  }

  // User behavior
  userBehavior: {
    interactionDelay?: number // Time between user request and tool execution
    retryCount: number
    modificationCount: number // How many times user modified the request
    satisfactionScore?: number // Based on follow-up actions
  }
}

/**
 * Pattern detection algorithms
 */
export class PatternDetector {
  /**
   * Detect execution hotspots (frequently used tool combinations)
   */
  static detectHotspots(metrics: ExtendedMetrics[]): {
    pattern: string[]
    frequency: number
    averageExecutionTime: number
    improvementPotential: number
  }[] {
    const sequenceMap = new Map<
      string,
      {
        count: number
        totalTime: number
        tools: string[]
      }
    >()

    // Build sequences from execution context
    for (let i = 0; i < metrics.length - 1; i++) {
      const current = metrics[i]
      const next = metrics[i + 1]

      if (next.executionContext.previousTool === current.toolId) {
        const sequence = [current.toolId, next.toolId]
        const key = sequence.join("->")

        const existing = sequenceMap.get(key) || {
          count: 0,
          totalTime: 0,
          tools: sequence,
        }

        existing.count++
        existing.totalTime += (current.duration || 0) + (next.duration || 0)
        sequenceMap.set(key, existing)
      }
    }

    // Calculate improvement potential
    return Array.from(sequenceMap.entries())
      .map(([, data]) => {
        const avgTime = data.totalTime / data.count
        const frequency = data.count / metrics.length

        // High frequency + high execution time = high improvement potential
        const improvementPotential = frequency * avgTime

        return {
          pattern: data.tools,
          frequency: data.count,
          averageExecutionTime: avgTime,
          improvementPotential,
        }
      })
      .sort((a, b) => b.improvementPotential - a.improvementPotential)
      .slice(0, 10)
  }

  /**
   * Detect performance bottlenecks
   */
  static detectBottlenecks(metrics: ExtendedMetrics[]): {
    tool: string
    issue: "slow_execution" | "high_memory" | "high_cpu" | "frequent_errors"
    severity: number
    details: Record<string, any>
  }[] {
    const bottlenecks: any[] = []

    // Group by tool
    const toolGroups = new Map<string, ExtendedMetrics[]>()
    metrics.forEach((m) => {
      const group = toolGroups.get(m.toolId) || []
      group.push(m)
      toolGroups.set(m.toolId, group)
    })

    // Analyze each tool
    toolGroups.forEach((toolMetrics, toolId) => {
      // Check for slow execution
      const durations = toolMetrics
        .map((m) => m.duration || 0)
        .filter((d) => d > 0)
      const avgDuration =
        durations.reduce((a, b) => a + b, 0) / durations.length
      const p95Duration = this.getPercentile(durations, 95)

      if (p95Duration > 5000) {
        // 5 seconds
        bottlenecks.push({
          tool: toolId,
          issue: "slow_execution",
          severity: Math.min(p95Duration / 1000, 10), // 1-10 scale
          details: {
            averageDuration: avgDuration,
            p95Duration,
            sampleSize: durations.length,
          },
        })
      }

      // Check for high memory usage
      const memoryDeltas = toolMetrics
        .map((m) => m.resourceUsage.memoryDelta)
        .filter((d) => d > 0)

      if (memoryDeltas.length > 0) {
        const avgMemory =
          memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length
        const maxMemory = Math.max(...memoryDeltas)

        if (maxMemory > 100 * 1024 * 1024) {
          // 100MB
          bottlenecks.push({
            tool: toolId,
            issue: "high_memory",
            severity: Math.min(maxMemory / (100 * 1024 * 1024), 10),
            details: {
              averageMemoryDelta: avgMemory,
              maxMemoryDelta: maxMemory,
              sampleSize: memoryDeltas.length,
            },
          })
        }
      }

      // Check for frequent errors
      const errorRate =
        toolMetrics.filter((m) => !m.success).length / toolMetrics.length
      if (errorRate > 0.1) {
        // 10% error rate
        bottlenecks.push({
          tool: toolId,
          issue: "frequent_errors",
          severity: Math.min(errorRate * 10, 10),
          details: {
            errorRate,
            totalExecutions: toolMetrics.length,
            errorCount: toolMetrics.filter((m) => !m.success).length,
            commonErrors: this.getCommonErrors(toolMetrics),
          },
        })
      }
    })

    return bottlenecks.sort((a, b) => b.severity - a.severity)
  }

  /**
   * Detect inefficient patterns
   */
  static detectInefficiencies(metrics: ExtendedMetrics[]): {
    pattern: string
    inefficiencyType: string
    description: string
    suggestion: string
    potentialSaving: number
  }[] {
    const inefficiencies: any[] = []

    // Detect redundant operations
    for (let i = 0; i < metrics.length - 5; i++) {
      const window = metrics.slice(i, i + 5)
      const toolCounts = new Map<string, number>()

      window.forEach((m) => {
        toolCounts.set(m.toolId, (toolCounts.get(m.toolId) || 0) + 1)
      })

      // Check for repeated operations
      toolCounts.forEach((count, tool) => {
        if (count >= 3) {
          inefficiencies.push({
            pattern: `Repeated ${tool} operations`,
            inefficiencyType: "redundant_operations",
            description: `Tool ${tool} called ${count} times in quick succession`,
            suggestion: "Consider batching operations or caching results",
            potentialSaving:
              (count - 1) *
              (window.find((m) => m.toolId === tool)?.duration || 0),
          })
        }
      })
    }

    // Detect inefficient sequences
    const readWritePatterns = this.findReadWritePatterns(metrics)
    readWritePatterns.forEach((pattern) => {
      if (pattern.inefficient) {
        inefficiencies.push({
          pattern: pattern.sequence.join(" -> "),
          inefficiencyType: "inefficient_sequence",
          description: pattern.description,
          suggestion: pattern.suggestion,
          potentialSaving: pattern.potentialSaving,
        })
      }
    })

    return inefficiencies
  }

  /**
   * Helper: Get percentile value
   */
  private static getPercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)] || 0
  }

  /**
   * Helper: Get common errors
   */
  private static getCommonErrors(
    metrics: ExtendedMetrics[],
  ): Record<string, number> {
    const errorCounts = new Map<string, number>()

    metrics
      .filter((m) => !m.success && m.error)
      .forEach((m) => {
        const errorType = m.errorPatterns?.errorType || m.error || "unknown"
        errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1)
      })

    const result: Record<string, number> = {}
    errorCounts.forEach((count, error) => {
      result[error] = count
    })

    return result
  }

  /**
   * Helper: Find read-write patterns
   */
  private static findReadWritePatterns(metrics: ExtendedMetrics[]): any[] {
    const patterns: any[] = []

    for (let i = 0; i < metrics.length - 2; i++) {
      const [first, second, third] = metrics.slice(i, i + 3)

      // Multiple reads followed by write
      if (
        first.toolId === "read" &&
        second.toolId === "read" &&
        third.toolId === "write"
      ) {
        patterns.push({
          sequence: ["read", "read", "write"],
          inefficient: true,
          description: "Multiple reads before write",
          suggestion:
            "Batch read operations or use glob to read multiple files",
          potentialSaving: first.duration || 0,
        })
      }

      // Read, modify, write pattern that could be edit
      if (first.toolId === "read" && third.toolId === "write") {
        const sameFile =
          first.metadata?.["filePath"] === third.metadata?.["filePath"]
        if (sameFile) {
          patterns.push({
            sequence: ["read", "process", "write"],
            inefficient: true,
            description: "Read-modify-write pattern on same file",
            suggestion: "Use edit tool for in-place modifications",
            potentialSaving:
              (first.duration || 0) + (third.duration || 0) * 0.5,
          })
        }
      }
    }

    return patterns
  }
}

/**
 * Extended SessionPerformance with pattern tracking
 */
export class SessionPerformanceExtended {
  private static extendedMetrics = new Map<string, ExtendedMetrics[]>()

  /**
   * Track extended metrics for a tool execution
   */
  static trackExecution(
    sessionId: string,
    toolId: string,
    messageId: string,
    options: {
      parameters?: Record<string, any>
      previousTool?: string
      parallelTools?: string[]
      userIntent?: string
      startMemory?: number
      startCpu?: number
    } = {},
  ): string {
    const executionId = `${toolId}-${sessionId}-${messageId}-${Date.now()}`

    const metrics: ExtendedMetrics = {
      toolId,
      sessionId,
      messageId,
      startTime: Date.now(),
      success: false,
      inputSize: 0,
      outputSize: 0,
      executionContext: {
        previousTool: options.previousTool,
        parallelTools: options.parallelTools || [],
        userIntent: options.userIntent,
        errorRecovery: false,
      },
      parameterPatterns: {
        parameterTypes: {},
        parameterValues: {},
        parameterFrequency: {},
        commonCombinations: [],
      },
      resourceUsage: {
        memoryDelta: 0,
        ioOperations: 0,
        networkCalls: 0,
        fileSystemAccess: 0,
      },
      userBehavior: {
        retryCount: 0,
        modificationCount: 0,
      },
    }

    // Track parameters
    if (options.parameters) {
      Object.entries(options.parameters).forEach(([key, value]) => {
        metrics.parameterPatterns.parameterTypes[key] = typeof value
        metrics.parameterPatterns.parameterValues[key] = value
      })
    }

    // Track initial resource usage
    if (typeof process !== "undefined" && process.memoryUsage) {
      metrics.memoryUsed = process.memoryUsage().heapUsed
    }

    // Store in session metrics
    const sessionMetrics = this.extendedMetrics.get(sessionId) || []
    sessionMetrics.push(metrics)
    this.extendedMetrics.set(sessionId, sessionMetrics)

    return executionId
  }

  /**
   * Complete execution tracking with detailed metrics
   */
  static completeExecution(
    sessionId: string,
    executionId: string,
    result: {
      success: boolean
      output?: any
      error?: Error
      resourceUsage?: Partial<ExtendedMetrics["resourceUsage"]>
      errorRecovery?: boolean
    },
  ): ExtendedMetrics | null {
    const sessionMetrics = this.extendedMetrics.get(sessionId)
    if (!sessionMetrics) return null

    const metrics = sessionMetrics.find(
      (m) =>
        `${m.toolId}-${m.sessionId}-${m.messageId}-${m.startTime}` ===
        executionId,
    )

    if (!metrics) return null

    // Update completion metrics
    metrics.endTime = Date.now()
    metrics.duration = metrics.endTime - metrics.startTime
    metrics.success = result.success
    metrics.outputSize = result.output
      ? JSON.stringify(result.output).length
      : 0

    // Update resource usage
    if (result.resourceUsage) {
      Object.assign(metrics.resourceUsage, result.resourceUsage)
    }

    // Calculate memory delta
    if (
      typeof process !== "undefined" &&
      process.memoryUsage &&
      metrics.memoryUsed
    ) {
      const currentMemory = process.memoryUsage().heapUsed
      metrics.resourceUsage.memoryDelta = currentMemory - metrics.memoryUsed
    }

    // Track error patterns
    if (result.error) {
      metrics.error = result.error.message
      metrics.errorPatterns = {
        errorType: result.error.name || "Error",
        errorCode: (result.error as any).code,
        stackTrace: result.error.stack,
        recoveryAttempts: result.errorRecovery ? 1 : 0,
        recoverySuccess: result.errorRecovery || false,
      }
    }

    metrics.executionContext.errorRecovery = result.errorRecovery || false

    return metrics
  }

  /**
   * Get usage patterns for a session
   */
  static getUsagePatterns(sessionId: string): {
    hotspots: ReturnType<typeof PatternDetector.detectHotspots>
    bottlenecks: ReturnType<typeof PatternDetector.detectBottlenecks>
    inefficiencies: ReturnType<typeof PatternDetector.detectInefficiencies>
  } {
    const metrics = this.extendedMetrics.get(sessionId) || []

    return {
      hotspots: PatternDetector.detectHotspots(metrics),
      bottlenecks: PatternDetector.detectBottlenecks(metrics),
      inefficiencies: PatternDetector.detectInefficiencies(metrics),
    }
  }

  /**
   * Export extended metrics for analysis
   */
  static exportMetrics(sessionId: string): {
    metrics: ExtendedMetrics[]
    patterns: ReturnType<typeof SessionPerformanceExtended.getUsagePatterns>
    summary: {
      totalExecutions: number
      averageExecutionTime: number
      errorRate: number
      mostUsedTools: Array<{ tool: string; count: number; avgTime: number }>
      resourceUsage: {
        totalMemoryDelta: number
        totalIoOperations: number
        totalNetworkCalls: number
      }
    }
  } {
    const metrics = this.extendedMetrics.get(sessionId) || []
    const patterns = this.getUsagePatterns(sessionId)

    // Calculate summary statistics
    const toolStats = new Map<string, { count: number; totalTime: number }>()
    let totalMemoryDelta = 0
    let totalIoOperations = 0
    let totalNetworkCalls = 0

    metrics.forEach((m) => {
      const stats = toolStats.get(m.toolId) || { count: 0, totalTime: 0 }
      stats.count++
      stats.totalTime += m.duration || 0
      toolStats.set(m.toolId, stats)

      totalMemoryDelta += m.resourceUsage.memoryDelta
      totalIoOperations += m.resourceUsage.ioOperations
      totalNetworkCalls += m.resourceUsage.networkCalls
    })

    const mostUsedTools = Array.from(toolStats.entries())
      .map(([tool, stats]) => ({
        tool,
        count: stats.count,
        avgTime: stats.totalTime / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const totalExecutions = metrics.length
    const totalTime = metrics.reduce((sum, m) => sum + (m.duration || 0), 0)
    const errorCount = metrics.filter((m) => !m.success).length

    return {
      metrics,
      patterns,
      summary: {
        totalExecutions,
        averageExecutionTime:
          totalExecutions > 0 ? totalTime / totalExecutions : 0,
        errorRate: totalExecutions > 0 ? errorCount / totalExecutions : 0,
        mostUsedTools,
        resourceUsage: {
          totalMemoryDelta,
          totalIoOperations,
          totalNetworkCalls,
        },
      },
    }
  }

  /**
   * Clear metrics for a session
   */
  static clearMetrics(sessionId: string): void {
    this.extendedMetrics.delete(sessionId)
  }
}
