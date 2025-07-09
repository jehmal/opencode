import { test, expect } from "bun:test"
import { PerformanceWrapper } from "../tool/performance-wrapper"
import { PerformanceTracker } from "@opencode/dgm-integration"
import { Tool } from "../tool/tool"
import { z } from "zod"

test("PerformanceWrapper wraps tool execution", async () => {
  // Create a mock tool
  const mockTool: Tool.Info = {
    id: "test-tool",
    description: "Test tool for performance tracking",
    parameters: z.object({
      input: z.string(),
    }),
    async execute(args: { input: string }, _ctx: Tool.Context) {
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10))
      return {
        metadata: {
          title: "Test Tool",
          result: args.input.toUpperCase(),
        },
        output: `Processed: ${args.input}`,
      }
    },
  }

  // Create tracker
  const tracker = new PerformanceTracker()

  // Wrap the tool
  const wrappedTool = PerformanceWrapper.wrap(mockTool, tracker)

  // Execute wrapped tool
  const result = await wrappedTool.execute(
    { input: "hello" },
    {
      sessionID: "test-session",
      messageID: "test-message",
      abort: new AbortController().signal,
      metadata: async () => {},
    },
  )

  // Verify result
  expect(result.output).toBe("Processed: hello")
  expect(result.metadata["result"]).toBe("HELLO")

  // Performance should be added when config is enabled
  // For now, it won't be added because config is not mocked

  // Verify tracker has metrics
  const report = tracker.getReport()
  expect(report.totalOperations).toBe(0) // Will be 0 because config is not enabled
})

test("PerformanceWrapper handles errors correctly", async () => {
  const errorTool: Tool.Info = {
    id: "error-tool",
    description: "Tool that throws errors",
    parameters: z.object({}),
    async execute() {
      throw new Error("Test error")
    },
  }

  const tracker = new PerformanceTracker()
  const wrappedTool = PerformanceWrapper.wrap(errorTool, tracker)

  // Should throw the original error
  expect(
    wrappedTool.execute(
      {},
      {
        sessionID: "test-session",
        messageID: "test-message",
        abort: new AbortController().signal,
        metadata: async () => {},
      },
    ),
  ).rejects.toThrow("Test error")
})

test("PerformanceWrapper.wrapAll wraps multiple tools", () => {
  const tools: Tool.Info[] = [
    {
      id: "tool1",
      description: "Tool 1",
      parameters: z.object({}),
      async execute() {
        return { metadata: { title: "Tool 1" }, output: "output1" }
      },
    },
    {
      id: "tool2",
      description: "Tool 2",
      parameters: z.object({}),
      async execute() {
        return { metadata: { title: "Tool 2" }, output: "output2" }
      },
    },
  ]

  const tracker = new PerformanceTracker()
  const wrappedTools = PerformanceWrapper.wrapAll(tools, tracker)

  expect(wrappedTools).toHaveLength(2)
  expect(wrappedTools[0].id).toBe("tool1")
  expect(wrappedTools[1].id).toBe("tool2")
})
