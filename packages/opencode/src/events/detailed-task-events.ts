import { z } from "zod"
import { Bus } from "../bus"

// Enhanced task progress event with detailed context
export const DetailedTaskProgressEvent = Bus.event(
  "task.detailed-progress",
  z.object({
    sessionID: z.string(),
    taskID: z.string(),
    agentName: z.string(),

    // Main progress line (always shown)
    primaryStatus: z.string(),

    // Secondary details (shown when available)
    secondaryStatus: z.string().optional(),
    tertiaryStatus: z.string().optional(),

    // Tool context for smart summarization
    currentTool: z.string(),
    toolParameters: z.record(z.any()).optional(),

    // Timing and progress
    timestamp: z.number(),
    startTime: z.number(),
    estimatedCompletion: z.number().optional(),

    // Progress percentage (0-100)
    progress: z.number().min(0).max(100).optional(),

    // Phase information
    phase: z
      .enum(["initializing", "context-gathering", "processing", "finalizing"])
      .optional(),
  }),
)

// Compact task summary for Claude Code style display
export const TaskSummaryEvent = Bus.event(
  "task.summary",
  z.object({
    sessionID: z.string(),
    taskID: z.string(),
    agentName: z.string(),

    // 1-3 lines of current activity
    lines: z.array(z.string()).min(1).max(3),

    // Visual indicators
    icon: z.string().optional(),
    spinner: z.boolean().default(true),

    // Timing
    timestamp: z.number(),
    elapsed: z.number(), // milliseconds since start
  }),
)

// Helper to emit detailed progress events
export function emitDetailedTaskProgress(
  data: z.infer<typeof DetailedTaskProgressEvent.properties>,
) {
  Bus.publish(DetailedTaskProgressEvent, data)
}

// Helper to emit task summary events
export function emitTaskSummary(
  data: z.infer<typeof TaskSummaryEvent.properties>,
) {
  Bus.publish(TaskSummaryEvent, data)
}

// Progress summarization utility
export class ProgressSummarizer {
  private static toolIcons: Record<string, string> = {
    read: "📂",
    write: "💾",
    edit: "✏️",
    grep: "🔍",
    glob: "📁",
    bash: "🖥️",
    list: "📋",
    task: "🤖",
    webfetch: "🌐",
    todoread: "📝",
    todowrite: "📝",
  }

  private static toolVerbs: Record<string, string> = {
    read: "Reading",
    write: "Writing to",
    edit: "Editing",
    grep: "Searching for",
    glob: "Finding files",
    bash: "Running",
    list: "Listing",
    task: "Delegating to",
    webfetch: "Fetching",
    todoread: "Reading tasks",
    todowrite: "Updating tasks",
  }

  static summarizeToolInvocation(
    toolName: string,
    parameters: Record<string, any> = {},
  ): string {
    const icon = this.toolIcons[toolName.toLowerCase()] || "🔧"
    const verb = this.toolVerbs[toolName.toLowerCase()] || "Using"

    switch (toolName.toLowerCase()) {
      case "read":
        return `${icon} ${verb} ${this.truncatePath(parameters["filePath"] || "file")}`

      case "write":
        return `${icon} ${verb} ${this.truncatePath(parameters["filePath"] || "file")}`

      case "edit":
        return `${icon} ${verb} ${this.truncatePath(parameters["filePath"] || "file")}`

      case "grep":
        const pattern = parameters["pattern"] || "patterns"
        const include = parameters["include"]
          ? ` in ${parameters["include"]}`
          : ""
        return `${icon} ${verb} '${this.truncateText(pattern, 20)}'${include}`

      case "glob":
        const globPattern = parameters["pattern"] || "*"
        return `${icon} ${verb} matching '${globPattern}'`

      case "bash":
        const command = parameters["command"] || "command"
        return `${icon} ${verb} ${this.truncateText(command, 30)}`

      case "list":
        const path = parameters["path"] || "directory"
        return `${icon} ${verb} ${this.truncatePath(path)}`

      case "task":
        const description = parameters["description"] || "sub-task"
        return `${icon} ${verb} ${this.truncateText(description, 40)}`

      case "webfetch":
        const url = parameters["url"] || "web content"
        return `${icon} ${verb} ${this.truncateUrl(url)}`

      case "todoread":
      case "todowrite":
        return `${icon} ${verb}`

      default:
        return `${icon} ${verb} ${toolName}`
    }
  }

  static generateTaskSummary(
    agentName: string,
    currentTool: string,
    toolParameters: Record<string, any> = {},
    phase: string = "processing",
    elapsed: number = 0,
  ): string[] {
    const lines: string[] = []

    // Primary line: Agent + high-level activity
    const agentIcon = "🤖"
    const phaseDescription = this.getPhaseDescription(phase)
    lines.push(`${agentIcon} ${agentName}: ${phaseDescription}`)

    // Secondary line: Current tool activity
    if (currentTool) {
      const toolSummary = this.summarizeToolInvocation(
        currentTool,
        toolParameters,
      )
      const elapsedText =
        elapsed > 1000 ? ` (${Math.round(elapsed / 1000)}s)` : ""
      lines.push(`   ${toolSummary}${elapsedText}`)
    }

    // Tertiary line: Specific details (if available)
    const details = this.extractSpecificDetails(currentTool, toolParameters)
    if (details) {
      lines.push(`   ${details}`)
    }

    return lines.slice(0, 3) // Ensure max 3 lines
  }

  private static getPhaseDescription(phase: string): string {
    switch (phase) {
      case "initializing":
        return "Initializing..."
      case "context-gathering":
        return "Gathering context..."
      case "processing":
        return "Processing request..."
      case "finalizing":
        return "Finalizing..."
      default:
        return "Working..."
    }
  }

  private static extractSpecificDetails(
    toolName: string,
    parameters: Record<string, any>,
  ): string | null {
    switch (toolName.toLowerCase()) {
      case "grep":
        if (parameters["path"]) {
          return `🔍 Scanning ${this.truncatePath(parameters["path"])}`
        }
        break

      case "read":
        if (parameters["limit"] || parameters["offset"]) {
          const limit = parameters["limit"] || "all"
          const offset = parameters["offset"] || 0
          return `📄 Lines ${offset}-${offset + limit}`
        }
        break

      case "bash":
        if (parameters["description"]) {
          return `💬 ${this.truncateText(parameters["description"], 50)}`
        }
        break

      case "task":
        if (parameters["prompt"]) {
          return `📋 ${this.truncateText(parameters["prompt"], 50)}`
        }
        break
    }

    return null
  }

  private static truncatePath(path: string, maxLength: number = 40): string {
    if (path.length <= maxLength) return path

    const parts = path.split("/")
    if (parts.length > 2) {
      return `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`
    }

    return path.slice(-maxLength)
  }

  private static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength - 3) + "..."
  }

  private static truncateUrl(url: string, maxLength: number = 30): string {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname
      if (domain.length <= maxLength) return domain
      return domain.slice(0, maxLength - 3) + "..."
    } catch {
      return this.truncateText(url, maxLength)
    }
  }
}
