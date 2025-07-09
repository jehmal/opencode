/**
 * Performance Improvement Scenario Test
 * Tests the complete flow of detecting and improving performance issues
 */

import { describe, it, beforeAll, afterAll, expect } from "bun:test"
import { EvolutionIntegrationTestSuite } from "../evolution-integration-test-suite"
import { Log } from "../../../../util/log"
import type { EvolutionOrchestrator } from "../../../orchestrator/evolution-orchestrator"
import type { Evolution } from "../../../types"

const log = Log.create({ service: "performance-improvement-test" })

describe("Performance Improvement Scenario", () => {
  let suite: EvolutionIntegrationTestSuite

  beforeAll(async () => {
    suite = new EvolutionIntegrationTestSuite()
    await suite.setup()
  })

  afterAll(async () => {
    await suite.teardown()
  })

  it("should improve slow bash command execution", async () => {
    // 1. Simulate slow performance
    await simulateSlowPerformance()

    // 2. Start orchestrator with test configuration
    const orchestrator = suite.components.orchestrator
    await orchestrator.start({
      cycleInterval: 1000, // 1 second for testing
      autoApprove: {
        enabled: true,
        maxRiskLevel: 0.3,
      },
    })

    // 3. Wait for evolution cycle
    const evolution = await waitForEvolution(orchestrator, 30000)

    // 4. Verify improvement
    expect(evolution).toBeDefined()
    expect(evolution.type).toBe("performance")
    expect(evolution.result?.metrics?.performanceGain).toBeGreaterThan(0.1)

    // 5. Verify deployment
    const deployment = await suite.components.deployment.getDeploymentStatus(
      evolution.id,
    )
    expect(deployment).toBeDefined()
    expect(deployment.status).toBe("completed")
    expect(deployment.strategy).toMatch(/direct|canary/) // Based on risk level

    // 6. Stop orchestrator
    await orchestrator.stop()
  }, 60000) // 60 second timeout for full cycle

  it("should handle multiple performance bottlenecks", async () => {
    // 1. Simulate multiple bottlenecks
    await simulateMultipleBottlenecks()

    // 2. Run pattern detection
    const patterns = await suite.components.analyzer.detectPatterns()

    // 3. Verify multiple patterns detected
    expect(patterns.length).toBeGreaterThan(1)

    // 4. Generate hypotheses
    const hypotheses =
      await suite.components.analyzer.generateHypotheses(patterns)

    // 5. Verify prioritization
    expect(hypotheses.length).toBeGreaterThan(0)
    expect(hypotheses[0].confidence).toBeGreaterThanOrEqual(0.5)

    // 6. Test each hypothesis in sandbox
    for (const hypothesis of hypotheses.slice(0, 3)) {
      // Test top 3
      const evolution = await suite.components.bridge.requestEvolution({
        type: "performance",
        id: hypothesis.id,
        targetFiles: ["test.js"],
        context: {
          projectPath: process.cwd(),
          language: "javascript",
        },
        constraints: {
          maxExecutionTime: 10000,
          memoryLimit: 256 * 1024 * 1024,
          allowBreakingChanges: false,
        },
        metrics: {
          currentPerformance: {
            latency: 100,
            throughput: 1000,
            errorRate: 0,
          },
        },
      })

      expect(evolution).toBeDefined()
    }
  })

  it("should respect performance thresholds", async () => {
    // 1. Create evolution with minimal improvement
    const minimalEvolution = {
      id: "test-minimal-improvement",
      hypothesis: {
        id: "hyp-minimal",
        type: "performance-optimization",
        description: "Minimal optimization",
        confidence: 0.6,
      },
      changes: [
        {
          file: "test.js",
          originalContent: "slow",
          evolvedContent: "slightly-faster",
          diff: "diff",
          explanation: "Minor optimization",
        },
      ],
      metrics: {
        performanceGain: 0.03, // 3% improvement (below 5% threshold)
      },
    }

    // 2. Validate evolution
    const validation =
      await suite.components.validator.validateEvolution(minimalEvolution)

    // 3. Verify rejection due to insufficient improvement
    expect(validation.valid).toBe(false)
    expect(validation.report.reason).toContain("insufficient improvement")
  })
})

/**
 * Helper function to simulate slow performance
 */
async function simulateSlowPerformance(): Promise<void> {
  log.info("Simulating slow performance patterns")

  // In a real scenario, this would record actual slow operations
  // For testing, we'll create mock data that the analyzer can detect

  // The pattern detection system would normally collect this from actual usage
  // Here we're simulating what would be detected
}

/**
 * Helper function to simulate multiple performance bottlenecks
 */
async function simulateMultipleBottlenecks(): Promise<void> {
  log.info("Simulating multiple performance bottlenecks")

  // Simulate various types of performance issues:
  // - Slow file I/O
  // - Inefficient algorithms
  // - Memory leaks
  // - Redundant operations
}

/**
 * Wait for an evolution to be created and completed
 */
async function waitForEvolution(
  orchestrator: EvolutionOrchestrator,
  timeout: number = 30000,
): Promise<Evolution> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const evolutions = orchestrator.getActiveEvolutions()

    if (evolutions.length > 0) {
      const evolution = evolutions[0]

      // Wait for completion
      while (
        evolution.status !== "completed" &&
        evolution.status !== "failed"
      ) {
        if (Date.now() - startTime > timeout) {
          throw new Error("Timeout waiting for evolution completion")
        }
        await sleep(100)
      }

      return evolution
    }

    await sleep(100)
  }

  throw new Error("Timeout waiting for evolution")
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
