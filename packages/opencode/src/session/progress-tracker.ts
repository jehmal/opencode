import { z } from "zod"
import { Bus } from "../bus"
import {
  TaskProgressEvent,
  TaskStartedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
} from "../events/task-events"

// Progress calculation algorithms and state management
export namespace ProgressTracker {
  // Enhanced progress calculation schema
  export const ProgressStateSchema = z.object({
    sessionID: z.string(),
    taskID: z.string(),
    currentProgress: z.number().min(0).max(100),
    estimatedCompletion: z.number().optional(),
    velocity: z.number().optional(), // Progress per minute
    phases: z.array(
      z.object({
        name: z.string(),
        weight: z.number(), // Relative importance (0-1)
        completed: z.boolean(),
        progress: z.number().min(0).max(100),
      }),
    ),
    toolMetrics: z.object({
      totalTools: z.number(),
      completedTools: z.number(),
      failedTools: z.number(),
      averageToolTime: z.number().optional(),
    }),
    startTime: z.number(),
    lastUpdate: z.number(),
    smoothingFactor: z.number().min(0).max(1).default(0.3),
  })

  export type ProgressState = z.infer<typeof ProgressStateSchema>

  // Progress calculation strategies
  export enum CalculationStrategy {
    LINEAR = "linear",
    WEIGHTED_PHASES = "weighted_phases",
    TOOL_BASED = "tool_based",
    VELOCITY_BASED = "velocity_based",
    HYBRID = "hybrid",
  }

  // Progress phase definitions for different task types
  export const TaskPhases = {
    ANALYSIS: { name: "Analysis", weight: 0.2 },
    PLANNING: { name: "Planning", weight: 0.15 },
    IMPLEMENTATION: { name: "Implementation", weight: 0.5 },
    TESTING: { name: "Testing", weight: 0.1 },
    FINALIZATION: { name: "Finalization", weight: 0.05 },
  }

  class ProgressCalculator {
    private progressStates = new Map<string, ProgressState>()
    private progressHistory = new Map<
      string,
      Array<{ timestamp: number; progress: number }>
    >()

    constructor() {
      this.setupEventListeners()
    }

    private setupEventListeners() {
      Bus.subscribe(TaskStartedEvent, (event) => {
        this.initializeProgress(event.properties)
      })

      Bus.subscribe(TaskProgressEvent, (event) => {
        this.updateProgress(event.properties)
      })

      Bus.subscribe(TaskCompletedEvent, (event) => {
        this.completeProgress(event.properties)
      })

      Bus.subscribe(TaskFailedEvent, (event) => {
        this.handleFailure(event.properties)
      })
    }

    private initializeProgress(taskData: {
      sessionID: string
      taskID: string
      timestamp: number
    }) {
      const progressState: ProgressState = {
        sessionID: taskData.sessionID,
        taskID: taskData.taskID,
        currentProgress: 0,
        phases: Object.values(TaskPhases).map((phase) => ({
          name: phase.name,
          weight: phase.weight,
          completed: false,
          progress: 0,
        })),
        toolMetrics: {
          totalTools: 0,
          completedTools: 0,
          failedTools: 0,
        },
        startTime: taskData.timestamp,
        lastUpdate: taskData.timestamp,
        smoothingFactor: 0.3,
      }

      this.progressStates.set(taskData.taskID, progressState)
      this.progressHistory.set(taskData.taskID, [])
    }

    calculateProgress(
      taskID: string,
      strategy: CalculationStrategy = CalculationStrategy.HYBRID,
      additionalData?: {
        toolCount?: number
        completedTools?: number
        currentPhase?: string
        customProgress?: number
      },
    ): number {
      const state = this.progressStates.get(taskID)
      if (!state) return 0

      let calculatedProgress = 0

      switch (strategy) {
        case CalculationStrategy.LINEAR:
          calculatedProgress = this.calculateLinearProgress(state)
          break
        case CalculationStrategy.WEIGHTED_PHASES:
          calculatedProgress = this.calculateWeightedPhaseProgress(
            state,
            additionalData,
          )
          break
        case CalculationStrategy.TOOL_BASED:
          calculatedProgress = this.calculateToolBasedProgress(
            state,
            additionalData,
          )
          break
        case CalculationStrategy.VELOCITY_BASED:
          calculatedProgress = this.calculateVelocityBasedProgress(state)
          break
        case CalculationStrategy.HYBRID:
          calculatedProgress = this.calculateHybridProgress(
            state,
            additionalData,
          )
          break
      }

      // Apply smoothing to prevent jarring jumps
      const smoothedProgress = this.applySmoothingFilter(
        state,
        calculatedProgress,
      )

      // Update state
      state.currentProgress = smoothedProgress
      state.lastUpdate = Date.now()

      // Store in history for velocity calculations
      this.addToHistory(taskID, smoothedProgress)

      return smoothedProgress
    }

    private calculateLinearProgress(state: ProgressState): number {
      const elapsed = Date.now() - state.startTime
      const estimatedDuration = 120000 // 2 minutes default
      return Math.min((elapsed / estimatedDuration) * 100, 95)
    }

    private calculateWeightedPhaseProgress(
      state: ProgressState,
      data?: any,
    ): number {
      let totalProgress = 0

      state.phases.forEach((phase) => {
        if (phase.completed) {
          totalProgress += phase.weight * 100
        } else if (data?.currentPhase === phase.name) {
          totalProgress += phase.weight * phase.progress
        }
      })

      return Math.min(totalProgress, 95)
    }

    private calculateToolBasedProgress(
      state: ProgressState,
      data?: any,
    ): number {
      if (data?.toolCount && data.toolCount > 0) {
        const completedRatio = (data.completedTools || 0) / data.toolCount
        // Base progress of 25% + 65% for tool completion, capped at 90%
        return Math.min(25 + completedRatio * 65, 90)
      }
      return state.currentProgress
    }

