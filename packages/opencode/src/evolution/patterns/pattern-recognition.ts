/**
 * Pattern recognition system for identifying improvement opportunities
 * Analyzes usage patterns to generate evolution hypotheses
 */

import type { ImprovementHypothesis, EvolutionRequestType } from "../types"
import type { ExtendedMetrics } from "../../performance/session-performance-extended"

/**
 * Pattern classification types
 */
export enum PatternType {
  HOTSPOT = "hotspot",
  BOTTLENECK = "bottleneck",
  INEFFICIENCY = "inefficiency",
  ERROR_PRONE = "error_prone",
  RESOURCE_INTENSIVE = "resource_intensive",
  REDUNDANT = "redundant",
  SUBOPTIMAL_SEQUENCE = "suboptimal_sequence",
}

/**
 * Detected pattern with improvement potential
 */
export interface DetectedPattern {
  id: string
  type: PatternType
  confidence: number
  frequency: number
  impact: {
    performanceImpact: number // 0-1 scale
    userExperienceImpact: number // 0-1 scale
    resourceImpact: number // 0-1 scale
  }
  context: {
    tools: string[]
    averageExecutionTime: number
    errorRate: number
    resourceUsage: {
      memory: number
      cpu?: number
      io: number
    }
  }
  improvementOpportunity: {
    description: string
    expectedBenefit: string
    implementationComplexity: "low" | "medium" | "high"
    risks: string[]
  }
}

/**
 * Pattern recognition engine
 */
