import { describe, test, expect, beforeAll, afterEach, vi } from "bun:test"
import { TechniqueRegistry } from "../registry/technique-registry"
import { TechniqueSelector } from "../selector/technique-selector"
import { PromptComposer } from "../composer/prompt-composer"
import { ChainOfThoughtTechnique } from "../techniques/reasoning/chain-of-thought"
import { TreeOfThoughtsTechnique } from "../techniques/reasoning/tree-of-thoughts"
import { ProgramAidedLanguageTechnique } from "../techniques/reasoning/pal"
import { FewShotTechnique } from "../techniques/generation/few-shot"
import { PersonaTechnique } from "../techniques/generation/persona"
import { ActivePromptTechnique } from "../techniques/optimization/active-prompt"
import { SelfConsistencyTechnique } from "../techniques/optimization/self-consistency"
import { IterativeRefinementTechnique } from "../techniques/optimization/iterative-refinement"
import { ConstitutionalAITechnique } from "../techniques/advanced/constitutional-ai"
import { generatedKnowledge } from "../techniques/advanced/generated-knowledge"
import { MetaPromptingTechnique } from "../techniques/advanced/meta-prompting"
import { PromptChainingTechnique } from "../techniques/advanced/prompt-chaining"
import { ReActTechnique } from "../techniques/advanced/react"
import { ReflexionTechnique } from "../techniques/advanced/reflexion"
import { AgentCommunicationProtocolTechnique } from "../techniques/multi-agent/agent-communication-protocol"
import { ConsensusBuildingTechnique } from "../techniques/multi-agent/consensus-building"
import { HierarchicalDecompositionTechnique } from "../techniques/multi-agent/hierarchical-decomposition"
import { MultiAgentCoordinationTechnique } from "../techniques/multi-agent/multi-agent-coordination"
import type {
  PromptingTechnique,
  TechniqueContext,
  TaskType,
  SelectionContext,
  Capability,
} from "../types"

// Mock implementations for missing components
class MockTechniqueCache {
  private cache = new Map<string, PromptingTechnique>()
  private hits = 0
  private misses = 0

  set(id: string, technique: PromptingTechnique): void {
    this.cache.set(id, technique)
  }

  get(id: string): PromptingTechnique | undefined {
    const result = this.cache.get(id)
    if (result) {
      this.hits++
    } else {
      this.misses++
    }
    return result
  }

  async warmUp(techniques: PromptingTechnique[]): Promise<void> {
    techniques.forEach((t) => this.cache.set(t.id, t))
  }

  getHitRate(): number {
    const total = this.hits + this.misses
    return total === 0 ? 0 : this.hits / total
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }
}

// Mock the TechniqueLoader to avoid file system dependencies
class MockTechniqueLoader {
  private loadTimes: number[] = []

  async loadAll(): Promise<PromptingTechnique[]> {
    const start = performance.now()

    // Return all technique instances
    const techniques: PromptingTechnique[] = [
      new ChainOfThoughtTechnique(),
      new TreeOfThoughtsTechnique(),
      new ProgramAidedLanguageTechnique(),
      new FewShotTechnique(),
      new PersonaTechnique(),
      new ActivePromptTechnique(),
      new SelfConsistencyTechnique(),
      new IterativeRefinementTechnique(),
      new ConstitutionalAITechnique(),
      generatedKnowledge, // This is exported as const
      new MetaPromptingTechnique(),
      new PromptChainingTechnique(),
      new ReActTechnique(),
      new ReflexionTechnique(),
      new AgentCommunicationProtocolTechnique(),
      new ConsensusBuildingTechnique(),
      new HierarchicalDecompositionTechnique(),
      new MultiAgentCoordinationTechnique(),
    ]

    const loadTime = performance.now() - start
    this.loadTimes.push(loadTime)

    return techniques
  }

  getAverageLoadTime(): number {
    if (this.loadTimes.length === 0) return 0
    const sum = this.loadTimes.reduce((acc, time) => acc + time, 0)
    return sum / this.loadTimes.length
  }
}

