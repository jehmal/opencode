import type { Argv } from "yargs"
// import { Bus } from "../../bus"
// import { Config } from "../../config/config"
import { Session } from "../../session"
import { SessionPerformance } from "../../session/performance"
import { UI } from "../ui"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { DGMBridge } from "@opencode/dgm-integration"
import path from "path"
import { analyzePatternsWithLLM } from "./evolve-llm-analyzer"
// import { Message } from "../../session/message"

/**
 * Evolution command for DGMO
 * Analyzes performance patterns and triggers DGM self-improvement
 */
export const EvolveCommand = cmd({
  command: "evolve",
  describe: "analyze performance and evolve dgmo capabilities",
  builder: (yargs: Argv) => {
    return yargs
      .option("analyze", {
        alias: ["a"],
        describe: "analyze performance patterns without evolving",
        type: "boolean",
        default: false,
      })
      .option("session", {
        alias: ["s"],
        describe: "analyze specific session ID",
        type: "string",
      })
      .option("auto-apply", {
        describe: "automatically apply improvements without confirmation",
        type: "boolean",
        default: false,
      })
      .option("min-samples", {
        describe: "minimum number of samples before evolution",
        type: "number",
        default: 10,
      })
      .option("verbose", {
        describe: "show detailed evolution process",
        type: "boolean",
        default: false,
      })
      .option("generate", {
        alias: ["g"],
        describe: "generate code improvements based on performance data",
        type: "boolean",
        default: false,
      })
      .option("llm-analysis", {
        alias: ["l"],
        describe:
          "use LLM to analyze message patterns (uses Claude 3.5 Sonnet)",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args) => {
    await bootstrap({ cwd: process.cwd() }, async () => {
      UI.empty()
      UI.println(UI.logo())
      UI.empty()
      UI.println(
        UI.Style.TEXT_HIGHLIGHT_BOLD + "Evolution Engine",
        UI.Style.TEXT_NORMAL + " - Analyzing performance patterns...",
      )
      UI.empty()

      try {
        // Initialize DGM bridge with proper configuration
        // Get the project root (3 levels up from src/cli/cmd)
        const projectRoot = process
          .cwd()
          .includes("/opencode/packages/opencode")
          ? process.cwd().replace("/opencode/packages/opencode", "")
          : process.cwd()

        // Get Anthropic authentication
        const { AuthAnthropic } = await import("../../auth/anthropic")
        const anthropicToken = await AuthAnthropic.access()

        // Use venv Python path
        const venvPythonPath = path.join(
          projectRoot,
          "dgm",
          "venv",
          "bin",
          "python",
        )

        const dgmConfig = {
          enabled: true,
          pythonPath: venvPythonPath,
          dgmPath: projectRoot,
          timeout: 30000,
          maxRetries: 3,
          healthCheckInterval: 60000,
          anthropicToken: anthropicToken || undefined,
        }

        UI.println(UI.Style.TEXT_DIM + "Initializing DGM bridge...")
        const bridge = new DGMBridge(dgmConfig)
        await bridge.initialize()

        // Collect performance data
        const performanceData = await collectPerformanceData(
          args.session,
          args.llmAnalysis,
          anthropicToken,
          args.verbose,
        )

        if (performanceData.totalSamples < args.minSamples) {
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "⚠ ",
            UI.Style.TEXT_NORMAL +
              `Insufficient data: ${performanceData.totalSamples}/${args.minSamples} samples`,
          )
          UI.println(
            UI.Style.TEXT_DIM +
              "  Continue using DGMO to gather more performance data.",
          )
          return
        }

        // Display performance summary
        displayPerformanceSummary(performanceData, args.verbose)

        if (args.analyze) {
          UI.empty()
          UI.println(
            UI.Style.TEXT_INFO_BOLD +
              "Analysis complete. Use --analyze=false to trigger evolution.",
          )
          return
        }

        // Check if generate flag is set
        if (args.generate) {
          UI.empty()
          UI.println(
            UI.Style.TEXT_INFO_BOLD + "→ ",
            UI.Style.TEXT_NORMAL +
              "Generating code improvements based on performance data...",
          )

          const generationResults = await generateImprovements(
            bridge,
            performanceData,
            args.verbose,
          )

          // Display generated improvements
          displayGeneratedImprovements(generationResults)

          // Apply improvements if requested
          if (args.autoApply || (await confirmApplyImprovements())) {
            await applyGeneratedImprovements(bridge, generationResults)
          }

          await bridge.close()
          return
        }

        // Analyze patterns and get evolution suggestions
        UI.empty()
        UI.println(
          UI.Style.TEXT_INFO_BOLD + "→ ",
          UI.Style.TEXT_NORMAL + "Sending patterns to DGM for analysis...",
        )

        const evolutionResults = await analyzeAndEvolve(
          bridge,
          performanceData,
          args.verbose,
        )

        // Display evolution suggestions
        displayEvolutionSuggestions(evolutionResults)

        // Apply improvements if requested
        if (args.autoApply || (await confirmApplyImprovements())) {
          await applyImprovements(bridge, evolutionResults)
        }

        await bridge.close()
      } catch (error) {
        if (error instanceof Error) {
          UI.error(`Evolution failed: ${error.name}`)
          UI.println(UI.Style.TEXT_DIM + `  ${error.message}`)
          if (error.stack && args.verbose) {
            UI.println(UI.Style.TEXT_DIM + "Stack trace:")
            UI.println(UI.Style.TEXT_DIM + error.stack)
          }
        } else {
          UI.error(`Evolution failed: ${String(error)}`)
        }
        process.exit(1)
      }
    })
  },
})

// Performance data collection types
interface PerformanceData {
  totalSamples: number
  toolStats: Record<
    string,
    {
      count: number
      successRate: number
      avgDuration: number
      errors: string[]
    }
  >
  errorPatterns: Array<{
    pattern: string
    count: number
    tools: string[]
    examples: string[]
  }>
  workflowPatterns: Array<{
    pattern: string
    formula: string
    count: number
    examples: string[]
    suggestedAutomation?: string
  }>
  successRate: number
  sessionCount: number
  timeRange: {
    start: Date
    end: Date
  }
}

// Helper functions
async function collectPerformanceData(
  sessionId?: string,
  useLLMAnalysis: boolean = false,
  anthropicToken?: string,
  verbose: boolean = false,
): Promise<PerformanceData> {
  const data: PerformanceData = {
    totalSamples: 0,
    toolStats: {},
    errorPatterns: [],
    workflowPatterns: [],
    successRate: 0,
    sessionCount: 0,
    timeRange: {
      start: new Date(),
      end: new Date(),
    },
  }

  // If specific session requested, analyze just that one
  if (sessionId) {
    const session = await Session.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const report = await SessionPerformance.loadReport(sessionId)
    if (report) {
      processSessionData(data, report)
      data.sessionCount = 1
    }
    return data
  }

  // Otherwise, analyze all recent sessions from ALL projects
  const sessions = []

  // First, get sessions from current project
  for await (const session of Session.list()) {
    sessions.push(session)
  }

  // Also look for sessions in the global data directory
  // This will find sessions from all projects
  const { Global } = await import("../../global")
  const fs = await import("fs/promises")
  const path = await import("path")

  try {
    // Look in all project directories
    const projectsDir = path.join(Global.Path.data, "project")
    const projectDirs = await fs.readdir(projectsDir).catch(() => [])

    for (const projectDir of projectDirs) {
      const sessionInfoDir = path.join(
        projectsDir,
        projectDir,
        "storage",
        "session",
        "info",
      )
      try {
        const sessionFiles = await fs.readdir(sessionInfoDir).catch(() => [])
        for (const sessionFile of sessionFiles) {
          if (sessionFile.endsWith(".json")) {
            // const sessionId = sessionFile.replace(".json", "")
            try {
              const sessionData = await fs.readFile(
                path.join(sessionInfoDir, sessionFile),
                "utf-8",
              )
              const session = JSON.parse(sessionData)
              sessions.push(session)

              // Also check for sub-sessions
              if (session.id) {
                const children = await Session.children(session.id).catch(
                  () => [],
                )
                sessions.push(...children)
              }
            } catch (e) {
              // Skip invalid sessions
            }
          }
        }
      } catch (e) {
        // Skip inaccessible directories
      }
    }
  } catch (e) {
    UI.println(
      UI.Style.TEXT_DIM + "Note: Only analyzing current project sessions",
    )
  }

  // Remove duplicates and limit total
  const uniqueSessions = Array.from(
    new Map(sessions.map((s) => [s.id, s])).values(),
  ).slice(0, 500) // Increased limit for global analysis

  // Process performance data from all unique sessions
  UI.println(
    UI.Style.TEXT_DIM +
      `Found ${uniqueSessions.length} sessions across all projects`,
  )

  // Store messages by session for LLM analysis if requested
  const sessionMessages: Map<string, string[]> = new Map()

  for (const session of uniqueSessions) {
    const report = await SessionPerformance.loadReport(session.id)
    if (report) {
      processSessionData(data, report)
      data.sessionCount++
    } else {
      // Fallback: Analyze session messages directly when no performance report exists
      try {
        const messages = await Session.messages(session.id)
        let sessionHasData = false

        for (const msg of messages) {
          // Analyze user messages for workflow patterns
          if (msg.role === "user" && msg.parts) {
            for (const part of msg.parts) {
              if (part.type === "text" && part.text) {
                analyzeUserMessagePatterns(data, part.text)
                // Collect for LLM analysis if enabled
                if (useLLMAnalysis) {
                  if (!sessionMessages.has(session.id)) {
                    sessionMessages.set(session.id, [])
                  }
                  sessionMessages.get(session.id)!.push(`USER: ${part.text}`)
                }
              }
            }
          }

          // Also collect assistant messages for LLM analysis
          if (useLLMAnalysis && msg.role === "assistant") {
            // Collect text responses
            if (msg.parts) {
              for (const part of msg.parts) {
                if (part.type === "text" && part.text) {
                  if (!sessionMessages.has(session.id)) {
                    sessionMessages.set(session.id, [])
                  }

                  // Get beginning and end of assistant response for better context
                  const fullText = part.text
                  let assistantText = ""

                  if (fullText.length <= 800) {
                    // If short enough, include the whole thing
                    assistantText = fullText
                  } else {
                    // Get first 400 chars and last 400 chars
                    const start = fullText.substring(0, 400)
                    const end = fullText.substring(fullText.length - 400)
                    assistantText = `${start}\n[... middle truncated ...]\n${end}`
                  }

                  sessionMessages
                    .get(session.id)!
                    .push(`ASSISTANT: ${assistantText}`)
                }
              }
            }

            // Also check for tool usage in metadata
            if (msg.metadata?.tool) {
              const toolDetails: string[] = []

              for (const [, toolData] of Object.entries(msg.metadata.tool)) {
                const toolName = toolData.title || "unknown"

                // Check if it's an MCP tool (format: servername_toolname)
                const isMCP =
                  toolName.includes("_") && !toolName.startsWith("Error:")

                if (isMCP) {
                  // Extract MCP server and tool name
                  const [mcpServer, ...toolParts] = toolName.split("_")
                  const mcpToolName = toolParts.join("_")

                  // Get parameters if available
                  let params = ""
                  if (toolData["params"]) {
                    // Extract key parameter names (not full values to save space)
                    const paramKeys = Object.keys(toolData["params"]).join(", ")
                    params = ` (params: ${paramKeys})`
                  }

                  toolDetails.push(`MCP:${mcpServer}:${mcpToolName}${params}`)
                } else {
                  // Regular tool
                  toolDetails.push(toolName)
                }

                // Track if tool had an error
                if (toolData.error) {
                  const errorMsg = toolData.message || "Unknown error"
                  toolDetails.push(
                    `ERROR:${toolName}:${errorMsg.substring(0, 100)}`,
                  )
                }
              }

              if (toolDetails.length > 0 && sessionMessages.has(session.id)) {
                sessionMessages
                  .get(session.id)!
                  .push(`TOOLS_USED: ${toolDetails.join(" | ")}`)
              }
            }
          }

          if (msg.role === "assistant" && msg.metadata?.tool) {
            for (const [_, toolData] of Object.entries(msg.metadata.tool)) {
              const toolName = toolData.title || "unknown"

              // Initialize tool stats if not exists
              if (!data.toolStats[toolName]) {
                data.toolStats[toolName] = {
                  count: 0,
                  successRate: 1.0,
                  avgDuration: 0,
                  errors: [],
                }
              }

              const toolStat = data.toolStats[toolName]
              const duration =
                toolData.time?.end && toolData.time?.start
                  ? toolData.time.end - toolData.time.start
                  : 100

              // Update counts and averages
              const prevTotal = toolStat.count * toolStat.avgDuration
              toolStat.count++
              data.totalSamples++
              sessionHasData = true

              toolStat.avgDuration = (prevTotal + duration) / toolStat.count

              // Track errors
              if (toolData["error"]) {
                toolStat.errors.push(toolData["message"] || "Unknown error")
                addErrorPattern(data, {
                  tool: toolName,
                  message: toolData["message"] || "Unknown error",
                  type: "tool_error",
                })
              }

              // Update success rate
              const successCount = toolStat.count - toolStat.errors.length
              toolStat.successRate =
                toolStat.count > 0 ? successCount / toolStat.count : 1.0
            }
          }
        }

        if (sessionHasData) {
          data.sessionCount++
          // Update time range
          const sessionTime = new Date(session.time.created)
          if (sessionTime < data.timeRange.start)
            data.timeRange.start = sessionTime
          if (sessionTime > data.timeRange.end) data.timeRange.end = sessionTime
        }
      } catch (e) {
        // Silently skip sessions that can't be analyzed
      }
    }
  }

  // Calculate aggregate metrics
  if (data.totalSamples > 0) {
    let totalSuccess = 0
    for (const tool in data.toolStats) {
      totalSuccess +=
        data.toolStats[tool].count * data.toolStats[tool].successRate
    }
    data.successRate = totalSuccess / data.totalSamples
  }

  // Sort error patterns by frequency
  data.errorPatterns.sort((a, b) => b.count - a.count)

  // Run LLM analysis if requested and we have messages
  if (useLLMAnalysis && sessionMessages.size > 0 && anthropicToken) {
    UI.empty()
    UI.println(
      UI.Style.TEXT_INFO_BOLD + "→ ",
      UI.Style.TEXT_NORMAL +
        `Running LLM pattern analysis on ${sessionMessages.size} sessions...`,
    )

    // Process each session individually to avoid overwhelming the LLM
    let sessionCount = 0
    const maxSessionsToAnalyze = 20 // Limit to prevent excessive API calls

    for (const [sessionId, messages] of sessionMessages) {
      if (sessionCount >= maxSessionsToAnalyze) {
        UI.println(
          UI.Style.TEXT_DIM +
            `  Analyzed ${maxSessionsToAnalyze} sessions (limit reached)`,
        )
        break
      }

      // Skip sessions with too few messages (lowered threshold)
      if (messages.length < 3) {
        continue
      }

      sessionCount++

      if (verbose) {
        UI.println(
          UI.Style.TEXT_DIM +
            `  Analyzing session ${sessionCount}/${Math.min(sessionMessages.size, maxSessionsToAnalyze)} (${messages.length} messages)...`,
        )
      }

      try {
        // Analyze this session's messages with smaller batch size
        const sessionPatterns = await analyzePatternsWithLLM(
          messages.slice(0, 50), // Limit messages per session to avoid token limits
          anthropicToken,
          verbose, // Pass through verbose flag
        )

        // Merge patterns from this session
        for (const pattern of sessionPatterns) {
          const existing = data.workflowPatterns.find(
            (wp) => wp.pattern === pattern.pattern,
          )

          if (existing) {
            existing.count += pattern.count
            existing.examples.push(
              ...pattern.examples.slice(0, 3 - existing.examples.length),
            )
            if (pattern.suggestedAutomation && !existing.suggestedAutomation) {
              existing.suggestedAutomation = pattern.suggestedAutomation
            }
          } else {
            data.workflowPatterns.push(pattern)
          }
        }

        // Small delay between sessions to avoid rate limits
        if (sessionCount < maxSessionsToAnalyze) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      } catch (error) {
        if (verbose) {
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "⚠ ",
            UI.Style.TEXT_NORMAL + `Failed to analyze session: ${error}`,
          )
        }
      }
    }

    UI.println(
      UI.Style.TEXT_SUCCESS_BOLD + "✓ ",
      UI.Style.TEXT_NORMAL +
        `LLM analysis complete. Analyzed ${sessionCount} sessions.`,
    )

    // Sort workflow patterns by count
    data.workflowPatterns.sort((a, b) => b.count - a.count)
  }

  return data
}

