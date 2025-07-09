/**
 * End-to-End Evolution Testing Suite
 * Tests the complete evolution system without TUI dependency
 */

import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals"
import { EvolutionOrchestrator } from "../orchestrator/evolution-orchestrator"
import { EvolutionBridge } from "../bridge"
import { DGMBridge } from "../../dgm/bridge"
import { UsageAnalyzer } from "../orchestrator/usage-analyzer"
import { SandboxManager } from "../sandbox/sandbox-manager"
import { EvolutionUI } from "../ui"
import { EvolutionPrioritizer } from "../orchestrator/evolution-prioritizer"
import { EvolutionMetricsCollector } from "../orchestrator/evolution-metrics"
import { EvolutionRollbackManager } from "../orchestrator/evolution-rollback"
import { EvolutionConfigManager } from "../orchestrator/evolution-config"
import { mockPerformanceData } from "./mock-performance-data"
import {
  EvolutionRequest,
  EvolutionStatus,
  EvolutionRequestType,
} from "../types"
import { DGMStatus } from "../../dgm/types"
import { EventEmitter } from "events"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

// Mock console for verbose debugging
const originalConsole = { ...console }
const debugLog = (phase: string, data: any) => {
  originalConsole.log(
    `\n[EVOLUTION DEBUG - ${phase}]`,
    JSON.stringify(data, null, 2),
  )
}

