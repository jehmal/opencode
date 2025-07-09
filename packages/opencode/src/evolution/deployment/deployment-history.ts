/**
 * Deployment History Tracker
 * Records and analyzes deployment history for insights
 */

import type {
  Deployment,
  DeploymentResult,
  DeploymentStrategy,
} from "./evolution-deployment-manager"

export interface DeploymentRecord {
  id: string
  evolutionId: string
  timestamp: number
  strategy: DeploymentStrategy
  duration: number
  result: DeploymentResult
  metrics: {
    affectedUsers: number
    errorRate: number
    performanceImpact: number
    rollbackRequired: boolean
  }
  stages: {
    name: string
    duration: number
    success: boolean
  }[]
}

export interface DeploymentAnalytics {
  totalDeployments: number
  successRate: number
  averageDuration: number
  strategyBreakdown: {
    strategy: DeploymentStrategy
    count: number
    successRate: number
    avgDuration: number
  }[]
  rollbackRate: number
  trends: {
    period: string
    deployments: number
    successRate: number
    rollbacks: number
  }[]
}

export interface IStorageAdapter {
  save(key: string, data: any): Promise<void>
  load(key: string): Promise<any>
  exists(key: string): Promise<boolean>
}

export class InMemoryStorageAdapter implements IStorageAdapter {
  private storage: Map<string, any> = new Map()

  async save(key: string, data: any): Promise<void> {
    this.storage.set(key, JSON.parse(JSON.stringify(data)))
  }

  async load(key: string): Promise<any> {
    const data = this.storage.get(key)
    return data ? JSON.parse(JSON.stringify(data)) : null
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key)
  }
}

export class DeploymentHistoryTracker {
  private history: DeploymentRecord[] = []
  private storage: IStorageAdapter
  private readonly STORAGE_KEY = "deployment-history"

  constructor(storage?: IStorageAdapter) {
    this.storage = storage || new InMemoryStorageAdapter()
    this.loadHistory()
  }

  private async loadHistory(): Promise<void> {
    try {
      const data = await this.storage.load(this.STORAGE_KEY)
      if (data && Array.isArray(data)) {
        this.history = data
      }
    } catch (error) {
      console.error("Failed to load deployment history:", error)
    }
  }

  async recordDeployment(deployment: Deployment): Promise<void> {
    if (!deployment.result) {
      throw new Error("Cannot record deployment without result")
    }

    const record: DeploymentRecord = {
      id: deployment.id,
      evolutionId: deployment.evolution.id,
      timestamp: deployment.startTime,
      strategy: deployment.strategy,
      duration: deployment.endTime
        ? deployment.endTime - deployment.startTime
        : 0,
      result: deployment.result,
      metrics: {
        affectedUsers: deployment.metrics.affectedUsers,
        errorRate: deployment.metrics.errorRate,
        performanceImpact: deployment.metrics.performanceImpact,
        rollbackRequired: deployment.result.rollbackRequired,
      },
      stages: deployment.stages.map((s) => ({
        name: s.name,
        duration: s.endTime && s.startTime ? s.endTime - s.startTime : 0,
        success: s.success || false,
      })),
    }

    this.history.push(record)
    await this.storage.save(this.STORAGE_KEY, this.history)
  }

  async getDeploymentAnalytics(): Promise<DeploymentAnalytics> {
    const recentDeployments = this.history.slice(-100) // Last 100 deployments

    return {
      totalDeployments: this.history.length,
      successRate: this.calculateSuccessRate(recentDeployments),
      averageDuration: this.calculateAverageDuration(recentDeployments),
      strategyBreakdown: this.getStrategyBreakdown(recentDeployments),
      rollbackRate: this.calculateRollbackRate(recentDeployments),
      trends: this.analyzeTrends(recentDeployments),
    }
  }

  private calculateSuccessRate(deployments: DeploymentRecord[]): number {
    if (deployments.length === 0) return 0

    const successful = deployments.filter((d) => d.result.success).length
    return (successful / deployments.length) * 100
  }

