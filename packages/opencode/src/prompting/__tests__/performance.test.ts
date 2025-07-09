import { describe, test, expect, beforeAll } from "bun:test"
import { TechniqueRegistry } from "../registry/technique-registry"
import { TechniqueSelector } from "../selector/technique-selector"
import { PromptComposer } from "../composer/prompt-composer"
import type {
  TechniqueContext,
  SelectionContext,
  PromptingTechnique,
  TaskType,
  Capability,
} from "../types"

// Performance tracking utilities
class PerformanceMeasurer {
  private measurements: Map<string, number[]> = new Map()

  measure<T>(name: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const duration = performance.now() - start

    if (!this.measurements.has(name)) {
      this.measurements.set(name, [])
    }
    this.measurements.get(name)!.push(duration)

    return result
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const result = await fn()
    const duration = performance.now() - start

    if (!this.measurements.has(name)) {
      this.measurements.set(name, [])
    }
    this.measurements.get(name)!.push(duration)

    return result
  }

  getStats(name: string): {
    count: number
    min: number
    max: number
    avg: number
    p50: number
    p90: number
    p99: number
  } | null {
    const measurements = this.measurements.get(name)
    if (!measurements || measurements.length === 0) return null

    const sorted = [...measurements].sort((a, b) => a - b)
    const count = sorted.length

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / count,
      p50: sorted[Math.floor(count * 0.5)],
      p90: sorted[Math.floor(count * 0.9)],
      p99: sorted[Math.floor(count * 0.99)],
    }
  }

  clear(): void {
    this.measurements.clear()
  }

  report(): void {
    console.log("\n=== Performance Report ===")
    for (const [name, measurements] of this.measurements) {
      const stats = this.getStats(name)
      if (stats) {
        console.log(`\n${name}:`)
        console.log(`  Samples: ${stats.count}`)
        console.log(`  Min: ${stats.min.toFixed(2)}ms`)
        console.log(`  Max: ${stats.max.toFixed(2)}ms`)
        console.log(`  Avg: ${stats.avg.toFixed(2)}ms`)
        console.log(`  P50: ${stats.p50.toFixed(2)}ms`)
        console.log(`  P90: ${stats.p90.toFixed(2)}ms`)
        console.log(`  P99: ${stats.p99.toFixed(2)}ms`)
      }
    }
  }
}

// Mock components for isolated performance testing
class MockTechniqueLoader {
  private techniques: PromptingTechnique[] = []

  constructor() {
    // Pre-create techniques to avoid initialization overhead
    this.techniques = this.createMockTechniques()
  }

  async loadAll(): Promise<PromptingTechnique[]> {
    // Simulate async loading with minimal overhead
    await new Promise((resolve) => setImmediate(resolve))
    return this.techniques
  }

  private createMockTechniques(): PromptingTechnique[] {
    const categories = [
      "reasoning",
      "generation",
      "optimization",
      "multi_agent",
      "advanced",
    ]
    const complexities = ["low", "medium", "high", "very_high"] as const
    const taskTypes: TaskType[] = [
      "analysis",
      "generation",
      "problem_solving",
      "coordination",
      "refinement",
      "exploration",
    ]

    return Array.from({ length: 20 }, (_, i) => ({
      id: `technique_${i}`,
      name: `Test Technique ${i}`,
      category: categories[i % categories.length] as any,
      description: `Test technique ${i} for performance testing`,
      complexity: complexities[i % complexities.length],
      suitableFor: taskTypes.slice(0, (i % 3) + 1),
      requiredCapabilities: i % 4 === 0 ? ["sub_agents" as Capability] : [],
      metrics: {
        totalExecutions: Math.floor(Math.random() * 1000),
        successRate: 0.8 + Math.random() * 0.2,
        averageLatency: 10 + Math.random() * 40,
        averageTokenUsage: 500 + Math.random() * 1500,
        lastUpdated: Date.now(),
      },
      async apply(context: TechniqueContext) {
        // Simulate minimal processing
        const content = `Applied ${this.id} to: ${context.task}`
        return {
          content,
          metadata: {
            techniques: [this.id],
            confidence: 0.8 + Math.random() * 0.2,
            estimatedTokens: content.split(/\s+/).length * 1.3,
            compositionStrategy: "single",
          },
          variables: context.variables,
        }
      },
      validate: (input: any) => typeof input === "string" && input.length > 10,
    }))
  }

  getAverageLoadTime(): number {
    return 5 // Mock value
  }
}

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
}

class PerformanceOptimizedRegistry extends TechniqueRegistry {
  constructor() {
    super()
    // @ts-ignore
    this.cache = new MockTechniqueCache()
    // @ts-ignore
    this.loader = new MockTechniqueLoader()
  }
}