function processSessionData(data: PerformanceData, report: any): void {
  // Update time range
  const reportTime = new Date(report.timestamp || Date.now())
  if (reportTime < data.timeRange.start) data.timeRange.start = reportTime
  if (reportTime > data.timeRange.end) data.timeRange.end = reportTime

  // Process operation breakdown
  if (report.operationBreakdown) {
    for (const [operation, stats] of Object.entries(
      report.operationBreakdown,
    )) {
      if (!data.toolStats[operation]) {
        data.toolStats[operation] = {
          count: 0,
          successRate: 1.0,
          avgDuration: 0,
          errors: [],
        }
      }

      const toolStat = data.toolStats[operation]
      const opStats = stats as any

      // Update counts and averages
      const prevTotal = toolStat.count * toolStat.avgDuration
      toolStat.count += opStats.count
      data.totalSamples += opStats.count

      if (toolStat.count > 0) {
        toolStat.avgDuration = (prevTotal + opStats.totalTime) / toolStat.count
      }
    }
  }

  // Extract error patterns from metadata if available
  if (report.errors) {
    for (const error of report.errors) {
      addErrorPattern(data, error)
    }
  }
}

function addErrorPattern(data: PerformanceData, error: any): void {
  const pattern = extractErrorPattern(error)

  // Find existing pattern or create new one
  let errorPattern = data.errorPatterns.find((ep) => ep.pattern === pattern)
  if (!errorPattern) {
    errorPattern = {
      pattern,
      count: 0,
      tools: [],
      examples: [],
    }
    data.errorPatterns.push(errorPattern)
  }

  errorPattern.count++

  // Add tool if not already tracked
  if (error.tool && !errorPattern.tools.includes(error.tool)) {
    errorPattern.tools.push(error.tool)
  }

  // Keep up to 3 examples
  if (errorPattern.examples.length < 3 && error.message) {
    errorPattern.examples.push(error.message)
  }
}

