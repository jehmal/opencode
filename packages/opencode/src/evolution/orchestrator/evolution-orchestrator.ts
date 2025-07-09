/**
 * Evolution Orchestrator - Main coordinator for the evolution loop
 * Brings together all evolution components into a cohesive self-improvement system
 */

import { EventEmitter } from "events"
import { Log } from "../../util/log"
import { NamedError } from "../../util/error"
import { z } from "zod"
import { EvolutionBridge } from "../bridge"
import { UsageAnalyzer } from "./usage-analyzer"
import { SandboxManager } from "../sandbox/sandbox-manager"
import { EvolutionUI } from "../ui"
import { EvolutionEvent, type ImprovementHypothesis } from "../types"
import { EvolutionProcess } from "./evolution-process"
import { EvolutionPrioritizer } from "./evolution-prioritizer"
import { EvolutionMetricsCollector } from "./evolution-metrics"
import { EvolutionRollbackManager } from "./evolution-rollback"
import { EvolutionConfigManager } from "./evolution-config"

const log = Log.create({ service: "evolution-orchestrator" })

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  cycleInterval?: number // Evolution cycle interval in ms
  maxConcurrentEvolutions?: number
  autoApprove?: {
    enabled: boolean
    maxRiskLevel: number
    types: string[]
  }
  priorities?: Record<string, number>
  enabled?: boolean
}

/**
 * Orchestrator errors
 */
export const OrchestratorError = NamedError.create(
  "OrchestratorError",
  z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
)

/**
 * Evolution Orchestrator events
 */
export enum OrchestratorEvent {
  CYCLE_STARTED = "orchestrator:cycle:started",
  CYCLE_COMPLETED = "orchestrator:cycle:completed",
  EVOLUTION_QUEUED = "orchestrator:evolution:queued",
  EVOLUTION_STARTED = "orchestrator:evolution:started",
  EVOLUTION_COMPLETED = "orchestrator:evolution:completed",
  EVOLUTION_FAILED = "orchestrator:evolution:failed",
  PAUSED = "orchestrator:paused",
  RESUMED = "orchestrator:resumed",
  STOPPED = "orchestrator:stopped",
}

/**
 * Main Evolution Orchestrator
 */
export class EvolutionOrchestrator extends EventEmitter {
  private evolutionLoop: NodeJS.Timeout | null = null
  private activeEvolutions = new Map<string, EvolutionProcess>()
  private evolutionQueue: ImprovementHypothesis[] = []
  private isRunning = false
  private isPaused = false
  private cycleCount = 0
  private successCount = 0
  private failureCount = 0

  constructor(
    private bridge: EvolutionBridge,
    private analyzer: UsageAnalyzer,
    private sandbox: SandboxManager,
    private ui: EvolutionUI,
    private prioritizer: EvolutionPrioritizer,
    private metricsCollector: EvolutionMetricsCollector,
    private rollbackManager: EvolutionRollbackManager,
    private configManager: EvolutionConfigManager,
  ) {
    super()
    this.setupEventHandlers()
  }

  /**
   * Start the evolution orchestrator
   */
  async start(config?: OrchestratorConfig): Promise<void> {
    if (this.isRunning) {
      log.warn("Orchestrator already running")
      return
    }

    log.info("Starting evolution orchestrator", { config })

    // Update configuration
    if (config) {
      await this.configManager.updateConfig(config)
    }

    const currentConfig = await this.configManager.getConfig()

    if (!currentConfig.enabled) {
      log.warn("Evolution orchestrator is disabled")
      return
    }

    this.isRunning = true
    this.isPaused = false

    // Run initial cycle immediately
    await this.runEvolutionCycle()

    // Start periodic cycles
    const interval = currentConfig.cycleInterval || 300000 // 5 minutes default
    this.evolutionLoop = setInterval(async () => {
      if (!this.isPaused) {
        await this.runEvolutionCycle()
      }
    }, interval)

    this.emit(OrchestratorEvent.RESUMED)
  }

  /**
   * Stop the evolution orchestrator
   */
  async stop(): Promise<void> {
    log.info("Stopping evolution orchestrator")

    if (this.evolutionLoop) {
      clearInterval(this.evolutionLoop)
      this.evolutionLoop = null
    }

    // Cancel all active evolutions
    for (const [id, process] of this.activeEvolutions) {
      try {
        await process.cancel()
      } catch (error) {
        log.error("Failed to cancel evolution", { id, error })
      }
    }

    this.activeEvolutions.clear()
    this.evolutionQueue = []
    this.isRunning = false
    this.isPaused = false

    this.emit(OrchestratorEvent.STOPPED)
  }

  /**
   * Pause the evolution orchestrator
   */
  pause(): void {
    log.info("Pausing evolution orchestrator")
    this.isPaused = true
    this.emit(OrchestratorEvent.PAUSED)
  }

  /**
   * Resume the evolution orchestrator
   */
  resume(): void {
    log.info("Resuming evolution orchestrator")
    this.isPaused = false
    this.emit(OrchestratorEvent.RESUMED)
  }

