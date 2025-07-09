import type { TaskType, ComplexityLevel } from "../types"
import type { TechniqueUsage } from "./technique-tracker"
import { techniqueTracker } from "./technique-tracker"

export interface PerformanceInsight {
  techniqueId: string
  insight: string
  confidence: number
  recommendation?: string
}

export interface TechniqueComparison {
  techniqueA: string
  techniqueB: string
  winner: string | "tie"
  metrics: {
    successRateDiff: number
    avgDurationDiff: number
    avgTokensDiff: number
  }
  confidence: number
}

export interface TaskTypeAnalysis {
  taskType: TaskType
  bestTechniques: Array<{
    techniqueId: string
    successRate: number
    avgDuration: number
    usageCount: number
  }>
  insights: string[]
}

export interface PerformanceReport {
  summary: {
    totalTechniques: number
    totalUsages: number
    overallSuccessRate: number
    topPerformers: string[]
    underperformers: string[]
  }
  taskTypeAnalysis: TaskTypeAnalysis[]
  complexityAnalysis: Map<
    ComplexityLevel,
    {
      bestTechniques: string[]
      avgSuccessRate: number
    }
  >
  insights: PerformanceInsight[]
  recommendations: string[]
}

export class PerformanceAnalyzer {
  async analyzeEffectiveness(
    techniqueId: string,
    taskType?: TaskType,
  ): Promise<{
    effectiveness: number
    confidence: number
    insights: string[]
  }> {
    const metrics = await techniqueTracker.getMetrics(techniqueId)
    if (!metrics) {
      return {
        effectiveness: 0,
        confidence: 0,
        insights: ["No usage data available for this technique"],
      }
    }

    const insights: string[] = []
    let effectiveness = metrics.successRate

    // Task-specific analysis
    if (taskType && metrics.taskTypePerformance.has(taskType)) {
      const taskPerf = metrics.taskTypePerformance.get(taskType)!
      effectiveness = taskPerf.successRate

      if (taskPerf.count < 5) {
        insights.push(
          `Limited data for ${taskType} tasks (${taskPerf.count} uses)`,
        )
      } else if (taskPerf.successRate > 0.8) {
        insights.push(`Excellent performance on ${taskType} tasks`)
      } else if (taskPerf.successRate < 0.5) {
        insights.push(`Struggles with ${taskType} tasks`)
      }
    }

    // Trend analysis
    if (metrics.recentTrend === "improving") {
      insights.push("Performance is improving over time")
      effectiveness *= 1.1 // Boost for improvement
    } else if (metrics.recentTrend === "declining") {
      insights.push("Performance is declining - may need adjustment")
      effectiveness *= 0.9 // Penalty for decline
    }

    // Token efficiency
    if (metrics.averageTokens > 0) {
      const tokenEfficiency =
        metrics.successRate / (metrics.averageTokens / 1000)
      if (tokenEfficiency > 2) {
        insights.push("Very token-efficient")
      } else if (tokenEfficiency < 0.5) {
        insights.push("High token usage relative to success rate")
      }
    }

    // Confidence based on usage count
    const confidence = Math.min(1, Math.log10(metrics.totalUsages + 1) / 2)

    return {
      effectiveness: Math.min(1, effectiveness),
      confidence,
      insights,
    }
  }

