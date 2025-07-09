import type { PromptingTechnique } from "../types"

interface CacheEntry {
  technique: PromptingTechnique
  lastAccessed: number
  accessCount: number
}

export class TechniqueCache {
  private cache: Map<string, CacheEntry> = new Map()
  private maxSize: number
  private hits = 0
  private misses = 0

  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }

  set(id: string, technique: PromptingTechnique): void {
    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(id)) {
      this.evictLRU()
    }

    this.cache.set(id, {
      technique,
      lastAccessed: Date.now(),
      accessCount: 0,
    })
  }

  get(id: string): PromptingTechnique | undefined {
    const entry = this.cache.get(id)

    if (entry) {
      this.hits++
      entry.lastAccessed = Date.now()
      entry.accessCount++
      return entry.technique
    }

    this.misses++
    return undefined
  }

  has(id: string): boolean {
    return this.cache.has(id)
  }

  delete(id: string): boolean {
    return this.cache.delete(id)
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  async warmUp(techniques: PromptingTechnique[]): Promise<void> {
    // Sort by priority (could be based on historical usage, complexity, etc.)
    const prioritized = this.prioritizeTechniques(techniques)

    // Add to cache up to maxSize
    const toCache = prioritized.slice(0, this.maxSize)

    for (const technique of toCache) {
      this.set(technique.id, technique)
    }
  }

  private prioritizeTechniques(
    techniques: PromptingTechnique[],
  ): PromptingTechnique[] {
    // Priority based on:
    // 1. Commonly used categories
    // 2. Lower complexity (faster to execute)
    // 3. Broader applicability

    const categoryPriority: Record<string, number> = {
      reasoning: 10,
      generation: 8,
      optimization: 6,
      advanced: 4,
      "multi-agent": 2,
    }

    const complexityScore: Record<string, number> = {
      low: 3,
      medium: 2,
      high: 1,
    }

    return techniques.sort((a, b) => {
      const aCategoryScore = categoryPriority[a.category] || 0
      const bCategoryScore = categoryPriority[b.category] || 0

      const aComplexityScore = complexityScore[a.complexity] || 0
      const bComplexityScore = complexityScore[b.complexity] || 0

      const aApplicability = a.suitableFor.length
      const bApplicability = b.suitableFor.length

      const aTotal = aCategoryScore + aComplexityScore + aApplicability
      const bTotal = bCategoryScore + bComplexityScore + bApplicability

      return bTotal - aTotal
    })
  }

  private evictLRU(): void {
    let lruKey: string | null = null
    let lruTime = Infinity

    // Find least recently used
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed
        lruKey = key
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey)
    }
  }

  getHitRate(): number {
    const total = this.hits + this.misses
    return total === 0 ? 0 : this.hits / total
  }

  getStatistics(): {
    size: number
    maxSize: number
    hits: number
    misses: number
    hitRate: number
    mostAccessed: Array<{ id: string; count: number }>
  } {
    const entries = Array.from(this.cache.entries())
    const mostAccessed = entries
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, 5)
      .map(([id, entry]) => ({ id, count: entry.accessCount }))

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
      mostAccessed,
    }
  }

  // Resize cache
  resize(newSize: number): void {
    if (newSize < this.cache.size) {
      // Need to evict entries
      const entriesToEvict = this.cache.size - newSize

      // Sort by last accessed time
      const sorted = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].lastAccessed - b[1].lastAccessed,
      )

      // Evict oldest entries
      for (let i = 0; i < entriesToEvict; i++) {
        this.cache.delete(sorted[i][0])
      }
    }

    this.maxSize = newSize
  }
}
