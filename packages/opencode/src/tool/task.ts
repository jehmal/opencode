import { z } from "zod"
import { Bus } from "../bus"
import { AgentConfig } from "../config/agent-config"
import {
  emitDetailedTaskProgress,
  emitTaskSummary,
  ProgressSummarizer,
} from "../events/detailed-task-events"
import {
  emitTaskCompleted,
  emitTaskFailed,
  emitTaskProgress,
  emitTaskStarted,
} from "../events/task-events"
import { Session } from "../session"
import { Message } from "../session/message"
import { SubSession } from "../session/sub-session"
import { Debug } from "../util/debug"
import DESCRIPTION from "./task.txt"
import { Tool } from "./tool"

Debug.log("[TASK-TOOL] TaskTool module loaded at", new Date().toISOString())

export const TaskTool = Tool.define({
  id: "task",
  description: DESCRIPTION,
  parameters: z.object({
    description: z
      .string()
      .describe("A short (3-5 words) description of the task"),
    prompt: z.string().describe("The task for the agent to perform"),
    agentMode: z
      .enum(["read-only", "all-tools"])
      .describe("Tool access mode for the sub-agent"),
    autoDebug: z
      .boolean()
      .describe("Automatically create debug agent on failure"),
    maxRetries: z
      .number()
      .describe("Maximum number of automatic retry attempts"),
    techniqueIds: z
      .array(z.string())
      .describe("Specific prompting techniques to use for this task"),
    autoSelectTechniques: z
      .boolean()
      .describe("Automatically select best techniques for the task"),
    techniqueStrategy: z
      .enum(["performance", "balanced", "exploration"])
      .describe("Strategy for technique selection"),
  }),
  async execute(params, ctx) {
    Debug.log("\n=== TASK TOOL EXECUTION STARTED ===")
    Debug.log("[TASK] Timestamp:", new Date().toISOString())
    Debug.log("[TASK] Task tool executed with params:", params)
    Debug.log("[TASK] Context sessionID:", ctx.sessionID)
    Debug.log("[TASK] Creating sub-session with parent:", ctx.sessionID)
    Debug.log("[TASK] Current working directory:", process.cwd())

    // Simple debug log to file
    try {
      const { logTaskExecution } = await import("./task-debug")
      logTaskExecution(ctx.sessionID, params.description)
    } catch (e) {
      Debug.error("[TASK] Debug log failed:", e)
    }

    // Import App to get paths
    const { App } = await import("../app/app")
    const appInfo = App.info()
    Debug.log("[TASK] App info paths:", appInfo.path)

    // Create a sub-session with the current session as parent
    const subSession = await Session.create(ctx.sessionID)

    // Get the parent message metadata - this is what was working in the original code
    const msg = await Session.getMessage(ctx.sessionID, ctx.messageID)
    const metadata = msg.metadata.assistant!

    Debug.log("[TASK] Using model configuration from parent message:", {
      modelID: metadata.modelID,
      providerID: metadata.providerID,
    })

    // Set the agent mode for this sub-session
    const mode = params.agentMode || "read-only"
    AgentConfig.setSessionAgentMode(subSession.id, mode)

    // Store sub-session info for navigation
    try {
      await SubSession.create(
        ctx.sessionID,
        subSession.id,
        params.description,
        params.prompt,
      )
      Debug.log("[TASK] SubSession.create completed successfully")

      // Verification Agent - verify sub-session creation in real-time
      const verificationAgent = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100)) // Brief delay for storage
        const { SessionDiagnostics } = await import("../session/diagnostics")
        const verification = await SessionDiagnostics.verifySubSessions(
          ctx.sessionID,
        )
        Debug.log("[VERIFICATION] Sub-session creation result:", {
          parentId: ctx.sessionID,
          subSessionId: subSession.id,
          verified: verification.subSessionCount > 0,
          totalInStorage: verification.totalInStorage,
        })

        // Emit custom event for debugging
        Bus.publish(
          Bus.event(
            "subsession.created",
            z.object({
              parentId: z.string(),
              subSessionId: z.string(),
              verified: z.boolean(),
              count: z.number(),
            }),
          ),
          {
            parentId: ctx.sessionID,
            subSessionId: subSession.id,
            verified: verification.subSessionCount > 0,
            count: verification.subSessionCount,
          },
        )
      }
      verificationAgent().catch((e) => Debug.error("[VERIFICATION] Error:", e)) // Fire and forget
    } catch (error) {
      Debug.error("[TASK] SubSession.create failed:", error)
      throw error
    }

    // Emit task started event
    const taskID = subSession.id
    const startTime = Date.now()

    // Mark sub-session as running with start time
    await SubSession.update(subSession.id, {
      status: "running",
      startedAt: startTime,
    })
    emitTaskStarted({
      sessionID: ctx.sessionID,
      taskID,
      agentName: params.description,
      taskDescription: params.prompt,
      timestamp: startTime,
    })
    function summary(input: Message.Info) {
      const result = []

      for (const part of input.parts) {
        if (part.type === "tool-invocation") {
          result.push({
            toolInvocation: part.toolInvocation,
            metadata: input.metadata.tool[part.toolInvocation.toolCallId],
          })
        }
      }
      return result
    }

    const unsub = Bus.subscribe(Message.Event.Updated, async (evt) => {
      if (evt.properties.info.metadata.sessionID !== subSession.id) return
      ctx.metadata({
        title: params.description,
        summary: summary(evt.properties.info),
      })

      // Emit progress event with better estimation
      // Count tool invocations to estimate progress
      const message = evt.properties.info
      let toolCount = 0
      let completedTools = 0
      let currentToolName = ""
      let currentToolParameters: Record<string, any> = {}

      if (message.parts) {
        message.parts.forEach((part) => {
          if (part.type === "tool-invocation") {
            toolCount++
            if (
              "toolInvocation" in part &&
              part.toolInvocation?.state === "result"
            ) {
              completedTools++
            } else if (
              "toolInvocation" in part &&
              part.toolInvocation?.state === "partial-call"
            ) {
              // Track the current tool being used
              currentToolName = part.toolInvocation.toolName || ""
              currentToolParameters = part.toolInvocation.args || {}
            }
          }
        })
      }

      // Map tool names to user-friendly descriptions
      const toolDescriptions: Record<string, string> = {
        "mcp__qdrant__qdrant-find": "🔍 Searching project memories...",
        Read: "📂 Reading project files...",
        Glob: "📁 Exploring directory structure...",
        Grep: "🔎 Analyzing codebase structure...",
        Write: "💾 Writing changes to disk...",
        Edit: "✏️ Applying code changes...",
        MultiEdit: "✏️ Applying multiple edits...",
        Bash: "🖥️ Executing command...",
        LS: "📋 Listing directory contents...",
        WebSearch: "🌐 Searching the web...",
        TodoRead: "📝 Reading task list...",
        TodoWrite: "📝 Updating task list...",
      }

      // Determine the phase based on the context
      let phase: "prompt-generation" | "context-gathering" | "processing" =
        "processing"
      let statusMessage = ""

      // Check if this is the continuation prompt generator task
      const isPromptGeneration =
        params.description.toLowerCase().includes("continuation") ||
        params.description.toLowerCase().includes("prompt")

      if (isPromptGeneration) {
        phase = "prompt-generation"
        if (completedTools === 0) {
          statusMessage = "🔄 Analyzing current session..."
        } else if (completedTools < toolCount) {
          statusMessage = "📝 Building continuation prompt..."
        } else {
          statusMessage = "✅ Continuation prompt ready!"
        }
      } else {
        // This is Claude's context gathering phase
        phase = "context-gathering"
        if (currentToolName && toolDescriptions[currentToolName]) {
          statusMessage = toolDescriptions[currentToolName]
        } else if (toolCount === 0) {
          statusMessage = "🧠 Initializing..."
        } else if (completedTools === toolCount && toolCount > 0) {
          statusMessage = "🧠 Preparing response..."
        } else {
          statusMessage = "🔄 Processing request..."
        }
      }

      emitTaskProgress({
        sessionID: ctx.sessionID,
        taskID,
        progress: 0, // We'll remove progress bars, so set to 0
        message: statusMessage,
        timestamp: Date.now(),
        startTime: startTime,
        phase: phase,
        currentTool: currentToolName,
        toolDescription: statusMessage,
      })

      // Emit enhanced progress with Claude Code style summary
      const elapsed = Date.now() - startTime
      const summaryLines = ProgressSummarizer.generateTaskSummary(
        params.description,
        currentToolName,
        currentToolParameters,
        phase,
        elapsed,
      )

      emitTaskSummary({
        sessionID: ctx.sessionID,
        taskID,
        agentName: params.description,
        lines: summaryLines,
        spinner: true,
        timestamp: Date.now(),
        elapsed,
      })

      emitDetailedTaskProgress({
        sessionID: ctx.sessionID,
        taskID,
        agentName: params.description,
        primaryStatus: summaryLines[0] || statusMessage,
        secondaryStatus: summaryLines[1],
        tertiaryStatus: summaryLines[2],
        currentTool: currentToolName,
        toolParameters: currentToolParameters,
        timestamp: Date.now(),
        startTime: startTime,
        phase: phase as any,
      })
    })

    ctx.abort.addEventListener("abort", () => {
      Session.abort(subSession.id)
    })
    try {
      Debug.log("[TASK] Starting Session.chat execution", {
        subSessionId: subSession.id,
        modelID: metadata.modelID,
        providerID: metadata.providerID,
        promptLength: params.prompt.length,
      })

      // Emit immediate progress to show we're starting execution
      emitTaskProgress({
        sessionID: ctx.sessionID,
        taskID,
        progress: 15,
        message: "Starting agent execution...",
        timestamp: Date.now(),
        startTime: startTime,
      })

      // Apply prompting techniques if configured
      let enhancedPrompt = params.prompt

      if (params.techniqueIds || params.autoSelectTechniques) {
        try {
          const { promptingIntegration } = await import(
            "../prompting/integration/dgmo-integration"
          )

          // Configure session with techniques
          await promptingIntegration.configureSession({
            sessionId: subSession.id,
            techniques: params.techniqueIds || [],
            autoSelect: params.autoSelectTechniques ?? true,
            strategy: params.techniqueStrategy,
          })

          // Enhance the prompt
          const enhancedResult = await promptingIntegration.enhancePrompt(
            subSession.id,
            params.prompt,
            {
              techniques: params.techniqueIds,
              autoSelect: params.autoSelectTechniques,
              strategy: params.techniqueStrategy,
            },
          )

          enhancedPrompt = enhancedResult.content

          Debug.log("[TASK] Prompt enhanced with techniques", {
            original: params.prompt.slice(0, 100),
            enhanced: enhancedPrompt.slice(0, 100),
            techniques: enhancedResult.metadata.techniques,
          })
        } catch (error) {
          Debug.error("[TASK] Failed to apply prompting techniques", error)
          // Continue with original prompt
        }
      }

      const result = await Session.chat({
        sessionID: subSession.id,
        modelID: metadata.modelID,
        providerID: metadata.providerID,
        parts: [
          {
            type: "text",
            text: enhancedPrompt,
          },
        ],
      })

      Debug.log("[TASK] Session.chat completed successfully", {
        subSessionId: subSession.id,
        resultPartsCount: result.parts.length,
        hasTextOutput: result.parts.some((p) => p.type === "text"),
      })

      unsub()

      // Extract text output for summary
      const output =
        result.parts.findLast((x) => x.type === "text")?.text || "No output"

      // Mark sub-session as completed
      await SubSession.complete(
        subSession.id,
        output.slice(0, 200) + (output.length > 200 ? "..." : ""),
      )

      // Emit task completed event
      const duration = Date.now() - startTime
      emitTaskCompleted({
        sessionID: ctx.sessionID,
        taskID,
        duration,
        success: true,
        summary: output.slice(0, 200),
        timestamp: Date.now(),
      })

      // Track technique performance if used
      if (params.techniqueIds || params.autoSelectTechniques) {
        try {
          const { promptingIntegration } = await import(
            "../prompting/integration/dgmo-integration"
          )

          // Calculate tokens used from the result
          const tokensUsed = result.metadata?.assistant?.tokens?.output || 0

          await promptingIntegration.trackSessionPerformance(
            subSession.id,
            true, // success
            {
              duration,
              tokensUsed,
            },
          )
        } catch (error) {
          Debug.error("[TASK] Failed to track technique performance", error)
        }
      }

      return {
        metadata: {
          title: params.description,
          summary: summary(result),
        },
        output,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      Debug.error("[TASK] Session.chat failed", {
        subSessionId: subSession.id,
        error: errorMessage,
        stack: errorStack,
        modelID: metadata.modelID,
        providerID: metadata.providerID,
      })

      // Emit immediate failure progress
      emitTaskProgress({
        sessionID: ctx.sessionID,
        taskID,
        progress: 0,
        message: `Failed: ${errorMessage}`,
        timestamp: Date.now(),
        startTime: startTime,
      })

      // Mark sub-session as failed
      await SubSession.fail(subSession.id, errorMessage)

      // Emit task failed event with more context
      emitTaskFailed({
        sessionID: ctx.sessionID,
        taskID,
        error: errorMessage,
        recoverable: params.autoDebug && analyzeError(errorMessage),
        timestamp: Date.now(),
      })

      // Check if we should auto-debug
      if (params.autoDebug && params.maxRetries > 0) {
        // Analyze the error to determine if it's recoverable
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        const isRecoverable = analyzeError(errorMessage)

        if (isRecoverable) {
          // Create a debug sub-agent to analyze and fix the issue
          const debugPrompt = `The previous task failed with error: "${errorMessage}"\n\nOriginal task: "${params.prompt}"\n\nPlease analyze the error and try to complete the task again. If the error is due to missing information or incorrect approach, adjust your strategy accordingly.`

          try {
            // Create debug sub-session
            const debugSession = await Session.create(ctx.sessionID)

            // Set debug agent to all-tools mode for better debugging capability
            AgentConfig.setSessionAgentMode(debugSession.id, "all-tools")

            // Store debug sub-session info
            await SubSession.create(
              ctx.sessionID,
              debugSession.id,
              `Debug: ${params.description}`,
              debugPrompt,
            )

            // Mark as running
            await SubSession.update(debugSession.id, { status: "running" })

            // Execute debug task
            const debugResult = await Session.chat({
              sessionID: debugSession.id,
              modelID: metadata.modelID,
              providerID: metadata.providerID,
              parts: [
                {
                  type: "text",
                  text: debugPrompt,
                },
              ],
            })

            const debugOutput =
              debugResult.parts.findLast((x) => x.type === "text")?.text ||
              "No output"

            // Mark debug session as completed
            await SubSession.complete(
              debugSession.id,
              debugOutput.slice(0, 200) +
                (debugOutput.length > 200 ? "..." : ""),
            )

            return {
              metadata: {
                title: `${params.description} (recovered)`,
                summary: summary(debugResult),
              },
              output: debugOutput,
            }
          } catch (debugError) {
            // Debug attempt also failed
            await SubSession.fail(
              subSession.id,
              `Original error: ${errorMessage}. Debug error: ${debugError instanceof Error ? debugError.message : String(debugError)}`,
            )
            throw error // Throw original error
          }
        }
      }

      throw error
    }
  },
})

// Analyze error to determine if it's recoverable
function analyzeError(errorMessage: string): boolean {
  const recoverablePatterns = [
    /file not found/i,
    /no such file/i,
    /permission denied/i,
    /command not found/i,
    /module not found/i,
    /cannot find/i,
    /undefined is not/i,
    /null is not/i,
    /timeout/i,
    /rate limit/i,
    /connection refused/i,
    /ENOENT/i,
    /EACCES/i,
    /ETIMEDOUT/i,
  ]

  return recoverablePatterns.some((pattern) => pattern.test(errorMessage))
}
