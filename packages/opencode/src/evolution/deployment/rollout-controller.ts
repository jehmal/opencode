/**
 * Rollout Controller for Evolution Deployment
 * Manages staged rollouts and feature flag progression
 */

import type { EvolutionResult } from "../types"
import type {
  DeploymentStrategy,
  DeploymentStage,
} from "./evolution-deployment-manager"
import { FeatureFlagManager, type FeatureFlag } from "./feature-flags"

export interface RolloutConfig {
  canaryPercentages: number[]
  stageDurations: number[]
}

export interface Rollout {
  id: string
  evolutionId: string
  strategy: DeploymentStrategy
  stages: RolloutStage[]
  currentStage: number
  status: RolloutStatus
  metrics: RolloutMetrics
  featureFlagId?: string
}

export enum RolloutStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  PAUSED = "paused",
  COMPLETED = "completed",
  FAILED = "failed",
  ROLLED_BACK = "rolled_back",
}

export interface RolloutStage {
  name: string
  percentage: number
  duration: number
  userGroups?: string[]
  startTime?: number
  endTime?: number
  metrics?: StageMetrics
}

export interface RolloutMetrics {
  startTime: number
  affectedUsers: number
  errorRate: number
  performanceImpact: number
  userSatisfaction?: number
}

export interface StageMetrics {
  usersReached: number
  errorCount: number
  avgResponseTime: number
  feedbackScore?: number
}

export class RolloutController {
  private rollouts: Map<string, Rollout> = new Map()
  private featureFlagManager: FeatureFlagManager

  constructor(private config: RolloutConfig) {
    this.featureFlagManager = new FeatureFlagManager()
  }

  async createRollout(
    evolution: EvolutionResult,
    strategy: DeploymentStrategy,
  ): Promise<Rollout> {
    const stages = await this.createRolloutStages(strategy)

    const rollout: Rollout = {
      id: `rollout-${evolution.id}`,
      evolutionId: evolution.id,
      strategy,
      stages,
      currentStage: 0,
      status: RolloutStatus.PENDING,
      metrics: {
        startTime: Date.now(),
        affectedUsers: 0,
        errorRate: 0,
        performanceImpact: 0,
      },
    }

    // Create feature flag for gradual rollout
    const flag = await this.createFeatureFlag(rollout)
    rollout.featureFlagId = flag.id

    this.rollouts.set(rollout.id, rollout)
    return rollout
  }

  async createRolloutStages(
    strategy: DeploymentStrategy,
  ): Promise<DeploymentStage[]> {
    switch (strategy) {
      case "canary":
        return this.createCanaryStages()
      case "blue-green":
        return this.createBlueGreenStages()
      case "direct":
      default:
        return this.createDirectStages()
    }
  }

  private createCanaryStages(): DeploymentStage[] {
    const percentages = this.config.canaryPercentages || [5, 25, 50, 100]
    const durations = this.config.stageDurations || [300000, 600000, 900000, 0]

    return percentages.map((percentage, index) => ({
      id: `stage-${index}`,
      name: this.getCanaryStageName(percentage),
      percentage,
      startTime: undefined,
      endTime: undefined,
      success: undefined,
    }))
  }

  private createBlueGreenStages(): DeploymentStage[] {
    return [
      {
        id: "stage-0",
        name: "Green Deployment",
        percentage: 0,
        startTime: undefined,
        endTime: undefined,
        success: undefined,
      },
      {
        id: "stage-1",
        name: "Traffic Switch",
        percentage: 100,
        startTime: undefined,
        endTime: undefined,
        success: undefined,
      },
    ]
  }

  private createDirectStages(): DeploymentStage[] {
    return [
      {
        id: "stage-0",
        name: "Direct Deployment",
        percentage: 100,
        startTime: undefined,
        endTime: undefined,
        success: undefined,
      },
    ]
  }

  private getCanaryStageName(percentage: number): string {
    if (percentage <= 5) return "Initial Canary"
    if (percentage <= 25) return "Extended Canary"
    if (percentage <= 50) return "Half Rollout"
    return "Full Rollout"
  }

  async advanceRollout(rollout: Rollout): Promise<void> {
    if (rollout.currentStage >= rollout.stages.length - 1) {
      rollout.status = RolloutStatus.COMPLETED
      return
    }

    const nextStage = rollout.stages[rollout.currentStage + 1]

    // Update feature flag for next stage
    await this.updateFeatureFlag(rollout.evolutionId, {
      percentage: nextStage.percentage,
      userGroups: nextStage.userGroups,
    })

    rollout.currentStage++
    rollout.metrics.affectedUsers = await this.calculateAffectedUsers(nextStage)
    rollout.status = RolloutStatus.IN_PROGRESS
  }

