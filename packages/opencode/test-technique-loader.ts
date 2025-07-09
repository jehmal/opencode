import { TechniqueRegistry } from "./src/prompting/registry"

async function testLoader() {
  console.log("Testing TechniqueLoader and TechniqueRegistry...")

  const registry = new TechniqueRegistry()

  console.log("Initializing registry...")
  await registry.initialize()

  const allTechniques = registry.getAll()
  console.log(`\nLoaded ${allTechniques.length} techniques:`)

  // Group by category
  const byCategory = allTechniques.reduce(
    (acc, t) => {
      if (!acc[t.category]) acc[t.category] = []
      acc[t.category].push(t)
      return acc
    },
    {} as Record<string, typeof allTechniques>,
  )

  Object.entries(byCategory).forEach(([category, techniques]) => {
    console.log(`\n${category} (${techniques.length}):`)
    techniques.forEach((t) => {
      console.log(`  - ${t.id}: ${t.name}`)
    })
  })

  // Test cache metrics
  console.log("\nCache metrics:")
  const metrics = registry.getMetrics()
  console.log(`  Total techniques: ${metrics.totalTechniques}`)
  console.log(`  Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%`)
  console.log(`  Average load time: ${metrics.averageLoadTime.toFixed(2)}ms`)

  // Test search
  console.log(
    "\nSearching for reasoning techniques suitable for problem_solving:",
  )
  const searchResults = registry.search({
    categories: ["reasoning"],
    taskTypes: ["problem_solving"],
  })
  searchResults.forEach((t) => {
    console.log(`  - ${t.name}`)
  })
}

testLoader().catch(console.error)
