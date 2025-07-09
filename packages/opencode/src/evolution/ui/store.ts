/**
 * Evolution UI Store
 * Agent ID: user-approval-workflow-004
 *
 * State management for Evolution UI
 */

import type {
  EvolutionItem,
  EvolutionFilter,
  AutoApprovalSettings,
  EvolutionEvent,
  EvolutionStatus,
} from "./types"
import { EventEmitter } from "events"
import type { IEvolutionBridge } from "../types"

export class EvolutionStore extends EventEmitter {
  private evolutions: Map<string, EvolutionItem> = new Map()
  private filter: EvolutionFilter = {}
  private autoApprovalSettings: AutoApprovalSettings = {
    enabled: false,
    minSafetyScore: 80,
    maxImpactLevel: "low",
    requireTests: true,
    excludePatterns: [],
    notificationPreferences: {
      onEvolutionStart: true,
      onAwaitingApproval: true,
      onAutoApproval: true,
      onFailure: true,
      onCompletion: true,
    },
  }
  private bridge: IEvolutionBridge | null = null

  constructor() {
    super()
    // Bridge will be injected when available
  }

  setBridge(bridge: IEvolutionBridge) {
    this.bridge = bridge
    this.setupEventListeners()
  }

  private setupEventListeners() {
    if (!this.bridge) return

    // Listen to evolution events from the bridge
    this.bridge.on("evolution:started" as any, (data: any) => {
      this.handleEvolutionEvent({
        type: "evolution.started",
        evolutionId: data.id,
        timestamp: new Date(),
        data,
      })
    })

    this.bridge.on("evolution:progress" as any, (data: any) => {
      this.handleEvolutionEvent({
        type: "evolution.progress",
        evolutionId: data.id,
        timestamp: new Date(),
        data,
      })
    })

    this.bridge.on("evolution:completed" as any, (data: any) => {
      this.handleEvolutionEvent({
        type: "evolution.completed",
        evolutionId: data.id,
        timestamp: new Date(),
        data,
      })
    })

    this.bridge.on("evolution:failed" as any, (data: any) => {
      this.handleEvolutionEvent({
        type: "evolution.failed",
        evolutionId: data.id,
        timestamp: new Date(),
        data,
      })
    })
  }

  private handleEvolutionEvent(event: EvolutionEvent) {
    // Update evolution state based on event
    const evolution = this.evolutions.get(event.evolutionId)
    if (!evolution) return

    switch (event.type) {
      case "evolution.started":
        evolution.status = "in-progress"
        evolution.phase = "analyzing"
        break
      case "evolution.progress":
        if (event.data.phase) evolution.phase = event.data.phase
        if (event.data.progress) evolution.progress = event.data.progress
        break
      case "evolution.completed":
        evolution.status = "awaiting-approval"
        evolution.progress = 100
        if (this.shouldAutoApprove(evolution)) {
          this.approveEvolution(event.evolutionId)
        }
        break
      case "evolution.failed":
        evolution.status = "failed"
        evolution.error = event.data.error
        break
    }

    this.emit("evolution:updated", evolution)
  }

  private shouldAutoApprove(evolution: EvolutionItem): boolean {
    if (!this.autoApprovalSettings.enabled) return false

    // Check safety score
    if (
      evolution.safetyScore.overall < this.autoApprovalSettings.minSafetyScore
    ) {
      return false
    }

    // Check impact level
    const impactLevels = ["low", "medium", "high", "critical"]
    const maxAllowedIndex = impactLevels.indexOf(
      this.autoApprovalSettings.maxImpactLevel,
    )
    const evolutionImpactIndex = impactLevels.indexOf(evolution.impact.level)
    if (evolutionImpactIndex > maxAllowedIndex) {
      return false
    }

    // Check test requirement
    if (
      this.autoApprovalSettings.requireTests &&
      evolution.impact.testsCoverage < 80
    ) {
      return false
    }

    // Check exclude patterns
    for (const pattern of this.autoApprovalSettings.excludePatterns) {
      const regex = new RegExp(pattern)
      for (const change of evolution.changes) {
        if (regex.test(change.file)) {
          return false
        }
      }
    }

    return true
  }

  async refreshEvolutions() {
    if (!this.bridge) return

    try {
      const history = await this.bridge.getEvolutionHistory(50)
      this.evolutions.clear()

      for (const result of history) {
        const evolution = this.mapResultToItem(result)
        this.evolutions.set(evolution.id, evolution)
      }

      this.emit("evolutions:refreshed", Array.from(this.evolutions.values()))
    } catch (error) {
      this.emit("error", error)
    }
  }

  private mapResultToItem(result: any): EvolutionItem {
    // Map the evolution result to our UI model
    return {
      id: result.id,
      timestamp: new Date(result.timestamp),
      status: this.mapStatus(result.status),
      phase: result.status.toLowerCase() as any,
      progress: this.calculateProgress(result),
      safetyScore: this.calculateSafetyScore(result),
      impact: this.assessImpact(result),
      changes: this.mapChanges(result.changes),
      performance: this.mapPerformance(result.metrics),
      error: result.error,
    }
  }

