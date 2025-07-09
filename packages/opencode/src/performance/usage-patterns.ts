/**
 * Usage pattern tracking and analysis for tool execution
 */

import { MetricsCollector } from "./metrics-collector"
import type { UsagePattern, ToolExecutionMetrics } from "./types"

/**
 * Tracks and analyzes tool usage patterns
 */
export class UsagePatternTracker {
  private static patterns: UsagePattern[] = []
  private static maxPatterns = 5000
  private static sequenceWindow = 5 // Number of tools to consider in a sequence

  /**
   * Analyze metrics and extract usage patterns
   */
  static analyzePatterns(sessionId: string): UsagePattern[] {
    const metrics = MetricsCollector.getSessionMetrics(sessionId)
    if (metrics.length < 2) return []

    // Sort by start time
    const sortedMetrics = [...metrics].sort((a, b) => a.startTime - b.startTime)
    const patterns: UsagePattern[] = []

    // Extract sequences
    for (let i = 0; i < sortedMetrics.length - 1; i++) {
      const windowEnd = Math.min(i + this.sequenceWindow, sortedMetrics.length)
      const sequence = sortedMetrics.slice(i, windowEnd)

      if (sequence.length >= 2) {
        const pattern = this.createPattern(sequence, i, sortedMetrics)
        patterns.push(pattern)
        this.addPattern(pattern)
      }
    }

    return patterns
  }

