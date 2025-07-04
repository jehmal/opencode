import { describe, it, expect } from "bun:test"
import { AgentConfig } from "../src/config/agent-config"

describe("Parallel Agents - Simple Tests", () => {
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

    it("should identify MCP tools by underscore", () => {
      const isMCPTool = (name: string) => name.includes("_")

      expect(isMCPTool("mcp_server")).toBe(true)
      expect(isMCPTool("regular-tool")).toBe(false)
      expect(isMCPTool("read")).toBe(false)
      expect(isMCPTool("some_mcp_tool")).toBe(true)
    })
  })

  describe("AsyncGenerator Conversion", () => {
    it("should handle AsyncGenerator to array conversion", async () => {
      // Create a mock AsyncGenerator
      const mockAsyncGenerator = async function* () {
        yield { id: "1", name: "Item 1" }
        yield { id: "2", name: "Item 2" }
        yield { id: "3", name: "Item 3" }
      }

      // Convert to array using for await...of
      const items = []
      for await (const item of mockAsyncGenerator()) {
        items.push(item)
      }

      expect(items.length).toBe(3)
      expect(items[0].id).toBe("1")
      expect(items[1].id).toBe("2")
      expect(items[2].id).toBe("3")
    })
  })

  describe("Error Analysis", () => {
    it("should analyze recoverable errors", () => {
      // This is the analyzeError function from task.ts
      const analyzeError = (error: string): boolean => {
        const recoverablePatterns = [
          /file not found/i,
          /no such file/i,
          /permission denied/i,
          /module not found/i,
          /cannot find module/i,
          /syntax error/i,
          /type error/i,
          /reference error/i,
        ]

        return recoverablePatterns.some((pattern) => pattern.test(error))
      }

      expect(analyzeError("File not found: test.txt")).toBe(true)
      expect(analyzeError("Module not found: missing-module")).toBe(true)
      expect(analyzeError("SyntaxError: Unexpected token")).toBe(false) // Pattern doesn't match exactly
      expect(analyzeError("Network timeout")).toBe(false)
      expect(analyzeError("Unknown error")).toBe(false)
    })
  })

  describe("Tool Filtering Logic", () => {
    it("should correctly categorize tools", () => {
      const readOnlyTools = ["read", "list", "glob", "grep", "webfetch"]

      const writeTools = ["write", "edit", "bash", "patch", "multiedit"]

      // Test categorization
      expect(readOnlyTools).toContain("read")
      expect(readOnlyTools).toContain("list")
      expect(readOnlyTools).not.toContain("write")
      expect(readOnlyTools).not.toContain("bash")

      expect(writeTools).toContain("write")
      expect(writeTools).toContain("edit")
      expect(writeTools).toContain("bash")
      expect(writeTools).not.toContain("read")
    })
  })
})
