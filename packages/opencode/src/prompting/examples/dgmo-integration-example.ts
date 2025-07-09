/**
 * Example: DGMO Prompting Techniques Integration
 *
 * This example demonstrates how the prompting techniques system
 * integrates seamlessly with DGMO's session management.
 */

import { promptingIntegration } from "../integration/dgmo-integration"
import { SessionPromptEnhancer } from "../integration/session-prompt-enhancer"

async function demonstrateIntegration() {
  console.log("=== DGMO Prompting Integration Demo ===\n")

  // 1. Initialize the integration
  console.log("1. Initializing prompting integration...")
  await promptingIntegration.initialize()
  console.log("✓ Integration initialized\n")

  // 2. Configure a session with specific techniques
  const sessionId = "demo-session-123"
  console.log("2. Configuring session with techniques...")

  await promptingIntegration.configureSession({
    sessionId,
    techniques: ["chain-of-thought", "few-shot"],
    autoSelect: false,
    strategy: "performance",
  })
  console.log("✓ Session configured\n")

  // 3. Enhance a prompt for the session
  console.log("3. Enhancing a prompt...")
  const originalPrompt =
    "Analyze the performance bottlenecks in this React application"

  const enhancedPrompt = await promptingIntegration.enhancePrompt(
    sessionId,
    originalPrompt,
  )

  console.log("Original prompt:", originalPrompt)
  console.log("Enhanced prompt preview:", enhancedPrompt.slice(0, 200) + "...")
  console.log()

  // 4. Task tool integration example
  console.log("4. Task tool with techniques example:")
  console.log(`
  // When creating a sub-agent task:
  const taskParams = {
    description: "Analyze code",
    prompt: "Review this codebase for security vulnerabilities",
    techniques: ["chain-of-thought", "step-by-step"],
    autoSelectTechniques: false,
    techniqueStrategy: "balanced"
  }
  `)

  // 5. Auto-selection example
  console.log("5. Auto-selecting techniques for a task...")
  const taskPrompt = "Debug why the authentication flow is failing"

  const recommendation = await promptingIntegration.recommendTechniques(
    taskPrompt,
    3,
  )

  console.log("Task:", taskPrompt)
  console.log("Recommended techniques:")
  recommendation.techniques.forEach((tech, i) => {
    console.log(
      `  ${i + 1}. ${tech.name} (confidence: ${(tech.confidence * 100).toFixed(0)}%)`,
    )
    console.log(`     Reasoning: ${tech.reasoning[0]}`)
  })
  console.log()

  // 6. Performance tracking
  console.log("6. Tracking technique performance...")

  await promptingIntegration.trackSessionPerformance(
    sessionId,
    true, // success
    {
      duration: 5432, // ms
      tokensUsed: 1250,
    },
  )
  console.log("✓ Performance tracked\n")

  // 7. Session prompt enhancer
  console.log("7. Using SessionPromptEnhancer...")

  const enhancedViaEnhancer = await SessionPromptEnhancer.enhance(
    sessionId,
    "Explain how React hooks work",
    {
      techniques: ["few-shot", "analogical-prompting"],
    },
  )

  console.log("✓ Prompt enhanced via SessionPromptEnhancer\n")

  // 8. Get performance metrics
  console.log("8. Retrieving performance metrics...")
  const metrics = await promptingIntegration.getPerformanceMetrics()

  console.log("Performance metrics:")
  console.log(`  Total executions: ${metrics.tracker.totalExecutions}`)
  console.log(
    `  Techniques tracked: ${Object.keys(metrics.tracker.techniquePerformance).length}`,
  )
  console.log()

  // 9. Cleanup
  console.log("9. Cleaning up session data...")
  await promptingIntegration.cleanupSession(sessionId)
  console.log("✓ Session cleaned up\n")

  console.log("=== Demo Complete ===")
}

// Integration points summary
console.log(`
DGMO Prompting Integration Points:
==================================

1. Session Management:
   - Automatic technique initialization for new sessions
   - Technique configuration per session
   - Cleanup on session deletion

2. Task Tool:
   - 'techniques' parameter for specific techniques
   - 'autoSelectTechniques' for automatic selection
   - 'techniqueStrategy' for selection strategy

3. Prompt Enhancement:
   - Intercept and enhance prompts before sending
   - Track technique usage and performance
   - Support for manual and automatic selection

4. Performance Tracking:
   - Track success rates per technique
   - Monitor token usage and latency
   - Adaptive technique selection based on history

5. Backward Compatibility:
   - System works without techniques
   - Opt-in enhancement
   - No breaking changes to existing code
`)

// Run the demo
if (import.meta.main) {
  demonstrateIntegration().catch(console.error)
}
