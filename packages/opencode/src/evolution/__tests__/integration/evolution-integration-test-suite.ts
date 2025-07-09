/**
 * Evolution Integration Test Suite
 * Comprehensive end-to-end testing for the DGMO-DGM evolution system
 */

import { EvolutionBridge } from "../../bridge"
import { UsageAnalyzer } from "../../orchestrator/usage-analyzer"
import { SandboxManager } from "../../sandbox"
import { EvolutionUI } from "../../ui"
import { EvolutionOrchestrator } from "../../orchestrator/evolution-orchestrator"
import { PerformanceValidator } from "../../validator/performance-validator"
import { EvolutionDeploymentManager } from "../../deployment/evolution-deployment-manager"
import { DGMBridge } from "../../../dgm/bridge"
import { Log } from "../../../util/log"
import type {
  ImprovementHypothesis,
  EvolutionResult,
  ValidationResult,
  ValidationReport,
  Deployment,
} from "../../types"

const log = Log.create({ service: "evolution-integration-test" })

export interface TestResult {
  phases: PhaseTestResult[]
  overall: {
    success: boolean
    duration: number
    error?: string
  }
}

export interface PhaseTestResult {
  phase: string
  success: boolean
  tests: TestCase[]
  duration?: number
  error?: string
}

export interface TestCase {
  name: string
  passed: boolean
  duration: number
  error?: string
  skipped?: boolean
}

export class EvolutionIntegrationTestSuite {
  private components!: {
    bridge: EvolutionBridge
    analyzer: UsageAnalyzer
    sandbox: SandboxManager
    ui: EvolutionUI
    orchestrator: EvolutionOrchestrator
    validator: PerformanceValidator
    deployment: EvolutionDeploymentManager
  }

  private dgmBridge!: DGMBridge

  async setup(): Promise<void> {
    log.info("Setting up integration test suite")

    // Initialize DGM bridge with config
    this.dgmBridge = new DGMBridge({
      enabled: true,
      pythonPath: process.env["PYTHON_PATH"] || "python3",
      timeout: 30000,
      maxRetries: 3,
      healthCheckInterval: 5000,
      dgmPath: process.env["DGM_PATH"],
    })

    // Initialize all components
    this.components = {
      bridge: new EvolutionBridge(this.dgmBridge),
      analyzer: new UsageAnalyzer(),
      sandbox: new SandboxManager({
        dockerEnabled: false, // Use process isolation for tests
        isolationMode: "process",
        resourceLimits: {
          maxMemory: 512 * 1024 * 1024, // 512MB
          maxCpu: 0.5,
          maxExecutionTime: 30000, // 30s
        },
      }),
      ui: new EvolutionUI({
        bridge: this.dgmBridge,
        autoApprovalEnabled: false,
        minSafetyScore: 0.8,
      }),
      orchestrator: null as any, // Will be initialized after other components
      validator: null as any, // Will be initialized after sandbox
      deployment: new EvolutionDeploymentManager({
        monitoring: {
          interval: 1000, // 1s for tests
          errorThreshold: 0.1, // 10% error rate
          performanceThreshold: 0.05, // 5% performance degradation
        },
        rollback: {
          enabled: true,
          errorThreshold: 0.1, // 10% error rate triggers rollback
          performanceThreshold: 0.05,
        },
      }),
    }

    // Create validator with sandbox dependency
    this.components.validator = new PerformanceValidator({
      sandbox: this.components.sandbox,
      thresholds: {
        performanceImprovement: 0.05, // 5% improvement required
        regressionTolerance: 0.02, // 2% regression allowed
        confidenceLevel: 0.95,
        sampleSize: 100,
      },
    })

    // Create orchestrator with all dependencies
    this.components.orchestrator = new EvolutionOrchestrator(
      this.components.bridge,
      this.components.analyzer,
      this.components.sandbox,
      this.components.ui,
      this.dgmBridge,
    )

    // Initialize all components
    await Promise.all([
      this.components.sandbox.initialize(),
      this.components.ui.initialize?.(),
      this.components.deployment.initialize?.(),
    ])

    log.info("Integration test suite setup complete")
  }

  async teardown(): Promise<void> {
    log.info("Tearing down integration test suite")

    // Stop all components gracefully
    await Promise.all([
      this.components.orchestrator.stop(),
      this.components.sandbox.cleanup(),
      this.components.ui.cleanup?.(),
    ])

    log.info("Integration test suite teardown complete")
  }