export class PatternRecognitionEngine {
  /**
   * Analyze metrics and identify patterns
   */
  static analyzeMetrics(metrics: ExtendedMetrics[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = []

    // Detect different pattern types
    patterns.push(...this.detectHotspots(metrics))
    patterns.push(...this.detectBottlenecks(metrics))
    patterns.push(...this.detectInefficiencies(metrics))
    patterns.push(...this.detectErrorPatterns(metrics))
    patterns.push(...this.detectResourceIntensivePatterns(metrics))
    patterns.push(...this.detectRedundantOperations(metrics))
    patterns.push(...this.detectSuboptimalSequences(metrics))

    // Sort by overall impact
    return patterns.sort((a, b) => {
      const impactA = this.calculateOverallImpact(a)
      const impactB = this.calculateOverallImpact(b)
      return impactB - impactA
    })
  }

  /**
   * Detect execution hotspots
   */
  private static detectHotspots(metrics: ExtendedMetrics[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = []
    const toolFrequency = new Map<string, number>()
    const toolPairFrequency = new Map<string, number>()

    // Count tool frequencies and pairs
    for (let i = 0; i < metrics.length; i++) {
      const current = metrics[i]
      toolFrequency.set(
        current.toolId,
        (toolFrequency.get(current.toolId) || 0) + 1,
      )

      if (i < metrics.length - 1) {
        const next = metrics[i + 1]
        const pair = `${current.toolId}->${next.toolId}`
        toolPairFrequency.set(pair, (toolPairFrequency.get(pair) || 0) + 1)
      }
    }

    // Identify high-frequency patterns
    toolPairFrequency.forEach((count, pair) => {
      const frequency = count / metrics.length
      if (frequency > 0.1) {
        // More than 10% of executions
        const [tool1, tool2] = pair.split("->")
        const relevantMetrics = metrics.filter(
          (m) => m.toolId === tool1 || m.toolId === tool2,
        )

        patterns.push({
          id: `hotspot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: PatternType.HOTSPOT,
          confidence: Math.min(frequency * 2, 0.95),
          frequency: count,
          impact: {
            performanceImpact: frequency * 0.8,
            userExperienceImpact: frequency * 0.6,
            resourceImpact: frequency * 0.4,
          },
          context: {
            tools: [tool1, tool2],
            averageExecutionTime: this.calculateAverageTime(relevantMetrics),
            errorRate: this.calculateErrorRate(relevantMetrics),
            resourceUsage: this.calculateResourceUsage(relevantMetrics),
          },
          improvementOpportunity: {
            description: `Optimize frequently used sequence ${tool1} -> ${tool2}`,
            expectedBenefit: `${Math.round(frequency * 100)}% of operations could be faster`,
            implementationComplexity: "medium",
            risks: [
              "May affect existing workflows",
              "Requires careful testing",
            ],
          },
        })
      }
    })

    return patterns
  }

  /**
   * Detect performance bottlenecks
   */
  private static detectBottlenecks(
    metrics: ExtendedMetrics[],
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = []
    const toolMetrics = new Map<string, ExtendedMetrics[]>()

    // Group by tool
    metrics.forEach((m) => {
      const group = toolMetrics.get(m.toolId) || []
      group.push(m)
      toolMetrics.set(m.toolId, group)
    })

    // Analyze each tool
    toolMetrics.forEach((toolData, toolId) => {
      const durations = toolData
        .map((m) => m.duration || 0)
        .filter((d) => d > 0)
      if (durations.length === 0) return

      const avgDuration =
        durations.reduce((a, b) => a + b, 0) / durations.length
      const p95Duration = this.getPercentile(durations, 95)

      // Check for slow execution
      if (p95Duration > 3000) {
        // 3 seconds
        patterns.push({
          id: `bottleneck-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: PatternType.BOTTLENECK,
          confidence: 0.9,
          frequency: toolData.length,
          impact: {
            performanceImpact: Math.min(p95Duration / 5000, 1), // Scale to 0-1
            userExperienceImpact: Math.min(p95Duration / 3000, 1),
            resourceImpact: 0.3,
          },
          context: {
            tools: [toolId],
            averageExecutionTime: avgDuration,
            errorRate: this.calculateErrorRate(toolData),
            resourceUsage: this.calculateResourceUsage(toolData),
          },
          improvementOpportunity: {
            description: `Tool ${toolId} has slow execution times (p95: ${Math.round(p95Duration)}ms)`,
            expectedBenefit: `Reduce execution time by up to ${Math.round(((p95Duration - avgDuration) / p95Duration) * 100)}%`,
            implementationComplexity: "high",
            risks: [
              "May require significant refactoring",
              "Could introduce new bugs",
            ],
          },
        })
      }
    })

    return patterns
  }

  /**
   * Detect inefficient patterns
   */
  private static detectInefficiencies(
    metrics: ExtendedMetrics[],
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = []

    // Look for read-write patterns that could be optimized
    for (let i = 0; i < metrics.length - 2; i++) {
      const [first, second, third] = metrics.slice(i, i + 3)

      // Multiple reads followed by write
      if (
        first.toolId === "read" &&
        second.toolId === "read" &&
        third.toolId === "write"
      ) {
        patterns.push({
          id: `inefficiency-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: PatternType.INEFFICIENCY,
          confidence: 0.85,
          frequency: 1,
          impact: {
            performanceImpact: 0.6,
            userExperienceImpact: 0.4,
            resourceImpact: 0.5,
          },
          context: {
            tools: ["read", "read", "write"],
            averageExecutionTime:
              (first.duration || 0) +
              (second.duration || 0) +
              (third.duration || 0),
            errorRate: 0,
            resourceUsage: this.calculateResourceUsage([first, second, third]),
          },
          improvementOpportunity: {
            description:
              "Multiple read operations before write could be batched",
            expectedBenefit: "Reduce I/O operations by 50%",
            implementationComplexity: "low",
            risks: ["May increase memory usage temporarily"],
          },
        })
      }

      // Read-modify-write on same file
      if (
        first.toolId === "read" &&
        third.toolId === "write" &&
        first.metadata?.["filePath"] === third.metadata?.["filePath"]
      ) {
        patterns.push({
          id: `inefficiency-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: PatternType.INEFFICIENCY,
          confidence: 0.9,
          frequency: 1,
          impact: {
            performanceImpact: 0.7,
            userExperienceImpact: 0.5,
            resourceImpact: 0.6,
          },
          context: {
            tools: ["read", "modify", "write"],
            averageExecutionTime: (first.duration || 0) + (third.duration || 0),
            errorRate: 0,
            resourceUsage: this.calculateResourceUsage([first, third]),
          },
          improvementOpportunity: {
            description:
              "Read-modify-write pattern could use edit tool instead",
            expectedBenefit: "Reduce file operations by 66%",
            implementationComplexity: "low",
            risks: ["Ensure edit tool supports required modifications"],
          },
        })
      }
    }

    return patterns
  }

  /**
   * Detect error-prone patterns
   */
  private static detectErrorPatterns(
    metrics: ExtendedMetrics[],
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = []
    const errorSequences = new Map<string, { count: number; errors: number }>()

    // Find sequences that often lead to errors
    for (let i = 0; i < metrics.length - 2; i++) {
      const sequence = metrics.slice(i, i + 3)
      const sequenceKey = sequence.map((m) => m.toolId).join("->")
      const hasError = sequence.some((m) => !m.success)

      const stats = errorSequences.get(sequenceKey) || { count: 0, errors: 0 }
      stats.count++
      if (hasError) stats.errors++
      errorSequences.set(sequenceKey, stats)
    }

    // Identify high error rate sequences
    errorSequences.forEach((stats, sequence) => {
      const errorRate = stats.errors / stats.count
      if (errorRate > 0.2 && stats.count > 3) {
        // 20% error rate with enough samples
        const tools = sequence.split("->")

        patterns.push({
          id: `error-prone-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: PatternType.ERROR_PRONE,
          confidence: Math.min(stats.count / 10, 0.95),
          frequency: stats.count,
          impact: {
            performanceImpact: errorRate * 0.8,
            userExperienceImpact: errorRate * 0.9,
            resourceImpact: errorRate * 0.5,
          },
          context: {
            tools,
            averageExecutionTime: 0, // Not relevant for error patterns
            errorRate,
            resourceUsage: { memory: 0, io: 0 },
          },
          improvementOpportunity: {
            description: `Sequence ${sequence} has ${Math.round(errorRate * 100)}% error rate`,
            expectedBenefit: `Prevent ${Math.round(stats.errors)} errors`,
            implementationComplexity: "medium",
            risks: ["May require error handling improvements"],
          },
        })
      }
    })

    return patterns
  }

  /**
   * Detect resource-intensive patterns
   */
  private static detectResourceIntensivePatterns(
    metrics: ExtendedMetrics[],
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = []
    const toolResourceUsage = new Map<
      string,
      { metrics: ExtendedMetrics[]; totalMemory: number }
    >()

    // Aggregate resource usage by tool
    metrics.forEach((m) => {
      const stats = toolResourceUsage.get(m.toolId) || {
        metrics: [],
        totalMemory: 0,
      }
      stats.metrics.push(m)
      stats.totalMemory += m.resourceUsage.memoryDelta
      toolResourceUsage.set(m.toolId, stats)
    })

    // Find resource hogs
    toolResourceUsage.forEach((stats, toolId) => {
      const avgMemory = stats.totalMemory / stats.metrics.length

      if (avgMemory > 50 * 1024 * 1024) {
        // 50MB average
        patterns.push({
          id: `resource-intensive-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: PatternType.RESOURCE_INTENSIVE,
          confidence: 0.85,
          frequency: stats.metrics.length,
          impact: {
            performanceImpact: 0.6,
            userExperienceImpact: 0.4,
            resourceImpact: Math.min(avgMemory / (100 * 1024 * 1024), 1),
          },
          context: {
            tools: [toolId],
            averageExecutionTime: this.calculateAverageTime(stats.metrics),
            errorRate: this.calculateErrorRate(stats.metrics),
            resourceUsage: {
              memory: avgMemory,
              io:
                stats.metrics.reduce(
                  (sum, m) => sum + m.resourceUsage.ioOperations,
                  0,
                ) / stats.metrics.length,
            },
          },
          improvementOpportunity: {
            description: `Tool ${toolId} uses excessive memory (avg: ${Math.round(avgMemory / 1024 / 1024)}MB)`,
            expectedBenefit:
              "Reduce memory usage by optimizing data structures",
            implementationComplexity: "medium",
            risks: ["May affect performance if not done carefully"],
          },
        })
      }
    })

    return patterns
  }

  /**
   * Detect redundant operations
   */
  private static detectRedundantOperations(
    metrics: ExtendedMetrics[],
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = []

    // Look for repeated operations in short windows
    const windowSize = 5
    for (let i = 0; i < metrics.length - windowSize; i++) {
      const window = metrics.slice(i, i + windowSize)
      const toolCounts = new Map<string, number>()

      window.forEach((m) => {
        toolCounts.set(m.toolId, (toolCounts.get(m.toolId) || 0) + 1)
      })

      toolCounts.forEach((count, tool) => {
        if (count >= 3) {
          // Same tool 3+ times in 5 operations
          patterns.push({
            id: `redundant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: PatternType.REDUNDANT,
            confidence: 0.8,
            frequency: count,
            impact: {
              performanceImpact: 0.7,
              userExperienceImpact: 0.5,
              resourceImpact: 0.6,
            },
            context: {
              tools: [tool],
              averageExecutionTime: this.calculateAverageTime(
                window.filter((m) => m.toolId === tool),
              ),
              errorRate: 0,
              resourceUsage: this.calculateResourceUsage(
                window.filter((m) => m.toolId === tool),
              ),
            },
            improvementOpportunity: {
              description: `Tool ${tool} called ${count} times in ${windowSize} operations`,
              expectedBenefit:
                "Reduce redundant operations through caching or batching",
              implementationComplexity: "low",
              risks: ["Ensure operations are truly redundant"],
            },
          })
        }
      })
    }

    return patterns
  }

  /**
   * Detect suboptimal sequences
   */
  private static detectSuboptimalSequences(
    metrics: ExtendedMetrics[],
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = []

    // Known suboptimal patterns
    const suboptimalPatterns = [
      {
        sequence: ["bash", "bash", "bash"],
        optimal: ["bash with &&"],
        description: "Multiple bash commands could be combined",
      },
      {
        sequence: ["grep", "read", "grep"],
        optimal: ["grep with better pattern"],
        description: "Multiple grep operations indicate inefficient search",
      },
      {
        sequence: ["list", "read", "list"],
        optimal: ["glob or targeted list"],
        description: "Repeated listing suggests need for better file discovery",
      },
    ]

    // Check for known suboptimal patterns
    for (let i = 0; i < metrics.length - 3; i++) {
      const sequence = metrics.slice(i, i + 3).map((m) => m.toolId)

      suboptimalPatterns.forEach((pattern) => {
        if (JSON.stringify(sequence) === JSON.stringify(pattern.sequence)) {
          patterns.push({
            id: `suboptimal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: PatternType.SUBOPTIMAL_SEQUENCE,
            confidence: 0.9,
            frequency: 1,
            impact: {
              performanceImpact: 0.6,
              userExperienceImpact: 0.5,
              resourceImpact: 0.4,
            },
            context: {
              tools: sequence,
              averageExecutionTime: metrics
                .slice(i, i + 3)
                .reduce((sum, m) => sum + (m.duration || 0), 0),
              errorRate: 0,
              resourceUsage: this.calculateResourceUsage(
                metrics.slice(i, i + 3),
              ),
            },
            improvementOpportunity: {
              description: pattern.description,
              expectedBenefit: `Replace with: ${pattern.optimal}`,
              implementationComplexity: "low",
              risks: ["Ensure replacement maintains same functionality"],
            },
          })
        }
      })
    }

    return patterns
  }

  /**
   * Helper: Calculate overall impact score
   */
  private static calculateOverallImpact(pattern: DetectedPattern): number {
    const { performanceImpact, userExperienceImpact, resourceImpact } =
      pattern.impact
    return (
      (performanceImpact * 0.4 +
        userExperienceImpact * 0.4 +
        resourceImpact * 0.2) *
      pattern.confidence
    )
  }

  /**
   * Helper: Calculate average execution time
   */
  private static calculateAverageTime(metrics: ExtendedMetrics[]): number {
    const durations = metrics.map((m) => m.duration || 0).filter((d) => d > 0)
    return durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0
  }

  /**
   * Helper: Calculate error rate
   */
  private static calculateErrorRate(metrics: ExtendedMetrics[]): number {
    const errorCount = metrics.filter((m) => !m.success).length
    return metrics.length > 0 ? errorCount / metrics.length : 0
  }

  /**
   * Helper: Calculate resource usage
   */
  private static calculateResourceUsage(metrics: ExtendedMetrics[]): {
    memory: number
    cpu?: number
    io: number
  } {
    const totalMemory = metrics.reduce(
      (sum, m) => sum + m.resourceUsage.memoryDelta,
      0,
    )
    const totalIo = metrics.reduce(
      (sum, m) => sum + m.resourceUsage.ioOperations,
      0,
    )

    return {
      memory: metrics.length > 0 ? totalMemory / metrics.length : 0,
      io: metrics.length > 0 ? totalIo / metrics.length : 0,
    }
  }

  /**
   * Helper: Get percentile
   */
  private static getPercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)] || 0
  }
}

