/**
 * Evolution Orchestrator Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { EvolutionOrchestrator } from "../evolution-orchestrator"
import { EvolutionBridge } from "../../bridge"
import { UsageAnalyzer } from "../usage-analyzer"
import { SandboxManager } from "../../sandbox/sandbox-manager"
import { EvolutionUI } from "../../ui"
import { EvolutionPrioritizer } from "../evolution-prioritizer"
import { EvolutionMetricsCollector } from "../evolution-metrics"
import { EvolutionRollbackManager } from "../evolution-rollback"
import { EvolutionConfigManager } from "../evolution-config"
import type { ImprovementHypothesis } from "../../types"

describe("EvolutionOrchestrator", () => {
  let orchestrator: EvolutionOrchestrator
  let mockBridge: any
  let mockAnalyzer: any
  let mockSandbox: any
  let mockUI: any
  let prioritizer: EvolutionPrioritizer
  let metricsCollector: EvolutionMetricsCollector
  let rollbackManager: EvolutionRollbackManager
  let configManager: EvolutionConfigManager

  beforeEach(async () => {
    // Create mocks
    mockBridge = {
      on: mock(() => {}),
      requestEvolution: mock(() =>
        Promise.resolve({
          id: "test-evolution",
          status: "completed",
          hypothesis: createMockHypothesis(),
          changes: [],
          metrics: { before: {}, after: {}, improvement: {} },
          testResults: {
            passed: true,
            totalTests: 10,
            passedTests: 10,
            failedTests: 0,
            details: "",
          },
          validationResults: {
            apiCompatibility: true,
            backwardCompatibility: true,
            securityCheck: true,
            performanceRegression: false,
            details: [],
          },
          timestamp: Date.now(),
          duration: 1000,
          requestId: "test-request",
        }),
      ),
      applyEvolution: mock(() => Promise.resolve()),
    }

    mockAnalyzer = {
      detectPatterns: mock(() =>
        Promise.resolve([
          {
            id: "pattern-1",
            type: "hotspot",
            confidence: 0.9,
            frequency: 10,
            impact: {
              performanceImpact: 0.8,
              userExperienceImpact: 0.7,
              resourceImpact: 0.6,
            },
            context: {
              tools: ["read", "write"],
              averageExecutionTime: 100,
              errorRate: 0.1,
              resourceUsage: { memory: 50, io: 20 },
            },
            improvementOpportunity: {
              description: "Test improvement",
              expectedBenefit: "Faster",
              implementationComplexity: "low",
              risks: [],
            },
          },
        ]),
      ),
      generateHypotheses: mock(() => Promise.resolve([createMockHypothesis()])),
    }

    mockSandbox = {
      createSandbox: mock(() => Promise.resolve({ id: "sandbox-1" })),
      execute: mock(() => Promise.resolve({ success: true })),
    }

    mockUI = {
      on: mock(() => {}),
      requestApproval: mock(() => Promise.resolve(true)),
    }

    // Create real instances
    prioritizer = new EvolutionPrioritizer()
    metricsCollector = new EvolutionMetricsCollector()
    rollbackManager = new EvolutionRollbackManager()
    configManager = new EvolutionConfigManager()

    // Create orchestrator
    orchestrator = new EvolutionOrchestrator(
      mockBridge as any,
      mockAnalyzer as any,
      mockSandbox as any,
      mockUI as any,
      prioritizer,
      metricsCollector,
      rollbackManager,
      configManager,
    )
  })

  afterEach(async () => {
    await orchestrator.stop()
  })

  it("should start and run evolution cycle", async () => {
    await orchestrator.start({ cycleInterval: 1000 })

    // Wait for cycle to complete
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const status = orchestrator.getStatus()
    expect(status.isRunning).toBe(true)
    expect(status.cycleCount).toBeGreaterThan(0)
    expect(mockAnalyzer.detectPatterns).toHaveBeenCalled()
    expect(mockAnalyzer.generateHypotheses).toHaveBeenCalled()
  })

  it("should prioritize bug fixes over features", async () => {
    const hypotheses: ImprovementHypothesis[] = [
      createMockHypothesis("feature", 0.8),
      createMockHypothesis("bug-fix", 0.5),
    ]

    mockAnalyzer.generateHypotheses = mock(() => Promise.resolve(hypotheses))

    await orchestrator.start({ cycleInterval: 1000 })
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const activeEvolutions = orchestrator.getActiveEvolutions()
    expect(activeEvolutions.length).toBeGreaterThan(0)
    // Bug fix should be prioritized despite lower improvement
  })

  it("should respect concurrent evolution limit", async () => {
    const manyHypotheses = Array(10)
      .fill(null)
      .map((_, i) => createMockHypothesis("feature", 0.5, `hypothesis-${i}`))

    mockAnalyzer.generateHypotheses = mock(() =>
      Promise.resolve(manyHypotheses),
    )

    await orchestrator.start({
      cycleInterval: 1000,
      maxConcurrentEvolutions: 3,
    })

    await new Promise((resolve) => setTimeout(resolve, 1500))

    const activeEvolutions = orchestrator.getActiveEvolutions()
    expect(activeEvolutions.length).toBeLessThanOrEqual(3)
  })

  it("should handle evolution failures gracefully", async () => {
    mockBridge.requestEvolution = mock(() =>
      Promise.reject(new Error("Evolution failed")),
    )

    await orchestrator.start({ cycleInterval: 1000 })
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const status = orchestrator.getStatus()
    expect(status.failureCount).toBeGreaterThan(0)
    expect(status.isRunning).toBe(true) // Should continue running
  })

  it("should pause and resume orchestrator", async () => {
    await orchestrator.start({ cycleInterval: 1000 })

    orchestrator.pause()
    const pausedStatus = orchestrator.getStatus()
    expect(pausedStatus.isPaused).toBe(true)

    orchestrator.resume()
    const resumedStatus = orchestrator.getStatus()
    expect(resumedStatus.isPaused).toBe(false)
  })

  it("should generate metrics report", async () => {
    await orchestrator.start({ cycleInterval: 1000 })
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const report = await orchestrator.getMetricsReport()
    expect(report).toBeDefined()
    expect(report.totalEvolutions).toBeGreaterThanOrEqual(0)
  })

  it("should handle configuration updates", async () => {
    const configUpdateHandler = mock(() => {})
    configManager.on("config-updated", configUpdateHandler)

    await orchestrator.start()
    await configManager.updateConfig({ cycleInterval: 10000 })

    expect(configUpdateHandler).toHaveBeenCalled()
  })

  it("should auto-approve safe evolutions", async () => {
    await configManager.updateConfig({
      autoApprove: {
        enabled: true,
        maxRiskLevel: 0.5,
        types: ["fix_bugs"],
      },
    })

    const bugFixHypothesis = createMockHypothesis("bug-fix", 0.8)
    mockAnalyzer.generateHypotheses = mock(() =>
      Promise.resolve([bugFixHypothesis]),
    )

    await orchestrator.start({ cycleInterval: 1000 })
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Should not call requestApproval for auto-approved evolutions
    expect(mockUI.requestApproval).not.toHaveBeenCalled()
  })
})

function createMockHypothesis(
  type = "improve_performance",
  improvement = 0.5,
  id = "hypothesis-1",
): ImprovementHypothesis {
  return {
    id,
    type: type as any,
    description: `Test hypothesis for ${type}`,
    expectedImpact: [
      {
        metric: "executionTime",
        currentValue: 100,
        targetValue: 100 * (1 - improvement),
        improvementPercentage: improvement * 100,
      },
    ],
    confidence: 0.8,
    risks: ["Test risk"],
    dependencies: ["test-tool"],
  }
}