  async identifyPatterns(minUsages: number = 10): Promise<{
    successfulCombinations: Array<{
      techniques: string[]
      taskTypes: TaskType[]
      successRate: number
      usageCount: number
    }>
    failurePatterns: Array<{
      technique: string
      commonFailureReasons: string[]
      taskTypes: TaskType[]
    }>
  }> {
    const recentHistory = await techniqueTracker.getUsageHistory(
      undefined,
      1000,
    )

    // Analyze successful combinations
    const combinationMap = new Map<
      string,
      {
        techniques: string[]
        taskTypes: Set<TaskType>
        successes: number
        total: number
      }
    >()

    // Group usages by time window to find combinations
    const timeWindow = 5 * 60 * 1000 // 5 minutes
    let currentWindow: TechniqueUsage[] = []
    let windowStart = 0

    for (const usage of recentHistory) {
      if (windowStart === 0) {
        windowStart = usage.taskContext.timestamp
      }

      if (usage.taskContext.timestamp - windowStart <= timeWindow) {
        currentWindow.push(usage)
      } else {
        // Process window
        if (currentWindow.length > 1) {
          const techniques = [
            ...new Set(currentWindow.map((u) => u.techniqueId)),
          ]
          const key = techniques.sort().join("+")

          if (!combinationMap.has(key)) {
            combinationMap.set(key, {
              techniques,
              taskTypes: new Set(),
              successes: 0,
              total: 0,
            })
          }

          const combo = combinationMap.get(key)!
          currentWindow.forEach((u) => {
            u.taskContext.taskTypes.forEach((t) => combo.taskTypes.add(t))
            combo.total++
            if (u.execution.success) combo.successes++
          })
        }

        // Start new window
        currentWindow = [usage]
        windowStart = usage.taskContext.timestamp
      }
    }

    // Convert to array and filter
    const successfulCombinations = Array.from(combinationMap.values())
      .filter((c) => c.total >= minUsages)
      .map((c) => ({
        techniques: c.techniques,
        taskTypes: Array.from(c.taskTypes),
        successRate: c.successes / c.total,
        usageCount: c.total,
      }))
      .sort((a, b) => b.successRate - a.successRate)

    // Analyze failure patterns
    const failureMap = new Map<
      string,
      {
        technique: string
        errors: Map<string, number>
        taskTypes: Set<TaskType>
      }
    >()

    for (const usage of recentHistory) {
      if (!usage.execution.success && usage.execution.error) {
        if (!failureMap.has(usage.techniqueId)) {
          failureMap.set(usage.techniqueId, {
            technique: usage.techniqueId,
            errors: new Map(),
            taskTypes: new Set(),
          })
        }

        const failure = failureMap.get(usage.techniqueId)!
        const errorType = this.categorizeError(usage.execution.error)
        failure.errors.set(errorType, (failure.errors.get(errorType) || 0) + 1)
        usage.taskContext.taskTypes.forEach((t) => failure.taskTypes.add(t))
      }
    }

    const failurePatterns = Array.from(failureMap.values())
      .filter((f) => {
        const totalErrors = Array.from(f.errors.values()).reduce(
          (a, b) => a + b,
          0,
        )
        return totalErrors >= 3
      })
      .map((f) => ({
        technique: f.technique,
        commonFailureReasons: Array.from(f.errors.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([reason]) => reason),
        taskTypes: Array.from(f.taskTypes),
      }))

    return { successfulCombinations, failurePatterns }
  }

  async generateRecommendations(
    taskType: TaskType,
    complexity: ComplexityLevel,
    currentTechniques?: string[],
  ): Promise<{
    recommended: string[]
    avoid: string[]
    reasoning: string[]
  }> {
    const allMetrics = await techniqueTracker.getAllMetrics()
    const recommendations: string[] = []
    const avoid: string[] = []
    const reasoning: string[] = []

    // Score each technique for the given task
    const scores = new Map<string, number>()

    for (const [techniqueId, metrics] of allMetrics) {
      let score = 0

      // Task type performance
      if (metrics.taskTypePerformance.has(taskType)) {
        const perf = metrics.taskTypePerformance.get(taskType)!
        if (perf.count >= 3) {
          score += perf.successRate * 40

          if (perf.successRate > 0.8) {
            reasoning.push(
              `${techniqueId} has excellent success rate for ${taskType}`,
            )
          }
        }
      }

      // Complexity performance
      if (metrics.complexityPerformance.has(complexity)) {
        const perf = metrics.complexityPerformance.get(complexity)!
        if (perf.count >= 3) {
          score += perf.successRate * 30
        }
      }

      // Overall performance
      score += metrics.successRate * 20

      // Trend bonus/penalty
      if (metrics.recentTrend === "improving") score += 10
      if (metrics.recentTrend === "declining") score -= 10

      // Avoid if consistently failing
      if (metrics.totalUsages >= 10 && metrics.successRate < 0.3) {
        avoid.push(techniqueId)
        reasoning.push(`${techniqueId} has poor overall performance`)
      } else if (score > 50) {
        scores.set(techniqueId, score)
      }
    }

    // Get top recommendations
    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    recommendations.push(...sorted.map(([id]) => id))

    // Check for synergies with current techniques
    if (currentTechniques && currentTechniques.length > 0) {
      const patterns = await this.identifyPatterns()
      const relevantCombos = patterns.successfulCombinations.filter(
        (c) =>
          c.taskTypes.includes(taskType) &&
          currentTechniques.some((ct) => c.techniques.includes(ct)),
      )

      for (const combo of relevantCombos) {
        const missing = combo.techniques.filter(
          (t) => !currentTechniques.includes(t),
        )
        if (missing.length > 0 && combo.successRate > 0.7) {
          recommendations.unshift(...missing)
          reasoning.push(
            `${missing.join(" + ")} works well with ${currentTechniques.join(", ")}`,
          )
        }
      }
    }

    return {
      recommended: [...new Set(recommendations)].slice(0, 3),
      avoid: [...new Set(avoid)],
      reasoning,
    }
  }

