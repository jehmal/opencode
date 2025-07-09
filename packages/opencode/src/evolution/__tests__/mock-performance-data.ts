/**
 * Mock Performance Data Generator
 * Creates realistic performance metrics for testing evolution system
 */

import type { PerformanceMetrics } from "../types"

export const mockPerformanceData = {
  /**
   * Generate a single set of performance metrics
   */
  generateMetrics(): PerformanceMetrics {
    const baseTime = 80 + Math.random() * 40 // 80-120ms
    const baseMemory = 40 + Math.random() * 20 // 40-60MB
    const baseCpu = 60 + Math.random() * 30 // 60-90%

    return {
      executionTime: Math.round(baseTime * 10) / 10,
      memoryUsage: Math.round(baseMemory * 10) / 10,
      cpuUsage: Math.round(baseCpu * 10) / 10,
      errorRate: Math.random() < 0.1 ? Math.random() * 5 : 0,
      customMetrics: {
        throughput: Math.round((1000 / baseTime) * 10) / 10,
        responseTime: Math.round(baseTime * 0.8 * 10) / 10,
      },
    }
  },

  /**
   * Generate multiple tool executions with varied performance
   */
  generateMultipleExecutions(count: number) {
    const executions = []

    for (let i = 0; i < count; i++) {
      const isSlowExecution = Math.random() < 0.3 // 30% chance of slow execution
      const hasError = Math.random() < 0.05 // 5% error rate

      const metrics = this.generateMetrics()

      // Add variance for slow executions
      if (isSlowExecution) {
        metrics.executionTime =
          metrics.executionTime * (1.5 + Math.random() * 0.5)
        metrics.cpuUsage = Math.min(95, metrics.cpuUsage * 1.2)
      }

      executions.push({
        id: `exec_${Date.now()}_${i}`,
        toolName: this.getRandomToolName(),
        timestamp: Date.now() - (count - i) * 60000, // Spread over time
        metrics,
        success: !hasError,
        error: hasError ? this.generateError() : undefined,
        context: {
          fileSize: Math.round(Math.random() * 1000) + 100,
          complexity: Math.round(Math.random() * 10) + 1,
          userAction: this.getRandomAction(),
        },
      })
    }

    return executions
  },

  /**
   * Generate pattern data for testing pattern detection
   */
  generatePatternData() {
    return {
      performanceBottlenecks: [
        {
          tool: "file-search",
          avgExecutionTime: 150,
          occurrences: 45,
          timeRange: { start: Date.now() - 86400000, end: Date.now() },
          pattern: "Consistently slow on large repositories",
        },
        {
          tool: "code-analysis",
          avgExecutionTime: 200,
          occurrences: 30,
          timeRange: { start: Date.now() - 86400000, end: Date.now() },
          pattern: "Memory spikes during TypeScript parsing",
        },
      ],
      errorPatterns: [
        {
          tool: "test-runner",
          errorRate: 0.15,
          commonErrors: ["Timeout", "Memory limit exceeded"],
          occurrences: 12,
        },
      ],
      usagePatterns: [
        {
          sequence: ["file-search", "code-edit", "test-runner"],
          frequency: 0.7,
          avgDuration: 450,
          optimization: "Could batch operations",
        },
      ],
    }
  },

  /**
   * Generate evolution scenario data
   */
  generateEvolutionScenario(type: "performance" | "memory" | "error") {
    const scenarios = {
      performance: {
        before: {
          executionTime: 120,
          cpuUsage: 85,
          throughput: 8.3,
        },
        after: {
          executionTime: 84, // 30% improvement
          cpuUsage: 65,
          throughput: 11.9,
        },
        changes: [
          "Implemented caching for repeated operations",
          "Optimized algorithm complexity from O(n²) to O(n log n)",
          "Added early exit conditions",
        ],
      },
      memory: {
        before: {
          memoryUsage: 80,
          peakMemory: 120,
          gcPauses: 15,
        },
        after: {
          memoryUsage: 50, // 37.5% reduction
          peakMemory: 75,
          gcPauses: 5,
        },
        changes: [
          "Implemented object pooling",
          "Fixed memory leaks in event listeners",
          "Optimized data structures",
        ],
      },
      error: {
        before: {
          errorRate: 0.12,
          failureTypes: ["timeout", "null reference", "type mismatch"],
          mtbf: 8.3, // mean time between failures in minutes
        },
        after: {
          errorRate: 0.02, // 83% reduction
          failureTypes: ["timeout"],
          mtbf: 50,
        },
        changes: [
          "Added comprehensive error handling",
          "Implemented retry logic with exponential backoff",
          "Fixed race conditions",
        ],
      },
    }

    return scenarios[type]
  },

  /**
   * Helper methods
   */
  getRandomToolName() {
    const tools = [
      "file-search",
      "code-analysis",
      "test-runner",
      "linter",
      "formatter",
      "type-checker",
      "bundler",
      "compiler",
    ]
    return tools[Math.floor(Math.random() * tools.length)]
  },

  getRandomAction() {
    const actions = [
      "search",
      "edit",
      "refactor",
      "test",
      "debug",
      "analyze",
      "format",
      "compile",
    ]
    return actions[Math.floor(Math.random() * actions.length)]
  },

  generateError() {
    const errors = [
      { type: "TimeoutError", message: "Operation timed out after 30s" },
      { type: "MemoryError", message: "Memory limit exceeded" },
      { type: "ParseError", message: "Failed to parse file" },
      { type: "NetworkError", message: "Connection refused" },
    ]
    return errors[Math.floor(Math.random() * errors.length)]
  },
}
