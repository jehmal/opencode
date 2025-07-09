/**
 * Evolution Process Manager
 * Manages the lifecycle of individual evolution processes
 */

import { EventEmitter } from "events"
import { Log } from "../../util/log"
import { NamedError } from "../../util/error"
import { z } from "zod"
import type { EvolutionOrchestrator } from "./evolution-orchestrator"
import type { EvolutionBridge } from "../bridge"
import type { SandboxManager } from "../sandbox/sandbox-manager"
import type { EvolutionUI } from "../ui"
import type { EvolutionRollbackManager } from "./evolution-rollback"
import type { EvolutionConfigManager } from "./evolution-config"
import {
  EvolutionStatus,
  EvolutionRequestType,
  type ImprovementHypothesis,
  type EvolutionRequest,
  type EvolutionResult,
} from "../types"

const log = Log.create({ service: "evolution-process" })

/**
 * Evolution state type
 */
export type EvolutionState =
  | "pending"
  | "generating"
  | "testing"
  | "validating"
  | "awaiting-approval"
  | "applying"
  | "completed"
  | "failed"
  | "cancelled"
  | "rejected"
  | "rollback"

/**
 * Evolution metrics
 */
export interface EvolutionMetrics {
  startTime: number
  endTime?: number
  phases: Record<
    string,
    { startTime: number; endTime?: number; status: string }
  >
  safety: {
    score: number
    risks: string[]
  }
  performance?: {
    before: Record<string, number>
    after: Record<string, number>
  }
}

/**
 * Process errors
 */
export const ProcessError = NamedError.create(
  "ProcessError",
  z.object({
    code: z.string(),
    message: z.string(),
    phase: z.string(),
    details: z.any().optional(),
  }),
)

/**
 * Evolution Process - Manages a single evolution lifecycle
 */
export class EvolutionProcess extends EventEmitter {
  private state: EvolutionState = "pending"
  private metrics: EvolutionMetrics
  private evolutionResult?: EvolutionResult
  private snapshotId?: string

  constructor(
    public readonly id: string,
    public readonly hypothesis: ImprovementHypothesis,
    private orchestrator: EvolutionOrchestrator,
    private bridge: EvolutionBridge,
    private sandbox: SandboxManager,
    private ui: EvolutionUI,
    private rollbackManager: EvolutionRollbackManager,
    private configManager: EvolutionConfigManager,
  ) {
    super()
    this.metrics = {
      startTime: Date.now(),
      phases: {},
      safety: { score: 0, risks: [] },
    }
  }

  /**
   * Execute the evolution process
   */
  async execute(): Promise<EvolutionResult> {
    try {
      // Phase 1: Generate evolution
      await this.transitionTo("generating")
      const evolution = await this.generateEvolution()

      // Phase 2: Test in sandbox
      await this.transitionTo("testing")
      const testResults = await this.testEvolution(evolution)

      // Phase 3: Validate improvements
      await this.transitionTo("validating")
      const validation = await this.validateEvolution(evolution, testResults)

      // Phase 4: Get user approval
      await this.transitionTo("awaiting-approval")
      const approved = await this.getUserApproval(evolution, validation)

      // Phase 5: Apply if approved
      if (approved) {
        await this.transitionTo("applying")
        await this.applyEvolution(evolution)
        await this.transitionTo("completed")
      } else {
        await this.transitionTo("rejected")
      }

      return this.createResult()
    } catch (error) {
      await this.transitionTo("failed")
      throw error
    }
  }

  /**
   * Cancel the evolution process
   */
  async cancel(): Promise<void> {
    log.info(`Cancelling evolution ${this.id}`)
    await this.transitionTo("cancelled")

    // If we have a result, try to rollback
    if (this.evolutionResult && this.snapshotId) {
      try {
        await this.rollbackManager.rollback(this.id)
      } catch (error) {
        log.error("Failed to rollback during cancel", { id: this.id, error })
      }
    }
  }

  /**
   * Reject the evolution
   */
  async reject(): Promise<void> {
    log.info(`Rejecting evolution ${this.id}`)
    await this.transitionTo("rejected")
  }

  /**
   * Get current state
   */
  getState(): string {
    return this.state
  }

  /**
   * Get start time
   */
  getStartTime(): number {
    return this.metrics.startTime
  }

