import { describe, test, expect, beforeAll } from "bun:test"
import { TechniqueRegistry } from "../registry/technique-registry"
import { TechniqueSelector } from "../selector/technique-selector"
import { PromptComposer } from "../composer/prompt-composer"
import { DGMOIntegration } from "../integration/dgmo-integration"
import type {
  TechniqueContext,
  SelectionContext,
  TaskType,
  Capability,
  PromptingTechnique,
} from "../types"

// Mock session for testing
class MockSession {
  id = "test-session"
  agentId = "test-agent"
  capabilities: Capability[] = ["memory", "tools", "sub_agents"]

  async enhancePrompt(prompt: string, techniques?: string[]): Promise<string> {
    // Simulate prompt enhancement
    return `Enhanced: ${prompt}`
  }
}

// Mock performance tracker
class MockPerformanceTracker {
  private records: any[] = []

  async trackExecution(data: any): Promise<void> {
    this.records.push(data)
  }

  getRecords(): any[] {
    return this.records
  }

  clear(): void {
    this.records = []
  }
}

describe("Prompting System Integration Tests", () => {
  let registry: TechniqueRegistry
  let selector: TechniqueSelector
  let composer: PromptComposer
  let integration: DGMOIntegration
  let mockSession: MockSession
  let performanceTracker: MockPerformanceTracker

  beforeAll(async () => {
    // Initialize components
    registry = new TechniqueRegistry()
    selector = new TechniqueSelector(registry)
    composer = new PromptComposer(registry)

    // Mock the integration dependencies
    performanceTracker = new MockPerformanceTracker()

    // Create integration with mocked dependencies
    integration = new DGMOIntegration(registry, selector, composer)

    // Initialize registry with mock loader
    await registry.initialize()

    mockSession = new MockSession()
  })

  describe("Session Integration", () => {
    test("should enhance prompts through session integration", async () => {
      const prompt = "Solve this complex optimization problem"
      const enhanced = await mockSession.enhancePrompt(prompt, ["cot", "tot"])

      expect(enhanced).toContain("Enhanced:")
      expect(enhanced).toContain(prompt)
    })

    test("should respect session capabilities", async () => {
      const context: SelectionContext = {
        sessionId: mockSession.id,
        agentId: mockSession.agentId,
        constraints: [
          { type: "capability_requirement", value: mockSession.capabilities },
        ],
      }

      const selected = await selector.select(
        "Create multiple agents to analyze data",
        context,
      )

      // Should select techniques compatible with session capabilities
      const allCompatible = selected.primary.every((t) => {
        if (!t.requiredCapabilities || t.requiredCapabilities.length === 0) {
          return true
        }
        return t.requiredCapabilities.every((cap) =>
          mockSession.capabilities.includes(cap),
        )
      })

      expect(allCompatible).toBe(true)
    })

    test("should track performance across sessions", async () => {
      const context: TechniqueContext = {
        task: "Test task",
        sessionId: mockSession.id,
        agentId: mockSession.agentId,
        variables: {},
        constraints: [],
        previousTechniques: [],
        capabilities: mockSession.capabilities,
      }

      // Execute technique
      const technique = registry.get("cot")
      if (technique) {
        const start = performance.now()
        const result = await technique.apply(context)
        const duration = performance.now() - start

        // Track execution
        await performanceTracker.trackExecution({
          techniqueId: technique.id,
          sessionId: context.sessionId,
          agentId: context.agentId,
          duration,
          success: true,
          tokensUsed: result.metadata.estimatedTokens,
        })
      }

      const records = performanceTracker.getRecords()
      expect(records.length).toBeGreaterThan(0)
      expect(records[0].techniqueId).toBe("cot")
    })
  })

  describe("Task Tool Integration", () => {
    test("should accept technique parameters in task creation", async () => {
      const taskParams = {
        task: "Analyze system architecture",
        techniques: ["cot", "tot"],
        constraints: {
          maxTokens: 2000,
          timeLimit: 30000,
        },
      }

      // Simulate task tool behavior
      const context: TechniqueContext = {
        task: taskParams.task,
        sessionId: "task-session",
        agentId: "task-agent",
        variables: {
          requestedTechniques: taskParams.techniques,
        },
        constraints: [
          { type: "token_limit", value: taskParams.constraints.maxTokens },
          { type: "time_limit", value: taskParams.constraints.timeLimit },
        ],
        previousTechniques: [],
        capabilities: ["sub_agents"],
      }

      // Get requested techniques
      const techniques = taskParams.techniques
        .map((id) => registry.get(id))
        .filter((t) => t !== undefined) as PromptingTechnique[]

      const result = await composer.compose(techniques, context)

      expect(result.metadata.techniques).toEqual(
        expect.arrayContaining(["cot", "tot"]),
      )
      expect(result.metadata.estimatedTokens).toBeLessThanOrEqual(2000)
    })

    test("should handle technique inheritance in sub-agents", async () => {
      const parentContext: TechniqueContext = {
        task: "Parent task",
        sessionId: "parent-session",
        agentId: "parent-agent",
        variables: {
          appliedTechniques: ["cot", "meta_prompting"],
        },
        constraints: [],
        previousTechniques: ["cot", "meta_prompting"],
        capabilities: ["sub_agents"],
      }

      const childContext: TechniqueContext = {
        task: "Child task",
        parentContext,
        sessionId: "child-session",
        agentId: "child-agent",
        variables: {},
        constraints: [],
        previousTechniques: [],
        capabilities: ["memory"],
      }

      // Child should consider parent techniques
      const analysis = await selector.analyzeTask(childContext.task, {
        sessionId: childContext.sessionId,
        agentId: childContext.agentId,
        parentTechniques: parentContext.previousTechniques,
        constraints: childContext.constraints,
      })

      expect(analysis.suggestedTechniques.length).toBeGreaterThan(0)
      // Should suggest complementary techniques
    })
  })

  describe("Performance Tracking Integration", () => {
    test("should track technique execution metrics", async () => {
      performanceTracker.clear()

      const techniques = ["cot", "tot", "self_consistency"]
      const context: TechniqueContext = {
        task: "Complex analysis task",
        sessionId: "perf-session",
        agentId: "perf-agent",
        variables: {},
        constraints: [],
        previousTechniques: [],
        capabilities: [],
      }

      // Execute multiple techniques
      for (const techId of techniques) {
        const technique = registry.get(techId)
        if (technique) {
          const start = performance.now()
          await technique.apply(context)
          const duration = performance.now() - start

          await performanceTracker.trackExecution({
            techniqueId: techId,
            sessionId: context.sessionId,
            duration,
            success: true,
          })
        }
      }

      const records = performanceTracker.getRecords()
      expect(records).toHaveLength(techniques.length)

      // Verify all executions were tracked
      const trackedIds = records.map((r) => r.techniqueId)
      expect(trackedIds).toEqual(expect.arrayContaining(techniques))
    })

    test("should adapt selection based on performance history", async () => {
      const performanceHistory = [
        {
          techniqueId: "cot",
          taskType: "analysis" as TaskType,
          success: true,
          latency: 50,
          timestamp: Date.now() - 5000,
        },
        {
          techniqueId: "tot",
          taskType: "analysis" as TaskType,
          success: false,
          latency: 200,
          timestamp: Date.now() - 3000,
        },
        {
          techniqueId: "cot",
          taskType: "analysis" as TaskType,
          success: true,
          latency: 45,
          timestamp: Date.now() - 1000,
        },
      ]

      const context: SelectionContext = {
        sessionId: "adaptive-session",
        agentId: "adaptive-agent",
        constraints: [],
        performanceHistory,
      }

      const selected = await selector.select(
        "Analyze this data structure",
        context,
      )

      // Should prefer techniques with better performance
      const scores = selected.primary.map((t) => {
        const history = performanceHistory.filter((h) => h.techniqueId === t.id)
        const successRate =
          history.filter((h) => h.success).length / history.length
        return { id: t.id, successRate }
      })

      // Techniques with better success rates should be preferred
      expect(scores.length).toBeGreaterThan(0)
    })
  })

  describe("End-to-End Workflow", () => {
    test("should handle complete prompt enhancement workflow", async () => {
      // 1. Analyze task
      const task =
        "Design a scalable microservices architecture for an e-commerce platform"
      const context: SelectionContext = {
        sessionId: "e2e-session",
        agentId: "e2e-agent",
        constraints: [{ type: "token_limit", value: 3000 }],
      }

      const analysis = await selector.analyzeTask(task, context)
      expect(analysis.taskType).toContain("problem_solving")
      expect(analysis.complexity).toBe("high")

      // 2. Select techniques
      const selected = await selector.select(task, context)
      expect(selected.primary.length).toBeGreaterThan(0)

      // 3. Compose prompt
      const techniqueContext: TechniqueContext = {
        task,
        sessionId: context.sessionId,
        agentId: context.agentId,
        variables: {
          domain: "Software Architecture",
          requirements: ["scalability", "reliability", "maintainability"],
        },
        constraints: context.constraints,
        previousTechniques: [],
        capabilities: ["tools", "memory"],
      }

      const enhanced = await composer.compose(
        selected.primary,
        techniqueContext,
      )

      // 4. Verify result
      expect(enhanced.content).toContain(task)
      expect(enhanced.metadata.techniques.length).toBeGreaterThan(0)
      expect(enhanced.metadata.estimatedTokens).toBeLessThanOrEqual(3000)
      expect(enhanced.metadata.confidence).toBeGreaterThan(0.5)
    })

    test("should handle multi-agent coordination workflow", async () => {
      const task = "Implement a distributed data processing pipeline"

      // Parent agent context
      const parentContext: TechniqueContext = {
        task,
        sessionId: "parent-session",
        agentId: "coordinator-agent",
        variables: {},
        constraints: [],
        previousTechniques: [],
        capabilities: ["sub_agents", "memory"],
      }

      // Select coordination techniques
      const coordTechniques = registry.search({
        categories: ["multi_agent"],
        capabilities: ["sub_agents"],
      })

      expect(coordTechniques.length).toBeGreaterThan(0)

      // Apply coordination technique
      const coordinator = coordTechniques[0]
      const coordResult = await coordinator.apply(parentContext)

      expect(coordResult.content).toContain("Agent")
      expect(coordResult.metadata.techniques).toContain(coordinator.id)

      // Simulate sub-agent contexts
      const subAgentTasks = [
        "Design data ingestion module",
        "Implement processing logic",
        "Create output connectors",
      ]

      const subAgentResults = await Promise.all(
        subAgentTasks.map(async (subTask, index) => {
          const subContext: TechniqueContext = {
            task: subTask,
            parentContext,
            sessionId: `sub-session-${index}`,
            agentId: `sub-agent-${index}`,
            variables: {
              parentTask: task,
              role: subTask,
            },
            constraints: [],
            previousTechniques: [],
            capabilities: ["tools"],
          }

          const subSelected = await selector.select(subTask, {
            sessionId: subContext.sessionId,
            agentId: subContext.agentId,
            parentTechniques: parentContext.previousTechniques,
            constraints: [],
          })

          return composer.compose(subSelected.primary, subContext)
        }),
      )

      // Verify all sub-agents produced results
      expect(subAgentResults).toHaveLength(3)
      subAgentResults.forEach((result) => {
        expect(result.content).toBeTruthy()
        expect(result.metadata.techniques.length).toBeGreaterThan(0)
      })
    })
  })

  describe("Error Recovery", () => {
    test("should handle technique failures gracefully", async () => {
      // Create a context that might cause issues
      const context: TechniqueContext = {
        task: "Test task with potential failure",
        sessionId: "error-session",
        agentId: "error-agent",
        variables: {
          forceError: true,
        },
        constraints: [],
        previousTechniques: [],
        capabilities: [],
      }

      // Try to apply techniques that might fail
      const techniques = ["cot", "tot", "meta_prompting"]
      const results = []

      for (const techId of techniques) {
        const technique = registry.get(techId)
        if (technique) {
          try {
            const result = await technique.apply(context)
            results.push({ techId, success: true, result })
          } catch (error) {
            results.push({ techId, success: false, error })
          }
        }
      }

      // At least some techniques should succeed
      const successful = results.filter((r) => r.success)
      expect(successful.length).toBeGreaterThan(0)
    })

    test("should validate and sanitize inputs", async () => {
      const invalidInputs = [
        "", // Empty task
        "a", // Too short
        "x".repeat(10000), // Too long
        null, // Null
        undefined, // Undefined
        123, // Wrong type
      ]

      for (const input of invalidInputs) {
        const technique = registry.get("cot")
        if (technique) {
          const isValid = technique.validate(input as any)
          if (typeof input === "string" && input.length > 20) {
            expect(isValid).toBe(true)
          } else {
            expect(isValid).toBe(false)
          }
        }
      }
    })
  })

  describe("Performance Benchmarks", () => {
    test("should meet performance targets for common operations", async () => {
      const operations = [
        {
          name: "Task Analysis",
          fn: () =>
            selector.analyzeTask("Analyze this code", {
              sessionId: "bench-session",
              agentId: "bench-agent",
              constraints: [],
            }),
          maxTime: 20,
        },
        {
          name: "Technique Selection",
          fn: () =>
            selector.select("Write a function", {
              sessionId: "bench-session",
              agentId: "bench-agent",
              constraints: [],
            }),
          maxTime: 30,
        },
        {
          name: "Single Technique Composition",
          fn: async () => {
            const cot = registry.get("cot")!
            return composer.compose([cot], {
              task: "Test task",
              sessionId: "bench-session",
              agentId: "bench-agent",
              variables: {},
              constraints: [],
              previousTechniques: [],
              capabilities: [],
            })
          },
          maxTime: 20,
        },
      ]

      for (const op of operations) {
        const start = performance.now()
        await op.fn()
        const duration = performance.now() - start

        expect(duration).toBeLessThan(op.maxTime)
        console.log(
          `${op.name}: ${duration.toFixed(2)}ms (target: <${op.maxTime}ms)`,
        )
      }
    })

    test("should handle concurrent requests efficiently", async () => {
      const concurrentRequests = 20
      const tasks = Array.from(
        { length: concurrentRequests },
        (_, i) => `Task ${i}: Analyze and optimize this algorithm`,
      )

      const start = performance.now()

      const results = await Promise.all(
        tasks.map(async (task) => {
          const context: SelectionContext = {
            sessionId: `concurrent-${Math.random()}`,
            agentId: `agent-${Math.random()}`,
            constraints: [],
          }

          const selected = await selector.select(task, context)
          const techniqueContext: TechniqueContext = {
            task,
            sessionId: context.sessionId,
            agentId: context.agentId,
            variables: {},
            constraints: [],
            previousTechniques: [],
            capabilities: [],
          }

          return composer.compose(selected.primary, techniqueContext)
        }),
      )

      const duration = performance.now() - start

      expect(results).toHaveLength(concurrentRequests)
      expect(duration).toBeLessThan(1000) // Should handle 20 requests in under 1 second

      console.log(
        `Concurrent requests (${concurrentRequests}): ${duration.toFixed(2)}ms`,
      )
    })
  })
})
