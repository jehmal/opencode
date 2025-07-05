import { z } from "zod"

export namespace AgentConfig {
  // Agent mode types
  export const AgentMode = z.enum(["read-only", "all-tools"])
  export type AgentMode = z.infer<typeof AgentMode>

  // Default mode is all-tools to enable full functionality including sub-sessions
  const DEFAULT_MODE: AgentMode = "all-tools"

  // Session-specific modes storage - using session ID as key
  const sessionModes = new Map<string, AgentMode>()

  // Tool lists for different modes
  export const READ_ONLY_TOOLS = [
    "read",
    "list",
    "glob",
    "grep",
    "webfetch",
    // MCP tools are always allowed
  ]

  export const ALL_TOOLS = [
    "read",
    "list",
    "glob",
    "grep",
    "webfetch",
    "write",
    "edit",
    "bash",
    "patch",
    "multiedit",
    "task",
    "todowrite",
    "todoread",
    "diagnose_subsessions",
    // All other tools
  ]

  // Get the current agent mode from config
  export async function getAgentMode(): Promise<AgentMode> {
    // For now, return the default mode
    // TODO: Read from config when available
    return DEFAULT_MODE
  }

  // Set agent mode for a specific session
  export function setSessionAgentMode(sessionId: string, mode: AgentMode) {
    sessionModes.set(sessionId, mode)
  }

  // Get agent mode for a specific session
  export function getSessionAgentMode(
    sessionId: string,
  ): AgentMode | undefined {
    return sessionModes.get(sessionId)
  }

  // Check if a session is a sub-agent (created by task tool)
  export function isSubAgentSession(
    _sessionId: string,
    parentId?: string,
  ): boolean {
    // Sub-agent sessions have a parent session ID
    // Check for actual value, not just undefined
    // Also check for string "undefined" which might come from serialization
    return (
      parentId !== undefined &&
      parentId !== null &&
      parentId !== "" &&
      parentId !== "undefined"
    )
  }

  // Check if main DGMO session (not a sub-agent)
  export function isMainSession(sessionId: string, parentId?: string): boolean {
    return !isSubAgentSession(sessionId, parentId)
  }

  // Get allowed tools for a session
  export async function getAllowedTools(
    sessionId: string,
    parentId?: string,
  ): Promise<string[]> {
    // Main DGMO always has all tools
    const isMain = isMainSession(sessionId, parentId)
    console.log("[AGENT-CONFIG] getAllowedTools:", {
      sessionId,
      parentId,
      parentIdType: typeof parentId,
      parentIdTruthy: !!parentId,
      parentIdLength: typeof parentId === "string" ? parentId.length : "N/A",
      isMainSession: isMain,
      willGetAllTools: isMain,
    })

    if (isMain) {
      console.log(
        "[AGENT-CONFIG] Main session detected, returning ALL_TOOLS including task",
      )
      return ALL_TOOLS
    }

    // Get session-specific mode or fall back to global
    const mode = getSessionAgentMode(sessionId) || (await getAgentMode())
    console.log("[AGENT-CONFIG] Session mode:", mode)

    const tools = mode === "all-tools" ? ALL_TOOLS : READ_ONLY_TOOLS
    console.log(
      "[AGENT-CONFIG] Returning tools:",
      tools.length,
      "tools, includes task:",
      tools.includes("task"),
    )
    return tools
  }

  // Check if a tool is allowed for a session
  export async function isToolAllowed(
    sessionId: string,
    toolName: string,
    parentId?: string,
  ): Promise<boolean> {
    // MCP tools are always allowed (they start with server prefix)
    if (toolName.includes("_") && !ALL_TOOLS.includes(toolName)) {
      return true // Likely an MCP tool
    }

    const allowedTools = await getAllowedTools(sessionId, parentId)
    const isAllowed = allowedTools.includes(toolName)
    if (toolName === "task") {
      console.log("[AGENT-CONFIG] isToolAllowed for task:", {
        sessionId,
        parentId,
        allowedToolsCount: allowedTools.length,
        isAllowed,
        allowedTools: allowedTools.slice(0, 5) + "...",
      })
    }
    return isAllowed
  }
}