/**
 * Hypothesis generator - converts patterns to improvement hypotheses
 */
export class HypothesisGenerator {
  /**
   * Generate improvement hypotheses from detected patterns
   */
  static generateHypotheses(
    patterns: DetectedPattern[],
  ): ImprovementHypothesis[] {
    return patterns
      .filter((p) => this.calculateOverallImpact(p) > 0.3) // Only significant patterns
      .map((pattern) => this.patternToHypothesis(pattern))
      .filter((h) => h !== null) as ImprovementHypothesis[]
  }

  /**
   * Convert a pattern to an improvement hypothesis
   */
  private static patternToHypothesis(
    pattern: DetectedPattern,
  ): ImprovementHypothesis | null {
    const type = this.mapPatternToEvolutionType(pattern.type)
    if (!type) return null

    return {
      id: `hypothesis-${pattern.id}`,
      type,
      description: this.generateDescription(pattern),
      expectedImpact: this.generateExpectedImpact(pattern),
      confidence: pattern.confidence,
      risks: pattern.improvementOpportunity.risks,
      dependencies: pattern.context.tools,
    }
  }

  /**
   * Map pattern type to evolution request type
   */
  private static mapPatternToEvolutionType(
    patternType: PatternType,
  ): EvolutionRequestType | null {
    const mapping: Record<PatternType, EvolutionRequestType> = {
      [PatternType.HOTSPOT]: "improve_performance" as EvolutionRequestType,
      [PatternType.BOTTLENECK]: "improve_performance" as EvolutionRequestType,
      [PatternType.INEFFICIENCY]: "refactor_code" as EvolutionRequestType,
      [PatternType.ERROR_PRONE]: "fix_bugs" as EvolutionRequestType,
      [PatternType.RESOURCE_INTENSIVE]:
        "optimize_memory" as EvolutionRequestType,
      [PatternType.REDUNDANT]: "refactor_code" as EvolutionRequestType,
      [PatternType.SUBOPTIMAL_SEQUENCE]:
        "improve_performance" as EvolutionRequestType,
    }

    return mapping[patternType] || null
  }