  async pauseRollout(rolloutId: string): Promise<void> {
    const rollout = this.rollouts.get(rolloutId)
    if (rollout && rollout.status === RolloutStatus.IN_PROGRESS) {
      rollout.status = RolloutStatus.PAUSED
    }
  }

  async resumeRollout(rolloutId: string): Promise<void> {
    const rollout = this.rollouts.get(rolloutId)
    if (rollout && rollout.status === RolloutStatus.PAUSED) {
      rollout.status = RolloutStatus.IN_PROGRESS
    }
  }

  async rollbackRollout(rolloutId: string): Promise<void> {
    const rollout = this.rollouts.get(rolloutId)
    if (!rollout) return

    // Disable feature flag
    await this.featureFlagManager.updateFlag(rollout.evolutionId, {
      enabled: false,
      percentage: 0,
    })

    rollout.status = RolloutStatus.ROLLED_BACK
  }

  async updateStageMetrics(
    rolloutId: string,
    stageIndex: number,
    metrics: StageMetrics,
  ): Promise<void> {
    const rollout = this.rollouts.get(rolloutId)
    if (!rollout || stageIndex >= rollout.stages.length) return

    const stage = rollout.stages[stageIndex] as RolloutStage
    stage.metrics = metrics

    // Update rollout metrics
    rollout.metrics.errorRate = metrics.errorCount / metrics.usersReached
    rollout.metrics.performanceImpact = (metrics.avgResponseTime - 100) / 100 // Assuming 100ms baseline
  }

  private async createFeatureFlag(rollout: Rollout): Promise<FeatureFlag> {
    return this.featureFlagManager.createFlag(rollout.evolutionId, {
      enabled: false,
      percentage: 0,
      userGroups: [],
      metadata: {
        rolloutId: rollout.id,
        strategy: rollout.strategy,
      },
    })
  }

  private async updateFeatureFlag(
    evolutionId: string,
    updates: { percentage: number; userGroups?: string[] },
  ): Promise<void> {
    await this.featureFlagManager.updateFlag(evolutionId, {
      enabled: true,
      percentage: updates.percentage,
      userGroups: updates.userGroups,
    })
  }

  private async calculateAffectedUsers(stage: RolloutStage): Promise<number> {
    // In a real implementation, this would query actual user counts
    const totalUsers = 1000000 // Assume 1M users
    return Math.round((stage.percentage / 100) * totalUsers)
  }

  // Analytics methods

  async getRolloutAnalytics(
    rolloutId: string,
  ): Promise<RolloutAnalytics | null> {
    const rollout = this.rollouts.get(rolloutId)
    if (!rollout) return null

    const completedStages = rollout.stages
      .slice(0, rollout.currentStage + 1)
      .filter((stage) => (stage as RolloutStage).metrics)

    const totalUsers = completedStages.reduce(
      (sum, stage) =>
        sum + ((stage as RolloutStage).metrics?.usersReached || 0),
      0,
    )

    const totalErrors = completedStages.reduce(
      (sum, stage) => sum + ((stage as RolloutStage).metrics?.errorCount || 0),
      0,
    )

    const avgResponseTime = completedStages.reduce((sum, stage, index) => {
      const metrics = (stage as RolloutStage).metrics
      if (!metrics) return sum
      return (sum * index + metrics.avgResponseTime) / (index + 1)
    }, 0)

    return {
      rolloutId,
      strategy: rollout.strategy,
      progress: ((rollout.currentStage + 1) / rollout.stages.length) * 100,
      totalUsersReached: totalUsers,
      overallErrorRate: totalUsers > 0 ? totalErrors / totalUsers : 0,
      avgResponseTime,
      stageBreakdown: completedStages.map((stage, index) => ({
        stageName: stage.name,
        percentage: stage.percentage,
        metrics: (stage as RolloutStage).metrics,
      })),
    }
  }

  async getActiveRollouts(): Promise<Rollout[]> {
    return Array.from(this.rollouts.values()).filter(
      (rollout) => rollout.status === RolloutStatus.IN_PROGRESS,
    )
  }

  async getRolloutByEvolutionId(evolutionId: string): Promise<Rollout | null> {
    const rolloutId = `rollout-${evolutionId}`
    return this.rollouts.get(rolloutId) || null
  }
}

export interface RolloutAnalytics {
  rolloutId: string
  strategy: DeploymentStrategy
  progress: number
  totalUsersReached: number
  overallErrorRate: number
  avgResponseTime: number
  stageBreakdown: {
    stageName: string
    percentage: number
    metrics?: StageMetrics
  }[]
}