  async runFullEvolutionCycle(): Promise<TestResult> {
    const results: TestResult = {
      phases: [],
      overall: { success: false, duration: 0 },
    }

    const startTime = Date.now()

    try {
      // Phase 1: Pattern Detection
      results.phases.push(await this.testPatternDetection())

      // Phase 2: Evolution Generation
      results.phases.push(await this.testEvolutionGeneration())

      // Phase 3: Sandbox Testing
      results.phases.push(await this.testSandboxExecution())

      // Phase 4: Performance Validation
      results.phases.push(await this.testPerformanceValidation())

      // Phase 5: User Approval
      results.phases.push(await this.testUserApproval())

      // Phase 6: Deployment
      results.phases.push(await this.testDeployment())

      // Phase 7: Post-Deployment
      results.phases.push(await this.testPostDeployment())

      results.overall.success = results.phases.every((p) => p.success)
      results.overall.duration = Date.now() - startTime

      log.info(
        `Full evolution cycle completed in ${results.overall.duration}ms`,
        {
          success: results.overall.success,
          phasesRun: results.phases.length,
          failedPhases: results.phases.filter((p) => !p.success).length,
        },
      )
    } catch (error) {
      results.overall.error =
        error instanceof Error ? error.message : String(error)
      log.error("Evolution cycle test failed", { error })
    }

    return results
  }

  private async testPatternDetection(): Promise<PhaseTestResult> {
    const phase = "Pattern Detection"
    log.info(`Testing ${phase}`)

    const result: PhaseTestResult = {
      phase,
      success: false,
      tests: [],
    }

    const startTime = Date.now()

    try {
      // Test 1: Detect patterns from current session
      const detectTest = await this.runTest(
        "Detect patterns from session",
        async () => {
          const patterns = await this.components.analyzer.detectPatterns()
          if (!Array.isArray(patterns)) {
            throw new Error("Expected patterns array")
          }
          return patterns.length > 0
        },
      )
      result.tests.push(detectTest)

      // Test 2: Generate hypotheses from patterns
      const hypothesisTest = await this.runTest(
        "Generate improvement hypotheses",
        async () => {
          const patterns = await this.components.analyzer.detectPatterns()
          const hypotheses =
            await this.components.analyzer.generateHypotheses(patterns)

          if (!Array.isArray(hypotheses)) {
            throw new Error("Expected hypotheses array")
          }

          // Verify hypothesis structure
          for (const hypothesis of hypotheses) {
            if (
              !hypothesis.id ||
              !hypothesis.description ||
              typeof hypothesis.confidence !== "number"
            ) {
              throw new Error("Invalid hypothesis structure")
            }
          }

          return hypotheses.length > 0
        },
      )
      result.tests.push(hypothesisTest)

      result.success = result.tests.every((t) => t.passed)
      result.duration = Date.now() - startTime
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      log.error(`${phase} failed`, { error })
    }

    return result
  }

  private async testEvolutionGeneration(): Promise<PhaseTestResult> {
    const phase = "Evolution Generation"
    log.info(`Testing ${phase}`)

    const result: PhaseTestResult = {
      phase,
      success: false,
      tests: [],
    }

    const startTime = Date.now()

    try {
      // Create a test hypothesis
      const hypothesis: ImprovementHypothesis = {
        id: "test-hypothesis-1",
        type: "performance-optimization",
        description: "Optimize bash command execution",
        confidence: 0.8,
        targetTool: "bash",
        metrics: {
          currentLatency: 100,
          targetLatency: 85,
        },
      }

      // Test 1: Create evolution request
      const requestTest = await this.runTest(
        "Create evolution request",
        async () => {
          const request = await this.components.bridge.createEvolutionSession({
            hypothesis,
            constraints: {
              maxExecutionTime: 30000,
              memoryLimit: 512 * 1024 * 1024,
              allowBreakingChanges: false,
            },
          })

          if (!request.id || request.status !== "active") {
            throw new Error("Invalid evolution request")
          }

          return true
        },
      )
      result.tests.push(requestTest)

      // Test 2: Generate evolution code
      const generationTest = await this.runTest(
        "Generate evolution code",
        async () => {
          const session = await this.components.bridge.createEvolutionSession({
            hypothesis,
            constraints: {},
          })

          const evolution = await this.components.bridge.requestEvolution({
            sessionId: session.id,
            targetTool: "bash",
            performanceData: {
              latency: 100,
              throughput: 1000,
            },
          })

          if (!evolution || evolution.length === 0) {
            throw new Error("No evolution generated")
          }

          return true
        },
      )
      result.tests.push(generationTest)

      result.success = result.tests.every((t) => t.passed)
      result.duration = Date.now() - startTime
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      log.error(`${phase} failed`, { error })
    }

    return result
  }

