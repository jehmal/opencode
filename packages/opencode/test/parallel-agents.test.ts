import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { SubSession } from "../src/session/sub-session"
import { AgentConfig } from "../src/config/agent-config"

describe("Parallel Agents Implementation", () => {
  beforeEach(() => {
    // Clear any existing state
    SubSession.cleanup(30)
  })

  afterEach(() => {
    // Clean up after tests
    SubSession.cleanup(0)
  })

  describe("SubSession Storage", () => {
    it("should create and retrieve a sub-session", async () => {
      const parentID = "parent123"
      const sessionID = "session456"
      const agentName = "Test Agent"
      const task = "Test task description"

      await SubSession.create(parentID, sessionID, agentName, task)

      const subSession = await SubSession.get(sessionID)
      expect(subSession).toBeDefined()
      expect(subSession?.parentSessionId).toBe(parentID)
      expect(subSession?.agentName).toBe(agentName)
      expect(subSession?.taskDescription).toBe(task)
      expect(subSession?.status).toBe("pending")
    })

    it("should update sub-session status", async () => {
      const sessionID = "session789"
      await SubSession.create("parent", sessionID, "Agent", "Task")

      // Update to running
      await SubSession.update(sessionID, { status: "running" })
      let subSession = await SubSession.get(sessionID)
      expect(subSession?.status).toBe("running")

      // Complete the session
      await SubSession.complete(sessionID, "Task completed successfully")
      subSession = await SubSession.get(sessionID)
      expect(subSession?.status).toBe("completed")
      expect(subSession?.summary).toBe("Task completed successfully")
    })

    it("should fail a sub-session", async () => {
      const sessionID = "session999"
      await SubSession.create("parent", sessionID, "Agent", "Task")

      await SubSession.fail(sessionID, "Something went wrong")
      const subSession = await SubSession.get(sessionID)
      expect(subSession?.status).toBe("failed")
      expect(subSession?.summary).toBe("Something went wrong")
    })

    it("should search sub-sessions by parent", async () => {
      const parentID = "parent999"
      await SubSession.create(parentID, "child1", "Agent 1", "Task 1")
      await SubSession.create(parentID, "child2", "Agent 2", "Task 2")
      await SubSession.create("other-parent", "child3", "Agent 3", "Task 3")

      const results = await SubSession.search(parentID)
      expect(results.length).toBe(2)
      expect(results.every((s) => s.parentSessionId === parentID)).toBe(true)
    })

    it("should list all sub-sessions", async () => {
      await SubSession.create("parent1", "session1", "Agent 1", "Task 1")
      await SubSession.create("parent2", "session2", "Agent 2", "Task 2")

      const all = await SubSession.list()
      expect(all.length).toBeGreaterThanOrEqual(2)
    })

    it("should cleanup old sub-sessions", async () => {
      // Create an old session
      const sessionID = "old-session"
      await SubSession.create("parent", sessionID, "Agent", "Task")

      // Manually set createdAt to be old
      const storage = await SubSession.list()
      const session = storage.find((s) => s.id === sessionID)
      if (session) {
        session.createdAt = Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
        await SubSession.update(sessionID, {})
      }

      // Cleanup sessions older than 24 hours
      await SubSession.cleanup(24)

      const result = await SubSession.get(sessionID)
      expect(result).toBeUndefined()
    })
  })

  describe("Agent Mode Configuration", () => {
    it("should set and get session agent mode", () => {
      const sessionID = "test-session"

      // Set read-only mode
      AgentConfig.setSessionAgentMode(sessionID, "read-only")
      expect(AgentConfig.getSessionAgentMode(sessionID)).toBe("read-only")

      // Set all-tools mode
      AgentConfig.setSessionAgentMode(sessionID, "all-tools")
      expect(AgentConfig.getSessionAgentMode(sessionID)).toBe("all-tools")
    })

    it("should return allowed tools for read-only mode", async () => {
      const tools = await AgentConfig.getAllowedTools("read-only")

      // Should include read tools
      expect(tools).toContain("read")
      expect(tools).toContain("glob")
      expect(tools).toContain("grep")
      expect(tools).toContain("list")

      // Should not include write tools
      expect(tools).not.toContain("write")
      expect(tools).not.toContain("edit")
      expect(tools).not.toContain("bash")
    })

    it("should return empty array for all-tools mode", async () => {
      const tools = await AgentConfig.getAllowedTools("all-tools")
      expect(tools.length).toBe(0) // Empty means all tools allowed
    })

    it("should validate tool access", async () => {
      // Read-only mode
      expect(await AgentConfig.isToolAllowed("read", "read-only")).toBe(true)
      expect(await AgentConfig.isToolAllowed("write", "read-only")).toBe(false)
      expect(await AgentConfig.isToolAllowed("bash", "read-only")).toBe(false)

      // All-tools mode
      expect(await AgentConfig.isToolAllowed("read", "all-tools")).toBe(true)
      expect(await AgentConfig.isToolAllowed("write", "all-tools")).toBe(true)
      expect(await AgentConfig.isToolAllowed("bash", "all-tools")).toBe(true)
    })

    it("should always allow MCP tools", async () => {
      // MCP tools have underscores in their names
      expect(
        await AgentConfig.isToolAllowed("mcp_server_tool", "read-only"),
      ).toBe(true)
      expect(
        await AgentConfig.isToolAllowed("some_mcp_function", "read-only"),
      ).toBe(true)
    })
  })

  describe("Tool Filtering Logic", () => {
    it("should identify MCP tools by underscore", () => {
      const isMCPTool = (name: string) => name.includes("_")

      expect(isMCPTool("mcp_server")).toBe(true)
      expect(isMCPTool("regular-tool")).toBe(false)
      expect(isMCPTool("read")).toBe(false)
      expect(isMCPTool("some_mcp_tool")).toBe(true)
    })

    it("should filter tools based on mode", async () => {
      const allTools = [
        "read",
        "write",
        "edit",
        "bash",
        "glob",
        "grep",
        "mcp_tool",
      ]
      const readOnlyAllowed = await AgentConfig.getAllowedTools("read-only")

      const filtered = allTools.filter((tool) => {
        // MCP tools always allowed
        if (tool.includes("_")) return true
        // Otherwise check allowed list
        return readOnlyAllowed.includes(tool)
      })

      expect(filtered).toContain("read")
      expect(filtered).toContain("glob")
      expect(filtered).toContain("grep")
      expect(filtered).toContain("mcp_tool")
      expect(filtered).not.toContain("write")
      expect(filtered).not.toContain("edit")
      expect(filtered).not.toContain("bash")
    })
  })
})
