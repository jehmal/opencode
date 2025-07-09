import type { PromptingTechnique } from "../types"
import { Glob } from "bun"
import path from "path"

export class TechniqueLoader {
  private loadTimes: number[] = []
  private techniquesPath: string

  constructor() {
    this.techniquesPath = path.join(__dirname, "..", "techniques")
  }

  async loadAll(): Promise<PromptingTechnique[]> {
    const start = performance.now()
    const techniques: PromptingTechnique[] = []
    const errors: Array<{ file: string; error: Error }> = []

    try {
      // Find all technique files
      const glob = new Glob("**/*.ts")
      const files: string[] = []

      for await (const file of glob.scan({
        cwd: this.techniquesPath,
        onlyFiles: true,
      })) {
        // Skip index, test, and spec files
        if (
          !file.includes("index.ts") &&
          !file.includes(".test.ts") &&
          !file.includes(".spec.ts")
        ) {
          files.push(path.join(this.techniquesPath, file))
        }
      }

      // Load techniques in parallel
      const loadPromises = files.map(async (file: string) => {
        try {
          const techniqueStart = performance.now()

          // Dynamic import
          const module = await import(file)

          // Find technique class in exports
          const techniqueClass = this.findTechniqueClass(module)

          if (techniqueClass) {
            const instance = new techniqueClass()

            // Validate it implements PromptingTechnique
            if (this.isValidTechnique(instance)) {
              techniques.push(instance)

              const loadTime = performance.now() - techniqueStart
              this.loadTimes.push(loadTime)
            } else {
              errors.push({
                file,
                error: new Error("Invalid technique implementation"),
              })
            }
          } else {
            errors.push({
              file,
              error: new Error("No technique class found in module"),
            })
          }
        } catch (error) {
          errors.push({
            file,
            error: error instanceof Error ? error : new Error(String(error)),
          })
        }
      })

      await Promise.all(loadPromises)

      // Log errors if any
      if (errors.length > 0) {
        console.error(`Failed to load ${errors.length} techniques:`)
        errors.forEach(({ file, error }) => {
          console.error(`  - ${path.basename(file)}: ${error.message}`)
        })
      }

      return techniques
    } catch (error) {
      console.error("Failed to load techniques:", error)
      throw error
    }
  }

  async loadByCategory(category: string): Promise<PromptingTechnique[]> {
    const categoryPath = path.join(this.techniquesPath, category)
    const techniques: PromptingTechnique[] = []

    try {
      const glob = new Glob("*.ts")

      for await (const file of glob.scan({
        cwd: categoryPath,
        onlyFiles: true,
      })) {
        // Skip index, test, and spec files
        if (
          !file.includes("index.ts") &&
          !file.includes(".test.ts") &&
          !file.includes(".spec.ts")
        ) {
          try {
            const fullPath = path.join(categoryPath, file)
            const module = await import(fullPath)
            const techniqueClass = this.findTechniqueClass(module)

            if (techniqueClass) {
              const instance = new techniqueClass()
              if (this.isValidTechnique(instance)) {
                techniques.push(instance)
              }
            }
          } catch (error) {
            console.error(`Failed to load technique from ${file}:`, error)
          }
        }
      }

      return techniques
    } catch (error) {
      console.error(
        `Failed to load techniques from category ${category}:`,
        error,
      )
      return []
    }
  }

  async loadSingle(techniqueId: string): Promise<PromptingTechnique | null> {
    try {
      // Search for the technique file
      const glob = new Glob("**/*.ts")

      for await (const file of glob.scan({
        cwd: this.techniquesPath,
        onlyFiles: true,
      })) {
        // Skip index, test, and spec files
        if (
          !file.includes("index.ts") &&
          !file.includes(".test.ts") &&
          !file.includes(".spec.ts")
        ) {
          try {
            const fullPath = path.join(this.techniquesPath, file)
            const module = await import(fullPath)
            const techniqueClass = this.findTechniqueClass(module)

            if (techniqueClass) {
              const instance = new techniqueClass()
              if (
                this.isValidTechnique(instance) &&
                instance.id === techniqueId
              ) {
                return instance
              }
            }
          } catch (error) {
            // Continue searching
          }
        }
      }

      return null
    } catch (error) {
      console.error(`Failed to load technique ${techniqueId}:`, error)
      return null
    }
  }

  private findTechniqueClass(module: any): any {
    // Look for exported classes that end with "Technique"
    for (const key of Object.keys(module)) {
      const exported = module[key]

      if (
        typeof exported === "function" &&
        exported.prototype &&
        key.endsWith("Technique")
      ) {
        return exported
      }
    }

    // Fallback: check default export
    if (module.default && typeof module.default === "function") {
      return module.default
    }

    return null
  }

  private isValidTechnique(instance: any): instance is PromptingTechnique {
    return (
      instance &&
      typeof instance.id === "string" &&
      typeof instance.name === "string" &&
      typeof instance.category === "string" &&
      typeof instance.apply === "function" &&
      typeof instance.validate === "function" &&
      instance.complexity &&
      Array.isArray(instance.suitableFor)
    )
  }

  getAverageLoadTime(): number {
    if (this.loadTimes.length === 0) return 0

    const sum = this.loadTimes.reduce((acc, time) => acc + time, 0)
    return sum / this.loadTimes.length
  }

  getLoadStatistics(): {
    totalLoaded: number
    averageLoadTime: number
    minLoadTime: number
    maxLoadTime: number
  } {
    if (this.loadTimes.length === 0) {
      return {
        totalLoaded: 0,
        averageLoadTime: 0,
        minLoadTime: 0,
        maxLoadTime: 0,
      }
    }

    return {
      totalLoaded: this.loadTimes.length,
      averageLoadTime: this.getAverageLoadTime(),
      minLoadTime: Math.min(...this.loadTimes),
      maxLoadTime: Math.max(...this.loadTimes),
    }
  }
}
