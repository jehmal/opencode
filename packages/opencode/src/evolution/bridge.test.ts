/**
 * Evolution Bridge tests
 */

import { describe, test, expect, beforeEach } from "bun:test"
import { EvolutionBridge } from "./bridge"
import { DGMStatus } from "../dgm/types"
import {
  EvolutionConfig,
  EvolutionEvent,
  EvolutionRequestType,
  EvolutionStatus,
  type EvolutionRequest,
} from "./types"

describe("EvolutionBridge", () => {
  let evolutionBridge: EvolutionBridge
  let mockDGMBridge: any
  let config: EvolutionConfig

  beforeEach(() => {
    // Create mock DGM bridge
    mockDGMBridge = {
      status: DGMStatus.READY,
      executeTool: async (tool: string, _params: any) => {
        if (tool === "evolution.analyze") {
          return {
            description: "Test improvement",
            expectedImpact: [
              {
                metric: "executionTime",
                currentValue: 100,
                targetValue: 50,
                improvementPercentage: 50,
              },
            ],
            confidence: 0.8,
            risks: ["Minor risk"],
            dependencies: [],
          }
        }
        if (tool === "evolution.generate") {
          return {
            content: "evolved code",
            explanation: "Optimized algorithm",
          }
        }
        if (tool === "evolution.validate") {
          return {
            apiCompatibility: true,
            backwardCompatibility: true,
            securityCheck: true,
            performanceRegression: false,
            details: [],
          }
        }
        if (tool === "evolution.metrics") {
          return {
            executionTime: 80,
            memoryUsage: 40,
          }
        }
        if (tool === "evolution.snapshot") {
          return { success: true }
        }
        if (tool === "evolution.rollback") {
          return { success: true }
        }
        return {}
      },
      on: () => {},
      off: () => {},
    }

    // Create config
    config = {
      enabled: true,
      autoEvolve: false,
      evolutionThreshold: {
        performanceDegradation: 20,
        errorRateIncrease: 10,
        testFailureRate: 5,
      },
      maxConcurrentEvolutions: 3,
      evolutionTimeout: 600000,
      rollbackOnFailure: true,
      requireApproval: true,
      telemetry: {
        trackMetrics: false,
        reportingInterval: 60000,
      },
    }

    evolutionBridge = new EvolutionBridge(config, mockDGMBridge)
  })

  describe("requestEvolution", () => {
    test("should create and process evolution request", async () => {
      const request: EvolutionRequest = {
        id: "test-request-1",
        type: EvolutionRequestType.IMPROVE_PERFORMANCE,
        targetFiles: ["/test/file.ts"],
        context: {
          projectPath: "/test/project",
          language: "typescript",
          testCommand: "npm test",
          performanceCommand: "npm run perf",
        },
        constraints: {
          maxExecutionTime: 300000,
          preserveApi: true,
          maintainBackwardCompatibility: true,
          requireTests: true,
        },
        metrics: {
          baseline: {
            executionTime: 100,
            memoryUsage: 50,
          },
        },
      }

      const result = await evolutionBridge.requestEvolution(request)

      expect(result).toBeDefined()
      expect(result.requestId).toBe(request.id)
      expect(result.status).toBe(EvolutionStatus.PENDING)
      expect(result.hypothesis).toBeDefined()
    })

    test("should throw error if DGM bridge is not ready", async () => {
      mockDGMBridge.status = DGMStatus.ERROR

      const request: EvolutionRequest = {
        id: "test-request-2",
        type: EvolutionRequestType.FIX_BUGS,
        targetFiles: ["/test/file.ts"],
        context: {
          projectPath: "/test/project",
          language: "typescript",
        },
        constraints: {
          maxExecutionTime: 300000,
          preserveApi: true,
          maintainBackwardCompatibility: true,
          requireTests: true,
        },
        metrics: {
          baseline: {},
        },
      }

      try {
        await evolutionBridge.requestEvolution(request)
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("DGM bridge is not ready")
      }
    })

    test("should enforce concurrent evolution limit", async () => {
      const requests: EvolutionRequest[] = []
      for (let i = 0; i < 4; i++) {
        requests.push({
          id: `test-request-${i}`,
          type: EvolutionRequestType.REFACTOR_CODE,
          targetFiles: ["/test/file.ts"],
          context: {
            projectPath: "/test/project",
            language: "typescript",
          },
          constraints: {
            maxExecutionTime: 300000,
            preserveApi: true,
            maintainBackwardCompatibility: true,
            requireTests: true,
          },
          metrics: {
            baseline: {},
          },
        })
      }

      // Start 3 evolutions (the limit)
      const promises = requests
        .slice(0, 3)
        .map((r) => evolutionBridge.requestEvolution(r))
      await Promise.all(promises)

      // The 4th should fail
      try {
        await evolutionBridge.requestEvolution(requests[3])
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Maximum concurrent evolutions")
      }
    })
  })

  describe("getEvolutionStatus", () => {
    test("should return status for active evolution", async () => {
      const request: EvolutionRequest = {
        id: "test-request-3",
        type: EvolutionRequestType.OPTIMIZE_MEMORY,
        targetFiles: ["/test/file.ts"],
        context: {
          projectPath: "/test/project",
          language: "typescript",
        },
        constraints: {
          maxExecutionTime: 300000,
          preserveApi: true,
          maintainBackwardCompatibility: true,
          requireTests: true,
        },
        metrics: {
          baseline: {},
        },
      }

      const result = await evolutionBridge.requestEvolution(request)
      const status = await evolutionBridge.getEvolutionStatus(result.id)

      expect(status).toBeDefined()
      expect(status.id).toBe(result.id)
    })

    test("should throw error for non-existent evolution", async () => {
      try {
        await evolutionBridge.getEvolutionStatus("non-existent")
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Evolution non-existent not found")
      }
    })
  })

  describe("cancelEvolution", () => {
    test("should cancel active evolution", async () => {
      const request: EvolutionRequest = {
        id: "test-request-4",
        type: EvolutionRequestType.ENHANCE_SECURITY,
        targetFiles: ["/test/file.ts"],
        context: {
          projectPath: "/test/project",
          language: "typescript",
        },
        constraints: {
          maxExecutionTime: 300000,
          preserveApi: true,
          maintainBackwardCompatibility: true,
          requireTests: true,
        },
        metrics: {
          baseline: {},
        },
      }

      const result = await evolutionBridge.requestEvolution(request)
      await evolutionBridge.cancelEvolution(result.id)

      // Should now be in history
      const history = await evolutionBridge.getEvolutionHistory()
      expect(history.some((e) => e.id === result.id)).toBe(true)
    })
  })

  describe("getPerformanceMetrics", () => {
    test("should return metrics for target files", async () => {
      const targetFiles = ["/test/file1.ts", "/test/file2.ts"]

      const metrics = await evolutionBridge.getPerformanceMetrics(targetFiles)
      expect(metrics).toBeDefined()
      expect(metrics.executionTime).toBe(80)
      expect(metrics.memoryUsage).toBe(40)
    })

    test("should cache metrics", async () => {
      const targetFiles = ["/test/file1.ts", "/test/file2.ts"]
      let callCount = 0
      const originalExecuteTool = mockDGMBridge.executeTool
      mockDGMBridge.executeTool = async (tool: string, params: any) => {
        if (tool === "evolution.metrics") {
          callCount++
        }
        return originalExecuteTool(tool, params)
      }

      // First call
      await evolutionBridge.getPerformanceMetrics(targetFiles)
      expect(callCount).toBe(1)

      // Second call (should use cache)
      await evolutionBridge.getPerformanceMetrics(targetFiles)
      expect(callCount).toBe(1)
    })
  })

  describe("createSession", () => {
    test("should create evolution session", async () => {
      const session = await evolutionBridge.createSession(
        "Performance Optimization",
        "Optimize all critical paths",
      )

      expect(session).toBeDefined()
      expect(session.name).toBe("Performance Optimization")
      expect(session.status).toBe("active")
      expect(session.requests).toEqual([])
    })
  })

  describe("getActiveSessions", () => {
    test("should return only active sessions", async () => {
      await evolutionBridge.createSession("Session 1", "Description 1")
      await evolutionBridge.createSession("Session 2", "Description 2")

      const activeSessions = await evolutionBridge.getActiveSessions()
      expect(activeSessions).toHaveLength(2)
    })
  })

  describe("healthCheck", () => {
    test("should return health status", async () => {
      const health = await evolutionBridge.healthCheck()

      expect(health).toBeDefined()
      expect(health.status).toBe(DGMStatus.READY)
      expect(health.activeEvolutions).toBe(0)
      expect(health.completedEvolutions).toBe(0)
      expect(health.successRate).toBe(0)
    })
  })

  describe("event emissions", () => {
    test("should emit lifecycle events", async () => {
      const events: string[] = []

      // Register event listeners
      Object.values(EvolutionEvent).forEach((event) => {
        evolutionBridge.on(event, () => events.push(event))
      })

      const request: EvolutionRequest = {
        id: "test-request-5",
        type: EvolutionRequestType.IMPROVE_READABILITY,
        targetFiles: ["/test/file.ts"],
        context: {
          projectPath: "/test/project",
          language: "typescript",
        },
        constraints: {
          maxExecutionTime: 300000,
          preserveApi: true,
          maintainBackwardCompatibility: true,
          requireTests: true,
        },
        metrics: {
          baseline: {},
        },
      }

      await evolutionBridge.requestEvolution(request)

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(events).toContain(EvolutionEvent.REQUEST_CREATED)
      expect(events).toContain(EvolutionEvent.ANALYSIS_STARTED)
    })
  })

  describe("shutdown", () => {
    test("should cancel all active evolutions on shutdown", async () => {
      const request: EvolutionRequest = {
        id: "test-request-6",
        type: EvolutionRequestType.CUSTOM,
        targetFiles: ["/test/file.ts"],
        context: {
          projectPath: "/test/project",
          language: "typescript",
        },
        constraints: {
          maxExecutionTime: 300000,
          preserveApi: true,
          maintainBackwardCompatibility: true,
          requireTests: true,
        },
        metrics: {
          baseline: {},
        },
        customPrompt: "Custom optimization",
      }

      await evolutionBridge.requestEvolution(request)
      await evolutionBridge.shutdown()

      const health = await evolutionBridge.healthCheck()
      expect(health.activeEvolutions).toBe(0)
    })
  })
})