  async generatePerformanceReport(): Promise<PerformanceReport> {
    const allMetrics = await techniqueTracker.getAllMetrics()
    const recentHistory = await techniqueTracker.getUsageHistory(
      undefined,
      1000,
    )

    // Calculate summary statistics
    let totalUsages = 0
    let totalSuccesses = 0
    const techniqueScores: Array<[string, number]> = []

    for (const [id, metrics] of allMetrics) {
      totalUsages += metrics.totalUsages
      totalSuccesses += Math.round(metrics.totalUsages * metrics.successRate)
      techniqueScores.push([
        id,
        metrics.successRate * Math.log10(metrics.totalUsages + 1),
      ])
    }

    techniqueScores.sort((a, b) => b[1] - a[1])

    const summary = {
      totalTechniques: allMetrics.size,
      totalUsages,
      overallSuccessRate: totalUsages > 0 ? totalSuccesses / totalUsages : 0,
      topPerformers: techniqueScores.slice(0, 3).map(([id]) => id),
      underperformers: techniqueScores
        .filter(([, score]) => score < 0.3)
        .map(([id]) => id),
    }

    // Task type analysis
    const taskTypeMap = new Map<
      TaskType,
      Map<
        string,
        {
          successRate: number
          avgDuration: number
          count: number
        }
      >
    >()

    for (const [techniqueId, metrics] of allMetrics) {
      for (const [taskType, perf] of metrics.taskTypePerformance) {
        if (!taskTypeMap.has(taskType)) {
          taskTypeMap.set(taskType, new Map())
        }

        taskTypeMap.get(taskType)!.set(techniqueId, {
          successRate: perf.successRate,
          avgDuration: perf.avgDuration,
          count: perf.count,
        })
      }
    }

    const taskTypeAnalysis: TaskTypeAnalysis[] = []
    for (const [taskType, techniques] of taskTypeMap) {
      const sorted = Array.from(techniques.entries())
        .filter(([, stats]) => stats.count >= 3)
        .sort((a, b) => b[1].successRate - a[1].successRate)
        .slice(0, 5)

      const insights: string[] = []
      if (sorted.length > 0) {
        const best = sorted[0]
        insights.push(`${best[0]} is most effective for ${taskType} tasks`)

        if (
          sorted.length > 1 &&
          sorted[0][1].successRate - sorted[1][1].successRate > 0.2
        ) {
          insights.push(`${best[0]} significantly outperforms alternatives`)
        }
      }

      taskTypeAnalysis.push({
        taskType,
        bestTechniques: sorted.map(([id, stats]) => ({
          techniqueId: id,
          successRate: stats.successRate,
          avgDuration: stats.avgDuration,
          usageCount: stats.count,
        })),
        insights,
      })
    }

    // Complexity analysis
    const complexityAnalysis = new Map<
      ComplexityLevel,
      {
        bestTechniques: string[]
        avgSuccessRate: number
      }
    >()

    const complexityLevels: ComplexityLevel[] = [
      "low",
      "medium",
      "high",
      "very_high",
    ]
    for (const level of complexityLevels) {
      const techniques: Array<[string, number]> = []
      let totalRate = 0
      let count = 0

      for (const [id, metrics] of allMetrics) {
        if (metrics.complexityPerformance.has(level)) {
          const perf = metrics.complexityPerformance.get(level)!
          if (perf.count >= 3) {
            techniques.push([id, perf.successRate])
            totalRate += perf.successRate
            count++
          }
        }
      }

      techniques.sort((a, b) => b[1] - a[1])

      complexityAnalysis.set(level, {
        bestTechniques: techniques.slice(0, 3).map(([id]) => id),
        avgSuccessRate: count > 0 ? totalRate / count : 0,
      })
    }

    // Generate insights
    const insights: PerformanceInsight[] = []

    // Top performer insights
    for (const topId of summary.topPerformers) {
      const metrics = allMetrics.get(topId)!
      insights.push({
        techniqueId: topId,
        insight: `Top performer with ${(metrics.successRate * 100).toFixed(1)}% success rate`,
        confidence: Math.min(1, metrics.totalUsages / 50),
      })
    }

    // Underperformer insights
    for (const underId of summary.underperformers) {
      const metrics = allMetrics.get(underId)!
      insights.push({
        techniqueId: underId,
        insight: "Consistently underperforming",
        confidence: Math.min(1, metrics.totalUsages / 20),
        recommendation:
          "Consider removing from rotation or adjusting parameters",
      })
    }

    // Generate recommendations
    const recommendations: string[] = []

    if (summary.overallSuccessRate < 0.6) {
      recommendations.push(
        "Overall success rate is low - consider reviewing technique selection criteria",
      )
    }

    if (summary.underperformers.length > summary.topPerformers.length) {
      recommendations.push(
        "Many techniques are underperforming - focus on proven performers",
      )
    }

    // Check for task type gaps
    const taskTypes: TaskType[] = [
      "analysis",
      "generation",
      "problem_solving",
      "coordination",
      "refinement",
      "exploration",
    ]

    for (const taskType of taskTypes) {
      if (!taskTypeMap.has(taskType) || taskTypeMap.get(taskType)!.size < 2) {
        recommendations.push(`Limited technique coverage for ${taskType} tasks`)
      }
    }

    return {
      summary,
      taskTypeAnalysis,
      complexityAnalysis,
      insights,
      recommendations,
    }
  }