describe("Prompting System Performance Tests", () => {
  let registry: TechniqueRegistry
  let selector: TechniqueSelector
  let composer: PromptComposer
  let perf: PerformanceMeasurer

  beforeAll(async () => {
    perf = new PerformanceMeasurer()

    // Initialize with performance-optimized mocks
    registry = new PerformanceOptimizedRegistry()
    await registry.initialize()

    selector = new TechniqueSelector(registry)
    composer = new PromptComposer(registry)
  })

  describe("Technique Selection Performance", () => {
    test("should select techniques within 50ms target", async () => {
      const tasks = [
        "Simple analysis task",
        "Complex algorithm optimization with multiple constraints",
        "Generate creative content with specific requirements",
        "Coordinate multiple agents for distributed processing",
        "Refine and optimize existing solution iteratively",
      ]

      for (const task of tasks) {
        const context: SelectionContext = {
          sessionId: `perf-${Math.random()}`,
          agentId: `agent-${Math.random()}`,
          constraints: [],
        }

        await perf.measureAsync("technique_selection", async () => {
          await selector.select(task, context)
        })
      }

      const stats = perf.getStats("technique_selection")
      expect(stats).toBeTruthy()
      expect(stats!.avg).toBeLessThan(50)
      expect(stats!.p90).toBeLessThan(50)
    })

    test("should handle constraint filtering efficiently", async () => {
      const constraints = [
        [{ type: "token_limit" as const, value: 1000 }],
        [{ type: "time_limit" as const, value: 5000 }],
        [
          {
            type: "technique_exclusion" as const,
            value: ["technique_1", "technique_5"],
          },
        ],
        [{ type: "capability_requirement" as const, value: ["sub_agents"] }],
      ]

      for (const constraintSet of constraints) {
        const context: SelectionContext = {
          sessionId: "perf-session",
          agentId: "perf-agent",
          constraints: constraintSet,
        }

        await perf.measureAsync("constrained_selection", async () => {
          await selector.select(
            "Complex task requiring specific capabilities",
            context,
          )
        })
      }

      const stats = perf.getStats("constrained_selection")
      expect(stats!.avg).toBeLessThan(50)
    })
  })

  describe("Prompt Composition Performance", () => {
    test("should compose single technique prompts efficiently", async () => {
      const techniques = registry.getAll().slice(0, 5)

      for (const technique of techniques) {
        const context: TechniqueContext = {
          task: "Test task for performance measurement",
          sessionId: "perf-session",
          agentId: "perf-agent",
          variables: {},
          constraints: [],
          previousTechniques: [],
          capabilities: [],
        }

        await perf.measureAsync("single_composition", async () => {
          await composer.compose([technique], context)
        })
      }

      const stats = perf.getStats("single_composition")
      expect(stats!.avg).toBeLessThan(20)
      expect(stats!.p99).toBeLessThan(30)
    })

    test("should compose multiple techniques efficiently", async () => {
      const techniqueSets = [
        registry.getAll().slice(0, 2),
        registry.getAll().slice(0, 3),
        registry.getAll().slice(0, 5),
      ]

      for (const techniques of techniqueSets) {
        const context: TechniqueContext = {
          task: "Complex task requiring multiple techniques",
          sessionId: "perf-session",
          agentId: "perf-agent",
          variables: { complexity: "high" },
          constraints: [],
          previousTechniques: [],
          capabilities: ["memory", "tools"],
        }

        await perf.measureAsync(
          `composition_${techniques.length}_techniques`,
          async () => {
            await composer.compose(techniques, context)
          },
        )
      }

      const stats2 = perf.getStats("composition_2_techniques")
      const stats3 = perf.getStats("composition_3_techniques")
      const stats5 = perf.getStats("composition_5_techniques")

      expect(stats2!.avg).toBeLessThan(30)
      expect(stats3!.avg).toBeLessThan(40)
      expect(stats5!.avg).toBeLessThan(50)
    })
  })

  describe("Registry Performance", () => {
    test("should retrieve techniques by ID with cache efficiency", () => {
      const techniqueIds = Array.from(
        { length: 20 },
        (_, i) => `technique_${i}`,
      )

      // First pass - cache misses
      for (const id of techniqueIds) {
        perf.measure("registry_get_cold", () => {
          registry.get(id)
        })
      }

      // Second pass - cache hits
      for (const id of techniqueIds) {
        perf.measure("registry_get_warm", () => {
          registry.get(id)
        })
      }

      const coldStats = perf.getStats("registry_get_cold")
      const warmStats = perf.getStats("registry_get_warm")

      expect(warmStats!.avg).toBeLessThan(coldStats!.avg * 0.5) // Warm cache should be at least 2x faster
      expect(warmStats!.avg).toBeLessThan(1) // Sub-millisecond for cached access
    })

    test("should search techniques efficiently", () => {
      const queries = [
        { categories: ["reasoning"] },
        { taskTypes: ["problem_solving", "analysis"] },
        { capabilities: ["sub_agents"] },
        { categories: ["optimization"], taskTypes: ["refinement"] },
      ]

      for (const query of queries) {
        perf.measure("registry_search", () => {
          registry.search(query as any)
        })
      }

      const stats = perf.getStats("registry_search")
      expect(stats!.avg).toBeLessThan(5)
      expect(stats!.p90).toBeLessThan(10)
    })
  })

  describe("Concurrent Operations", () => {
    test("should handle concurrent selections efficiently", async () => {
      const concurrentCounts = [10, 20, 50]

      for (const count of concurrentCounts) {
        const start = performance.now()

        const promises = Array.from({ length: count }, (_, i) =>
          selector.select(`Task ${i}`, {
            sessionId: `concurrent-${i}`,
            agentId: `agent-${i}`,
            constraints: [],
          }),
        )

        await Promise.all(promises)

        const duration = performance.now() - start
        perf.measurements.set(`concurrent_${count}_selections`, [duration])

        // Should scale sub-linearly
        expect(duration).toBeLessThan(count * 10) // Less than 10ms per selection
      }
    })

    test("should handle concurrent compositions efficiently", async () => {
      const technique = registry.get("technique_0")!
      const count = 30

      const start = performance.now()

      const promises = Array.from({ length: count }, (_, i) =>
        composer.compose([technique], {
          task: `Concurrent task ${i}`,
          sessionId: `session-${i}`,
          agentId: `agent-${i}`,
          variables: {},
          constraints: [],
          previousTechniques: [],
          capabilities: [],
        }),
      )

      await Promise.all(promises)

      const duration = performance.now() - start

      expect(duration).toBeLessThan(count * 5) // Less than 5ms per composition
      console.log(
        `Concurrent compositions (${count}): ${duration.toFixed(2)}ms`,
      )
    })
  })

  describe("Memory and Resource Usage", () => {
    test("should maintain stable performance over many operations", async () => {
      const iterations = 100
      const batchSize = 10

      for (let batch = 0; batch < iterations / batchSize; batch++) {
        const batchStart = performance.now()

        for (let i = 0; i < batchSize; i++) {
          const task = `Iteration ${batch * batchSize + i}`
          const context: SelectionContext = {
            sessionId: "stability-test",
            agentId: "stability-agent",
            constraints: [],
          }

          await perf.measureAsync("stability_test", async () => {
            const selected = await selector.select(task, context)
            await composer.compose(selected.primary, {
              task,
              sessionId: context.sessionId,
              agentId: context.agentId,
              variables: {},
              constraints: [],
              previousTechniques: [],
              capabilities: [],
            })
          })
        }

        const batchDuration = performance.now() - batchStart
        console.log(`Batch ${batch + 1}: ${batchDuration.toFixed(2)}ms`)
      }

      const stats = perf.getStats("stability_test")

      // Performance should remain stable
      const firstHalf = perf.measurements
        .get("stability_test")!
        .slice(0, iterations / 2)
      const secondHalf = perf.measurements
        .get("stability_test")!
        .slice(iterations / 2)

      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const secondAvg =
        secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

      // Second half should not be significantly slower (within 20%)
      expect(secondAvg).toBeLessThan(firstAvg * 1.2)
    })
  })

  describe("Edge Cases and Stress Tests", () => {
    test("should handle very long tasks efficiently", async () => {
      const longTasks = [
        "x".repeat(100),
        "word ".repeat(100),
        "This is a very complex task that requires multiple steps and considerations. ".repeat(
          10,
        ),
      ]

      for (const task of longTasks) {
        await perf.measureAsync("long_task_processing", async () => {
          const selected = await selector.select(task, {
            sessionId: "long-task",
            agentId: "long-agent",
            constraints: [],
          })

          await composer.compose(selected.primary, {
            task,
            sessionId: "long-task",
            agentId: "long-agent",
            variables: {},
            constraints: [],
            previousTechniques: [],
            capabilities: [],
          })
        })
      }

      const stats = perf.getStats("long_task_processing")
      expect(stats!.avg).toBeLessThan(100) // Should still be reasonably fast
    })

    test("should handle many constraints efficiently", async () => {
      const manyConstraints = [
        { type: "token_limit" as const, value: 1000 },
        { type: "time_limit" as const, value: 5000 },
        {
          type: "technique_exclusion" as const,
          value: ["t1", "t2", "t3", "t4", "t5"],
        },
        { type: "capability_requirement" as const, value: ["memory", "tools"] },
      ]

      await perf.measureAsync("many_constraints", async () => {
        await selector.select("Task with many constraints", {
          sessionId: "constrained",
          agentId: "constrained-agent",
          constraints: manyConstraints,
        })
      })

      const stats = perf.getStats("many_constraints")
      expect(stats!.avg).toBeLessThan(50)
    })
  })

  afterAll(() => {
    // Print performance report
    perf.report()
  })
})