  /**
   * Generate hypothesis description
   */
  private static generateDescription(pattern: DetectedPattern): string {
    const baseDescription = pattern.improvementOpportunity.description
    const tools = pattern.context.tools.join(", ")

    return `${baseDescription}. This pattern involves ${tools} and occurs ${pattern.frequency} times. ${pattern.improvementOpportunity.expectedBenefit}.`
  }

  /**
   * Generate expected impact metrics
   */
  private static generateExpectedImpact(
    pattern: DetectedPattern,
  ): ImprovementHypothesis["expectedImpact"] {
    const impacts: ImprovementHypothesis["expectedImpact"] = []

    if (pattern.impact.performanceImpact > 0.3) {
      impacts.push({
        metric: "execution_time",
        currentValue: pattern.context.averageExecutionTime,
        targetValue:
          pattern.context.averageExecutionTime *
          (1 - pattern.impact.performanceImpact * 0.5),
        improvementPercentage: pattern.impact.performanceImpact * 50,
      })
    }

    if (pattern.impact.resourceImpact > 0.3) {
      impacts.push({
        metric: "memory_usage",
        currentValue: pattern.context.resourceUsage.memory,
        targetValue:
          pattern.context.resourceUsage.memory *
          (1 - pattern.impact.resourceImpact * 0.4),
        improvementPercentage: pattern.impact.resourceImpact * 40,
      })
    }

    if (pattern.context.errorRate > 0.1) {
      impacts.push({
        metric: "error_rate",
        currentValue: pattern.context.errorRate * 100,
        targetValue: pattern.context.errorRate * 50,
        improvementPercentage: 50,
      })
    }

    return impacts
  }

  /**
   * Helper: Calculate overall impact
   */
  private static calculateOverallImpact(pattern: DetectedPattern): number {
    const { performanceImpact, userExperienceImpact, resourceImpact } =
      pattern.impact
    return (
      (performanceImpact * 0.4 +
        userExperienceImpact * 0.4 +
        resourceImpact * 0.2) *
      pattern.confidence
    )
  }
}
