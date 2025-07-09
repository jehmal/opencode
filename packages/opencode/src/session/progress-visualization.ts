import { z } from "zod"
import { ProgressTracker } from "./progress-tracker"

// Progress visualization and UI components
export namespace ProgressVisualization {
  // Progress bar configuration schema
  export const ProgressBarConfigSchema = z.object({
    width: z.number().min(10).max(200).default(50),
    height: z.number().min(1).max(10).default(1),
    showPercentage: z.boolean().default(true),
    showETA: z.boolean().default(true),
    showVelocity: z.boolean().default(false),
    animated: z.boolean().default(true),
    theme: z.enum(["default", "minimal", "detailed"]).default("default"),
    colors: z
      .object({
        complete: z.string().default("green"),
        incomplete: z.string().default("gray"),
        background: z.string().default("black"),
        text: z.string().default("white"),
      })
      .default({}),
  })

  export type ProgressBarConfig = z.infer<typeof ProgressBarConfigSchema>

  // Progress display formats
  export enum DisplayFormat {
    BAR = "bar",
    PERCENTAGE = "percentage",
    SPINNER = "spinner",
    DOTS = "dots",
    DETAILED = "detailed",
  }

  // ANSI color codes for terminal output
  const Colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",
    bgBlack: "\x1b[40m",
    bgGreen: "\x1b[42m",
    bgGray: "\x1b[100m",
  }

  // Progress bar renderer
  export class ProgressBarRenderer {
    private config: ProgressBarConfig
    private animationFrame = 0
    private lastRender = 0

    constructor(config: Partial<ProgressBarConfig> = {}) {
      this.config = ProgressBarConfigSchema.parse(config)
    }

    renderProgressBar(
      progress: number,
      taskID?: string,
      format: DisplayFormat = DisplayFormat.BAR,
    ): string {
      const now = Date.now()

      // Throttle rendering to avoid excessive updates
      if (now - this.lastRender < 100) {
        return ""
      }
      this.lastRender = now

      switch (format) {
        case DisplayFormat.BAR:
          return this.renderBar(progress, taskID)
        case DisplayFormat.PERCENTAGE:
          return this.renderPercentage(progress, taskID)
        case DisplayFormat.SPINNER:
          return this.renderSpinner(progress, taskID)
        case DisplayFormat.DOTS:
          return this.renderDots(progress)
        case DisplayFormat.DETAILED:
          return this.renderDetailed(progress, taskID)
        default:
          return this.renderBar(progress, taskID)
      }
    }

    private renderBar(progress: number, taskID?: string): string {
      const { width, showPercentage, showETA } = this.config
      const completed = Math.floor((progress / 100) * width)
      const remaining = width - completed

      // Create progress bar
      const completedBar = Colors.bgGreen + " ".repeat(completed) + Colors.reset
      const remainingBar = Colors.bgGray + " ".repeat(remaining) + Colors.reset
      const bar = `[${completedBar}${remainingBar}]`

      // Add percentage if enabled
      const percentage = showPercentage ? ` ${progress.toFixed(1)}%` : ""

      // Add ETA if enabled and available
      let eta = ""
      if (showETA && taskID) {
        const analytics = ProgressTracker.getProgressAnalytics(taskID)
        if (analytics?.estimatedCompletion) {
          const remainingTime = Math.max(
            0,
            analytics.estimatedCompletion - Date.now(),
          )
          eta = ` ETA: ${this.formatDuration(remainingTime)}`
        }
      }

      return `${Colors.cyan}Progress:${Colors.reset} ${bar}${percentage}${eta}`
    }

    private renderPercentage(progress: number, taskID?: string): string {
      const percentage = `${progress.toFixed(1)}%`

      if (taskID) {
        const analytics = ProgressTracker.getProgressAnalytics(taskID)
        if (analytics?.velocity) {
          const velocity = `(${analytics.velocity.toFixed(1)}%/min)`
          return `${Colors.cyan}Progress:${Colors.reset} ${percentage} ${Colors.gray}${velocity}${Colors.reset}`
        }
      }

      return `${Colors.cyan}Progress:${Colors.reset} ${percentage}`
    }

    private renderSpinner(progress: number, _taskID?: string): string {
      const spinners = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
      const spinner = spinners[this.animationFrame % spinners.length]
      this.animationFrame++

      const percentage = `${progress.toFixed(1)}%`
      return `${Colors.cyan}${spinner} Processing...${Colors.reset} ${percentage}`
    }

    private renderDots(progress: number): string {
      const totalDots = 20
      const completedDots = Math.floor((progress / 100) * totalDots)
      const dots =
        "●".repeat(completedDots) + "○".repeat(totalDots - completedDots)

      return `${Colors.cyan}Progress:${Colors.reset} ${Colors.green}${dots}${Colors.reset} ${progress.toFixed(1)}%`
    }

    private renderDetailed(progress: number, taskID?: string): string {
      if (!taskID) {
        return this.renderBar(progress, taskID)
      }

      const analytics = ProgressTracker.getProgressAnalytics(taskID)
      if (!analytics) {
        return this.renderBar(progress, taskID)
      }

      const lines = []

      // Main progress bar
      lines.push(this.renderBar(progress, taskID))

      // Phase breakdown
      if (analytics.phases && analytics.phases.length > 0) {
        lines.push(`${Colors.gray}Phases:${Colors.reset}`)
        analytics.phases.forEach((phase) => {
          const status = phase.completed ? "✓" : "○"
          const color = phase.completed ? Colors.green : Colors.gray
          lines.push(`  ${color}${status} ${phase.name}${Colors.reset}`)
        })
      }

      // Tool metrics
      if (analytics.toolMetrics.totalTools > 0) {
        const { completedTools, totalTools, failedTools } =
          analytics.toolMetrics
        lines.push(
          `${Colors.gray}Tools: ${completedTools}/${totalTools} completed${failedTools > 0 ? `, ${failedTools} failed` : ""}${Colors.reset}`,
        )
      }

      // Performance metrics
      if (analytics.velocity) {
        lines.push(
          `${Colors.gray}Velocity: ${analytics.velocity.toFixed(1)}%/min${Colors.reset}`,
        )
      }

      if (analytics.efficiency) {
        const efficiencyPercent = (analytics.efficiency * 100).toFixed(1)
        lines.push(
          `${Colors.gray}Efficiency: ${efficiencyPercent}%${Colors.reset}`,
        )
      }

      return lines.join("\n")
    }

    private formatDuration(ms: number): string {
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)

      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`
      } else {
        return `${seconds}s`
      }
    }

    updateConfig(newConfig: Partial<ProgressBarConfig>) {
      this.config = ProgressBarConfigSchema.parse({
        ...this.config,
        ...newConfig,
      })
    }
  }

  // Progress state manager for UI updates
  export class ProgressStateManager {
    private activeProgress = new Map<
      string,
      {
        progress: number
        renderer: ProgressBarRenderer
        lastUpdate: number
        format: DisplayFormat
      }
    >()

    private updateCallbacks = new Map<
      string,
      Array<(progress: number, display: string) => void>
    >()

    startTracking(
      taskID: string,
      config: Partial<ProgressBarConfig> = {},
      format: DisplayFormat = DisplayFormat.BAR,
    ) {
      const renderer = new ProgressBarRenderer(config)

      this.activeProgress.set(taskID, {
        progress: 0,
        renderer,
        lastUpdate: Date.now(),
        format,
      })

      // Initial render
      this.updateProgress(taskID, 0)
    }

    updateProgress(taskID: string, progress: number) {
      const state = this.activeProgress.get(taskID)
      if (!state) return

      state.progress = progress
      state.lastUpdate = Date.now()

      // Render progress display
      const display = state.renderer.renderProgressBar(
        progress,
        taskID,
        state.format,
      )

      // Notify callbacks
      const callbacks = this.updateCallbacks.get(taskID) || []
      callbacks.forEach((callback) => callback(progress, display))
    }

    stopTracking(taskID: string) {
      this.activeProgress.delete(taskID)
      this.updateCallbacks.delete(taskID)
    }

    onProgressUpdate(
      taskID: string,
      callback: (progress: number, display: string) => void,
    ) {
      const callbacks = this.updateCallbacks.get(taskID) || []
      callbacks.push(callback)
      this.updateCallbacks.set(taskID, callbacks)
    }

    getActiveProgress(): Array<{
      taskID: string
      progress: number
      lastUpdate: number
    }> {
      return Array.from(this.activeProgress.entries()).map(
        ([taskID, state]) => ({
          taskID,
          progress: state.progress,
          lastUpdate: state.lastUpdate,
        }),
      )
    }

    // Batch update multiple progress bars
    updateMultiple(updates: Array<{ taskID: string; progress: number }>) {
      updates.forEach(({ taskID, progress }) => {
        this.updateProgress(taskID, progress)
      })
    }

    // Get formatted display for a specific task
    getDisplay(taskID: string): string {
      const state = this.activeProgress.get(taskID)
      if (!state) return ""

      return state.renderer.renderProgressBar(
        state.progress,
        taskID,
        state.format,
      )
    }

    // Change display format for a task
    setDisplayFormat(taskID: string, format: DisplayFormat) {
      const state = this.activeProgress.get(taskID)
      if (state) {
        state.format = format
        this.updateProgress(taskID, state.progress) // Trigger re-render
      }
    }
  }

  // Singleton instances
  export const stateManager = new ProgressStateManager()
  export const defaultRenderer = new ProgressBarRenderer()

  // Utility functions
  export function createProgressBar(
    config?: Partial<ProgressBarConfig>,
  ): ProgressBarRenderer {
    return new ProgressBarRenderer(config)
  }

  export function formatProgress(
    progress: number,
    format: DisplayFormat = DisplayFormat.BAR,
    config?: Partial<ProgressBarConfig>,
  ): string {
    const renderer = new ProgressBarRenderer(config)
    return renderer.renderProgressBar(progress, undefined, format)
  }

  // Animation helpers
  export function animateProgress(
    from: number,
    to: number,
    duration: number,
    onUpdate: (progress: number) => void,
    onComplete?: () => void,
  ) {
    const startTime = Date.now()
    const difference = to - from

    function animate() {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-out)
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      const currentValue = from + difference * easedProgress

      onUpdate(currentValue)

      if (progress < 1) {
        setTimeout(animate, 16) // ~60fps
      } else {
        onComplete?.()
      }
    }

    animate()
  }
}
