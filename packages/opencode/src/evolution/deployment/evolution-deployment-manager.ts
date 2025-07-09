/**
 * Evolution Deployment Manager
 * Safely deploys validated evolutions to production with rollout strategies and monitoring
 */

import { EventEmitter } from "events"
import type { EvolutionResult, EvolutionRequestType } from "../types"
import type { ValidationResult } from "../validator/performance-validator"
import {
  DeploymentStrategy,
  IDeploymentStrategy,
} from "./deployment-strategies"
import { RolloutController } from "./rollout-controller"
import { DeploymentMonitor } from "./deployment-monitor"
import { RollbackManager } from "./rollback-manager"
import { FeatureFlagManager } from "./feature-flags"

export interface DeploymentConfig {
  strategies: {
    riskThresholds: {
      low: number // < 0.2
      medium: number // < 0.5
      high: number // >= 0.5
    }
  }
  monitoring: {
    interval: number
    errorThreshold: number
    performanceThreshold: number
  }
  rollout: {
    canaryPercentages: number[]
    stageDurations: number[]
  }
}

export interface Deployment {
  id: string
  evolution: EvolutionResult
  strategy: DeploymentStrategy
  status: DeploymentStatus
  stages: DeploymentStage[]
  currentStage: number
  startTime: number
  endTime?: number
  metrics: DeploymentMetrics
  result?: DeploymentResult
  rollbackExecuted?: boolean
}

export enum DeploymentStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  MONITORING = "monitoring",
  COMPLETED = "completed",
  FAILED = "failed",
  ROLLED_BACK = "rolled_back",
}

export interface DeploymentStage {
  id: string
  name: string
  percentage: number
  startTime?: number
  endTime?: number
  success?: boolean
  metrics?: StageMetrics
}

export interface DeploymentMetrics {
  affectedUsers: number
  errorRate: number
  performanceImpact: number
  rollbackCount: number
}

export interface StageMetrics {
  errorRate: number
  responseTime: number
  userFeedback: number
}

export interface DeploymentResult {
  success: boolean
  strategy: DeploymentStrategy
  duration: number
  stages: number
  metrics: DeploymentMetrics
  rollbackRequired: boolean
  message: string
}

export interface DeploymentPlan {
  deploymentId: string
  strategy: DeploymentStrategy
  stages: DeploymentStage[]
  estimatedDuration: number
  riskScore: number
  rollbackPlan: string
}

export class EvolutionDeploymentManager extends EventEmitter {
  private activeDeployments: Map<string, Deployment> = new Map()
  private rolloutController: RolloutController
  private monitor: DeploymentMonitor
  private rollbackManager: RollbackManager
  private featureFlagManager: FeatureFlagManager
  private strategies: Map<DeploymentStrategy, IDeploymentStrategy> = new Map()

  constructor(private config: DeploymentConfig) {
    super()
    this.rolloutController = new RolloutController(config.rollout)
    this.monitor = new DeploymentMonitor(config.monitoring)
    this.rollbackManager = new RollbackManager()
    this.featureFlagManager = new FeatureFlagManager()

    this.setupEventHandlers()
  }

  async deployEvolution(
    evolution: EvolutionResult,
    validation: ValidationResult,
  ): Promise<DeploymentResult> {
    this.emit("deployment:started", { evolutionId: evolution.id })

    // 1. Select deployment strategy based on risk
    const strategy = this.selectStrategy(evolution, validation)

    // 2. Create deployment plan
    const plan = await this.createDeploymentPlan(
      evolution,
      strategy,
      validation,
    )

    // 3. Create rollback plan upfront
    const deployment = await this.initializeDeployment(evolution, plan)
    await this.rollbackManager.createRollbackPlan(deployment)

    // 4. Execute deployment with monitoring
    const success = await this.executeDeployment(deployment)

    // 5. Monitor and validate deployment
    if (success) {
      const monitoringSuccess = await this.monitorDeployment(deployment)

      if (monitoringSuccess) {
        await this.finalizeDeployment(deployment)
      } else {
        await this.rollbackDeployment(deployment, "Monitoring detected issues")
      }
    } else {
      await this.rollbackDeployment(deployment, "Deployment execution failed")
    }

    return deployment.result!
  }

