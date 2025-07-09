import { z } from "zod"
import { Bus } from "../../bus"
import { Storage } from "../../storage/storage"
import { Log } from "../../util/log"
import { PromptComposer } from "../composer/prompt-composer"
import { TechniqueInheritance } from "../inheritance/technique-inheritance"
import { PerformanceTracker } from "../learning/performance-tracker"
import { TechniqueRegistry } from "../registry/technique-registry"
import { TechniqueSelector } from "../selector/technique-selector"
import type {
  EnhancedPrompt,
  PromptingTechnique,
  TaskAnalysis,
  TechniqueContext,
  TechniqueExecution,
  TechniqueModification,
  TechniqueSet,
} from "../types"

export interface TaskCompleteEvent {
  taskId: string
  duration: number
  success: boolean
  metadata: {
    techniques: string[]
  }
  metrics: {
    tokensUsed: number
    latency: number
  }
}

export interface SessionTechniqueConfig {
  sessionId: string
  techniques: string[]
  autoSelect: boolean
  strategy?: "performance" | "balanced" | "exploration"
  constraints?: string[]
}

export class DGMOPromptingIntegration {
  private registry: TechniqueRegistry
  private selector: TechniqueSelector
  private composer: PromptComposer
  private inheritance: TechniqueInheritance
  private performanceTracker: PerformanceTracker
  private initialized = false
  private sessionConfigs = new Map<string, SessionTechniqueConfig>()
  private log = Log.create({ service: "prompting-integration" })

  // Event definitions for technique usage
  static Events = {
    TechniqueApplied: Bus.event(
      "prompting.technique.applied",
      z.object({
        sessionId: z.string(),
        techniqueId: z.string(),
        techniqueName: z.string(),
        timestamp: z.number(),
      }),
    ),
    TechniquePerformance: Bus.event(
      "prompting.technique.performance",
      z.object({
        sessionId: z.string(),
        techniqueId: z.string(),
        success: z.boolean(),
        duration: z.number(),
        tokensUsed: z.number(),
      }),
    ),
  }

  constructor() {
    this.registry = new TechniqueRegistry()
    this.selector = new TechniqueSelector()
    this.composer = new PromptComposer()
    this.inheritance = new TechniqueInheritance()
    this.performanceTracker = new PerformanceTracker()
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    const start = performance.now()

    // Initialize all components
    await Promise.all([
      this.registry.initialize(),
      this.performanceTracker.initialize(),
    ])

    this.initialized = true
  }

  // Integration with Session Manager
  async enhanceSessionPrompt(
    sessionId: string,
    task: string,
  ): Promise<EnhancedPrompt> {
    await this.ensureInitialized()

    const context = await this.buildContext(sessionId, task)
    const analysis = await this.selector.analyze(task, {
      sessionId,
      agentId: context.agentId,
      constraints: context.constraints,
      performanceHistory: await this.performanceTracker.getHistory(sessionId),
    })

    const availableTechniques = this.registry.getAll()
    const selected = await this.selector.select(analysis, availableTechniques)

    return this.composer.compose(
      selected.primary,
      context,
      selected.composition,
    )
  }

  async composePrompt(
    sessionId: string,
    task: string,
    techniqueIds: string[],
    strategy?: "sequential" | "parallel" | "nested",
  ): Promise<EnhancedPrompt> {
    await this.ensureInitialized()

    const context = await this.buildContext(sessionId, task)
    const techniques = (
      await Promise.all(techniqueIds.map((id) => this.registry.get(id)))
    ).filter((t) => t !== undefined) as PromptingTechnique[]

    if (techniques.length === 0) {
      throw new Error("No valid techniques found for composition")
    }

    return this.composer.compose(techniques, context, {
      type: strategy || "sequential",
    })
  }

  // Integration with Parallel Agents
  async prepareSubAgentTechniques(
    parentAgentId: string,
    subAgentTask: string,
    modifications?: TechniqueModification[],
  ): Promise<TechniqueSet> {
    await this.ensureInitialized()

    const parentTechniques =
      await this.inheritance.getAgentTechniques(parentAgentId)
    const inherited = this.inheritance.inherit(
      parentTechniques,
      modifications || [],
    )

    // Adapt based on sub-agent specific task
    const taskAnalysis = await this.selector.analyze(subAgentTask, {
      sessionId: inherited.metadata.agentId,
      agentId: inherited.metadata.agentId,
      parentTechniques: Array.from(parentTechniques.techniques.keys()),
      constraints: [],
    })

    return this.adaptTechniques(inherited, taskAnalysis)
  }