  /**
   * Generate the evolution
   */
  private async generateEvolution(): Promise<EvolutionRequest> {
    this.recordPhaseStart("generating")

    try {
      // Create evolution request from hypothesis
      const request: EvolutionRequest = {
        id: this.id,
        type: this.hypothesis.type,
        targetFiles: this.hypothesis.dependencies,
        context: {
          projectPath: process.cwd(),
          language: "typescript",
          framework: "node",
          testCommand: "bun test",
          performanceCommand: "bun run benchmark",
        },
        constraints: {
          maxExecutionTime: 300000,
          preserveApi: true,
          maintainBackwardCompatibility: true,
          requireTests: true,
          minTestCoverage: 80,
        },
        metrics: {
          baseline: this.extractBaselineMetrics(),
        },
        customPrompt: this.hypothesis.description,
        metadata: {
          hypothesisId: this.hypothesis.id,
          confidence: this.hypothesis.confidence,
        },
      }

      this.recordPhaseEnd("generating", "success")
      return request
    } catch (error) {
      this.recordPhaseEnd("generating", "failed")
      throw new ProcessError({
        code: "GENERATION_FAILED",
        message: "Failed to generate evolution",
        phase: "generating",
        details: error,
      })
    }
  }

  /**
   * Test the evolution in sandbox
   */
  private async testEvolution(evolution: EvolutionRequest): Promise<any> {
    this.recordPhaseStart("testing")

    try {
      // Create snapshot before testing
      this.snapshotId = await this.rollbackManager.createSnapshot({
        id: this.id,
        hypothesis: this.hypothesis,
        changes: [],
        metrics: { before: {}, after: {}, improvement: {} },
        testResults: {
          passed: false,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          details: "",
        },
        validationResults: {
          apiCompatibility: false,
          backwardCompatibility: false,
          securityCheck: false,
          performanceRegression: false,
          details: [],
        },
        status: EvolutionStatus.TESTING,
        timestamp: Date.now(),
        duration: 0,
        requestId: evolution.id,
      })

      // Request evolution from bridge
      this.evolutionResult = await this.bridge.requestEvolution(evolution)

      // Test in sandbox
      const sandbox = await this.sandbox.createSandbox({
        id: this.id,
        code: this.getEvolvedCode(),
        tests: [],
        config: {
          timeout: 60000,
          memoryLimit: 512 * 1024 * 1024,
          cpuLimit: 0.5,
        },
      })

      const testResult = await this.sandbox.execute(sandbox.id)

      this.recordPhaseEnd("testing", testResult.success ? "success" : "failed")
      return testResult
    } catch (error) {
      this.recordPhaseEnd("testing", "failed")
      throw new ProcessError({
        code: "TESTING_FAILED",
        message: "Failed to test evolution",
        phase: "testing",
        details: error,
      })
    }
  }

  /**
   * Validate the evolution
   */
  private async validateEvolution(
    evolution: EvolutionRequest,
    testResults: any,
  ): Promise<any> {
    this.recordPhaseStart("validating")

    try {
      // Calculate safety score
      const safetyScore = this.calculateSafetyScore(testResults)
      this.metrics.safety = {
        score: safetyScore,
        risks: this.hypothesis.risks,
      }

      // Check if evolution meets requirements
      const validation = {
        safetyScore,
        testsPassed: testResults.success,
        performanceImproved: this.checkPerformanceImprovement(),
        apiCompatible: true, // TODO: Implement API compatibility check
        securityPassed: true, // TODO: Implement security check
      }

      this.recordPhaseEnd("validating", "success")
      return validation
    } catch (error) {
      this.recordPhaseEnd("validating", "failed")
      throw new ProcessError({
        code: "VALIDATION_FAILED",
        message: "Failed to validate evolution",
        phase: "validating",
        details: error,
      })
    }
  }

  /**
   * Get user approval
   */
  private async getUserApproval(
    evolution: EvolutionRequest,
    validation: any,
  ): Promise<boolean> {
    this.recordPhaseStart("awaiting-approval")

    try {
      const config = await this.configManager.getConfig()

      // Check auto-approval conditions
      if (config.autoApprove?.enabled) {
        const autoApproved =
          validation.safetyScore >=
            100 - config.autoApprove.maxRiskLevel * 100 &&
          config.autoApprove.types.includes(this.hypothesis.type)

        if (autoApproved) {
          log.info(`Auto-approving evolution ${this.id}`)
          this.recordPhaseEnd("awaiting-approval", "auto-approved")
          return true
        }
      }

      // Request user approval through UI
      const approved = await this.ui.requestApproval({
        evolutionId: this.id,
        hypothesis: this.hypothesis,
        validation,
        changes: this.evolutionResult?.changes || [],
      })

      this.recordPhaseEnd(
        "awaiting-approval",
        approved ? "approved" : "rejected",
      )
      return approved
    } catch (error) {
      this.recordPhaseEnd("awaiting-approval", "failed")
      throw new ProcessError({
        code: "APPROVAL_FAILED",
        message: "Failed to get approval",
        phase: "awaiting-approval",
        details: error,
      })
    }
  }