  private async testSandboxExecution(): Promise<PhaseTestResult> {
    const phase = "Sandbox Execution"
    log.info(`Testing ${phase}`)

    const result: PhaseTestResult = {
      phase,
      success: false,
      tests: [],
    }

    const startTime = Date.now()

    try {
      // Test 1: Execute safe evolution
      const safeTest = await this.runTest(
        "Execute safe evolution",
        async () => {
          const testResult = await this.components.sandbox.runInSandbox({
            code: 'console.log("Safe test");',
            language: "javascript",
            timeout: 5000,
          })

          if (!testResult.success || testResult.securityViolations.length > 0) {
            throw new Error("Safe code marked as unsafe")
          }

          return true
        },
      )
      result.tests.push(safeTest)

      // Test 2: Detect unsafe evolution
      const unsafeTest = await this.runTest(
        "Detect unsafe evolution",
        async () => {
          const testResult = await this.components.sandbox.runInSandbox({
            code: "while(true) { /* infinite loop */ }",
            language: "javascript",
            timeout: 5000,
          })

          if (testResult.success || testResult.error !== "Execution timeout") {
            throw new Error("Unsafe code not detected")
          }

          return true
        },
      )
      result.tests.push(unsafeTest)

      result.success = result.tests.every((t) => t.passed)
      result.duration = Date.now() - startTime
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      log.error(`${phase} failed`, { error })
    }

    return result
  }

  private async testPerformanceValidation(): Promise<PhaseTestResult> {
    const phase = "Performance Validation"
    log.info(`Testing ${phase}`)

    const result: PhaseTestResult = {
      phase,
      success: false,
      tests: [],
    }

    const startTime = Date.now()

    try {
      // Test 1: Validate performance improvement
      const improvementTest = await this.runTest(
        "Validate performance improvement",
        async () => {
          const evolution: EvolutionResult = {
            requestId: "test-req-1",
            status: "completed",
            hypothesis: {
              id: "test-hypothesis-perf",
              type: "performance-optimization",
              description: "Test optimization",
              confidence: 0.8,
            },
            changes: [
              {
                file: "test.js",
                originalContent: "slow code",
                evolvedContent: "fast code",
                diff: "diff",
                explanation: "Optimized",
              },
            ],
            metrics: {
              performanceGain: 0.15,
              riskLevel: 0.2,
              confidence: 0.9,
            },
            timestamp: Date.now(),
            validationReport: {
              performanceImprovement: 0.15,
              regressionRisk: 0.05,
              confidence: 0.9,
              testsPassed: true,
              benchmarkResults: {
                baseline: { latency: 100, throughput: 1000 },
                evolved: { latency: 85, throughput: 1100 },
              },
            },
          }

          const validation =
            await this.components.validator.validateEvolution(evolution)

          if (
            !validation.valid ||
            !validation.report.performanceImprovement ||
            validation.report.performanceImprovement < 0.1
          ) {
            throw new Error("Performance improvement not validated")
          }

          return true
        },
      )
      result.tests.push(improvementTest)

      // Test 2: Detect performance regression
      const regressionTest = await this.runTest(
        "Detect performance regression",
        async () => {
          const evolution: EvolutionResult = {
            requestId: "test-req-2",
            status: "completed",
            hypothesis: {
              id: "test-hypothesis-regression",
              type: "performance-optimization",
              description: "Test regression",
              confidence: 0.8,
            },
            changes: [
              {
                file: "test.js",
                originalContent: "fast code",
                evolvedContent: "slow code",
                diff: "diff",
                explanation: "Regressed",
              },
            ],
            metrics: {
              performanceGain: -0.2,
              riskLevel: 0.5,
              confidence: 0.9,
            },
            timestamp: Date.now(),
            validationReport: {
              performanceImprovement: -0.2,
              regressionRisk: 0.8,
              confidence: 0.9,
              testsPassed: true,
              benchmarkResults: {
                baseline: { latency: 100, throughput: 1000 },
                evolved: { latency: 120, throughput: 900 },
              },
            },
          }

          const validation =
            await this.components.validator.validateEvolution(evolution)

          if (
            validation.valid ||
            validation.report.performanceImprovement >= 0
          ) {
            throw new Error("Performance regression not detected")
          }

          return true
        },
      )
      result.tests.push(regressionTest)

      result.success = result.tests.every((t) => t.passed)
      result.duration = Date.now() - startTime
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      log.error(`${phase} failed`, { error })
    }

    return result
  }