  /**
   * Run a single evolution cycle
   */
  private async runEvolutionCycle(): Promise<void> {
    this.cycleCount++
    log.info(`Starting evolution cycle ${this.cycleCount}`)
    this.emit(OrchestratorEvent.CYCLE_STARTED, { cycle: this.cycleCount })

    try {
      // 1. Analyze usage patterns
      const patterns = await this.analyzer.detectPatterns()
      log.info(`Detected ${patterns.length} patterns`)

      // 2. Generate hypotheses from patterns
      const hypotheses = await this.analyzer.generateHypotheses(patterns)
      log.info(`Generated ${hypotheses.length} hypotheses`)

      // 3. Prioritize evolutions
      const prioritized = await this.prioritizeEvolutions(hypotheses)

      // 4. Add to queue
      this.evolutionQueue.push(...prioritized)

      // 5. Process queue up to concurrent limit
      await this.processEvolutionQueue()

      this.emit(OrchestratorEvent.CYCLE_COMPLETED, {
        cycle: this.cycleCount,
        patternsDetected: patterns.length,
        hypothesesGenerated: hypotheses.length,
        evolutionsQueued: prioritized.length,
        activeEvolutions: this.activeEvolutions.size,
      })
    } catch (error) {
      log.error("Evolution cycle failed", { cycle: this.cycleCount, error })
      this.emit(OrchestratorEvent.CYCLE_COMPLETED, {
        cycle: this.cycleCount,
        error,
      })
    }
  }

  /**
   * Prioritize evolutions based on impact and confidence
   */
  private async prioritizeEvolutions(
    hypotheses: ImprovementHypothesis[],
  ): Promise<ImprovementHypothesis[]> {
    const config = await this.configManager.getConfig()
    return this.prioritizer.prioritize(hypotheses, config.priorities)
  }

  /**
   * Process the evolution queue
   */
  private async processEvolutionQueue(): Promise<void> {
    const config = await this.configManager.getConfig()
    const maxConcurrent = config.maxConcurrentEvolutions || 3

    while (
      this.evolutionQueue.length > 0 &&
      this.activeEvolutions.size < maxConcurrent
    ) {
      const hypothesis = this.evolutionQueue.shift()
      if (!hypothesis) break

      await this.executeEvolution(hypothesis)
    }
  }

  /**
   * Execute a single evolution
   */
  private async executeEvolution(
    hypothesis: ImprovementHypothesis,
  ): Promise<void> {
    const process = new EvolutionProcess(
      hypothesis.id,
      hypothesis,
      this,
      this.bridge,
      this.sandbox,
      this.ui,
      this.rollbackManager,
      this.configManager,
    )

    this.activeEvolutions.set(hypothesis.id, process)
    this.emit(OrchestratorEvent.EVOLUTION_QUEUED, { hypothesis })

    try {
      this.emit(OrchestratorEvent.EVOLUTION_STARTED, { hypothesis })
      const result = await process.execute()

      this.successCount++
      await this.metricsCollector.collectMetrics(result)

      this.emit(OrchestratorEvent.EVOLUTION_COMPLETED, {
        hypothesis,
        result,
      })
    } catch (error) {
      this.failureCount++
      log.error("Evolution failed", { hypothesis: hypothesis.id, error })

      this.emit(OrchestratorEvent.EVOLUTION_FAILED, {
        hypothesis,
        error,
      })
    } finally {
      this.activeEvolutions.delete(hypothesis.id)
    }
  }

  /**
   * Get orchestrator status
   */
  getStatus(): {
    isRunning: boolean
    isPaused: boolean
    cycleCount: number
    activeEvolutions: number
    queuedEvolutions: number
    successCount: number
    failureCount: number
    successRate: number
  } {
    const total = this.successCount + this.failureCount
    const successRate = total > 0 ? this.successCount / total : 0

    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      cycleCount: this.cycleCount,
      activeEvolutions: this.activeEvolutions.size,
      queuedEvolutions: this.evolutionQueue.length,
      successCount: this.successCount,
      failureCount: this.failureCount,
      successRate,
    }
  }

  /**
   * Get active evolutions
   */
  getActiveEvolutions(): Array<{
    id: string
    hypothesis: ImprovementHypothesis
    state: string
    startTime: number
  }> {
    return Array.from(this.activeEvolutions.values()).map((process) => ({
      id: process.id,
      hypothesis: process.hypothesis,
      state: process.getState(),
      startTime: process.getStartTime(),
    }))
  }

  /**
   * Get evolution metrics report
   */
  async getMetricsReport(): Promise<any> {
    return this.metricsCollector.generateReport()
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Listen to bridge events
    this.bridge.on(EvolutionEvent.EVOLUTION_COMPLETED, async (result) => {
      log.info("Evolution completed via bridge", { id: result.id })
    })

    this.bridge.on(EvolutionEvent.EVOLUTION_FAILED, async (error) => {
      log.error("Evolution failed via bridge", { error })
    })

    // Listen to UI events
    this.ui.on("evolution:approved", async (evolutionId) => {
      log.info("Evolution approved by user", { evolutionId })
    })

    this.ui.on("evolution:rejected", async (evolutionId) => {
      log.info("Evolution rejected by user", { evolutionId })
      const process = this.activeEvolutions.get(evolutionId)
      if (process) {
        await process.reject()
      }
    })

    // Listen to config changes
    this.configManager.on("config-updated", async (config) => {
      log.info("Configuration updated", { config })

      // Restart if cycle interval changed
      if (this.isRunning && config.cycleInterval) {
        await this.stop()
        await this.start()
      }
    })
  }
}
