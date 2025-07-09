import { describe, it, expect } from "bun:test"
import { TechniqueLoader } from "../../src/prompting/registry/technique-loader"
import { TechniqueCache } from "../../src/prompting/registry/technique-cache"
import { TechniqueRegistry } from "../../src/prompting/registry/technique-registry"

describe("TechniqueLoader", () => {
  it("should load all techniques", async () => {
    const loader = new TechniqueLoader()
    const techniques = await loader.loadAll()

    expect(techniques.length).toBeGreaterThan(0)
    expect(techniques.length).toBe(18) // We have 18 techniques

    // Check that each technique has required properties
    techniques.forEach((technique) => {
      expect(technique.id).toBeDefined()
      expect(technique.name).toBeDefined()
      expect(technique.category).toBeDefined()
      expect(technique.apply).toBeDefined()
      expect(technique.validate).toBeDefined()
    })
  })

  it("should load techniques by category", async () => {
    const loader = new TechniqueLoader()
    const reasoningTechniques = await loader.loadByCategory("reasoning")

    expect(reasoningTechniques.length).toBeGreaterThan(0)
    reasoningTechniques.forEach((technique) => {
      expect(technique.category).toBe("reasoning")
    })
  })

  it("should load a single technique by ID", async () => {
    const loader = new TechniqueLoader()
    const technique = await loader.loadSingle("cot")

    expect(technique).toBeDefined()
    expect(technique?.id).toBe("cot")
    expect(technique?.name).toBe("Chain of Thought (CoT)")
  })

  it("should track load times", async () => {
    const loader = new TechniqueLoader()
    await loader.loadAll()

    const stats = loader.getLoadStatistics()
    expect(stats.totalLoaded).toBeGreaterThan(0)
    expect(stats.averageLoadTime).toBeGreaterThan(0)
    expect(stats.minLoadTime).toBeGreaterThan(0)
    expect(stats.maxLoadTime).toBeGreaterThan(0)
  })
})

describe("TechniqueCache", () => {
  it("should cache and retrieve techniques", () => {
    const cache = new TechniqueCache(10)
    const mockTechnique = {
      id: "test",
      name: "Test Technique",
      category: "test" as const,
      description: "Test",
      complexity: "low" as const,
      suitableFor: ["analysis"] as const,
      apply: async () => ({ content: "", metadata: {}, variables: {} }),
      validate: () => true,
    }

    cache.set("test", mockTechnique)
    const retrieved = cache.get("test")

    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe("test")
  })

  it("should track hit rate", () => {
    const cache = new TechniqueCache(10)
    const mockTechnique = {
      id: "test",
      name: "Test Technique",
      category: "test" as const,
      description: "Test",
      complexity: "low" as const,
      suitableFor: ["analysis"] as const,
      apply: async () => ({ content: "", metadata: {}, variables: {} }),
      validate: () => true,
    }

    cache.set("test", mockTechnique)

    // Hit
    cache.get("test")
    // Miss
    cache.get("nonexistent")

    const hitRate = cache.getHitRate()
    expect(hitRate).toBe(0.5) // 1 hit, 1 miss
  })

  it("should evict LRU when full", () => {
    const cache = new TechniqueCache(2)

    const technique1 = {
      id: "test1",
      name: "Test 1",
      category: "test" as const,
      description: "Test",
      complexity: "low" as const,
      suitableFor: ["analysis"] as const,
      apply: async () => ({ content: "", metadata: {}, variables: {} }),
      validate: () => true,
    }

    const technique2 = {
      id: "test2",
      name: "Test 2",
      category: "test" as const,
      description: "Test",
      complexity: "low" as const,
      suitableFor: ["analysis"] as const,
      apply: async () => ({ content: "", metadata: {}, variables: {} }),
      validate: () => true,
    }

    const technique3 = {
      id: "test3",
      name: "Test 3",
      category: "test" as const,
      description: "Test",
      complexity: "low" as const,
      suitableFor: ["analysis"] as const,
      apply: async () => ({ content: "", metadata: {}, variables: {} }),
      validate: () => true,
    }

    cache.set("test1", technique1)
    cache.set("test2", technique2)

    // Access test2 to make it more recent
    cache.get("test2")

    // Add test3, should evict test1
    cache.set("test3", technique3)

    expect(cache.get("test1")).toBeUndefined()
    expect(cache.get("test2")).toBeDefined()
    expect(cache.get("test3")).toBeDefined()
  })
})

describe("TechniqueRegistry", () => {
  it("should initialize and load all techniques", async () => {
    const registry = new TechniqueRegistry()
    await registry.initialize()

    const allTechniques = registry.getAll()
    expect(allTechniques.length).toBe(18)
  })

  it("should get techniques by category", async () => {
    const registry = new TechniqueRegistry()
    await registry.initialize()

    const reasoningTechniques = registry.getByCategory("reasoning")
    expect(reasoningTechniques.length).toBeGreaterThan(0)
    reasoningTechniques.forEach((technique) => {
      expect(technique.category).toBe("reasoning")
    })
  })

  it("should search techniques", async () => {
    const registry = new TechniqueRegistry()
    await registry.initialize()

    const results = registry.search({
      categories: ["reasoning"],
      taskTypes: ["problem_solving"],
    })

    expect(results.length).toBeGreaterThan(0)
    results.forEach((technique) => {
      expect(technique.category).toBe("reasoning")
      expect(technique.suitableFor).toContain("problem_solving")
    })
  })

  it("should provide metrics", async () => {
    const registry = new TechniqueRegistry()
    await registry.initialize()

    const metrics = registry.getMetrics()
    expect(metrics.totalTechniques).toBe(18)
    expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0)
    expect(metrics.averageLoadTime).toBeGreaterThan(0)
  })
})
