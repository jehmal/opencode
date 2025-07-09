#!/usr/bin/env bun

import { TechniqueRegistry } from "./src/prompting/registry/technique-registry"

async function testAllTechniques() {
  console.log("🧪 Testing All 18 Prompting Techniques")
  console.log("=====================================\n")

  const registry = new TechniqueRegistry()
  await registry.initialize()

  const all = registry.getAll()
  console.log(`✅ Successfully loaded ${all.length} techniques:\n`)

  // Group by category
  const byCategory = new Map<string, typeof all>()
  for (const technique of all) {
    const category = technique.category
    if (!byCategory.has(category)) {
      byCategory.set(category, [])
    }
    byCategory.get(category)!.push(technique)
  }

  // Display all techniques by category
  for (const [category, techniques] of byCategory) {
    console.log(`📁 ${category.toUpperCase()} (${techniques.length})`)
    for (const t of techniques) {
      console.log(`   ✓ ${t.name} (${t.id})`)
      console.log(`     ${t.description}`)
    }
    console.log()
  }

  // Test each technique can be applied
  console.log("🔧 Testing technique application...")
  const testContext = {
    sessionId: "test",
    agentId: "test",
    task: "Write a function to sort an array",
    variables: {},
    constraints: [],
    previousTechniques: [],
    capabilities: [],
  }

  let successCount = 0
  for (const technique of all) {
    try {
      const result = await technique.apply(testContext)
      if (result && result.content && result.metadata) {
        successCount++
        console.log(`   ✓ ${technique.name} - Applied successfully`)
      } else {
        console.log(`   ✗ ${technique.name} - Invalid result`)
      }
    } catch (error) {
      console.log(`   ✗ ${technique.name} - Error: ${error}`)
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Total techniques: ${all.length}`)
  console.log(`   Successfully applied: ${successCount}`)
  console.log(
    `   Success rate: ${((successCount / all.length) * 100).toFixed(1)}%`,
  )

  if (successCount === all.length) {
    console.log("\n🎉 All techniques working perfectly!")
  } else {
    console.log(`\n⚠️  ${all.length - successCount} techniques need attention`)
  }
}

testAllTechniques().catch(console.error)
