#!/usr/bin/env bun

import { TechniqueRegistry } from "./src/prompting/registry/technique-registry"
import { TechniqueSelector } from "./src/prompting/selector/technique-selector"
import { PromptComposer } from "./src/prompting/composer/prompt-composer"

async function testTechniques() {
  console.log("Testing Prompting Techniques Loading...")

  // Test registry
  const registry = TechniqueRegistry.getInstance()
  await registry.initialize()

  console.log("\n✅ Loaded Techniques:")
  const all = registry.getAll()
  all.forEach((t) => {
    console.log(`  - ${t.name} (${t.id}): ${t.description}`)
  })

  // Test selector
  console.log("\n📊 Testing Technique Selection:")
  const selector = new TechniqueSelector(registry)

  const tasks = [
    "Write a function to calculate fibonacci numbers",
    "Create 3 agents to analyze different aspects of a codebase",
    "Debug why my React component is re-rendering too often",
    "Explain how neural networks work",
  ]

  for (const task of tasks) {
    const analysis = await selector.analyze(task, {
      sessionId: "test",
      agentId: "test",
      task,
      variables: {},
      constraints: [],
    })

    console.log(`\nTask: "${task}"`)
    console.log(`  Type: ${analysis.taskType}`)
    console.log(`  Complexity: ${analysis.complexity}`)
    console.log(`  Requires Code: ${analysis.requiresCode}`)
  }

  // Test composer
  console.log("\n🎨 Testing Prompt Composition:")
  const composer = new PromptComposer()

  const cot = registry.get("cot")
  if (cot) {
    const enhanced = await composer.compose([cot], {
      sessionId: "test",
      agentId: "test",
      task: "Write a sorting algorithm",
      variables: {},
      constraints: [],
    })

    console.log("\nEnhanced prompt preview:")
    console.log(enhanced.content.substring(0, 300) + "...")
    console.log(`Tokens added: ${enhanced.metadata.estimatedTokens}`)
  }

  console.log("\n✅ All tests completed!")
}

testTechniques().catch(console.error)
