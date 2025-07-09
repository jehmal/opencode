#!/usr/bin/env bun

/**
 * Phase 1 Demo: Chain of Thought Integration
 *
 * This script demonstrates the basic functionality of the Phase 1 implementation:
 * - Loading techniques from the registry
 * - Applying Chain of Thought to various tasks
 * - Measuring performance
 * - Integrating with DGMO sessions
 */

import { techniqueRegistry, techniqueLoader } from "../registry"
import { promptingIntegration } from "../integration/session-integration"
import { ChainOfThoughtTechnique } from "../techniques/reasoning/chain-of-thought"

async function runDemo() {
  console.log("🚀 DGMO Prompting Techniques - Phase 1 Demo\n")

  // Step 1: Initialize the system
  console.log("1️⃣ Initializing prompting system...")
  const initStart = performance.now()
  await promptingIntegration.initialize()
  const initTime = performance.now() - initStart
  console.log(`✅ Initialized in ${initTime.toFixed(2)}ms\n`)

  // Step 2: List available techniques
  console.log("2️⃣ Available techniques:")
  const techniques = techniqueRegistry.getAll()
  techniques.forEach((t) => {
    console.log(`   - ${t.name} (${t.id}) - ${t.category}`)
  })
  console.log()

  // Step 3: Test Chain of Thought on different task types
  console.log("3️⃣ Testing Chain of Thought on various tasks:\n")

  const testCases = [
    {
      name: "Mathematical Problem",
      task: "Calculate the compound interest on $1000 at 5% annual rate for 3 years",
    },
    {
      name: "Debugging Task",
      task: "Debug why my React component is re-rendering infinitely",
    },
    {
      name: "Analysis Task",
      task: "Analyze the time complexity of a recursive fibonacci function",
    },
    {
      name: "Simple Task (Low Confidence)",
      task: "What is 2 + 2?",
    },
  ]

  for (const testCase of testCases) {
    console.log(`📝 ${testCase.name}:`)
    console.log(`   Original: "${testCase.task}"`)

    const enhanceStart = performance.now()
    const enhanced = await promptingIntegration.enhancePrompt(
      "demo-session",
      testCase.task,
      "cot",
    )
    const enhanceTime = performance.now() - enhanceStart

    console.log(`   Enhanced: "${enhanced.content.substring(0, 100)}..."`)
    console.log(
      `   Confidence: ${(enhanced.metadata.confidence * 100).toFixed(0)}%`,
    )
    console.log(`   Tokens: ~${enhanced.metadata.estimatedTokens}`)
    console.log(`   Time: ${enhanceTime.toFixed(2)}ms`)
    console.log()
  }

  // Step 4: Performance metrics
  console.log("4️⃣ Performance Metrics:")
  const metrics = techniqueRegistry.getMetrics()
  console.log(`   Total techniques loaded: ${metrics.totalTechniques}`)
  console.log(`   By category:`)
  Object.entries(metrics.byCategory).forEach(([category, count]) => {
    console.log(`     - ${category}: ${count}`)
  })
  console.log()

  // Step 5: Direct technique usage
  console.log("5️⃣ Direct technique usage example:")
  const cot = new ChainOfThoughtTechnique()
  console.log(`   Technique: ${cot.name}`)
  console.log(`   When to use:`)
  cot.whenToUse.forEach((use) => console.log(`     - ${use}`))
  console.log(`   Tips:`)
  cot.tips.forEach((tip) => console.log(`     - ${tip}`))
  console.log()

  // Step 6: Verify performance requirements
  console.log("6️⃣ Performance Verification:")

  // Test registry lookup speed
  const lookupStart = performance.now()
  for (let i = 0; i < 1000; i++) {
    techniqueRegistry.get("cot")
  }
  const lookupTime = (performance.now() - lookupStart) / 1000
  console.log(
    `   Average lookup time: ${lookupTime.toFixed(3)}ms (target: <1ms)`,
  )

  // Test enhancement speed
  const enhanceTestStart = performance.now()
  for (let i = 0; i < 10; i++) {
    await promptingIntegration.enhancePrompt(
      "perf-test",
      "Test task for performance measurement",
    )
  }
  const avgEnhanceTime = (performance.now() - enhanceTestStart) / 10
  console.log(
    `   Average enhancement time: ${avgEnhanceTime.toFixed(2)}ms (target: <50ms)`,
  )

  console.log("\n✅ Phase 1 Demo Complete!")
  console.log("\nNext steps:")
  console.log("- Implement remaining 17 techniques")
  console.log("- Add automatic technique selection")
  console.log("- Build composition engine")
  console.log("- Integrate with sub-agent system")
}

// Run the demo
runDemo().catch(console.error)