function extractErrorPattern(error: any): string {
  // Extract common error patterns
  const message = error.message || error.toString()

  // Common patterns to detect
  if (message.includes("permission denied")) return "permission_denied"
  if (message.includes("file not found")) return "file_not_found"
  if (message.includes("timeout")) return "timeout"
  if (message.includes("syntax error")) return "syntax_error"
  if (message.includes("type error")) return "type_error"
  if (message.includes("network")) return "network_error"
  if (message.includes("memory")) return "memory_error"

  // Generic pattern based on error type
  if (error.type) return error.type

  // Fallback to first few words
  return message.split(/\s+/).slice(0, 3).join("_").toLowerCase()
}

function analyzeUserMessagePatterns(data: PerformanceData, message: string) {
  // Common workflow patterns to detect
  const patterns = [
    {
      regex:
        /use your qdrant.*?to (get context|understand|know).*?(?:to do|for|about)\s+(.+?)(?:\.|$)/i,
      type: "qdrant_context_lookup",
      formula: "Use qdrant → get context → do {task}",
    },
    {
      regex:
        /use your prompting.*?to (optimize|refine|improve).*?(?:to|for)\s+(.+?)(?:\.|$)/i,
      type: "prompt_optimization",
      formula: "Use prompting MCP → optimize → do {task}",
    },
    {
      regex:
        /(?:first|start by|begin with)\s+(.+?)\s+(?:then|after that|next)\s+(.+?)(?:\.|$)/i,
      type: "sequential_workflow",
      formula: "First {step1} → then {step2}",
    },
    {
      regex: /remember (?:this|that|to)\s+(.+?)(?:\.|$)/i,
      type: "memory_request",
      formula: "Remember {information}",
    },
    {
      regex: /store (?:this|that|in)\s+(.+?)(?:\.|$)/i,
      type: "storage_request",
      formula: "Store {data} in {location}",
    },
    {
      regex: /create (\d+) (?:agents?|sub-?agents?).*?to\s+(.+?)(?:\.|$)/i,
      type: "parallel_agents",
      formula: "Create {n} agents to {task}",
    },
    {
      regex:
        /search (?:for|in|through)\s+(.+?)\s+(?:for|to find)\s+(.+?)(?:\.|$)/i,
      type: "search_pattern",
      formula: "Search {location} for {target}",
    },
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern.regex)
    if (match) {
      // Find existing pattern or create new one
      let workflowPattern = data.workflowPatterns.find(
        (wp) => wp.pattern === pattern.type,
      )

      if (!workflowPattern) {
        workflowPattern = {
          pattern: pattern.type,
          formula: pattern.formula,
          count: 0,
          examples: [],
          suggestedAutomation: generateAutomationSuggestion(pattern.type),
        }
        data.workflowPatterns.push(workflowPattern)
      }

      workflowPattern.count++

      // Keep up to 3 examples
      if (workflowPattern.examples.length < 3) {
        workflowPattern.examples.push(message.substring(0, 200))
      }
    }
  }

  // Also detect repeated phrases (3+ words appearing frequently)
  const words = message.toLowerCase().split(/\s+/)
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = words.slice(i, i + 3).join(" ")
    if (
      phrase.length > 10 &&
      !phrase.includes("the") &&
      !phrase.includes("and")
    ) {
      // Track this as a potential pattern
      // This would be stored for frequency analysis across sessions
    }
  }
}