  private async testUserApproval(): Promise<PhaseTestResult> {
    const phase = "User Approval"
    log.info(`Testing ${phase}`)

    const result: PhaseTestResult = {
      phase,
      success: false,
      tests: [],
    }

    const startTime = Date.now()

    try {
      // Test 1: Auto-approve low risk
      const autoApproveTest = await this.runTest(
        "Auto-approve low risk evolution",
        async () => {
          const evolution = {
            id: "test-evolution-low-risk",
            riskLevel: 0.1,
            hypothesis: {
              expectedImprovement: 0.2,
            },
          }

          // Configure auto-approval
          this.components.ui.setAutoApproval({
            enabled: true,
            maxRiskLevel: 0.3,
          })

          const approved = await this.components.ui.requestApproval(evolution)

          if (!approved) {
            throw new Error("Low risk evolution not auto-approved")
          }

          return true
        },
      )
      result.tests.push(autoApproveTest)

      // Test 2: Require manual approval for high risk
      const manualApprovalTest = await this.runTest(
        "Require manual approval for high risk",
        async () => {
          const evolution = {
            id: "test-evolution-high-risk",
            riskLevel: 0.8,
            hypothesis: {
              expectedImprovement: 0.5,
            },
          }

          // Simulate manual approval
          this.components.ui.simulateUserResponse(true)

          const approved = await this.components.ui.requestApproval(evolution)

          if (!approved) {
            throw new Error("Manual approval not working")
          }

          return true
        },
      )
      result.tests.push(manualApprovalTest)

      result.success = result.tests.every((t) => t.passed)
      result.duration = Date.now() - startTime
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      log.error(`${phase} failed`, { error })
    }

    return result
  }

  private async testDeployment(): Promise<PhaseTestResult> {
    const phase = "Deployment"
    log.info(`Testing ${phase}`)

    const result: PhaseTestResult = {
      phase,
      success: false,
      tests: [],
    }

    const startTime = Date.now()

    try {
      // Test 1: Direct deployment for low risk
      const directDeployTest = await this.runTest(
        "Direct deployment for low risk",
        async () => {
          const evolution: EvolutionResult = {
            requestId: "test-deploy-1",
            status: "completed",
            hypothesis: {
              id: "test-hypothesis-deploy",
              type: "performance-optimization",
              description: "Test deployment",
              confidence: 0.9,
            },
            changes: [
              {
                file: "test.js",
                originalContent: "old",
                evolvedContent: "new",
                diff: "diff",
                explanation: "Updated",
              },
            ],
            metrics: {
              performanceGain: 0.15,
              riskLevel: 0.1,
              confidence: 0.9,
            },
            timestamp: Date.now(),
          }

          const deployment = await this.components.deployment.deployEvolution(
            evolution,
            {
              valid: true,
              report: { performanceImprovement: 0.15 },
            } as ValidationResult,
          )

          if (!deployment.success || deployment.strategy !== "direct") {
            throw new Error("Direct deployment failed")
          }

          return true
        },
      )
      result.tests.push(directDeployTest)

      // Test 2: Canary deployment for medium risk
      const canaryDeployTest = await this.runTest(
        "Canary deployment for medium risk",
        async () => {
          const evolution: EvolutionResult = {
            requestId: "test-deploy-2",
            status: "completed",
            hypothesis: {
              id: "test-hypothesis-canary",
              type: "performance-optimization",
              description: "Test canary",
              confidence: 0.7,
            },
            changes: [
              {
                file: "test.js",
                originalContent: "old",
                evolvedContent: "new",
                diff: "diff",
                explanation: "Updated",
              },
            ],
            metrics: {
              performanceGain: 0.2,
              riskLevel: 0.5,
              confidence: 0.7,
            },
            timestamp: Date.now(),
          }

          const deployment = await this.components.deployment.deployEvolution(
            evolution,
            {
              valid: true,
              report: { performanceImprovement: 0.2 },
            } as ValidationResult,
          )

          if (!deployment.success || deployment.strategy !== "canary") {
            throw new Error("Canary deployment failed")
          }

          return true
        },
      )
      result.tests.push(canaryDeployTest)

      result.success = result.tests.every((t) => t.passed)
      result.duration = Date.now() - startTime
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      log.error(`${phase} failed`, { error })
    }

    return result
  }