    private calculateVelocityBasedProgress(state: ProgressState): number {
      const history = this.progressHistory.get(state.taskID) || []
      if (history.length < 2) return state.currentProgress

      // Calculate velocity (progress per minute)
      const recentHistory = history.slice(-5) // Last 5 data points
      const timeSpan =
        recentHistory[recentHistory.length - 1].timestamp -
        recentHistory[0].timestamp
      const progressSpan =
        recentHistory[recentHistory.length - 1].progress -
        recentHistory[0].progress

      if (timeSpan > 0) {
        const velocity = (progressSpan / timeSpan) * 60000 // per minute
        state.velocity = velocity

        // Estimate completion time
        const remainingProgress = 100 - state.currentProgress
        if (velocity > 0) {
          state.estimatedCompletion =
            Date.now() + (remainingProgress / velocity) * 60000
        }
      }

      return state.currentProgress
    }

    private calculateHybridProgress(state: ProgressState, data?: any): number {
      // Combine multiple strategies with weights
      const toolProgress = this.calculateToolBasedProgress(state, data)
      const phaseProgress = this.calculateWeightedPhaseProgress(state, data)
      const linearProgress = this.calculateLinearProgress(state)

      // Weighted combination
      const hybrid =
        toolProgress * 0.5 + phaseProgress * 0.3 + linearProgress * 0.2

      return Math.min(hybrid, 95)
    }

    private applySmoothingFilter(
      state: ProgressState,
      newProgress: number,
    ): number {
      const smoothingFactor = state.smoothingFactor
      return (
        state.currentProgress +
        smoothingFactor * (newProgress - state.currentProgress)
      )
    }

    private addToHistory(taskID: string, progress: number) {
      const history = this.progressHistory.get(taskID) || []
      history.push({ timestamp: Date.now(), progress })

      // Keep only last 20 entries for performance
      if (history.length > 20) {
        history.shift()
      }

      this.progressHistory.set(taskID, history)
    }

    private updateProgress(progressData: any) {
      const state = this.progressStates.get(progressData.taskID)
      if (!state) return

      // Update tool metrics if provided
      if (progressData.toolCount !== undefined) {
        state.toolMetrics.totalTools = progressData.toolCount
        state.toolMetrics.completedTools = progressData.completedTools || 0
      }

      // Recalculate progress
      this.calculateProgress(progressData.taskID, CalculationStrategy.HYBRID, {
        toolCount: state.toolMetrics.totalTools,
        completedTools: state.toolMetrics.completedTools,
      })
    }

    private completeProgress(completionData: any) {
      const state = this.progressStates.get(completionData.taskID)
      if (!state) return

      state.currentProgress = 100
      state.phases.forEach((phase) => {
        phase.completed = true
        phase.progress = 100
      })
    }

    private handleFailure(failureData: any) {
      const state = this.progressStates.get(failureData.taskID)
      if (!state) return

      state.toolMetrics.failedTools += 1
      // Progress might decrease slightly on failure
      state.currentProgress = Math.max(state.currentProgress - 5, 0)
    }

    getProgressState(taskID: string): ProgressState | undefined {
      return this.progressStates.get(taskID)
    }

    getProgressHistory(
      taskID: string,
    ): Array<{ timestamp: number; progress: number }> {
      return this.progressHistory.get(taskID) || []
    }

    // Advanced progress analytics
    getProgressAnalytics(taskID: string) {
      const state = this.progressStates.get(taskID)
      const history = this.progressHistory.get(taskID) || []

      if (!state) return null

      const elapsed = Date.now() - state.startTime
      const averageVelocity =
        history.length > 1 ? (state.currentProgress / elapsed) * 60000 : 0 // per minute

      return {
        currentProgress: state.currentProgress,
        velocity: state.velocity || averageVelocity,
        estimatedCompletion: state.estimatedCompletion,
        timeElapsed: elapsed,
        phases: state.phases,
        toolMetrics: state.toolMetrics,
        efficiency: this.calculateEfficiency(history),
      }
    }

    private calculateEfficiency(
      history: Array<{ timestamp: number; progress: number }>,
    ): number {
      if (history.length < 2) return 1

      // Calculate how smooth the progress curve is (less variance = more efficient)
      const progressRates = []
      for (let i = 1; i < history.length; i++) {
        const timeDiff = history[i].timestamp - history[i - 1].timestamp
        const progressDiff = history[i].progress - history[i - 1].progress
        if (timeDiff > 0) {
          progressRates.push(progressDiff / timeDiff)
        }
      }

      if (progressRates.length === 0) return 1

      const mean =
        progressRates.reduce((a, b) => a + b, 0) / progressRates.length
      const variance =
        progressRates.reduce((acc, rate) => acc + Math.pow(rate - mean, 2), 0) /
        progressRates.length

      // Lower variance = higher efficiency (more consistent progress)
      return Math.max(0, 1 - variance / (mean * mean + 1))
    }
  }

  // Singleton instance
  export const calculator = new ProgressCalculator()

  // Public API
  export function calculateProgress(
    taskID: string,
    strategy?: CalculationStrategy,
    data?: any,
  ): number {
    return calculator.calculateProgress(taskID, strategy, data)
  }

  export function getProgressState(taskID: string): ProgressState | undefined {
    return calculator.getProgressState(taskID)
  }

  export function getProgressAnalytics(taskID: string) {
    return calculator.getProgressAnalytics(taskID)
  }

  export function getProgressHistory(taskID: string) {
    return calculator.getProgressHistory(taskID)
  }
}