  private calculateAverageDuration(deployments: DeploymentRecord[]): number {
    if (deployments.length === 0) return 0

    const totalDuration = deployments.reduce((sum, d) => sum + d.duration, 0)
    return totalDuration / deployments.length
  }

  private getStrategyBreakdown(
    deployments: DeploymentRecord[],
  ): DeploymentAnalytics["strategyBreakdown"] {
    const strategies: DeploymentStrategy[] = ["direct", "canary", "blue-green"]

    return strategies.map((strategy) => {
      const strategyDeployments = deployments.filter(
        (d) => d.strategy === strategy,
      )

      return {
        strategy,
        count: strategyDeployments.length,
        successRate: this.calculateSuccessRate(strategyDeployments),
        avgDuration: this.calculateAverageDuration(strategyDeployments),
      }
    })
  }

  private calculateRollbackRate(deployments: DeploymentRecord[]): number {
    if (deployments.length === 0) return 0

    const rollbacks = deployments.filter(
      (d) => d.metrics.rollbackRequired,
    ).length
    return (rollbacks / deployments.length) * 100
  }

  private analyzeTrends(
    deployments: DeploymentRecord[],
  ): DeploymentAnalytics["trends"] {
    // Group by day
    const dayGroups = new Map<string, DeploymentRecord[]>()

    deployments.forEach((deployment) => {
      const date = new Date(deployment.timestamp)
      const dayKey = date.toISOString().split("T")[0]

      if (!dayGroups.has(dayKey)) {
        dayGroups.set(dayKey, [])
      }
      dayGroups.get(dayKey)!.push(deployment)
    })

    // Calculate trends for each day
    return Array.from(dayGroups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7) // Last 7 days
      .map(([period, dayDeployments]) => ({
        period,
        deployments: dayDeployments.length,
        successRate: this.calculateSuccessRate(dayDeployments),
        rollbacks: dayDeployments.filter((d) => d.metrics.rollbackRequired)
          .length,
      }))
  }

  // Query methods

  async getDeploymentById(
    deploymentId: string,
  ): Promise<DeploymentRecord | null> {
    return this.history.find((d) => d.id === deploymentId) || null
  }

  async getDeploymentsByEvolution(
    evolutionId: string,
  ): Promise<DeploymentRecord[]> {
    return this.history.filter((d) => d.evolutionId === evolutionId)
  }

  async getRecentDeployments(limit: number = 10): Promise<DeploymentRecord[]> {
    return this.history.slice(-limit)
  }

  async getFailedDeployments(limit: number = 10): Promise<DeploymentRecord[]> {
    return this.history.filter((d) => !d.result.success).slice(-limit)
  }

  async getDeploymentsByStrategy(
    strategy: DeploymentStrategy,
  ): Promise<DeploymentRecord[]> {
    return this.history.filter((d) => d.strategy === strategy)
  }

  async getDeploymentsByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<DeploymentRecord[]> {
    const start = startDate.getTime()
    const end = endDate.getTime()

    return this.history.filter(
      (d) => d.timestamp >= start && d.timestamp <= end,
    )
  }

  async exportHistory(format: "json" | "csv" = "json"): Promise<string> {
    if (format === "json") {
      return JSON.stringify(this.history, null, 2)
    } else {
      // CSV export
      const headers = [
        "ID",
        "Evolution ID",
        "Timestamp",
        "Strategy",
        "Duration (ms)",
        "Success",
        "Rollback Required",
        "Error Rate",
        "Performance Impact",
      ].join(",")

      const rows = this.history.map((d) =>
        [
          d.id,
          d.evolutionId,
          new Date(d.timestamp).toISOString(),
          d.strategy,
          d.duration,
          d.result.success,
          d.metrics.rollbackRequired,
          d.metrics.errorRate.toFixed(4),
          d.metrics.performanceImpact.toFixed(4),
        ].join(","),
      )

      return [headers, ...rows].join("\n")
    }
  }
}