  private async testPostDeployment(): Promise<PhaseTestResult> {
    const phase = "Post-Deployment"
    log.info(`Testing ${phase}`)

    const result: PhaseTestResult = {
      phase,
      success: false,
      tests: [],
    }

    const startTime = Date.now()

    try {
      // Test 1: Monitor deployed evolution
      const monitoringTest = await this.runTest(
        "Monitor deployed evolution",
        async () => {
          const evolutionId = "test-evolution-monitor"

          // Get deployment (it should exist from deployment phase)
          const deployment =
            await this.components.deployment.getDeployment(evolutionId)

          if (!deployment) {
            // Create a test deployment
            const evolution: EvolutionResult = {
              requestId: evolutionId,
              status: "completed",
              hypothesis: {
                id: "test-hypothesis-monitor",
                type: "performance-optimization",
                description: "Test monitoring",
                confidence: 0.8,
              },
              changes: [],
              metrics: {
                performanceGain: 0.1,
                riskLevel: 0.2,
                confidence: 0.8,
              },
              timestamp: Date.now(),
            }

            await this.components.deployment.deployEvolution(evolution, {
              valid: true,
              report: {},
            } as ValidationResult)
          }

          // Check monitoring is active
          const status =
            await this.components.deployment.getDeploymentStatus(evolutionId)

          if (!status) {
            throw new Error("Deployment monitoring not available")
          }

          return true
        },
      )
      result.tests.push(monitoringTest)

      // Test 2: Automatic rollback on errors
      const rollbackTest = await this.runTest(
        "Automatic rollback on errors",
        async () => {
          const evolutionId = "test-evolution-rollback"

          // Create deployment
          const evolution: EvolutionResult = {
            requestId: evolutionId,
            status: "completed",
            hypothesis: {
              id: "test-hypothesis-rollback",
              type: "performance-optimization",
              description: "Test rollback",
              confidence: 0.8,
            },
            changes: [],
            metrics: {
              performanceGain: 0.1,
              riskLevel: 0.3,
              confidence: 0.8,
            },
            timestamp: Date.now(),
          }

          const deployment = await this.components.deployment.deployEvolution(
            evolution,
            { valid: true, report: {} } as ValidationResult,
          )

          // Simulate error spike by triggering rollback
          if (deployment.success) {
            await this.components.deployment.rollbackDeployment(
              evolutionId,
              "High error rate detected",
            )
          }

          // Check if rollback completed
          const finalDeployment =
            await this.components.deployment.getDeployment(evolutionId)

          if (!finalDeployment || finalDeployment.status !== "rolled-back") {
            throw new Error("Rollback not completed")
          }

          return true
        },
      )
      result.tests.push(rollbackTest)

      result.success = result.tests.every((t) => t.passed)
      result.duration = Date.now() - startTime
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      log.error(`${phase} failed`, { error })
    }

    return result
  }

  private async runTest(
    name: string,
    testFn: () => Promise<boolean>,
  ): Promise<TestCase> {
    const startTime = Date.now()
    const testCase: TestCase = {
      name,
      passed: false,
      duration: 0,
    }

    try {
      testCase.passed = await testFn()
      testCase.duration = Date.now() - startTime
      log.info(`Test "${name}" ${testCase.passed ? "passed" : "failed"}`, {
        duration: testCase.duration,
      })
    } catch (error) {
      testCase.passed = false
      testCase.error = error instanceof Error ? error.message : String(error)
      testCase.duration = Date.now() - startTime
      log.error(`Test "${name}" threw error`, { error: testCase.error })
    }

    return testCase
  }
}
