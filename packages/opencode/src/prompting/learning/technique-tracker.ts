import type { TaskType, ComplexityLevel, Capability } from "../types"
import { Storage } from "../../storage/storage"
import { Log } from "../../util/log"

export interface TechniqueUsage {
  id: string
  techniqueId: string
  taskContext: {
    task: string
    taskTypes: TaskType[]
    complexity: ComplexityLevel
    capabilities: Capability[]
    timestamp: number
  }
  execution: {
    startTime: number
    endTime?: number
    duration?: number
    tokensUsed?: number
    success?: boolean
    error?: string
  }
  outcome: {
    userFeedback?: "positive" | "negative" | "neutral"
    qualityScore?: number // 0-1
    completionRate?: number // 0-1
    errorRate?: number // 0-1
  }
  metadata?: Record<string, any>
}

export interface TechniqueMetrics {
  techniqueId: string
  totalUsages: number
  successRate: number
  averageDuration: number
  averageTokens: number
  taskTypePerformance: Map<
    TaskType,
    {
      count: number
      successRate: number
      avgDuration: number
    }
  >
  complexityPerformance: Map<
    ComplexityLevel,
    {
      count: number
      successRate: number
    }
  >
  recentTrend: "improving" | "declining" | "stable"
  lastUpdated: number
}

export class TechniqueTracker {
  private log = Log.create({ service: "technique-tracker" })
  private activeUsages = new Map<string, TechniqueUsage>()
  private metricsCache = new Map<string, TechniqueMetrics>()
  private readonly STORAGE_KEY = "prompting:technique-metrics"
  private readonly USAGE_HISTORY_KEY = "prompting:usage-history"
  private readonly MAX_HISTORY_SIZE = 10000

  async initialize(): Promise<void> {
    // Load existing metrics from storage
    try {
      const metrics = await Storage.readJSON<Record<string, any>>(
        this.STORAGE_KEY,
      )
      for (const [id, metric] of Object.entries(metrics)) {
        // Reconstruct Maps from stored data
        metric.taskTypePerformance = new Map(
          Object.entries(metric.taskTypePerformance as any),
        )
        metric.complexityPerformance = new Map(
          Object.entries(metric.complexityPerformance as any),
        )
        this.metricsCache.set(id, metric as TechniqueMetrics)
      }
      this.log.info(`Loaded metrics for ${this.metricsCache.size} techniques`)
    } catch (error) {
      // File doesn't exist yet, that's ok
    }
  }