  private categorizeError(error: string): string {
    const lowerError = error.toLowerCase()

    if (lowerError.includes("timeout")) return "Timeout"
    if (lowerError.includes("token") || lowerError.includes("limit"))
      return "Token limit"
    if (lowerError.includes("parse") || lowerError.includes("syntax"))
      return "Parse error"
    if (lowerError.includes("validation")) return "Validation error"
    if (lowerError.includes("context")) return "Context error"

    return "Other"
  }

  async compareTechniques(
    techniqueA: string,
    techniqueB: string,
    taskType?: TaskType,
  ): Promise<TechniqueComparison> {
    const metricsA = await techniqueTracker.getMetrics(techniqueA)
    const metricsB = await techniqueTracker.getMetrics(techniqueB)

    if (!metricsA || !metricsB) {
      throw new Error("One or both techniques have no metrics")
    }

    let successRateA = metricsA.successRate
    let successRateB = metricsB.successRate
    let durationA = metricsA.averageDuration
    let durationB = metricsB.averageDuration

    // Use task-specific metrics if available
    if (taskType) {
      if (metricsA.taskTypePerformance.has(taskType)) {
        const perfA = metricsA.taskTypePerformance.get(taskType)!
        successRateA = perfA.successRate
        durationA = perfA.avgDuration
      }
      if (metricsB.taskTypePerformance.has(taskType)) {
        const perfB = metricsB.taskTypePerformance.get(taskType)!
        successRateB = perfB.successRate
        durationB = perfB.avgDuration
      }
    }

    const successDiff = successRateA - successRateB
    const durationDiff = durationA - durationB
    const tokenDiff = metricsA.averageTokens - metricsB.averageTokens

    // Determine winner
    let winner: string | "tie" = "tie"
    if (Math.abs(successDiff) > 0.1) {
      winner = successDiff > 0 ? techniqueA : techniqueB
    } else if (Math.abs(durationDiff) > 100) {
      winner = durationDiff < 0 ? techniqueA : techniqueB
    }

    // Calculate confidence based on usage counts
    const minUsages = Math.min(metricsA.totalUsages, metricsB.totalUsages)
    const confidence = Math.min(1, Math.log10(minUsages + 1) / 2)

    return {
      techniqueA,
      techniqueB,
      winner,
      metrics: {
        successRateDiff: successDiff,
        avgDurationDiff: durationDiff,
        avgTokensDiff: tokenDiff,
      },
      confidence,
    }
  }
}

// Singleton instance
export const performanceAnalyzer = new PerformanceAnalyzer()