  /**
   * Create a usage pattern from a sequence of metrics
   */
  private static createPattern(
    sequence: ToolExecutionMetrics[],
    startIndex: number,
    allMetrics: ToolExecutionMetrics[],
  ): UsagePattern {
    const toolSequence = sequence.map((m) => m.toolId)
    const totalDuration = sequence.reduce(
      (sum, m) => sum + (m.duration || 0),
      0,
    )
    const successCount = sequence.filter((m) => m.success).length

    // Get context
    const previousTools =
      startIndex > 0
        ? allMetrics
            .slice(Math.max(0, startIndex - 3), startIndex)
            .map((m) => m.toolId)
        : []

    const nextIndex = startIndex + sequence.length
    const nextTools =
      nextIndex < allMetrics.length
        ? allMetrics
            .slice(nextIndex, Math.min(nextIndex + 3, allMetrics.length))
            .map((m) => m.toolId)
        : []

    const hasError = sequence.some((m) => !m.success)

    return {
      id: `pattern-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      sessionId: sequence[0].sessionId,
      timestamp: sequence[0].startTime,
      toolSequence,
      context: {
        previousTools,
        nextTools,
        errorContext: hasError,
      },
      performance: {
        totalDuration,
        averageToolDuration: totalDuration / sequence.length,
        successRate: successCount / sequence.length,
      },
    }
  }

  /**
   * Add a pattern to storage
   */
  private static addPattern(pattern: UsagePattern): void {
    this.patterns.push(pattern)

    // Maintain size limit
    if (this.patterns.length > this.maxPatterns) {
      this.patterns = this.patterns.slice(-this.maxPatterns)
    }
  }

  /**
   * Find similar patterns
   */
  static findSimilarPatterns(
    toolSequence: string[],
    threshold: number = 0.8,
  ): UsagePattern[] {
    return this.patterns.filter((pattern) => {
      const similarity = this.calculateSequenceSimilarity(
        pattern.toolSequence,
        toolSequence,
      )
      return similarity >= threshold
    })
  }

  /**
   * Calculate similarity between two tool sequences
   */
  private static calculateSequenceSimilarity(
    seq1: string[],
    seq2: string[],
  ): number {
    if (seq1.length === 0 || seq2.length === 0) return 0

    // Use Jaccard similarity
    const set1 = new Set(seq1)
    const set2 = new Set(seq2)

    const intersection = new Set([...set1].filter((x) => set2.has(x)))
    const union = new Set([...set1, ...set2])

    return intersection.size / union.size
  }

  /**
   * Get most common patterns
   */
  static getMostCommonPatterns(limit: number = 10): Array<{
    sequence: string[]
    count: number
    averagePerformance: {
      duration: number
      successRate: number
    }
  }> {
    const patternMap = new Map<string, UsagePattern[]>()

    // Group by sequence
    this.patterns.forEach((pattern) => {
      const key = pattern.toolSequence.join("->")
      const existing = patternMap.get(key) || []
      existing.push(pattern)
      patternMap.set(key, existing)
    })

    // Calculate statistics
    const results = Array.from(patternMap.entries())
      .map(([sequence, patterns]) => {
        const totalDuration = patterns.reduce(
          (sum, p) => sum + p.performance.totalDuration,
          0,
        )
        const totalSuccessRate = patterns.reduce(
          (sum, p) => sum + p.performance.successRate,
          0,
        )

        return {
          sequence: sequence.split("->"),
          count: patterns.length,
          averagePerformance: {
            duration: totalDuration / patterns.length,
            successRate: totalSuccessRate / patterns.length,
          },
        }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    return results
  }

  /**
   * Get patterns that frequently lead to errors
   */
  static getErrorPronePatterns(): Array<{
    sequence: string[]
    errorRate: number
    commonErrors: string[]
  }> {
    const errorPatterns = this.patterns.filter((p) => p.context.errorContext)
    const patternMap = new Map<
      string,
      {
        count: number
        errorCount: number
        errors: string[]
      }
    >()

    errorPatterns.forEach((pattern) => {
      const key = pattern.toolSequence.join("->")
      const existing = patternMap.get(key) || {
        count: 0,
        errorCount: 0,
        errors: [],
      }

      existing.count++
      if (pattern.context.errorContext) {
        existing.errorCount++
      }

      patternMap.set(key, existing)
    })

    return Array.from(patternMap.entries())
      .map(([sequence, data]) => ({
        sequence: sequence.split("->"),
        errorRate: data.errorCount / data.count,
        commonErrors: [...new Set(data.errors)],
      }))
      .filter((p) => p.errorRate > 0.1) // Only patterns with >10% error rate
      .sort((a, b) => b.errorRate - a.errorRate)
  }

  /**
   * Predict next likely tools based on current sequence
   */
  static predictNextTools(
    currentSequence: string[],
    limit: number = 5,
  ): Array<{
    tool: string
    probability: number
    averageDuration: number
  }> {
    const relevantPatterns = this.patterns.filter((pattern) => {
      // Check if pattern contains the current sequence
      for (
        let i = 0;
        i <= pattern.toolSequence.length - currentSequence.length;
        i++
      ) {
        const subSequence = pattern.toolSequence.slice(
          i,
          i + currentSequence.length,
        )
        if (JSON.stringify(subSequence) === JSON.stringify(currentSequence)) {
          return i + currentSequence.length < pattern.toolSequence.length
        }
      }
      return false
    })

    // Count next tools
    const nextToolStats = new Map<
      string,
      {
        count: number
        totalDuration: number
      }
    >()

    relevantPatterns.forEach((pattern) => {
      for (
        let i = 0;
        i <= pattern.toolSequence.length - currentSequence.length;
        i++
      ) {
        const subSequence = pattern.toolSequence.slice(
          i,
          i + currentSequence.length,
        )
        if (JSON.stringify(subSequence) === JSON.stringify(currentSequence)) {
          const nextTool = pattern.toolSequence[i + currentSequence.length]
          if (nextTool) {
            const stats = nextToolStats.get(nextTool) || {
              count: 0,
              totalDuration: 0,
            }
            stats.count++
            stats.totalDuration += pattern.performance.averageToolDuration
            nextToolStats.set(nextTool, stats)
          }
        }
      }
    })

    const total = Array.from(nextToolStats.values()).reduce(
      (sum, s) => sum + s.count,
      0,
    )

    return Array.from(nextToolStats.entries())
      .map(([tool, stats]) => ({
        tool,
        probability: stats.count / total,
        averageDuration: stats.totalDuration / stats.count,
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, limit)
  }

  /**
   * Export patterns for analysis
   */
  static exportPatterns(): {
    patterns: UsagePattern[]
    summary: {
      totalPatterns: number
      uniqueSequences: number
      averageSequenceLength: number
      mostCommonTools: Array<{ tool: string; count: number }>
    }
  } {
    const uniqueSequences = new Set(
      this.patterns.map((p) => p.toolSequence.join("->")),
    )

    const toolCounts = new Map<string, number>()
    this.patterns.forEach((pattern) => {
      pattern.toolSequence.forEach((tool) => {
        toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1)
      })
    })

    const mostCommonTools = Array.from(toolCounts.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const totalLength = this.patterns.reduce(
      (sum, p) => sum + p.toolSequence.length,
      0,
    )

    return {
      patterns: [...this.patterns],
      summary: {
        totalPatterns: this.patterns.length,
        uniqueSequences: uniqueSequences.size,
        averageSequenceLength:
          this.patterns.length > 0 ? totalLength / this.patterns.length : 0,
        mostCommonTools,
      },
    }
  }

  /**
   * Clear patterns for a session
   */
  static clearSessionPatterns(sessionId: string): void {
    this.patterns = this.patterns.filter((p) => p.sessionId !== sessionId)
  }
}