  async startUsage(
    techniqueId: string,
    task: string,
    taskTypes: TaskType[],
    complexity: ComplexityLevel,
    capabilities: Capability[],
  ): Promise<string> {
    const usageId = `usage_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    const usage: TechniqueUsage = {
      id: usageId,
      techniqueId,
      taskContext: {
        task,
        taskTypes,
        complexity,
        capabilities,
        timestamp: Date.now(),
      },
      execution: {
        startTime: performance.now(),
      },
      outcome: {}, // Initialize empty outcome
    }

    this.activeUsages.set(usageId, usage)
    this.log.info(
      `Started tracking usage ${usageId} for technique ${techniqueId}`,
    )

    return usageId
  }

  async endUsage(
    usageId: string,
    success: boolean,
    tokensUsed?: number,
    error?: string,
  ): Promise<void> {
    const usage = this.activeUsages.get(usageId)
    if (!usage) {
      this.log.warn(`Usage ${usageId} not found`)
      return
    }

    // Update execution details
    usage.execution.endTime = performance.now()
    usage.execution.duration =
      usage.execution.endTime - usage.execution.startTime
    usage.execution.success = success
    usage.execution.tokensUsed = tokensUsed
    if (error) usage.execution.error = error

    // Initial outcome (can be updated later with feedback)
    usage.outcome = {
      completionRate: success ? 1 : 0,
      errorRate: error ? 1 : 0,
    }

    // Update metrics
    await this.updateMetrics(usage)

    // Store usage history
    await this.storeUsageHistory(usage)

    // Remove from active
    this.activeUsages.delete(usageId)

    this.log.info(`Completed tracking usage ${usageId}`)
  }

  async recordFeedback(
    usageId: string,
    feedback: "positive" | "negative" | "neutral",
    qualityScore?: number,
  ): Promise<void> {
    // Try to find in recent history
    const history = await this.getRecentHistory(100)
    const usage = history.find((u) => u.id === usageId)

    if (usage) {
      usage.outcome.userFeedback = feedback
      if (qualityScore !== undefined) {
        usage.outcome.qualityScore = qualityScore
      }

      // Update metrics with feedback
      await this.updateMetricsWithFeedback(usage)

      this.log.info(`Recorded feedback for usage ${usageId}`)
    }
  }

  async getMetrics(techniqueId: string): Promise<TechniqueMetrics | null> {
    return this.metricsCache.get(techniqueId) || null
  }

  async getAllMetrics(): Promise<Map<string, TechniqueMetrics>> {
    return new Map(this.metricsCache)
  }

  async getUsageHistory(
    techniqueId?: string,
    limit: number = 100,
  ): Promise<TechniqueUsage[]> {
    const history = await this.getRecentHistory(limit * 2)

    if (techniqueId) {
      return history
        .filter((u) => u.techniqueId === techniqueId)
        .slice(0, limit)
    }

    return history.slice(0, limit)
  }

  private async updateMetrics(usage: TechniqueUsage): Promise<void> {
    let metrics = this.metricsCache.get(usage.techniqueId)

    if (!metrics) {
      metrics = {
        techniqueId: usage.techniqueId,
        totalUsages: 0,
        successRate: 0,
        averageDuration: 0,
        averageTokens: 0,
        taskTypePerformance: new Map(),
        complexityPerformance: new Map(),
        recentTrend: "stable",
        lastUpdated: Date.now(),
      }
    }

    // Update basic metrics
    metrics.totalUsages++

    // Update success rate (exponential moving average)
    const alpha = 0.1
    const success = usage.execution.success ? 1 : 0
    metrics.successRate = metrics.successRate * (1 - alpha) + success * alpha

    // Update average duration
    if (usage.execution.duration) {
      metrics.averageDuration =
        (metrics.averageDuration * (metrics.totalUsages - 1) +
          usage.execution.duration) /
        metrics.totalUsages
    }

    // Update average tokens
    if (usage.execution.tokensUsed) {
      metrics.averageTokens =
        (metrics.averageTokens * (metrics.totalUsages - 1) +
          usage.execution.tokensUsed) /
        metrics.totalUsages
    }

    // Update task type performance
    for (const taskType of usage.taskContext.taskTypes) {
      const perf = metrics.taskTypePerformance.get(taskType) || {
        count: 0,
        successRate: 0,
        avgDuration: 0,
      }

      perf.count++
      perf.successRate = perf.successRate * (1 - alpha) + success * alpha

      if (usage.execution.duration) {
        perf.avgDuration =
          (perf.avgDuration * (perf.count - 1) + usage.execution.duration) /
          perf.count
      }

      metrics.taskTypePerformance.set(taskType, perf)
    }

    // Update complexity performance
    const complexPerf = metrics.complexityPerformance.get(
      usage.taskContext.complexity,
    ) || {
      count: 0,
      successRate: 0,
    }

    complexPerf.count++
    complexPerf.successRate =
      complexPerf.successRate * (1 - alpha) + success * alpha
    metrics.complexityPerformance.set(usage.taskContext.complexity, complexPerf)

    // Determine trend
    metrics.recentTrend = await this.calculateTrend(usage.techniqueId)
    metrics.lastUpdated = Date.now()

    // Update cache and persist
    this.metricsCache.set(usage.techniqueId, metrics)
    await this.persistMetrics()
  }

  private async updateMetricsWithFeedback(
    usage: TechniqueUsage,
  ): Promise<void> {
    const metrics = this.metricsCache.get(usage.techniqueId)
    if (!metrics) return

    // Adjust success rate based on feedback
    const feedbackWeight = 0.2
    let adjustment = 0

    if (usage.outcome.userFeedback === "positive") {
      adjustment = feedbackWeight
    } else if (usage.outcome.userFeedback === "negative") {
      adjustment = -feedbackWeight
    }

    metrics.successRate = Math.max(
      0,
      Math.min(1, metrics.successRate + adjustment),
    )

    // Update quality score if provided
    if (usage.outcome.qualityScore !== undefined) {
      // Incorporate quality score into success rate
      const qualityWeight = 0.1
      metrics.successRate =
        metrics.successRate * (1 - qualityWeight) +
        usage.outcome.qualityScore * qualityWeight
    }

    metrics.lastUpdated = Date.now()
    await this.persistMetrics()
  }

  private async calculateTrend(
    techniqueId: string,
  ): Promise<"improving" | "declining" | "stable"> {
    const recentHistory = await this.getUsageHistory(techniqueId, 20)
    if (recentHistory.length < 10) return "stable"

    // Calculate success rate for first half vs second half
    const midpoint = Math.floor(recentHistory.length / 2)
    const firstHalf = recentHistory.slice(0, midpoint)
    const secondHalf = recentHistory.slice(midpoint)

    const firstRate =
      firstHalf.filter((u) => u.execution.success).length / firstHalf.length
    const secondRate =
      secondHalf.filter((u) => u.execution.success).length / secondHalf.length

    const difference = secondRate - firstRate

    if (difference > 0.1) return "improving"
    if (difference < -0.1) return "declining"
    return "stable"
  }

  private async storeUsageHistory(usage: TechniqueUsage): Promise<void> {
    const history = await this.getRecentHistory(this.MAX_HISTORY_SIZE)

    // Add new usage
    history.unshift(usage)

    // Trim to max size
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.splice(this.MAX_HISTORY_SIZE)
    }

    await Storage.writeJSON(this.USAGE_HISTORY_KEY, history)
  }

  private async getRecentHistory(limit: number): Promise<TechniqueUsage[]> {
    try {
      const history = await Storage.readJSON<TechniqueUsage[]>(
        this.USAGE_HISTORY_KEY,
      )
      return history.slice(0, limit)
    } catch {
      return []
    }
  }

  private async persistMetrics(): Promise<void> {
    const metricsObj: Record<string, any> = {}

    for (const [id, metrics] of this.metricsCache) {
      metricsObj[id] = {
        ...metrics,
        // Convert Maps to objects for storage
        taskTypePerformance: Object.fromEntries(metrics.taskTypePerformance),
        complexityPerformance: Object.fromEntries(
          metrics.complexityPerformance,
        ),
      }
    }

    await Storage.writeJSON(this.STORAGE_KEY, metricsObj)
  }

  async exportMetrics(): Promise<{
    metrics: Record<string, TechniqueMetrics>
    recentHistory: TechniqueUsage[]
  }> {
    const metrics: Record<string, TechniqueMetrics> = {}
    for (const [id, metric] of this.metricsCache) {
      metrics[id] = metric
    }

    const recentHistory = await this.getRecentHistory(1000)

    return { metrics, recentHistory }
  }

  async reset(): Promise<void> {
    this.metricsCache.clear()
    this.activeUsages.clear()
    await Storage.remove(this.STORAGE_KEY)
    await Storage.remove(this.USAGE_HISTORY_KEY)
    this.log.info("Reset all technique tracking data")
  }
}

// Singleton instance
export const techniqueTracker = new TechniqueTracker()