describe("Evolution System E2E Tests", () => {
  let orchestrator: EvolutionOrchestrator
  let bridge: EvolutionBridge
  let dgmBridge: DGMBridge
  let testDir: string

  beforeAll(async () => {
    // Create test directory
    testDir = join(tmpdir(), `evolution-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    // Create mock DGM bridge
    dgmBridge = {
      status: DGMStatus.READY,
      executeTool: jest.fn().mockImplementation(async (tool, params) => {
        debugLog("DGM Tool Execution", { tool, params })

        switch (tool) {
          case "evolution.analyze":
            return {
              description: "Optimize performance by caching results",
              expectedImpact: ["30% faster execution", "Reduced memory usage"],
              confidence: 0.85,
              risks: ["Cache invalidation complexity"],
              dependencies: [],
            }

          case "evolution.generate":
            return {
              content: params.content.replace(
                "function process(data)",
                "const cache = new Map();\nfunction process(data)",
              ),
              explanation: "Added caching mechanism to improve performance",
            }

          case "evolution.validate":
            return {
              apiCompatibility: true,
              backwardCompatibility: true,
              securityCheck: true,
              performanceRegression: false,
              details: ["All validation checks passed"],
            }

          case "evolution.metrics":
            return mockPerformanceData.generateMetrics()

          case "evolution.snapshot":
            return { success: true, snapshotId: params.snapshotId }

          default:
            return {}
        }
      }),
      on: jest.fn(),
      emit: jest.fn(),
    } as any

    // Create evolution bridge
    const evolutionConfig = {
      maxConcurrentEvolutions: 3,
      requireApproval: false,
      rollbackOnFailure: true,
      telemetry: {
        enabled: true,
        trackMetrics: true,
        reportingInterval: 60000,
      },
    }
    bridge = new EvolutionBridge(evolutionConfig, dgmBridge)

    // Create mock components
    const analyzer = new MockUsageAnalyzer()
    const sandbox = new MockSandboxManager(testDir)
    const ui = new MockEvolutionUI()
    const prioritizer = new EvolutionPrioritizer()
    const metricsCollector = new EvolutionMetricsCollector()
    const rollbackManager = new EvolutionRollbackManager()
    const configManager = new EvolutionConfigManager()

    // Create orchestrator
    orchestrator = new EvolutionOrchestrator(
      bridge,
      analyzer,
      sandbox,
      ui,
      prioritizer,
      metricsCollector,
      rollbackManager,
      configManager,
    )
  })

  afterAll(async () => {
    await orchestrator.stop()
    await bridge.shutdown()
  })

  it("should run evolution cycle with minimal samples", async () => {
    debugLog("Test Start", { testName: "evolution cycle with minimal samples" })

    // Start orchestrator with minimal config
    await orchestrator.start({
      cycleInterval: 1000, // 1 second for testing
      maxConcurrentEvolutions: 1,
      autoApprove: {
        enabled: true,
        maxRiskLevel: 0.5,
        types: ["performance", "refactoring"],
      },
      enabled: true,
    })

    // Wait for first cycle
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Check status
    const status = orchestrator.getStatus()
    debugLog("Orchestrator Status", status)

    expect(status.isRunning).toBe(true)
    expect(status.cycleCount).toBeGreaterThan(0)
  })

  it("should process evolution request directly", async () => {
    debugLog("Test Start", { testName: "direct evolution request" })

    // Create test file
    const testFile = join(testDir, "test-function.js")
    await writeFile(
      testFile,
      `
function process(data) {
  // Inefficient processing
  const results = []
  for (let i = 0; i < data.length; i++) {
    results.push(data[i] * 2)
  }
  return results
}
    `,
    )

    // Create evolution request
    const request: EvolutionRequest = {
      id: "test-evolution-1",
      type: EvolutionType.PERFORMANCE,
      targetFiles: [testFile],
      metrics: {
        baseline: {
          executionTime: 100,
          memoryUsage: 50,
          cpuUsage: 80,
        },
      },
      constraints: {
        maxExecutionTime: 30000,
        maxMemoryUsage: 100,
        allowBreakingChanges: false,
      },
      context: {
        projectPath: testDir,
        testCommand: 'echo "Tests passed"',
        performanceCommand: 'echo "execution time: 70ms\\nmemory usage: 40MB"',
      },
    }

    // Request evolution
    const result = await bridge.requestEvolution(request)
    debugLog("Evolution Request Result", result)

    expect(result.status).toBe(EvolutionStatus.PENDING)
    expect(result.hypothesis).toBeDefined()

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Check final status
    const finalStatus = await bridge.getEvolutionStatus(result.id)
    debugLog("Final Evolution Status", finalStatus)

    expect(finalStatus.status).toBe(EvolutionStatus.COMPLETED)
    expect(finalStatus.changes.length).toBeGreaterThan(0)
    expect(finalStatus.testResults.passed).toBe(true)
  })

  it("should handle evolution phases sequentially", async () => {
    debugLog("Test Start", { testName: "sequential evolution phases" })

    const phases: string[] = []

    // Track phase transitions
    bridge.on("evolution:analysis:started", () => {
      phases.push("analyze")
      debugLog("Phase Transition", { phase: "analyze" })
    })

    bridge.on("evolution:generation:started", () => {
      phases.push("generate")
      debugLog("Phase Transition", { phase: "generate" })
    })

    bridge.on("evolution:testing:started", () => {
      phases.push("test")
      debugLog("Phase Transition", { phase: "test" })
    })

    bridge.on("evolution:validation:started", () => {
      phases.push("validate")
      debugLog("Phase Transition", { phase: "validate" })
    })

    // Create simple evolution request
    const request: EvolutionRequest = {
      id: "test-phases",
      type: EvolutionType.REFACTORING,
      targetFiles: [join(testDir, "dummy.js")],
      metrics: { baseline: {} },
      constraints: { maxExecutionTime: 10000 },
      context: { projectPath: testDir },
    }

    await bridge.requestEvolution(request)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    debugLog("Phase Execution Order", phases)
    expect(phases).toEqual(["analyze", "generate", "test", "validate"])
  })

  it("should generate and validate improvement hypotheses", async () => {
    debugLog("Test Start", { testName: "hypothesis generation and validation" })

    // Inject mock performance data
    const analyzer = new MockUsageAnalyzer()
    analyzer.injectPerformanceData(
      mockPerformanceData.generateMultipleExecutions(10),
    )

    // Detect patterns
    const patterns = await analyzer.detectPatterns()
    debugLog("Detected Patterns", patterns)
    expect(patterns.length).toBeGreaterThan(0)

    // Generate hypotheses
    const hypotheses = await analyzer.generateHypotheses(patterns)
    debugLog("Generated Hypotheses", hypotheses)
    expect(hypotheses.length).toBeGreaterThan(0)

    // Validate hypothesis structure
    const hypothesis = hypotheses[0]
    expect(hypothesis).toHaveProperty("id")
    expect(hypothesis).toHaveProperty("type")
    expect(hypothesis).toHaveProperty("description")
    expect(hypothesis).toHaveProperty("confidence")
    expect(hypothesis.confidence).toBeGreaterThan(0)
    expect(hypothesis.confidence).toBeLessThanOrEqual(1)
  })
})

// Mock implementations
class MockUsageAnalyzer extends EventEmitter {
  private performanceData: any[] = []

  injectPerformanceData(data: any[]) {
    this.performanceData = data
  }

  async detectPatterns() {
    debugLog("Pattern Detection", { dataPoints: this.performanceData.length })

    if (this.performanceData.length < 1) {
      // Generate mock data if none injected
      this.performanceData = mockPerformanceData.generateMultipleExecutions(5)
    }

    return [
      {
        type: "performance_bottleneck",
        location: "process function",
        frequency: 0.8,
        impact: "high",
        details: {
          avgExecutionTime: 95,
          maxExecutionTime: 120,
          occurrences: this.performanceData.length,
        },
      },
    ]
  }

  async generateHypotheses(patterns: any[]) {
    debugLog("Hypothesis Generation", { patternCount: patterns.length })

    return patterns.map((pattern, index) => ({
      id: `hyp_${Date.now()}_${index}`,
      type: EvolutionType.PERFORMANCE,
      description: `Optimize ${pattern.location} to reduce execution time`,
      expectedImpact: [
        "30% performance improvement",
        "Better resource utilization",
      ],
      confidence: 0.75 + Math.random() * 0.2,
      risks: ["Potential edge case handling"],
      dependencies: [],
    }))
  }
}

class MockSandboxManager {
  constructor(private testDir: string) {}

  async createSandbox(id: string) {
    const sandboxDir = join(this.testDir, "sandboxes", id)
    await mkdir(sandboxDir, { recursive: true })
    return { id, path: sandboxDir }
  }

  async runInSandbox(id: string, fn: () => Promise<any>) {
    debugLog("Sandbox Execution", { id })
    return fn()
  }

  async cleanupSandbox(id: string) {
    debugLog("Sandbox Cleanup", { id })
  }
}

class MockEvolutionUI extends EventEmitter {
  async showApprovalDialog(evolution: any) {
    debugLog("UI Approval Dialog", { evolution: evolution.id })
    // Auto-approve for testing
    this.emit("evolution:approved", evolution.id)
    return true
  }

  async updateProgress(evolution: any, progress: number) {
    debugLog("UI Progress Update", { evolution: evolution.id, progress })
  }
}