  // Integration with Task Events
  async onTaskComplete(event: TaskCompleteEvent): Promise<void> {
    const execution: TechniqueExecution = {
      taskId: event.taskId,
      techniques: event.metadata.techniques,
      duration: event.duration,
      success: event.success,
      metrics: {
        tokensUsed: event.metrics.tokensUsed,
        latency: event.metrics.latency,
      },
    }

    await this.performanceTracker.record(execution)

    // Update selector performance scores
    if (execution.techniques.length > 0) {
      // This would need task type information in a real implementation
      // For now, we'll skip the update
    }
  }

  // Get technique recommendations for a task
  async recommendTechniques(
    task: string,
    limit = 5,
  ): Promise<{
    techniques: Array<{
      id: string
      name: string
      confidence: number
      reasoning: string[]
    }>
    analysis: TaskAnalysis
  }> {
    await this.ensureInitialized()

    const analysis = await this.selector.analyze(task, {
      sessionId: "recommendation",
      agentId: "recommendation",
      constraints: [],
    })

    const availableTechniques = this.registry.getAll()
    const scores = this.selector.rank(
      availableTechniques as PromptingTechnique[],
      analysis,
    )

    const techniques = scores.slice(0, limit).map((score) => ({
      id: score.technique.id,
      name: score.technique.name,
      confidence: score.score / 100,
      reasoning: score.reasons,
    }))

    return { techniques, analysis }
  }

  // Get technique by ID
  async getTechnique(id: string): Promise<PromptingTechnique | undefined> {
    await this.ensureInitialized()
    return this.registry.get(id)
  }

  // Search techniques
  async searchTechniques(query: {
    categories?: string[]
    capabilities?: string[]
    taskTypes?: string[]
  }): Promise<PromptingTechnique[]> {
    await this.ensureInitialized()
    return this.registry.search(query as any)
  }