  private selectStrategy(
    evolution: EvolutionResult,
    validation: ValidationResult,
  ): DeploymentStrategy {
    const riskScore = this.calculateRiskScore(evolution, validation)

    if (riskScore < this.config.strategies.riskThresholds.low) {
      return "direct" // Low risk - direct deployment
    } else if (riskScore < this.config.strategies.riskThresholds.medium) {
      return "canary" // Medium risk - canary deployment
    } else {
      return "blue-green" // High risk - blue-green deployment
    }
  }

  private calculateRiskScore(
    evolution: EvolutionResult,
    validation: ValidationResult,
  ): number {
    let riskScore = 0

    // Evolution type risk
    const typeRisks: Record<string, number> = {
      fix_bugs: 0.1,
      improve_performance: 0.2,
      add_feature: 0.4,
      refactor_code: 0.5,
      enhance_security: 0.3,
      optimize_memory: 0.3,
      improve_readability: 0.1,
      custom: 0.6,
    }

    riskScore += typeRisks[evolution.hypothesis.type] || 0.5

    // Validation metrics risk
    const comparison = validation.metrics.comparison

    // Performance impact
    if (comparison.performance.improvement < 0) {
      riskScore += Math.abs(comparison.performance.improvement) / 100
    }

    // Memory impact
    if (comparison.memory.increase > 10) {
      riskScore += comparison.memory.increase / 100
    }

    // Reliability impact
    if (comparison.reliability.errorRateChange > 0) {
      riskScore += comparison.reliability.errorRateChange
    }

    // Confidence factor
    riskScore *= 2 - comparison.overall.confidence

    // Number of changed files
    const fileCount = evolution.changes.length
    if (fileCount > 10) {
      riskScore += 0.2
    } else if (fileCount > 5) {
      riskScore += 0.1
    }

    return Math.min(1, riskScore) // Cap at 1.0
  }

  private async createDeploymentPlan(
    evolution: EvolutionResult,
    strategy: DeploymentStrategy,
    validation: ValidationResult,
  ): Promise<DeploymentPlan> {
    const riskScore = this.calculateRiskScore(evolution, validation)
    const stages = await this.rolloutController.createRolloutStages(strategy)

    const plan: DeploymentPlan = {
      deploymentId: `deploy-${evolution.id}-${Date.now()}`,
      strategy,
      stages,
      estimatedDuration: this.estimateDeploymentDuration(stages),
      riskScore,
      rollbackPlan: this.generateRollbackPlan(strategy),
    }

    this.emit("deployment:plan-created", plan)
    return plan
  }

  private async initializeDeployment(
    evolution: EvolutionResult,
    plan: DeploymentPlan,
  ): Promise<Deployment> {
    const deployment: Deployment = {
      id: plan.deploymentId,
      evolution,
      strategy: plan.strategy,
      status: DeploymentStatus.PENDING,
      stages: plan.stages,
      currentStage: 0,
      startTime: Date.now(),
      metrics: {
        affectedUsers: 0,
        errorRate: 0,
        performanceImpact: 0,
        rollbackCount: 0,
      },
    }

    this.activeDeployments.set(deployment.id, deployment)

    // Create feature flag for the evolution
    await this.featureFlagManager.createFlag(evolution.id, {
      enabled: false,
      percentage: 0,
      rules: [],
    })

    return deployment
  }

  private async executeDeployment(deployment: Deployment): Promise<boolean> {
    deployment.status = DeploymentStatus.IN_PROGRESS
    this.emit("deployment:executing", { deploymentId: deployment.id })

    try {
      const strategy = await this.loadStrategy(deployment.strategy)

      // Start monitoring
      const monitoringSession = await this.monitor.startMonitoring(deployment)

      // Execute strategy
      await strategy.execute(deployment)

      deployment.status = DeploymentStatus.MONITORING
      return true
    } catch (error) {
      deployment.status = DeploymentStatus.FAILED
      this.emit("deployment:failed", {
        deploymentId: deployment.id,
        error: error.message,
      })
      return false
    }
  }

  private async monitorDeployment(deployment: Deployment): Promise<boolean> {
    const monitoringDuration = this.getMonitoringDuration(deployment.strategy)
    const startTime = Date.now()

    while (Date.now() - startTime < monitoringDuration) {
      const healthReport = await this.monitor.generateHealthReport(
        deployment.id,
      )

      if (healthReport.overallHealth < 0.8) {
        this.emit("deployment:health-degraded", {
          deploymentId: deployment.id,
          health: healthReport.overallHealth,
        })
        return false
      }

      // Check alerts
      const session = this.monitor.getSession(deployment.id)
      if (session && session.alerts.some((a) => a.severity === "high")) {
        return false
      }

      await this.sleep(10000) // Check every 10 seconds
    }

    return true
  }

