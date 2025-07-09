#!/usr/bin/env bun

import { DGMOPromptingIntegration } from "./src/prompting/integration/dgmo-integration"

async function testPromptingTechniques() {
  console.log("Testing DGMO Prompting Techniques Integration...")

  const integration = new DGMOPromptingIntegration()
  await integration.initialize()

  // Test 1: Simple task with auto-selection
  console.log("\n1. Testing auto-selection for a simple task:")
  const simpleTask = "Write a function to calculate fibonacci numbers"
  const enhanced1 = await integration.enhancePrompt(
    "test-session-1",
    simpleTask,
  )
  console.log("Original:", simpleTask)
  console.log("Enhanced:", enhanced1.content.substring(0, 200) + "...")
  console.log("Techniques used:", enhanced1.metadata.techniques)
  console.log("Confidence:", enhanced1.metadata.confidence)

  // Test 2: Complex multi-agent task
  console.log("\n2. Testing multi-agent coordination task:")
  const multiAgentTask =
    "Create 3 agents to analyze different aspects of a codebase"
  const enhanced2 = await integration.enhancePrompt(
    "test-session-2",
    multiAgentTask,
  )
  console.log("Original:", multiAgentTask)
  console.log("Enhanced:", enhanced2.content.substring(0, 200) + "...")
  console.log("Techniques used:", enhanced2.metadata.techniques)

  // Test 3: Specific technique selection
  console.log("\n3. Testing specific technique (Chain of Thought):")
  const enhanced3 = await integration.enhancePrompt(
    "test-session-3",
    simpleTask,
    {
      techniques: ["cot"],
      autoSelect: false,
    },
  )
  console.log("Enhanced with CoT:", enhanced3.content.substring(0, 200) + "...")
  console.log("Techniques used:", enhanced3.metadata.techniques)

  // Test 4: Get all available techniques
  console.log("\n4. Available techniques:")
  const allTechniques = await integration.searchTechniques({})
  console.log(`Total techniques: ${allTechniques.length}`)
  allTechniques.forEach((t) => {
    console.log(`- ${t.name} (${t.id}): ${t.description}`)
  })

  console.log("\n✅ All tests completed successfully!")
}

testPromptingTechniques().catch(console.error)
