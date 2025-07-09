/**
 * Evolution Bridge implementation
 * Connects DGM's evolution engine to DGMO's CLI editor
 */

import { EventEmitter } from "events"
import { Log } from "../util/log"
import { NamedError } from "../util/error"
import { z } from "zod"
import { DGMBridge } from "../dgm/bridge"
import { DGMStatus } from "../dgm/types"
import {
  EvolutionConfig,
  EvolutionEvent,
  EvolutionRequest,
  EvolutionStatus,
  type EvolutionResult,
  type EvolutionSession,
  type IEvolutionBridge,
  type ImprovementHypothesis,
  type PerformanceMetrics,
} from "./types"
import { exec } from "child_process"
import { promisify } from "util"
import { readFile, writeFile } from "fs/promises"

const execAsync = promisify(exec)
const log = Log.create({ service: "evolution-bridge" })

/**
 * Evolution Bridge errors
 */
export const EvolutionBridgeError = NamedError.create(
  "EvolutionBridgeError",
  z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.any().optional(),
  }),
)

export const EvolutionTimeoutError = NamedError.create(
  "EvolutionTimeoutError",
  z.object({
    requestId: z.string(),
    timeout: z.number(),
    phase: z.string(),
  }),
)

/**
 * Generate unique ID
 */
function generateId(): string {
  return `evo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Evolution Bridge implementation
 */
export class EvolutionBridge extends EventEmitter implements IEvolutionBridge {
  private config: EvolutionConfig
  private dgmBridge: DGMBridge
  private activeEvolutions = new Map<string, EvolutionResult>()
  private evolutionHistory: EvolutionResult[] = []
  private sessions = new Map<string, EvolutionSession>()
  private metricsCache = new Map<
    string,
    { metrics: PerformanceMetrics; timestamp: number }
  >()
  private metricsTimer: NodeJS.Timeout | null = null

  constructor(config: EvolutionConfig, dgmBridge: DGMBridge) {
    super()
    this.config = config
    this.dgmBridge = dgmBridge

    // Start metrics tracking if enabled
    if (config.telemetry.trackMetrics) {
      this.startMetricsTracking()
    }
  }

  /**
   * Request an evolution
   */
  async requestEvolution(request: EvolutionRequest): Promise<EvolutionResult> {
    log.info("Evolution requested", { request })

    // Validate request
    const validatedRequest = EvolutionRequest.parse(request)

    // Check if DGM bridge is ready
    if (this.dgmBridge.status !== DGMStatus.READY) {
      throw new EvolutionBridgeError({
        code: "DGM_NOT_READY",
        message: "DGM bridge is not ready",
        requestId: validatedRequest.id,
      })
    }

    // Check concurrent evolution limit
    if (this.activeEvolutions.size >= this.config.maxConcurrentEvolutions) {
      throw new EvolutionBridgeError({
        code: "EVOLUTION_LIMIT_EXCEEDED",
        message: `Maximum concurrent evolutions (${this.config.maxConcurrentEvolutions}) exceeded`,
        requestId: validatedRequest.id,
      })
    }

    // Create initial result
    const result: EvolutionResult = {
      id: generateId(),
      requestId: validatedRequest.id,
      status: EvolutionStatus.PENDING,
      hypothesis: {
        id: generateId(),
        type: validatedRequest.type,
        description: "Analyzing code for improvements...",
        expectedImpact: [],
        confidence: 0,
        risks: [],
        dependencies: [],
      },
      changes: [],
      metrics: {
        before: validatedRequest.metrics.baseline,
        after: {},
        improvement: {},
      },
      testResults: {
        passed: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        details: "",
      },
      validationResults: {
        apiCompatibility: true,
        backwardCompatibility: true,
        securityCheck: true,
        performanceRegression: false,
        details: [],
      },
      timestamp: Date.now(),
      duration: 0,
    }

    // Store active evolution
    this.activeEvolutions.set(result.id, result)
    this.emit(EvolutionEvent.REQUEST_CREATED, { result })

    // Start evolution process
    this.processEvolution(validatedRequest, result).catch((error) => {
      log.error("Evolution process failed", {
        error,
        requestId: validatedRequest.id,
      })
      result.status = EvolutionStatus.FAILED
      this.emit(EvolutionEvent.EVOLUTION_FAILED, { result, error })
    })

    return result
  }

  /**
   * Process evolution request
   */
  private async processEvolution(
    request: EvolutionRequest,
    result: EvolutionResult,
  ): Promise<void> {
    const startTime = Date.now()

    try {
      // Phase 1: Analysis
      result.status = EvolutionStatus.ANALYZING
      this.emit(EvolutionEvent.ANALYSIS_STARTED, { result })

      const hypothesis = await this.analyzeCode(request)
      result.hypothesis = hypothesis
      this.emit(EvolutionEvent.HYPOTHESIS_GENERATED, { result, hypothesis })

      // Phase 2: Generation
      result.status = EvolutionStatus.GENERATING
      this.emit(EvolutionEvent.GENERATION_STARTED, { result })

      const changes = await this.generateEvolution(request, hypothesis)
      result.changes = changes
      this.emit(EvolutionEvent.GENERATION_COMPLETED, { result, changes })

      // Phase 3: Testing
      result.status = EvolutionStatus.TESTING
      this.emit(EvolutionEvent.TESTING_STARTED, { result })

      const testResults = await this.runTests(request, changes)
      result.testResults = testResults
      this.emit(EvolutionEvent.TESTING_COMPLETED, { result, testResults })

      // Phase 4: Validation
      result.status = EvolutionStatus.VALIDATING
      this.emit(EvolutionEvent.VALIDATION_STARTED, { result })

      const validationResults = await this.validateChanges(request, changes)
      result.validationResults = validationResults
      this.emit(EvolutionEvent.VALIDATION_COMPLETED, {
        result,
        validationResults,
      })

      // Phase 5: Measure improvements
      const afterMetrics = await this.measurePerformance(request, changes)
      result.metrics.after = afterMetrics
      result.metrics.improvement = this.calculateImprovement(
        result.metrics.before,
        afterMetrics,
      )
      this.emit(EvolutionEvent.METRICS_UPDATED, { result })

      // Check if evolution was successful
      if (
        testResults.passed &&
        validationResults.apiCompatibility &&
        !validationResults.performanceRegression
      ) {
        // Create rollback snapshot
        result.rollbackInfo = await this.createRollbackSnapshot(
          request,
          changes,
        )

        // Apply changes if auto-apply is enabled
        if (!this.config.requireApproval) {
          await this.applyEvolution(result.id)
        } else {
          result.status = EvolutionStatus.COMPLETED
        }
      } else {
        result.status = EvolutionStatus.FAILED
        if (this.config.rollbackOnFailure && result.rollbackInfo) {
          await this.rollbackEvolution(result.id)
        }
      }

      result.duration = Date.now() - startTime
      this.emit(EvolutionEvent.EVOLUTION_COMPLETED, { result })
    } catch (error) {
      result.status = EvolutionStatus.FAILED
      result.duration = Date.now() - startTime
      throw error
    } finally {
      // Move to history
      this.activeEvolutions.delete(result.id)
      this.evolutionHistory.unshift(result)
      if (this.evolutionHistory.length > 100) {
        this.evolutionHistory.pop()
      }
    }
  }

  /**
   * Analyze code for improvement opportunities
   */
  private async analyzeCode(
    request: EvolutionRequest,
  ): Promise<ImprovementHypothesis> {
    log.info("Analyzing code", { requestId: request.id })

    const analysisResult = await this.dgmBridge.executeTool(
      "evolution.analyze",
      {
        type: request.type,
        targetFiles: request.targetFiles,
        context: request.context,
        metrics: request.metrics,
        customPrompt: request.customPrompt,
      },
      { requestId: request.id },
    )

    return {
      id: generateId(),
      type: request.type,
      description: analysisResult.description,
      expectedImpact: analysisResult.expectedImpact || [],
      confidence: analysisResult.confidence || 0.5,
      risks: analysisResult.risks || [],
      dependencies: analysisResult.dependencies || [],
    }
  }

  /**
   * Generate evolution changes
   */
  private async generateEvolution(
    request: EvolutionRequest,
    hypothesis: ImprovementHypothesis,
  ): Promise<EvolutionResult["changes"]> {
    log.info("Generating evolution", { requestId: request.id, hypothesis })

    const changes: EvolutionResult["changes"] = []

    for (const targetFile of request.targetFiles) {
      // Read original content
      const originalContent = await readFile(targetFile, "utf-8")

      // Generate evolved version
      const evolutionResult = await this.dgmBridge.executeTool(
        "evolution.generate",
        {
          file: targetFile,
          content: originalContent,
          hypothesis,
          constraints: request.constraints,
          context: request.context,
        },
        { requestId: request.id },
      )

      // Create diff
      const diff = await this.createDiff(
        originalContent,
        evolutionResult.content,
      )

      changes.push({
        file: targetFile,
        originalContent,
        evolvedContent: evolutionResult.content,
        diff,
        explanation:
          evolutionResult.explanation || "Code evolved based on hypothesis",
      })
    }

    return changes
  }

  /**
   * Run tests on evolved code
   */
  private async runTests(
    request: EvolutionRequest,
    changes: EvolutionResult["changes"],
  ): Promise<EvolutionResult["testResults"]> {
    log.info("Running tests", { requestId: request.id })

    if (!request.context.testCommand) {
      return {
        passed: true,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        details: "No test command configured",
      }
    }

    // Apply changes temporarily
    const backups = await this.applyChangesTemporarily(changes)

    try {
      // Run tests
      const { stdout, stderr } = await execAsync(request.context.testCommand, {
        cwd: request.context.projectPath,
        timeout: request.constraints.maxExecutionTime,
      })

      // Parse test results (this is a simplified version)
      const passed = !stderr.includes("FAILED") && !stdout.includes("FAILED")
      const totalMatch = stdout.match(/(\d+) tests?/i)
      const passedMatch = stdout.match(/(\d+) passed/i)
      const failedMatch = stdout.match(/(\d+) failed/i)

      return {
        passed,
        totalTests: totalMatch ? parseInt(totalMatch[1]) : 0,
        passedTests: passedMatch ? parseInt(passedMatch[1]) : 0,
        failedTests: failedMatch ? parseInt(failedMatch[1]) : 0,
        details: stdout + stderr,
      }
    } finally {
      // Restore original files
      await this.restoreFiles(backups)
    }
  }

  /**
   * Validate changes
   */
  private async validateChanges(
    request: EvolutionRequest,
    changes: EvolutionResult["changes"],
  ): Promise<EvolutionResult["validationResults"]> {
    log.info("Validating changes", { requestId: request.id })

    const validationResult = await this.dgmBridge.executeTool(
      "evolution.validate",
      {
        changes,
        constraints: request.constraints,
        context: request.context,
      },
      { requestId: request.id },
    )

    return {
      apiCompatibility: validationResult.apiCompatibility ?? true,
      backwardCompatibility: validationResult.backwardCompatibility ?? true,
      securityCheck: validationResult.securityCheck ?? true,
      performanceRegression: validationResult.performanceRegression ?? false,
      details: validationResult.details || [],
    }
  }

  /**
   * Measure performance metrics
   */
  private async measurePerformance(
    request: EvolutionRequest,
    changes: EvolutionResult["changes"],
  ): Promise<PerformanceMetrics> {
    log.info("Measuring performance", { requestId: request.id })

    if (!request.context.performanceCommand) {
      return {}
    }

    // Apply changes temporarily
    const backups = await this.applyChangesTemporarily(changes)

    try {
      // Run performance measurement
      const { stdout } = await execAsync(request.context.performanceCommand, {
        cwd: request.context.projectPath,
        timeout: 60000,
      })

      // Parse metrics (this is a simplified version)
      const metrics: PerformanceMetrics = {}

      const timeMatch = stdout.match(/execution time: ([\d.]+)ms/i)
      if (timeMatch) metrics.executionTime = parseFloat(timeMatch[1])

      const memoryMatch = stdout.match(/memory usage: ([\d.]+)MB/i)
      if (memoryMatch) metrics.memoryUsage = parseFloat(memoryMatch[1])

      const cpuMatch = stdout.match(/cpu usage: ([\d.]+)%/i)
      if (cpuMatch) metrics.cpuUsage = parseFloat(cpuMatch[1])

      return metrics
    } finally {
      // Restore original files
      await this.restoreFiles(backups)
    }
  }

  /**
   * Calculate improvement percentages
   */
  private calculateImprovement(
    before: PerformanceMetrics,
    after: PerformanceMetrics,
  ): Record<string, number> {
    const improvement: Record<string, number> = {}

    for (const [key, beforeValue] of Object.entries(before)) {
      const afterValue = after[key as keyof PerformanceMetrics]
      if (typeof beforeValue === "number" && typeof afterValue === "number") {
        // Lower is better for most metrics
        const improvementPercent =
          ((beforeValue - afterValue) / beforeValue) * 100
        improvement[key] = Math.round(improvementPercent * 100) / 100
      }
    }

    return improvement
  }

  /**
   * Create diff between original and evolved content
   */
  private async createDiff(original: string, evolved: string): Promise<string> {
    // Simple line-by-line diff (in production, use a proper diff library)
    const originalLines = original.split("\n")
    const evolvedLines = evolved.split("\n")
    const diff: string[] = []

    const maxLines = Math.max(originalLines.length, evolvedLines.length)
    for (let i = 0; i < maxLines; i++) {
      if (originalLines[i] !== evolvedLines[i]) {
        if (originalLines[i] !== undefined) {
          diff.push(`- ${originalLines[i]}`)
        }
        if (evolvedLines[i] !== undefined) {
          diff.push(`+ ${evolvedLines[i]}`)
        }
      }
    }

    return diff.join("\n")
  }

  /**
   * Apply changes temporarily for testing
   */
  private async applyChangesTemporarily(
    changes: EvolutionResult["changes"],
  ): Promise<Map<string, string>> {
    const backups = new Map<string, string>()

    for (const change of changes) {
      const content = await readFile(change.file, "utf-8")
      backups.set(change.file, content)
      await writeFile(change.file, change.evolvedContent, "utf-8")
    }

    return backups
  }

  /**
   * Restore original files
   */
  private async restoreFiles(backups: Map<string, string>): Promise<void> {
    for (const [file, content] of backups) {
      await writeFile(file, content, "utf-8")
    }
  }

  /**
   * Create rollback snapshot
   */
  private async createRollbackSnapshot(
    request: EvolutionRequest,
    changes: EvolutionResult["changes"],
  ): Promise<EvolutionResult["rollbackInfo"]> {
    const snapshotId = `snapshot_${Date.now()}`

    // Store snapshot data
    await this.dgmBridge.executeTool(
      "evolution.snapshot",
      {
        snapshotId,
        changes,
        request,
      },
      { requestId: request.id },
    )

    return {
      available: true,
      snapshotId,
      command: `evolution rollback ${snapshotId}`,
    }
  }

  /**
   * Get evolution status
   */
  async getEvolutionStatus(evolutionId: string): Promise<EvolutionResult> {
    const active = this.activeEvolutions.get(evolutionId)
    if (active) return active

    const historical = this.evolutionHistory.find((e) => e.id === evolutionId)
    if (historical) return historical

    throw new EvolutionBridgeError({
      code: "EVOLUTION_NOT_FOUND",
      message: `Evolution ${evolutionId} not found`,
    })
  }

  /**
   * Cancel ongoing evolution
   */
  async cancelEvolution(evolutionId: string): Promise<void> {
    const evolution = this.activeEvolutions.get(evolutionId)
    if (!evolution) {
      throw new EvolutionBridgeError({
        code: "EVOLUTION_NOT_FOUND",
        message: `Active evolution ${evolutionId} not found`,
      })
    }

    evolution.status = EvolutionStatus.FAILED
    this.activeEvolutions.delete(evolutionId)
    this.evolutionHistory.unshift(evolution)

    log.info("Evolution cancelled", { evolutionId })
  }

  /**
   * Apply evolution changes
   */
  async applyEvolution(evolutionId: string): Promise<void> {
    const evolution = await this.getEvolutionStatus(evolutionId)

    if (evolution.status !== EvolutionStatus.COMPLETED) {
      throw new EvolutionBridgeError({
        code: "INVALID_STATUS",
        message: `Cannot apply evolution in status ${evolution.status}`,
      })
    }

    evolution.status = EvolutionStatus.APPLYING
    this.emit(EvolutionEvent.APPLYING_CHANGES, { evolution })

    for (const change of evolution.changes) {
      await writeFile(change.file, change.evolvedContent, "utf-8")
    }

    log.info("Evolution applied", { evolutionId })
  }

  /**
   * Rollback evolution changes
   */
  async rollbackEvolution(evolutionId: string): Promise<void> {
    const evolution = await this.getEvolutionStatus(evolutionId)

    if (!evolution.rollbackInfo?.available) {
      throw new EvolutionBridgeError({
        code: "ROLLBACK_NOT_AVAILABLE",
        message: `Rollback not available for evolution ${evolutionId}`,
      })
    }

    evolution.status = EvolutionStatus.ROLLED_BACK
    this.emit(EvolutionEvent.ROLLBACK_STARTED, { evolution })

    await this.dgmBridge.executeTool(
      "evolution.rollback",
      { snapshotId: evolution.rollbackInfo.snapshotId },
      { evolutionId },
    )

    this.emit(EvolutionEvent.ROLLBACK_COMPLETED, { evolution })
    log.info("Evolution rolled back", { evolutionId })
  }

  /**
   * Get evolution history
   */
  async getEvolutionHistory(limit: number = 50): Promise<EvolutionResult[]> {
    return this.evolutionHistory.slice(0, limit)
  }

  /**
   * Get performance metrics for files
   */
  async getPerformanceMetrics(
    targetFiles: string[],
  ): Promise<PerformanceMetrics> {
    const cacheKey = targetFiles.sort().join(",")
    const cached = this.metricsCache.get(cacheKey)

    // Return cached metrics if fresh (< 5 minutes old)
    if (cached && Date.now() - cached.timestamp < 300000) {
      return cached.metrics
    }

    // Measure new metrics
    const metrics = await this.dgmBridge.executeTool(
      "evolution.metrics",
      { targetFiles },
      {},
    )

    this.metricsCache.set(cacheKey, { metrics, timestamp: Date.now() })
    return metrics
  }

  /**
   * Create evolution session
   */
  async createSession(
    name: string,
    description: string,
  ): Promise<EvolutionSession> {
    const session: EvolutionSession = {
      id: generateId(),
      name,
      description,
      requests: [],
      startTime: Date.now(),
      totalImprovements: 0,
      aggregateMetrics: {
        performanceGain: 0,
        memoryReduction: 0,
        errorReduction: 0,
        testCoverageIncrease: 0,
      },
      status: "active",
    }

    this.sessions.set(session.id, session)
    return session
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(): Promise<EvolutionSession[]> {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "active",
    )
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: DGMStatus
    activeEvolutions: number
    queuedEvolutions: number
    completedEvolutions: number
    successRate: number
  }> {
    const completed = this.evolutionHistory.filter(
      (e) => e.status === EvolutionStatus.COMPLETED,
    ).length
    const total = this.evolutionHistory.length

    return {
      status: this.dgmBridge.status,
      activeEvolutions: this.activeEvolutions.size,
      queuedEvolutions: 0, // We don't queue in this implementation
      completedEvolutions: completed,
      successRate: total > 0 ? (completed / total) * 100 : 0,
    }
  }

  /**
   * Start metrics tracking
   */
  private startMetricsTracking(): void {
    this.metricsTimer = setInterval(async () => {
      if (this.config.telemetry.metricsEndpoint) {
        const health = await this.healthCheck()
        // Send metrics to endpoint (implementation depends on your telemetry system)
        log.info("Metrics reported", { health })
      }
    }, this.config.telemetry.reportingInterval)
  }

  /**
   * Shutdown bridge
   */
  async shutdown(): Promise<void> {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
    }

    // Cancel all active evolutions
    for (const [id] of this.activeEvolutions) {
      await this.cancelEvolution(id)
    }

    log.info("Evolution bridge shutdown")
  }
}