  private async finalizeDeployment(deployment: Deployment): Promise<void> {
    deployment.status = DeploymentStatus.COMPLETED
    deployment.endTime = Date.now()

    // Calculate final metrics
    const healthReport = await this.monitor.generateHealthReport(deployment.id)

    deployment.result = {
      success: true,
      strategy: deployment.strategy,
      duration: deployment.endTime - deployment.startTime,
      stages: deployment.stages.length,
      metrics: deployment.metrics,
      rollbackRequired: false,
      message: `Successfully deployed using ${deployment.strategy} strategy`,
    }

    // Update feature flag to 100%
    await this.featureFlagManager.updateFlag(deployment.evolution.id, {
      percentage: 100,
    })

    this.emit("deployment:completed", deployment.result)

    // Clean up
    this.activeDeployments.delete(deployment.id)
    await this.monitor.stopMonitoring(deployment.id)
  }

  private async rollbackDeployment(
    deployment: Deployment,
    reason: string,
  ): Promise<void> {
    deployment.status = DeploymentStatus.ROLLED_BACK
    deployment.rollbackExecuted = true
    deployment.metrics.rollbackCount++

    const rollbackResult = await this.rollbackManager.executeRollback(
      deployment.id,
      reason,
    )

    deployment.result = {
      success: false,
      strategy: deployment.strategy,
      duration: Date.now() - deployment.startTime,
      stages: deployment.currentStage + 1,
      metrics: deployment.metrics,
      rollbackRequired: true,
      message: `Deployment rolled back: ${reason}`,
    }

    // Disable feature flag
    await this.featureFlagManager.updateFlag(deployment.evolution.id, {
      enabled: false,
    })

    this.emit("deployment:rolled-back", {
      deploymentId: deployment.id,
      reason,
      result: rollbackResult,
    })

    // Clean up
    this.activeDeployments.delete(deployment.id)
    await this.monitor.stopMonitoring(deployment.id)
  }

  private async loadStrategy(
    name: DeploymentStrategy,
  ): Promise<IDeploymentStrategy> {
    if (!this.strategies.has(name)) {
      const { createStrategy } = await import("./deployment-strategies")
      this.strategies.set(name, createStrategy(name))
    }
    return this.strategies.get(name)!
  }

  private estimateDeploymentDuration(stages: DeploymentStage[]): number {
    return stages.reduce((total, stage) => {
      const stageDuration = this.config.rollout.stageDurations[0] || 300000
      return total + stageDuration
    }, 0)
  }

  private generateRollbackPlan(strategy: DeploymentStrategy): string {
    const plans: Record<DeploymentStrategy, string> = {
      direct: "Revert code changes and restart services",
      canary: "Disable feature flag and revert canary instances",
      "blue-green": "Switch traffic back to blue environment",
    }
    return plans[strategy] || "Manual rollback required"
  }

  private getMonitoringDuration(strategy: DeploymentStrategy): number {
    const durations: Record<DeploymentStrategy, number> = {
      direct: 300000, // 5 minutes
      canary: 900000, // 15 minutes
      "blue-green": 600000, // 10 minutes
    }
    return durations[strategy] || 600000
  }

  private setupEventHandlers(): void {
    this.monitor.on("alert", (alert) => {
      this.emit("deployment:alert", alert)
    })

    this.rollbackManager.on("rollback-started", (data) => {
      this.emit("rollback:started", data)
    })

    this.rollbackManager.on("rollback-completed", (data) => {
      this.emit("rollback:completed", data)
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Public methods for management

  async getActiveDeployments(): Promise<Deployment[]> {
    return Array.from(this.activeDeployments.values())
  }

  async getDeploymentStatus(deploymentId: string): Promise<Deployment | null> {
    return this.activeDeployments.get(deploymentId) || null
  }

  async pauseDeployment(deploymentId: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId)
    if (deployment && deployment.status === DeploymentStatus.IN_PROGRESS) {
      // Pause by freezing current stage
      this.emit("deployment:paused", { deploymentId })
    }
  }

  async resumeDeployment(deploymentId: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId)
    if (deployment) {
      this.emit("deployment:resumed", { deploymentId })
    }
  }
}

export type { DeploymentStrategy }