function generateAutomationSuggestion(patternType: string): string {
  const suggestions: Record<string, string> = {
    qdrant_context_lookup:
      "Add to system message: 'Always check Qdrant for relevant context before starting any task'",
    prompt_optimization:
      "Add to system message: 'Use the prompting MCP server to optimize your approach before complex tasks'",
    sequential_workflow: "Create workflow macro for common task sequences",
    memory_request:
      "Auto-store important information in Qdrant without explicit request",
    storage_request:
      "Implement automatic storage detection based on content importance",
    parallel_agents:
      "Create /parallel-task command for automatic agent delegation",
    search_pattern: "Implement smart search that pre-indexes common locations",
  }

  return (
    suggestions[patternType] || "Analyze pattern for automation opportunities"
  )
}

function displayPerformanceSummary(data: PerformanceData, verbose: boolean) {
  UI.println(UI.Style.TEXT_HIGHLIGHT_BOLD + "Performance Summary")
  UI.println(UI.Style.TEXT_DIM + "─".repeat(50))
  UI.empty()

  // Time range
  const days = Math.ceil(
    (data.timeRange.end.getTime() - data.timeRange.start.getTime()) /
      (1000 * 60 * 60 * 24),
  )
  UI.println(
    UI.Style.TEXT_NORMAL_BOLD + "Analysis Period: ",
    UI.Style.TEXT_NORMAL + `${days} days (${data.sessionCount} sessions)`,
  )

  // Overall metrics
  UI.println(
    UI.Style.TEXT_NORMAL_BOLD + "Total Operations: ",
    UI.Style.TEXT_NORMAL + data.totalSamples.toLocaleString(),
  )
  UI.println(
    UI.Style.TEXT_NORMAL_BOLD + "Success Rate: ",
    UI.Style.TEXT_NORMAL + `${(data.successRate * 100).toFixed(1)}%`,
  )
  UI.empty()

  // Tool usage breakdown
  if (Object.keys(data.toolStats).length > 0) {
    UI.println(UI.Style.TEXT_NORMAL_BOLD + "Tool Usage:")
    const sortedTools = Object.entries(data.toolStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, verbose ? undefined : 5)

    for (const [tool, stats] of sortedTools) {
      const successIcon =
        stats.successRate > 0.9 ? "✓" : stats.successRate > 0.7 ? "~" : "!"
      UI.println(
        UI.Style.TEXT_DIM + `  ${successIcon} `,
        UI.Style.TEXT_NORMAL + tool.padEnd(20),
        UI.Style.TEXT_DIM + `${stats.count} calls, `,
        UI.Style.TEXT_NORMAL +
          `${(stats.successRate * 100).toFixed(0)}% success, `,
        UI.Style.TEXT_DIM + `${stats.avgDuration.toFixed(0)}ms avg`,
      )
    }
  }

  // Error patterns
  if (data.errorPatterns.length > 0) {
    UI.empty()
    UI.println(UI.Style.TEXT_NORMAL_BOLD + "Common Error Patterns:")
    const topErrors = data.errorPatterns.slice(0, verbose ? 10 : 3)

    for (const pattern of topErrors) {
      UI.println(
        UI.Style.TEXT_WARNING_BOLD + "  ! ",
        UI.Style.TEXT_NORMAL + pattern.pattern.replace(/_/g, " "),
        UI.Style.TEXT_DIM + ` (${pattern.count} occurrences)`,
      )
      if (verbose && pattern.tools.length > 0) {
        UI.println(UI.Style.TEXT_DIM + "    Tools: " + pattern.tools.join(", "))
      }
    }
  }

  // Workflow patterns
  if (data.workflowPatterns.length > 0) {
    UI.empty()
    UI.println(UI.Style.TEXT_NORMAL_BOLD + "Detected Workflow Patterns:")
    const topPatterns = data.workflowPatterns
      .sort((a, b) => b.count - a.count)
      .slice(0, verbose ? 10 : 5)

    for (const pattern of topPatterns) {
      UI.println(
        UI.Style.TEXT_SUCCESS_BOLD + "  → ",
        UI.Style.TEXT_NORMAL + pattern.formula,
        UI.Style.TEXT_DIM + ` (${pattern.count} times)`,
      )
      if (verbose && pattern.suggestedAutomation) {
        UI.println(
          UI.Style.TEXT_DIM + "    Suggestion: " + pattern.suggestedAutomation,
        )
      }
    }
  }
}

