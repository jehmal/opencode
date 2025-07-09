import type { PromptingTechnique, TechniqueCategory } from "../types"
import { TechniqueCache } from "./technique-cache"
import { TechniqueLoader } from "./technique-loader"

export class TechniqueRegistry {
  private techniques: Map<string, PromptingTechnique> = new Map()
  private cache: TechniqueCache
  private loader: TechniqueLoader
  private initialized = false

  constructor() {
    this.cache = new TechniqueCache()
    this.loader = new TechniqueLoader()
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    const start = performance.now()

    // Load all techniques from definitions
    const techniques = await this.loader.loadAll()

    // Register each technique
    for (const technique of techniques) {
      this.register(technique)
    }

    // Warm up cache
    await this.cache.warmUp(techniques)

    const duration = performance.now() - start

    this.initialized = true
  }

  register(technique: PromptingTechnique): void {
    if (this.techniques.has(technique.id)) {
      throw new Error(`Technique ${technique.id} already registered`)
    }

    // Validate technique
    if (!this.validateTechnique(technique)) {
      throw new Error(`Invalid technique: ${technique.id}`)
    }

    this.techniques.set(technique.id, technique)
    this.cache.set(technique.id, technique)
  }

  get(id: string): PromptingTechnique | undefined {
    // Try cache first
    const cached = this.cache.get(id)
    if (cached) return cached

    // Fall back to registry
    const technique = this.techniques.get(id)
    if (technique) {
      this.cache.set(id, technique)
    }

    return technique
  }

  getByCategory(category: TechniqueCategory): PromptingTechnique[] {
    const results: PromptingTechnique[] = []

    for (const technique of this.techniques.values()) {
      if (technique.category === category) {
        results.push(technique)
      }
    }

    return results
  }

  getAll(): PromptingTechnique[] {
    return Array.from(this.techniques.values())
  }

  search(query: {
    categories?: TechniqueCategory[]
    capabilities?: string[]
    taskTypes?: string[]
  }): PromptingTechnique[] {
    let results = this.getAll()

    if (query.categories?.length) {
      results = results.filter((t) => query.categories!.includes(t.category))
    }

    if (query.capabilities?.length) {
      results = results.filter((t) =>
        query.capabilities!.every(
          (cap) => t.requiredCapabilities?.includes(cap as any) ?? false,
        ),
      )
    }

    if (query.taskTypes?.length) {
      results = results.filter((t) =>
        query.taskTypes!.some((type) => t.suitableFor.includes(type as any)),
      )
    }

    return results
  }

  private validateTechnique(technique: PromptingTechnique): boolean {
    return !!(
      technique.id &&
      technique.name &&
      technique.category &&
      typeof technique.apply === "function" &&
      typeof technique.validate === "function" &&
      technique.complexity &&
      technique.suitableFor?.length
    )
  }

  // Performance metrics
  getMetrics(): {
    totalTechniques: number
    cacheHitRate: number
    averageLoadTime: number
  } {
    return {
      totalTechniques: this.techniques.size,
      cacheHitRate: this.cache.getHitRate(),
      averageLoadTime: this.loader.getAverageLoadTime(),
    }
  }
}