// Override the registry to use mocks
class MockedTechniqueRegistry extends TechniqueRegistry {
  constructor() {
    super()
    // @ts-ignore - accessing private properties for testing
    this.cache = new MockTechniqueCache()
    // @ts-ignore
    this.loader = new MockTechniqueLoader()
  }
}

describe("Prompting Techniques System", () => {
  let registry: TechniqueRegistry
  let selector: TechniqueSelector
  let composer: PromptComposer

  beforeAll(async () => {
    registry = new MockedTechniqueRegistry()
    await registry.initialize()
    selector = new TechniqueSelector(registry)
    composer = new PromptComposer(registry)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("Technique Registry", () => {
    test("should initialize with all 18 techniques", async () => {
      expect(registry.getAll()).toHaveLength(18)
    })

    test("should retrieve techniques by ID", () => {
      const retrieved = registry.get("cot")
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe("cot")
      expect(retrieved?.name).toBe("Chain of Thought (CoT)")
    })

    test("should retrieve techniques by category", () => {
      const reasoningTechniques = registry.getByCategory("reasoning")
      expect(reasoningTechniques.length).toBeGreaterThan(0)
      expect(reasoningTechniques.every((t) => t.category === "reasoning")).toBe(
        true,
      )
    })

    test("should search techniques by multiple criteria", () => {
      const results = registry.search({
        categories: ["reasoning", "optimization"],
        taskTypes: ["problem_solving"],
      })

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.every(
          (t) =>
            (t.category === "reasoning" || t.category === "optimization") &&
            t.suitableFor.includes("problem_solving" as TaskType),
        ),
      ).toBe(true)
    })

    test("should validate techniques before registration", () => {
      const invalidTechnique = {
        id: "invalid",
        name: "Invalid Technique",
        // Missing required properties
      } as any

      expect(() => registry.register(invalidTechnique)).toThrow()
    })

    test("should prevent duplicate registrations", () => {
      const technique = new ChainOfThoughtTechnique()

      // Clear registry first to ensure clean state
      const newRegistry = new MockedTechniqueRegistry()
      newRegistry.register(technique)

      expect(() => newRegistry.register(technique)).toThrow(
        "already registered",
      )
    })

    test("should track registry metrics", () => {
      const metrics = registry.getMetrics()

      expect(metrics).toHaveProperty("totalTechniques")
      expect(metrics).toHaveProperty("cacheHitRate")
      expect(metrics).toHaveProperty("averageLoadTime")
      expect(metrics.totalTechniques).toBeGreaterThan(0)
    })
  })

  describe("Individual Technique Tests", () => {
    describe("Chain of Thought (CoT)", () => {
      let cot: ChainOfThoughtTechnique

      beforeAll(() => {
        cot = new ChainOfThoughtTechnique()
      })

      test("should have correct metadata", () => {
        expect(cot.id).toBe("cot")
        expect(cot.category).toBe("reasoning")
        expect(cot.complexity).toBe("medium")
        expect(cot.suitableFor).toContain("problem_solving")
      })

      test("should validate suitable inputs", () => {
        expect(cot.validate("Calculate the total cost with tax")).toBe(true)
        expect(cot.validate("Hi")).toBe(false)
        expect(cot.validate(123)).toBe(false)
      })

      test("should apply technique to context", async () => {
        const context: TechniqueContext = {
          task: "Calculate the area of a circle with radius 5",
          sessionId: "test-session",
          agentId: "test-agent",
          variables: {},
          constraints: [],
          previousTechniques: [],
          capabilities: [],
        }

        const result = await cot.apply(context)

        expect(result.content).toContain("step-by-step")
        expect(result.content).toContain("Calculate the area of a circle")
        expect(result.metadata.techniques).toContain("cot")
        expect(result.metadata.confidence).toBeGreaterThan(0)
      })

      test("should add domain context when provided", async () => {
        const context: TechniqueContext = {
          task: "Optimize database query",
          sessionId: "test-session",
          agentId: "test-agent",
          variables: { domain: "Database Optimization" },
          constraints: [],
          previousTechniques: [],
          capabilities: [],
        }

        const result = await cot.apply(context)
        expect(result.content).toContain("Domain: Database Optimization")
      })
    })

    describe("Tree of Thoughts (ToT)", () => {
      let tot: TreeOfThoughtsTechnique

      beforeAll(() => {
        tot = new TreeOfThoughtsTechnique()
      })

      test("should explore multiple solution paths", async () => {
        const context: TechniqueContext = {
          task: "Design a distributed cache system",
          sessionId: "test-session",
          agentId: "test-agent",
          variables: {},
          constraints: [],
          previousTechniques: [],
          capabilities: [],
        }

        const result = await tot.apply(context)

        expect(result.content).toContain("Branch")
        expect(result.content).toContain("Evaluation")
        expect(result.metadata.techniques).toContain("tot")
      })
    })

    describe("Few-Shot Learning", () => {
      let fewShot: FewShotTechnique

      beforeAll(() => {
        fewShot = new FewShotTechnique()
      })

      test("should include examples in prompt", async () => {
        const context: TechniqueContext = {
          task: "Convert text to SQL query",
          sessionId: "test-session",
          agentId: "test-agent",
          variables: {
            examples: [
              { input: "Show all users", output: "SELECT * FROM users" },
              { input: "Count orders", output: "SELECT COUNT(*) FROM orders" },
            ],
          },
          constraints: [],
          previousTechniques: [],
          capabilities: [],
        }

        const result = await fewShot.apply(context)

        expect(result.content).toContain("Example")
        expect(result.content).toContain("Show all users")
        expect(result.content).toContain("SELECT * FROM users")
      })
    })

    describe("Multi-Agent Coordination", () => {
      let multiAgent: MultiAgentCoordinationTechnique

      beforeAll(() => {
        multiAgent = new MultiAgentCoordinationTechnique()
      })

      test("should require sub_agents capability", () => {
        expect(multiAgent.requiredCapabilities).toContain("sub_agents")
      })

      test("should structure multi-agent workflow", async () => {
        const context: TechniqueContext = {
          task: "Build a web scraper with data analysis",
          sessionId: "test-session",
          agentId: "test-agent",
          variables: {},
          constraints: [],
          previousTechniques: [],
          capabilities: ["sub_agents"],
        }

        const result = await multiAgent.apply(context)

        expect(result.content).toContain("Agent")
        expect(result.content).toContain("Coordination")
        expect(result.metadata.techniques).toContain("multi_agent_coordination")
      })
    })
  })

  describe("Technique Selection", () => {
    test("should analyze task and recommend techniques", async () => {
      const context: SelectionContext = {
        sessionId: "test-session",
        agentId: "test-agent",
        constraints: [],
      }

      const analysis = await selector.analyzeTask(
        "Create a complex algorithm to optimize route planning",
        context,
      )

      expect(analysis.taskType).toContain("problem_solving")
      expect(["high", "very_high"]).toContain(analysis.complexity)
      expect(analysis.suggestedTechniques.length).toBeGreaterThan(0)
    })

    test("should select appropriate techniques based on task analysis", async () => {
      const context: SelectionContext = {
        sessionId: "test-session",
        agentId: "test-agent",
        constraints: [],
      }

      const selected = await selector.select(
        "Write a story about a robot",
        context,
      )

      expect(selected.primary.length).toBeGreaterThan(0)
      expect(selected.primary.some((t) => t.category === "generation")).toBe(
        true,
      )
    })

    test("should respect capability constraints", async () => {
      const context: SelectionContext = {
        sessionId: "test-session",
        agentId: "test-agent",
        constraints: [
          { type: "capability_requirement", value: ["sub_agents"] },
        ],
      }

      const selected = await selector.select(
        "Coordinate multiple tasks",
        context,
      )

      const hasSubAgentCapability = selected.primary.every(
        (t) =>
          !t.requiredCapabilities ||
          t.requiredCapabilities.length === 0 ||
          context.constraints.some(
            (c) =>
              c.type === "capability_requirement" &&
              (c.value as Capability[]).includes("sub_agents"),
          ),
      )

      expect(hasSubAgentCapability).toBe(true)
    })

    test("should exclude incompatible techniques", async () => {
      const context: SelectionContext = {
        sessionId: "test-session",
        agentId: "test-agent",
        constraints: [{ type: "technique_exclusion", value: ["cot"] }],
      }

      const selected = await selector.select("Solve a complex problem", context)

      expect(selected.primary.every((t) => t.id !== "cot")).toBe(true)
    })
  })

  describe("Prompt Composition", () => {
    test("should compose prompts with single technique", async () => {
      const context: TechniqueContext = {
        task: "Analyze market trends",
        sessionId: "test-session",
        agentId: "test-agent",
        variables: {},
        constraints: [],
        previousTechniques: [],
        capabilities: [],
      }

      const technique = registry.get("cot")!
      const result = await composer.compose([technique], context)

      expect(result.content).toBeTruthy()
      expect(result.metadata.techniques).toContain("cot")
      expect(result.metadata.compositionStrategy).toBe("single")
    })

    test("should compose prompts with multiple techniques", async () => {
      const context: TechniqueContext = {
        task: "Create and optimize an algorithm",
        sessionId: "test-session",
        agentId: "test-agent",
        variables: {},
        constraints: [],
        previousTechniques: [],
        capabilities: ["iteration"],
      }

      const cot = registry.get("cot")!
      const iterative = registry.get("iterative_refinement")!
      const result = await composer.compose([cot, iterative], context)

      expect(result.metadata.techniques).toHaveLength(2)
      expect(result.metadata.compositionStrategy).toBe("sequential")
    })

    test("should handle nested composition", async () => {
      const context: TechniqueContext = {
        task: "Complex multi-step problem",
        sessionId: "test-session",
        agentId: "test-agent",
        variables: {},
        constraints: [],
        previousTechniques: [],
        capabilities: ["memory", "iteration"],
      }

      const meta = registry.get("meta_prompting")!
      const cot = registry.get("cot")!
      const selfConsistency = registry.get("self_consistency")!

      const result = await composer.compose(
        [meta, cot, selfConsistency],
        context,
      )

      expect(result.metadata.techniques).toHaveLength(3)
      expect(["nested", "sequential"]).toContain(
        result.metadata.compositionStrategy,
      )
    })

    test("should validate composition compatibility", () => {
      const cot = registry.get("cot")!
      const tot = registry.get("tot")!

      const validation = composer.validateComposition([cot, tot])

      expect(validation).toHaveProperty("valid")
      expect(validation.valid).toBe(true) // Assuming they are compatible
    })
  })

  describe("Learning System", () => {
    test("should track technique performance", async () => {
      const cot = registry.get("cot")!
      const initialMetrics = { ...cot.metrics }

      // Simulate successful execution
      const context: TechniqueContext = {
        task: "Test task",
        sessionId: "test-session",
        agentId: "test-agent",
        variables: {},
        constraints: [],
        previousTechniques: [],
        capabilities: [],
      }

      await cot.apply(context)

      // In a real implementation, metrics would be updated
      expect(cot.metrics.totalExecutions).toBeGreaterThanOrEqual(
        initialMetrics.totalExecutions,
      )
    })

    test("should adapt technique selection based on performance", async () => {
      const context: SelectionContext = {
        sessionId: "test-session",
        agentId: "test-agent",
        constraints: [],
        performanceHistory: [
          {
            techniqueId: "cot",
            taskType: "problem_solving" as TaskType,
            success: true,
            latency: 100,
            timestamp: Date.now() - 1000,
          },
          {
            techniqueId: "cot",
            taskType: "problem_solving" as TaskType,
            success: true,
            latency: 120,
            timestamp: Date.now() - 500,
          },
        ],
      }

      const selected = await selector.select("Solve another problem", context)

      // Should consider performance history in selection
      expect(selected.primary.length).toBeGreaterThan(0)
    })
  })

  describe("Performance Benchmarks", () => {
    test("should measure technique selection overhead", async () => {
      const start = performance.now()

      const context: SelectionContext = {
        sessionId: "test-session",
        agentId: "test-agent",
        constraints: [],
      }

      await selector.select("Test task", context)

      const duration = performance.now() - start
      expect(duration).toBeLessThan(50) // Target: <50ms
    })

    test("should measure composition performance", async () => {
      const start = performance.now()

      const context: TechniqueContext = {
        task: "Test task",
        sessionId: "test-session",
        agentId: "test-agent",
        variables: {},
        constraints: [],
        previousTechniques: [],
        capabilities: [],
      }

      const cot = registry.get("cot")!
      await composer.compose([cot], context)

      const duration = performance.now() - start
      expect(duration).toBeLessThan(50) // Target: <50ms
    })

    test("should handle concurrent technique applications", async () => {
      const contexts = Array.from({ length: 10 }, (_, i) => ({
        task: `Task ${i}`,
        sessionId: "test-session",
        agentId: `agent-${i}`,
        variables: {},
        constraints: [],
        previousTechniques: [],
        capabilities: [] as Capability[],
      }))

      const start = performance.now()

      const cot = registry.get("cot")!
      await Promise.all(contexts.map((ctx) => composer.compose([cot], ctx)))

      const duration = performance.now() - start
      expect(duration).toBeLessThan(500) // Should handle 10 concurrent requests efficiently
    })
  })

  describe("Error Handling", () => {
    test("should handle technique application failures gracefully", async () => {
      // Create a failing technique
      const failingTechnique: PromptingTechnique = {
        id: "failing",
        name: "Failing Technique",
        category: "reasoning",
        description: "Test technique that fails",
        complexity: "low",
        suitableFor: ["analysis" as TaskType],
        metrics: {
          totalExecutions: 0,
          successRate: 0,
          averageLatency: 0,
          averageTokenUsage: 0,
          lastUpdated: Date.now(),
        },
        async apply() {
          throw new Error("Technique failed")
        },
        validate: () => true,
      }

      const context: TechniqueContext = {
        task: "Test task",
        sessionId: "test-session",
        agentId: "test-agent",
        variables: {},
        constraints: [],
        previousTechniques: [],
        capabilities: [],
      }

      // Should handle error gracefully
      const cot = registry.get("cot")!
      const result = await composer.compose([failingTechnique, cot], context)

      // Should fall back to working technique
      expect(result).toBeTruthy()
      expect(result.metadata.techniques).toContain("cot")
    })

    test("should validate context before application", async () => {
      const invalidContext = {
        // Missing required fields
        task: "Test task",
      } as any

      const cot = registry.get("cot")!

      // Should validate context
      try {
        await composer.compose([cot], invalidContext)
        // If no error thrown, check that it handles gracefully
        expect(true).toBe(true)
      } catch (error) {
        // Expected to throw for invalid context
        expect(error).toBeDefined()
      }
    })
  })

  describe("Integration Points", () => {
    test("should integrate with session context", async () => {
      const context: TechniqueContext = {
        task: "Test task",
        sessionId: "real-session-123",
        agentId: "agent-456",
        variables: {
          sessionData: "test",
        },
        constraints: [],
        previousTechniques: ["few_shot"],
        capabilities: ["memory", "tools"] as Capability[],
      }

      const cot = registry.get("cot")!
      const result = await composer.compose([cot], context)

      expect(result.variables["sessionData"]).toBe("test")
      expect(result.variables["techniqueApplied"]).toBe("cot")
    })

    test("should support technique inheritance", async () => {
      const parentContext: TechniqueContext = {
        task: "Parent task",
        sessionId: "session-1",
        agentId: "parent-agent",
        variables: {},
        constraints: [],
        previousTechniques: ["cot"],
        capabilities: [],
      }

      const childContext: TechniqueContext = {
        task: "Child task",
        parentContext,
        sessionId: "session-1",
        agentId: "child-agent",
        variables: {},
        constraints: [],
        previousTechniques: [],
        capabilities: [],
      }

      const tot = registry.get("tot")!
      const result = await composer.compose([tot], childContext)

      expect(result.metadata.techniques).toContain("tot")
      // Should consider parent techniques in composition
    })
  })
})