interface EvolutionResults {
  suggestions: Array<{
    type: string
    description: string
    impact: "high" | "medium" | "low"
    implementation: string
  }>
  improvements: Array<{
    toolName: string
    changes: string[]
    testResults?: any
  }>
  patterns: {
    errorPatterns: any[]
    performancePatterns: any[]
    successPatterns: any[]
  }
}

async function analyzeAndEvolve(
  bridge: DGMBridge,
  data: PerformanceData,
  verbose: boolean,
): Promise<EvolutionResults> {
  const results: EvolutionResults = {
    suggestions: [],
    improvements: [],
    patterns: {
      errorPatterns: [],
      performancePatterns: [],
      successPatterns: [],
    },
  }

  try {
    // Prepare patterns for DGM analysis
    const patterns = {
      error_patterns: data.errorPatterns.map((ep) => ({
        pattern: ep.pattern,
        frequency: ep.count,
        affected_tools: ep.tools,
        examples: ep.examples,
      })),
      performance_patterns: Object.entries(data.toolStats).map(
        ([tool, stats]) => ({
          tool,
          usage_count: stats.count,
          avg_duration_ms: stats.avgDuration,
          success_rate: stats.successRate,
          common_errors: stats.errors.slice(0, 5),
        }),
      ),
      success_patterns: Object.entries(data.toolStats)
        .filter(([_, stats]) => stats.successRate > 0.9)
        .map(([tool, stats]) => ({
          tool,
          success_rate: stats.successRate,
          usage_count: stats.count,
        })),
    }

    if (verbose) {
      UI.println(UI.Style.TEXT_DIM + "Patterns detected:")
      UI.println(
        UI.Style.TEXT_DIM +
          `  - Error patterns: ${patterns.error_patterns.length}`,
      )
      UI.println(
        UI.Style.TEXT_DIM +
          `  - Performance patterns: ${patterns.performance_patterns.length}`,
      )
      UI.println(
        UI.Style.TEXT_DIM +
          `  - Success patterns: ${patterns.success_patterns.length}`,
      )
    }

    // Send patterns to DGM for evolution
    const evolutionResponse = await bridge.execute(
      "evolve_based_on_patterns",
      patterns,
    )

    if (evolutionResponse.adaptations) {
      // Process DGM's evolution suggestions
      for (const adaptation of evolutionResponse.adaptations) {
        results.suggestions.push({
          type: adaptation.type || "general",
          description: adaptation.description,
          impact: determineImpact(adaptation),
          implementation: adaptation.implementation || "",
        })
      }
    }

    // Store patterns for reference (convert snake_case to camelCase)
    results.patterns = {
      errorPatterns: patterns.error_patterns,
      performancePatterns: patterns.performance_patterns,
      successPatterns: patterns.success_patterns,
    }

    if (verbose) {
      UI.println(UI.Style.TEXT_DIM + `\nEvolution analysis complete.`)
      UI.println(
        UI.Style.TEXT_DIM +
          `Found ${results.suggestions.length} improvement suggestions.`,
      )
    }
  } catch (error) {
    UI.println(
      UI.Style.TEXT_WARNING_BOLD + "⚠ ",
      UI.Style.TEXT_NORMAL + `Evolution analysis failed: ${error}`,
    )
  }

  return results
}

