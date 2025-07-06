import { Debug } from "../util/debug"
import { Tool } from "./tool"
import DESCRIPTION from "./task.txt"
import { z } from "zod"
import { Session } from "../session"
import { Bus } from "../bus"
import { Message } from "../session/message"
import { AgentConfig } from "../config/agent-config"
import { SubSession } from "../session/sub-session"
import {
  emitTaskStarted,
  emitTaskProgress,
  emitTaskCompleted,
  emitTaskFailed,
} from "../events/task-events"

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
      .optional()
      .describe("Tool access mode for the sub-agent (defaults to read-only)"),
    autoDebug: z
      .boolean()
      .optional()
      .default(true)
      .describe("Automatically create debug agent on failure"),
    maxRetries: z
      .number()
      .optional()
      .default(1)
      .describe("Maximum number of automatic retry attempts"),
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
    const msg = await Session.getMessage(ctx.sessionID, ctx.messageID)
    const metadata = msg.metadata.assistant!

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

      if (message.parts) {
        message.parts.forEach((part) => {
          if (part.type === "tool-invocation") {
            toolCount++
            if (
              "toolInvocation" in part &&
              part.toolInvocation?.state === "result"
            ) {
              completedTools++
            }
          }
        })
      }

      // Calculate progress based on tool completion
      let progress = 25 // Base progress for starting
      if (toolCount > 0) {
        progress = Math.min(
          25 + Math.floor((completedTools / toolCount) * 65),
          90,
        )
      }

      emitTaskProgress({
        sessionID: ctx.sessionID,
        taskID,
        progress,
        message: `Processing (${completedTools}/${toolCount} tools completed)...`,
        timestamp: Date.now(),
        startTime: startTime,
      })
    })

    ctx.abort.addEventListener("abort", () => {
      Session.abort(subSession.id)
    })
    try {
      const result = await Session.chat({
        sessionID: subSession.id,
        modelID: metadata.modelID,
        providerID: metadata.providerID,
        parts: [
          {
            type: "text",
            text: params.prompt,
          },
        ],
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
      emitTaskCompleted({
        sessionID: ctx.sessionID,
        taskID,
        duration: Date.now() - startTime,
        success: true,
        summary: output.slice(0, 200),
        timestamp: Date.now(),
      })

      return {
        metadata: {
          title: params.description,
          summary: summary(result),
        },
        output,
      }
    } catch (error) {
      // Mark sub-session as failed
      await SubSession.fail(
        subSession.id,
        error instanceof Error ? error.message : String(error),
      )

      // Emit task failed event
      const errorMessage =
        error instanceof Error ? error.message : String(error)
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
