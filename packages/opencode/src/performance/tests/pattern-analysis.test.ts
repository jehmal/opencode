/**
 * Tests for usage pattern analysis system
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { SessionPerformanceExtended } from "../session-performance-extended"
import {
  PatternRecognitionEngine,
  HypothesisGenerator,
  PatternType,
} from "../../evolution/patterns/pattern-recognition"
import { PatternStorage } from "../pattern-storage"
import { PatternEvolutionIntegration } from "../../evolution/pattern-integration"
import type { ExtendedMetrics } from "../session-performance-extended"

describe("Pattern Analysis System", () => {
  const sessionId = "test-session-123"
  let storage: ReturnType<typeof PatternStorage.getInstance>

  beforeEach(() => {
    // Reset storage
    PatternStorage.reset()
    storage = PatternStorage.getInstance()

    // Clear any existing metrics
    SessionPerformanceExtended.clearMetrics(sessionId)
  })

  afterEach(() => {
    SessionPerformanceExtended.clearMetrics(sessionId)
    PatternStorage.reset()
  })

  describe("Extended Metrics Collection", () => {
    it("should track detailed execution metrics", () => {
      // Track a tool execution
      const executionId = SessionPerformanceExtended.trackExecution(
        sessionId,
        "read",
        "msg-1",
        {
          parameters: { filePath: "/test/file.ts" },
          previousTool: "list",
          parallelTools: ["grep"],
          userIntent: "Find specific code",
        },
      )

      // Complete execution
      const metrics = SessionPerformanceExtended.completeExecution(
        sessionId,
        executionId,
        {
          success: true,
          output: "file contents",
          resourceUsage: {
            memoryDelta: 1024 * 1024, // 1MB
            ioOperations: 1,
            fileSystemAccess: 1,
          },
        },
      )

      expect(metrics).toBeTruthy()
      expect(metrics?.toolId).toBe("read")
      expect(metrics?.success).toBe(true)
      expect(metrics?.resourceUsage.memoryDelta).toBe(1024 * 1024)
      expect(metrics?.executionContext.previousTool).toBe("list")
    })

    it("should track error patterns", () => {
      const executionId = SessionPerformanceExtended.trackExecution(
        sessionId,
        "bash",
        "msg-2",
      )

      const metrics = SessionPerformanceExtended.completeExecution(
        sessionId,
        executionId,
        {
          success: false,
          error: new Error("Command not found"),
          errorRecovery: true,
        },
      )

      expect(metrics?.success).toBe(false)
      expect(metrics?.error).toBe("Command not found")
      expect(metrics?.errorPatterns?.errorType).toBe("Error")
      expect(metrics?.executionContext.errorRecovery).toBe(true)
    })
  })

  describe("Pattern Detection", () => {
    it("should detect hotspot patterns", () => {
      // Create a sequence of metrics
      const metrics: ExtendedMetrics[] = []

      // Simulate frequent read->write pattern
      for (let i = 0; i < 10; i++) {
        metrics.push(createMockMetric("read", i * 2, true))
        metrics.push(createMockMetric("write", i * 2 + 1, true))
      }

      const patterns = PatternRecognitionEngine.analyzeMetrics(metrics)
      const hotspots = patterns.filter(
        (p: any) => p.type === PatternType.HOTSPOT,
      )

      expect(hotspots.length).toBeGreaterThan(0)
      expect(hotspots[0].context.tools).toContain("read")
      expect(hotspots[0].context.tools).toContain("write")
      expect(hotspots[0].frequency).toBeGreaterThan(5)
    })

    it("should detect bottleneck patterns", () => {
      const metrics: ExtendedMetrics[] = []

      // Create slow bash executions
      for (let i = 0; i < 5; i++) {
        metrics.push(createMockMetric("bash", i, true, 5000)) // 5 second execution
      }

      const patterns = PatternRecognitionEngine.analyzeMetrics(metrics)
      const bottlenecks = patterns.filter(
        (p: any) => p.type === PatternType.BOTTLENECK,
      )

      expect(bottlenecks.length).toBeGreaterThan(0)
      expect(bottlenecks[0].context.tools).toContain("bash")
      expect(bottlenecks[0].improvementOpportunity.description).toContain(
        "slow execution",
      )
    })

    it("should detect inefficient patterns", () => {
      const metrics: ExtendedMetrics[] = [
        createMockMetric("read", 0, true),
        createMockMetric("read", 1, true),
        createMockMetric("write", 2, true),
      ]

      const patterns = PatternRecognitionEngine.analyzeMetrics(metrics)
      const inefficiencies = patterns.filter(
        (p: any) => p.type === PatternType.INEFFICIENCY,
      )

      expect(inefficiencies.length).toBeGreaterThan(0)
      expect(inefficiencies[0].improvementOpportunity.description).toContain(
        "Multiple read operations",
      )
    })

    it("should detect error-prone patterns", () => {
      const metrics: ExtendedMetrics[] = []

      // Create pattern with high error rate
      for (let i = 0; i < 10; i++) {
        metrics.push(createMockMetric("grep", i * 3, true))
        metrics.push(createMockMetric("bash", i * 3 + 1, i % 3 !== 0)) // 33% error rate
        metrics.push(createMockMetric("write", i * 3 + 2, true))
      }

      const patterns = PatternRecognitionEngine.analyzeMetrics(metrics)
      const errorPatterns = patterns.filter(
        (p: any) => p.type === PatternType.ERROR_PRONE,
      )

      expect(errorPatterns.length).toBeGreaterThan(0)
      expect(errorPatterns[0].context.errorRate).toBeGreaterThan(0.2)
    })
  })

  describe("Hypothesis Generation", () => {
    it("should generate improvement hypotheses from patterns", () => {
      const metrics: ExtendedMetrics[] = []

      // Create various patterns
      for (let i = 0; i < 20; i++) {
        metrics.push(createMockMetric("read", i * 2, true, 1000))
        metrics.push(createMockMetric("write", i * 2 + 1, true, 1500))
      }

      const patterns = PatternRecognitionEngine.analyzeMetrics(metrics)
      const hypotheses = HypothesisGenerator.generateHypotheses(patterns)

      expect(hypotheses.length).toBeGreaterThan(0)
      expect(hypotheses[0].type).toBeDefined()
      expect(hypotheses[0].expectedImpact.length).toBeGreaterThan(0)
      expect(hypotheses[0].confidence).toBeGreaterThan(0.5)
    })

    it("should prioritize high-impact hypotheses", () => {
      const metrics: ExtendedMetrics[] = []

      // Create high-impact pattern (slow + frequent)
      for (let i = 0; i < 50; i++) {
        metrics.push(createMockMetric("bash", i, true, 10000)) // Very slow
      }

      const patterns = PatternRecognitionEngine.analyzeMetrics(metrics)
      const hypotheses = HypothesisGenerator.generateHypotheses(patterns)

      expect(hypotheses.length).toBeGreaterThan(0)
      const topHypothesis = hypotheses[0]
      expect(
        topHypothesis.expectedImpact[0].improvementPercentage,
      ).toBeGreaterThan(30)
    })
  })

  describe("Pattern Storage", () => {
    it("should store and retrieve metrics", async () => {
      const metrics: ExtendedMetrics[] = [
        createMockMetric("read", 0, true),
        createMockMetric("write", 1, true),
      ]

      await storage.storeMetrics(sessionId, metrics)
      const retrieved = await storage.getSessionMetrics(sessionId)

      expect(retrieved.length).toBe(2)
      expect(retrieved[0].toolId).toBe("read")
      expect(retrieved[1].toolId).toBe("write")
    })

    it("should aggregate patterns across sessions", async () => {
      // Store patterns from multiple sessions
      const pattern1 = {
        id: "pattern-1",
        type: PatternType.HOTSPOT,
        confidence: 0.9,
        frequency: 10,
        impact: {
          performanceImpact: 0.8,
          userExperienceImpact: 0.7,
          resourceImpact: 0.5,
        },
        context: {
          tools: ["read", "write"],
          averageExecutionTime: 1000,
          errorRate: 0,
          resourceUsage: { memory: 1024, io: 2 },
        },
        improvementOpportunity: {
          description: "Optimize read-write sequence",
          expectedBenefit: "50% faster",
          implementationComplexity: "medium" as const,
          risks: [],
        },
      }

      await storage.storePatterns("session-1", [pattern1])
      await storage.storePatterns("session-2", [pattern1])

      const aggregated = await storage.aggregatePatterns()

      expect(aggregated.length).toBeGreaterThan(0)
      expect(aggregated[0].frequency).toBe(2)
    })
  })

  describe("Evolution Integration", () => {
    it("should analyze session and generate recommendations", async () => {
      const integration = new PatternEvolutionIntegration()

      // Create metrics with patterns
      for (let i = 0; i < 20; i++) {
        const execId = SessionPerformanceExtended.trackExecution(
          sessionId,
          i % 2 === 0 ? "read" : "write",
          `msg-${i}`,
        )

        SessionPerformanceExtended.completeExecution(sessionId, execId, {
          success: true,
          resourceUsage: {
            memoryDelta: 1024 * 1024,
            ioOperations: 1,
          },
        })
      }

      const analysis = await integration.analyzeSession(sessionId)

      expect(analysis.patterns.length).toBeGreaterThan(0)
      expect(analysis.hypotheses.length).toBeGreaterThan(0)
      expect(analysis.recommendations).toBeDefined()
    })

    it("should monitor and trigger evolution when thresholds are met", async () => {
      const integration = new PatternEvolutionIntegration()

      // Create high-frequency pattern
      for (let i = 0; i < 50; i++) {
        const execId = SessionPerformanceExtended.trackExecution(
          sessionId,
          "bash",
          `msg-${i}`,
        )

        SessionPerformanceExtended.completeExecution(sessionId, execId, {
          success: true,
          resourceUsage: {
            memoryDelta: 10 * 1024 * 1024, // 10MB - high memory usage
          },
        })
      }

      const result = await integration.monitorAndEvolve(sessionId, {
        minPatternFrequency: 10,
        minConfidence: 0.7,
        minImpact: 0.3,
      })

      expect(result.triggered).toBe(true)
      expect(result.reason).toContain("significant patterns")
      expect(result.recommendations).toBeDefined()
    })
  })
})

// Helper function to create mock metrics
function createMockMetric(
  toolId: string,
  index: number,
  success: boolean,
  duration: number = 100,
): ExtendedMetrics {
  return {
    toolId,
    sessionId: "test-session",
    messageId: `msg-${index}`,
    startTime: Date.now() + index * 1000,
    endTime: Date.now() + index * 1000 + duration,
    duration,
    success,
    inputSize: 100,
    outputSize: 200,
    executionContext: {
      parallelTools: [],
      errorRecovery: false,
    },
    parameterPatterns: {
      parameterTypes: {},
      parameterValues: {},
      parameterFrequency: {},
      commonCombinations: [],
    },
    resourceUsage: {
      memoryDelta: 1024,
      ioOperations: 1,
      networkCalls: 0,
      fileSystemAccess: 1,
    },
    userBehavior: {
      retryCount: 0,
      modificationCount: 0,
    },
  }
}