  private mapStatus(status: string): EvolutionStatus {
    const statusMap: Record<string, EvolutionStatus> = {
      pending: "pending",
      analyzing: "in-progress",
      generating: "in-progress",
      testing: "in-progress",
      validating: "in-progress",
      applying: "in-progress",
      completed: "awaiting-approval",
      failed: "failed",
      rolled_back: "rolled-back",
    }
    return statusMap[status] || "pending"
  }

  private calculateProgress(result: any): number {
    const phases = [
      "analyzing",
      "generating",
      "testing",
      "validating",
      "applying",
    ]
    const currentPhaseIndex = phases.indexOf(result.status.toLowerCase())
    if (currentPhaseIndex === -1) return 0
    return ((currentPhaseIndex + 1) / phases.length) * 100
  }

  private calculateSafetyScore(result: any): any {
    const validation = result.validationResults || {}
    const scores = {
      apiCompatibility: validation.apiCompatibility ? 100 : 0,
      testCoverage: result.testResults?.coverage || 0,
      performanceImpact: validation.performanceRegression ? 0 : 100,
      securityRisk: validation.securityCheck ? 100 : 0,
      codeQuality: 80, // Default for now
    }

    const overall =
      Object.values(scores).reduce((a, b) => a + b, 0) /
      Object.keys(scores).length

    return {
      overall,
      categories: scores,
      recommendation:
        overall >= 80 ? "safe" : overall >= 60 ? "caution" : "risky",
    }
  }

  private assessImpact(result: any): any {
    const changes = result.changes || []
    const affectedFiles = changes.length
    const breakingChanges = !result.validationResults?.backwardCompatibility

    let level: "low" | "medium" | "high" | "critical" = "low"
    if (breakingChanges) level = "critical"
    else if (affectedFiles > 10) level = "high"
    else if (affectedFiles > 5) level = "medium"

    return {
      level,
      affectedFiles,
      affectedFunctions: [], // TODO: Extract from changes
      testsCoverage: result.testResults?.coverage || 0,
      breakingChanges,
      description: result.hypothesis?.description || "",
    }
  }

  private mapChanges(changes: any[]): any[] {
    return changes.map((change) => ({
      file: change.file,
      type: change.originalContent ? "modify" : "add",
      before: change.originalContent,
      after: change.evolvedContent,
      diff: change.diff,
      lineChanges: this.countLineChanges(change.diff),
    }))
  }

  private countLineChanges(diff: string): { added: number; removed: number } {
    const lines = diff.split("\n")
    let added = 0,
      removed = 0

    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) added++
      if (line.startsWith("-") && !line.startsWith("---")) removed++
    }

    return { added, removed }
  }

  private mapPerformance(metrics: any): any {
    if (!metrics)
      return {
        executionTime: { before: 0, after: 0, improvement: 0 },
        memoryUsage: { before: 0, after: 0, improvement: 0 },
        cpuUsage: { before: 0, after: 0, improvement: 0 },
      }

    return {
      executionTime: {
        before: metrics.before?.executionTime || 0,
        after: metrics.after?.executionTime || 0,
        improvement: metrics.improvement?.executionTime || 0,
      },
      memoryUsage: {
        before: metrics.before?.memoryUsage || 0,
        after: metrics.after?.memoryUsage || 0,
        improvement: metrics.improvement?.memoryUsage || 0,
      },
      cpuUsage: {
        before: metrics.before?.cpuUsage || 0,
        after: metrics.after?.cpuUsage || 0,
        improvement: metrics.improvement?.cpuUsage || 0,
      },
    }
  }

  async approveEvolution(id: string) {
    if (!this.bridge) return

    const evolution = this.evolutions.get(id)
    if (!evolution) return

    try {
      await this.bridge.applyEvolution(id)
      evolution.status = "approved"
      this.emit("evolution:approved", evolution)
    } catch (error) {
      this.emit("error", error)
    }
  }

  async rejectEvolution(id: string) {
    const evolution = this.evolutions.get(id)
    if (!evolution) return

    evolution.status = "rejected"
    this.emit("evolution:rejected", evolution)
  }

  async rollbackEvolution(id: string) {
    if (!this.bridge) return

    const evolution = this.evolutions.get(id)
    if (!evolution) return

    try {
      await this.bridge.rollbackEvolution(id)
      evolution.status = "rolled-back"
      this.emit("evolution:rolled-back", evolution)
    } catch (error) {
      this.emit("error", error)
    }
  }

  getEvolutions(): EvolutionItem[] {
    return Array.from(this.evolutions.values())
  }

  getEvolution(id: string): EvolutionItem | undefined {
    return this.evolutions.get(id)
  }

  getFilter(): EvolutionFilter {
    return this.filter
  }

  setFilter(filter: EvolutionFilter) {
    this.filter = filter
    this.emit("filter:changed", filter)
  }

  getAutoApprovalSettings(): AutoApprovalSettings {
    return this.autoApprovalSettings
  }

  setAutoApprovalSettings(settings: AutoApprovalSettings) {
    this.autoApprovalSettings = settings
    this.emit("settings:changed", settings)
  }
}

// Singleton instance
let storeInstance: EvolutionStore | null = null

export function useEvolutionStore(): EvolutionStore {
  if (!storeInstance) {
    storeInstance = new EvolutionStore()
  }
  return storeInstance
}