function determineImpact(adaptation: any): "high" | "medium" | "low" {
  // Determine impact based on adaptation characteristics
  if (adaptation.priority === "critical" || adaptation.affects_core)
    return "high"
  if (adaptation.priority === "low" || adaptation.affects_edge_cases)
    return "low"
  return "medium"
}

function displayEvolutionSuggestions(results: EvolutionResults) {
  UI.empty()
  UI.println(UI.Style.TEXT_HIGHLIGHT_BOLD + "Evolution Suggestions")
  UI.println(UI.Style.TEXT_DIM + "─".repeat(50))
  UI.empty()

  if (results.suggestions.length === 0) {
    UI.println(
      UI.Style.TEXT_INFO_BOLD + "ℹ ",
      UI.Style.TEXT_NORMAL + "No improvements suggested at this time.",
    )
    UI.println(UI.Style.TEXT_DIM + "  Continue using DGMO to gather more data.")
    return
  }

  // Group by impact
  const highImpact = results.suggestions.filter((s) => s.impact === "high")
  const mediumImpact = results.suggestions.filter((s) => s.impact === "medium")
  const lowImpact = results.suggestions.filter((s) => s.impact === "low")

  // Display high impact suggestions
  if (highImpact.length > 0) {
    UI.println(UI.Style.TEXT_DANGER_BOLD + "High Impact Improvements:")
    for (const suggestion of highImpact) {
      UI.println(
        UI.Style.TEXT_DANGER_BOLD + "  ⚡ ",
        UI.Style.TEXT_NORMAL + suggestion.description,
      )
      if (suggestion.type !== "general") {
        UI.println(UI.Style.TEXT_DIM + "     Type: " + suggestion.type)
      }
    }
    UI.empty()
  }

  // Display medium impact suggestions
  if (mediumImpact.length > 0) {
    UI.println(UI.Style.TEXT_WARNING_BOLD + "Medium Impact Improvements:")
    for (const suggestion of mediumImpact) {
      UI.println(
        UI.Style.TEXT_WARNING_BOLD + "  → ",
        UI.Style.TEXT_NORMAL + suggestion.description,
      )
    }
    UI.empty()
  }

  // Display low impact suggestions (only count)
  if (lowImpact.length > 0) {
    UI.println(
      UI.Style.TEXT_DIM +
        `Plus ${lowImpact.length} low-impact improvements available.`,
    )
    UI.empty()
  }

  // Summary
  UI.println(
    UI.Style.TEXT_INFO_BOLD + "Summary: ",
    UI.Style.TEXT_NORMAL +
      `${results.suggestions.length} total improvements identified`,
  )
}