  // Performance metrics
  async getPerformanceMetrics(): Promise<{
    registry: any
    selector: any
    composer: any
    tracker: any
  }> {
    await this.ensureInitialized()

    return {
      registry: this.registry.getMetrics(),
      selector: {
        totalAnalyses: 0, // Would be tracked in real implementation
        averageAnalysisTime: 0,
      },
      composer: {
        totalCompositions: 0,
        cacheHitRate: 0,
      },
      tracker: await this.performanceTracker.getMetrics(),
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  private async buildContext(
    sessionId: string,
    task: string,
  ): Promise<TechniqueContext> {
    const config = await this.getSessionConfig(sessionId)
    return {
      task,
      sessionId,
      agentId: sessionId, // Or a more specific agent ID if available
      variables: {},
      constraints: (config?.constraints as any) || [],
      previousTechniques: [],
      capabilities: [], // Add relevant capabilities
    }
  }

  private async adaptTechniques(
    techniqueSet: TechniqueSet,
    analysis: TaskAnalysis,
  ): Promise<TechniqueSet> {
    // Filter techniques based on task analysis
    const adapted = new Map<string, PromptingTechnique>()

    for (const [id, technique] of techniqueSet.techniques) {
      // Check if technique is suitable for the task
      const suitable = analysis.taskType.some((type) =>
        technique.suitableFor.includes(type),
      )

      if (suitable) {
        adapted.set(id, technique)
      }
    }

    // Add recommended techniques if not present
    for (const suggestionId of analysis.suggestedTechniques) {
      if (!adapted.has(suggestionId)) {
        const technique = this.registry.get(suggestionId)
        if (technique) {
          adapted.set(suggestionId, technique)
        }
      }
    }

    return {
      techniques: adapted,
      metadata: {
        ...techniqueSet.metadata,
        modifications: [
          ...techniqueSet.metadata.modifications,
          {
            techniqueId: "adaptation",
            type: "parameter",
            value: { taskAnalysis: analysis },
            reason: "Adapted for sub-agent task",
          },
        ],
      },
    }
  }

  // Session configuration methods
  async configureSession(config: SessionTechniqueConfig): Promise<void> {
    this.sessionConfigs.set(config.sessionId, config)
    await Storage.writeJSON(`prompting/sessions/${config.sessionId}`, config)

    this.log.info("Session configured", {
      sessionId: config.sessionId,
      techniques: config.techniques,
      autoSelect: config.autoSelect,
    })
  }

  async getSessionConfig(
    sessionId: string,
  ): Promise<SessionTechniqueConfig | undefined> {
    if (this.sessionConfigs.has(sessionId)) {
      return this.sessionConfigs.get(sessionId)
    }

    const storedConfig = await Storage.readJSON<SessionTechniqueConfig>(
      `prompting/sessions/${sessionId}`,
    )
    if (storedConfig) {
      this.sessionConfigs.set(sessionId, storedConfig)
    }

    return storedConfig
  }

  // Enhanced prompt generation for sessions
  async enhancePrompt(
    sessionId: string,
    prompt: string,
    options?: {
      techniques?: string[]
      autoSelect?: boolean
      strategy?: "performance" | "balanced" | "exploration"
    },
  ): Promise<EnhancedPrompt> {
    await this.ensureInitialized()

    // Get or create session config
    let config = await this.getSessionConfig(sessionId)

    if (!config) {
      config = {
        sessionId,
        techniques: options?.techniques || [],
        autoSelect: options?.autoSelect ?? true,
        strategy: options?.strategy || "balanced",
      }
      await this.configureSession(config)
    }

    // Build context
    const context = await this.buildContext(sessionId, prompt)

    // Select techniques
    let selectedTechniques: PromptingTechnique[]

    if (options?.techniques && options.techniques.length > 0) {
      // Use specified techniques
      selectedTechniques = options.techniques
        .map((id) => this.registry.get(id))
        .filter((t): t is PromptingTechnique => t !== undefined)
    } else if (config.autoSelect) {
      // Auto-select techniques
      const analysis = await this.selector.analyze(prompt, context)
      const availableTechniques = this.registry.getAll()
      const selected = await this.selector.select(analysis, availableTechniques)
      selectedTechniques = selected.primary
    } else {
      // Use configured techniques
      selectedTechniques = config.techniques
        .map((id) => this.registry.get(id))
        .filter((t): t is PromptingTechnique => t !== undefined)
    }

    if (selectedTechniques.length === 0) {
      return {
        content: prompt,
        variables: {},
        metadata: {
          techniques: [],
          confidence: 1.0,
          estimatedTokens: 0,
          compositionStrategy: "none",
        },
      }
    }

    // Compose enhanced prompt
    const enhanced = await this.composer.compose(selectedTechniques, context)

    // Track performance
    await this.performanceTracker.record({
      taskId: `${sessionId}-${Date.now()}`,
      techniques: selectedTechniques.map((t) => t.id),
      success: true,
      duration: 0, // Will be updated later
      metrics: {
        tokensUsed: enhanced.metadata.estimatedTokens,
        latency: 0,
      },
    })

    return enhanced
  }

  // Track technique performance from session results
  async trackSessionPerformance(
    sessionId: string,
    success: boolean,
    metrics: {
      duration: number
      tokensUsed: number
    },
  ): Promise<void> {
    const config = await this.getSessionConfig(sessionId)
    if (!config) return

    const execution: TechniqueExecution = {
      taskId: sessionId,
      techniques: config.techniques,
      duration: metrics.duration,
      success,
      metrics: {
        tokensUsed: metrics.tokensUsed,
        latency: metrics.duration,
      },
    }

    await this.performanceTracker.record(execution)

    // Emit performance event
    for (const techniqueId of config.techniques) {
      Bus.publish(DGMOPromptingIntegration.Events.TechniquePerformance, {
        sessionId,
        techniqueId,
        success,
        duration: metrics.duration,
        tokensUsed: metrics.tokensUsed,
      })
    }
  }

  // Clean up session data
  async cleanupSession(sessionId: string): Promise<void> {
    this.sessionConfigs.delete(sessionId)
    await Storage.remove(`prompting/sessions/${sessionId}`).catch(() => {})
  }
}

// Singleton instance for easy access
export const promptingIntegration = new DGMOPromptingIntegration()