  /**
   * Apply the evolution
   */
  private async applyEvolution(evolution: EvolutionRequest): Promise<void> {
    this.recordPhaseStart("applying")

    try {
      if (!this.evolutionResult) {
        throw new Error("No evolution result available")
      }

      // Apply through bridge
      await this.bridge.applyEvolution(this.id)

      this.recordPhaseEnd("applying", "success")
    } catch (error) {
      this.recordPhaseEnd("applying", "failed")

      // Attempt rollback
      if (this.snapshotId) {
        await this.transitionTo("rollback")
        await this.rollbackManager.rollback(this.id)
      }

      throw new ProcessError({
        code: "APPLICATION_FAILED",
        message: "Failed to apply evolution",
        phase: "applying",
        details: error,
      })
    }
  }

  /**
   * Create the final result
   */
  private createResult(): EvolutionResult {
    if (!this.evolutionResult) {
      throw new Error("No evolution result available")
    }

    this.metrics.endTime = Date.now()

    return {
      ...this.evolutionResult,
      status: this.mapStateToStatus(),
      duration: this.metrics.endTime - this.metrics.startTime,
    }
  }

  /**
   * Transition to a new state
   */
  private async transitionTo(newState: EvolutionState): Promise<void> {
    const oldState = this.state
    this.state = newState

    log.info(
      `Evolution ${this.id} transitioned from ${oldState} to ${newState}`,
    )
    this.emit("state-changed", { oldState, newState })
  }

  /**
   * Record phase start
   */
  private recordPhaseStart(phase: string): void {
    this.metrics.phases[phase] = {
      startTime: Date.now(),
      status: "running",
    }
  }

  /**
   * Record phase end
   */
  private recordPhaseEnd(phase: string, status: string): void {
    if (this.metrics.phases[phase]) {
      this.metrics.phases[phase].endTime = Date.now()
      this.metrics.phases[phase].status = status
    }
  }

  /**
   * Extract baseline metrics
   */
  private extractBaselineMetrics(): Record<string, number> {
    const metrics: Record<string, number> = {}

    this.hypothesis.expectedImpact.forEach((impact) => {
      metrics[impact.metric] = impact.currentValue
    })

    return metrics
  }

  /**
   * Get evolved code
   */
  private getEvolvedCode(): string {
    if (!this.evolutionResult) {
      return ""
    }

    // Combine all evolved code
    return this.evolutionResult.changes
      .map((change) => change.evolvedContent)
      .join("\n\n")
  }

  /**
   * Calculate safety score
   */
  private calculateSafetyScore(testResults: any): number {
    let score = 100

    // Deduct for test failures
    if (!testResults.success) {
      score -= 30
    }

    // Deduct for risks
    score -= this.hypothesis.risks.length * 10

    // Deduct for low confidence
    score -= (1 - this.hypothesis.confidence) * 20

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Check performance improvement
   */
  private checkPerformanceImprovement(): boolean {
    if (!this.evolutionResult) {
      return false
    }

    const improvement = this.evolutionResult.metrics.improvement
    return Object.values(improvement).some((value) => value > 0)
  }

  /**
   * Map state to evolution status
   */
  private mapStateToStatus(): EvolutionStatus {
    const stateMap: Record<EvolutionState, EvolutionStatus> = {
      pending: EvolutionStatus.PENDING,
      generating: EvolutionStatus.GENERATING,
      testing: EvolutionStatus.TESTING,
      validating: EvolutionStatus.VALIDATING,
      "awaiting-approval": EvolutionStatus.PENDING,
      applying: EvolutionStatus.APPLYING,
      completed: EvolutionStatus.COMPLETED,
      failed: EvolutionStatus.FAILED,
      cancelled: EvolutionStatus.FAILED,
      rejected: EvolutionStatus.FAILED,
      rollback: EvolutionStatus.ROLLED_BACK,
    }

    return stateMap[this.state] || EvolutionStatus.FAILED
  }
}