async function confirmApplyImprovements(): Promise<boolean> {
  // For now, return false to require --auto-apply flag
  // In future, could implement interactive confirmation
  UI.empty()
  UI.println(
    UI.Style.TEXT_WARNING_BOLD + "⚠ ",
    UI.Style.TEXT_NORMAL +
      "Use --auto-apply to automatically apply high-impact improvements",
  )
  return false
}

async function applyImprovements(bridge: DGMBridge, results: EvolutionResults) {
  UI.empty()
  UI.println(
    UI.Style.TEXT_INFO_BOLD + "→ ",
    UI.Style.TEXT_NORMAL + "Applying improvements...",
  )

  let appliedCount = 0
  let failedCount = 0

  for (const suggestion of results.suggestions) {
    if (suggestion.impact === "high" && suggestion.implementation) {
      try {
        UI.println(
          UI.Style.TEXT_DIM + "  Applying: ",
          UI.Style.TEXT_NORMAL + suggestion.description,
        )

        // Apply the improvement via DGM
        const applyResult = await bridge.execute("apply_improvement", {
          suggestion: suggestion.implementation,
          testFirst: true,
        })

        if (applyResult.success) {
          appliedCount++
          UI.println(
            UI.Style.TEXT_SUCCESS_BOLD + "    ✓ ",
            UI.Style.TEXT_NORMAL + "Applied successfully",
          )

          // Record the improvement
          results.improvements.push({
            toolName: suggestion.type,
            changes: [suggestion.description],
            testResults: applyResult.testResults,
          })
        } else {
          failedCount++
          UI.println(
            UI.Style.TEXT_DANGER_BOLD + "    ✗ ",
            UI.Style.TEXT_NORMAL +
              `Failed: ${applyResult.error || "Unknown error"}`,
          )
        }
      } catch (error) {
        failedCount++
        UI.println(
          UI.Style.TEXT_DANGER_BOLD + "    ✗ ",
          UI.Style.TEXT_NORMAL + `Error: ${error}`,
        )
      }
    }
  }

  UI.empty()
  UI.println(
    UI.Style.TEXT_HIGHLIGHT_BOLD + "Evolution Complete",
    UI.Style.TEXT_NORMAL + ` - Applied ${appliedCount} improvements`,
  )

  if (failedCount > 0) {
    UI.println(
      UI.Style.TEXT_WARNING_BOLD + "⚠ ",
      UI.Style.TEXT_NORMAL + `${failedCount} improvements failed to apply`,
    )
  }

  // Save evolution history
  await saveEvolutionHistory(results)
}

async function saveEvolutionHistory(results: EvolutionResults): Promise<void> {
  try {
    const history = {
      timestamp: new Date().toISOString(),
      patterns: results.patterns,
      suggestions: results.suggestions,
      improvements: results.improvements,
    }

    // Save to a history file for tracking evolution over time
    const { Storage } = await import("../../storage/storage")
    await Storage.writeJSON("evolution/history/" + Date.now(), history)
  } catch (error) {
    // Silently fail - history is not critical
  }
}

interface GenerationResults {
  generatedCode: Array<{
    toolName: string
    originalCode: string
    improvedCode: string
    improvements: string[]
    performanceGain: number
  }>
  patterns: {
    errorPatterns: any[]
    performancePatterns: any[]
    successPatterns: any[]
  }
}

async function generateImprovements(
  bridge: DGMBridge,
  data: PerformanceData,
  verbose: boolean,
): Promise<GenerationResults> {
  const results: GenerationResults = {
    generatedCode: [],
    patterns: {
      errorPatterns: [],
      performancePatterns: [],
      successPatterns: [],
    },
  }

  try {
    // Prepare patterns for DGM code generation
    const patterns = {
      error_patterns: data.errorPatterns.map((ep) => ({
        pattern: ep.pattern,
        frequency: ep.count,
        affected_tools: ep.tools,
        examples: ep.examples,
      })),
      performance_patterns: Object.entries(data.toolStats).map(
        ([tool, stats]) => ({
          tool,
          usage_count: stats.count,
          avg_duration_ms: stats.avgDuration,
          success_rate: stats.successRate,
          common_errors: stats.errors.slice(0, 5),
        }),
      ),
      success_patterns: Object.entries(data.toolStats)
        .filter(([_, stats]) => stats.successRate > 0.9)
        .map(([tool, stats]) => ({
          tool,
          success_rate: stats.successRate,
          usage_count: stats.count,
        })),
    }

    if (verbose) {
      UI.println(UI.Style.TEXT_DIM + "Patterns for code generation:")
      UI.println(
        UI.Style.TEXT_DIM +
          `  - Error patterns: ${patterns.error_patterns.length}`,
      )
      UI.println(
        UI.Style.TEXT_DIM +
          `  - Performance patterns: ${patterns.performance_patterns.length}`,
      )
      UI.println(
        UI.Style.TEXT_DIM +
          `  - Success patterns: ${patterns.success_patterns.length}`,
      )
    }

    // Send patterns to DGM for code generation
    const generationResponse = await bridge.execute(
      "generate_code_improvements",
      patterns,
    )

    if (generationResponse.generated_improvements) {
      // Process DGM's generated code improvements
      for (const improvement of generationResponse.generated_improvements) {
        results.generatedCode.push({
          toolName: improvement.tool_name || "unknown",
          originalCode: improvement.original_code || "",
          improvedCode: improvement.improved_code || "",
          improvements: improvement.improvements || [],
          performanceGain: improvement.performance_gain || 0,
        })
      }
    }

    // Store patterns for reference
    results.patterns = {
      errorPatterns: patterns.error_patterns,
      performancePatterns: patterns.performance_patterns,
      successPatterns: patterns.success_patterns,
    }

    if (verbose) {
      UI.println(UI.Style.TEXT_DIM + `\nCode generation complete.`)
      UI.println(
        UI.Style.TEXT_DIM +
          `Generated ${results.generatedCode.length} code improvements.`,
      )
    }
  } catch (error) {
    UI.println(
      UI.Style.TEXT_WARNING_BOLD + "⚠ ",
      UI.Style.TEXT_NORMAL + `Code generation failed: ${error}`,
    )
  }

  return results
}

function displayGeneratedImprovements(results: GenerationResults) {
  UI.empty()
  UI.println(UI.Style.TEXT_HIGHLIGHT_BOLD + "Generated Code Improvements")
  UI.println(UI.Style.TEXT_DIM + "─".repeat(50))
  UI.empty()

  if (results.generatedCode.length === 0) {
    UI.println(
      UI.Style.TEXT_INFO_BOLD + "ℹ ",
      UI.Style.TEXT_NORMAL + "No code improvements generated at this time.",
    )
    UI.println(UI.Style.TEXT_DIM + "  Continue using DGMO to gather more data.")
    return
  }

  // Display generated improvements
  for (const improvement of results.generatedCode) {
    UI.println(
      UI.Style.TEXT_HIGHLIGHT_BOLD + "Tool: ",
      UI.Style.TEXT_NORMAL + improvement.toolName,
    )

    if (improvement.performanceGain > 0) {
      UI.println(
        UI.Style.TEXT_SUCCESS_BOLD + "  Expected Performance Gain: ",
        UI.Style.TEXT_NORMAL + `${improvement.performanceGain.toFixed(1)}%`,
      )
    }

    if (improvement.improvements.length > 0) {
      UI.println(UI.Style.TEXT_NORMAL_BOLD + "  Improvements:")
      for (const imp of improvement.improvements) {
        UI.println(UI.Style.TEXT_DIM + "    • " + imp)
      }
    }

    UI.empty()
  }

  // Summary
  UI.println(
    UI.Style.TEXT_INFO_BOLD + "Summary: ",
    UI.Style.TEXT_NORMAL +
      `${results.generatedCode.length} code improvements generated`,
  )

  const totalGain = results.generatedCode.reduce(
    (sum, imp) => sum + imp.performanceGain,
    0,
  )
  if (totalGain > 0) {
    UI.println(
      UI.Style.TEXT_SUCCESS_BOLD + "Total Expected Performance Gain: ",
      UI.Style.TEXT_NORMAL + `${totalGain.toFixed(1)}%`,
    )
  }
}

async function applyGeneratedImprovements(
  bridge: DGMBridge,
  results: GenerationResults,
) {
  UI.empty()
  UI.println(
    UI.Style.TEXT_INFO_BOLD + "→ ",
    UI.Style.TEXT_NORMAL + "Applying generated improvements...",
  )

  let appliedCount = 0
  let failedCount = 0

  for (const improvement of results.generatedCode) {
    try {
      UI.println(
        UI.Style.TEXT_DIM + "  Applying: ",
        UI.Style.TEXT_NORMAL + improvement.toolName,
      )

      // Apply the generated improvement via DGM
      const applyResult = await bridge.execute("apply_generated_code", {
        tool_name: improvement.toolName,
        improved_code: improvement.improvedCode,
        test_first: true,
      })

      if (applyResult.success) {
        appliedCount++
        UI.println(
          UI.Style.TEXT_SUCCESS_BOLD + "    ✓ ",
          UI.Style.TEXT_NORMAL + "Applied successfully",
        )
      } else {
        failedCount++
        UI.println(
          UI.Style.TEXT_DANGER_BOLD + "    ✗ ",
          UI.Style.TEXT_NORMAL +
            `Failed: ${applyResult.error || "Unknown error"}`,
        )
      }
    } catch (error) {
      failedCount++
      UI.println(
        UI.Style.TEXT_DANGER_BOLD + "    ✗ ",
        UI.Style.TEXT_NORMAL + `Error: ${error}`,
      )
    }
  }

  UI.empty()
  UI.println(
    UI.Style.TEXT_HIGHLIGHT_BOLD + "Code Generation Complete",
    UI.Style.TEXT_NORMAL + ` - Applied ${appliedCount} improvements`,
  )

  if (failedCount > 0) {
    UI.println(
      UI.Style.TEXT_WARNING_BOLD + "⚠ ",
      UI.Style.TEXT_NORMAL + `${failedCount} improvements failed to apply`,
    )
  }

  // Save generation history
  await saveGenerationHistory(results)
}

async function saveGenerationHistory(
  results: GenerationResults,
): Promise<void> {
  try {
    const history = {
      timestamp: new Date().toISOString(),
      patterns: results.patterns,
      generatedCode: results.generatedCode,
    }

    // Save to a history file for tracking generation over time
    const { Storage } = await import("../../storage/storage")
    await Storage.writeJSON("evolution/generation/" + Date.now(), history)
  } catch (error) {
    // Silently fail - history is not critical
  }
}
