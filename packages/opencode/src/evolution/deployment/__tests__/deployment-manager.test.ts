/**
 * Tests for Evolution Deployment Manager
 */

import { describe, it, expect, beforeEach, vi } from "bun:test"
import { EvolutionDeploymentManager } from "../evolution-deployment-manager"
import type { EvolutionResult, ValidationResult } from "../../types"

describe("EvolutionDeploymentManager", () => {
  let manager: EvolutionDeploymentManager
  let mockConfig: any

  beforeEach(() => {
    mockConfig = {
      strategies: {
        riskThresholds: {
          low: 0.2,
          medium: 0.5,
          high: 0.5,
        },
      },
      monitoring: {
        interval: 1000,
        errorThreshold: 0.05,
        performanceThreshold: 500,
      },
      rollout: {
        canaryPercentages: [5, 25, 50, 100],
        stageDurations: [5000, 10000, 15000, 0],
      },
    }

    manager = new EvolutionDeploymentManager(mockConfig)
  })

  describe("Strategy Selection", () => {
    it("should select direct deployment for low risk evolutions", () => {
      const evolution = createEvolution("fix_bugs")
      const validation = createValidationResult(0.1, 5, 0)

      const strategy = (manager as any).selectStrategy(evolution, validation)

      expect(strategy).toBe("direct")
    })

    it("should select canary deployment for medium risk evolutions", () => {
      const evolution = createEvolution("add_feature")
      const validation = createValidationResult(0, 10, 0)

      const strategy = (manager as any).selectStrategy(evolution, validation)

      expect(strategy).toBe("canary")
    })

    it("should select blue-green deployment for high risk evolutions", () => {
      const evolution = createEvolution("refactor_code")
      const validation = createValidationResult(-10, 20, 0.05)

      const strategy = (manager as any).selectStrategy(evolution, validation)

      expect(strategy).toBe("blue-green")
    })
  })

  describe("Risk Score Calculation", () => {
    it("should calculate low risk score for bug fixes", () => {
      const evolution = createEvolution("fix_bugs")
      const validation = createValidationResult(10, 0, 0)

      const riskScore = (manager as any).calculateRiskScore(
        evolution,
        validation,
      )

      expect(riskScore).toBeLessThan(0.2)
    })

    it("should increase risk score for performance degradation", () => {
      const evolution = createEvolution("add_feature")
      const validation = createValidationResult(-20, 0, 0)

      const riskScore = (manager as any).calculateRiskScore(
        evolution,
        validation,
      )

      expect(riskScore).toBeGreaterThan(0.3)
    })

    it("should increase risk score for memory increase", () => {
      const evolution = createEvolution("add_feature")
      const validation = createValidationResult(0, 30, 0)

      const riskScore = (manager as any).calculateRiskScore(
        evolution,
        validation,
      )

      expect(riskScore).toBeGreaterThan(0.3)
    })

    it("should cap risk score at 1.0", () => {
      const evolution = createEvolution("custom")
      const validation = createValidationResult(-50, 50, 0.1)

      const riskScore = (manager as any).calculateRiskScore(
        evolution,
        validation,
      )

      expect(riskScore).toBe(1)
    })
  })

  describe("Deployment Execution", () => {
    it("should successfully deploy low risk evolution", async () => {
      const evolution = createEvolution("fix_bugs")
      const validation = createValidationResult(10, 5, 0)

      // Mock the internal methods
      vi.spyOn(manager as any, "executeDeployment").mockResolvedValue(true)
      vi.spyOn(manager as any, "monitorDeployment").mockResolvedValue(true)

      const result = await manager.deployEvolution(evolution, validation)

      expect(result.success).toBe(true)
      expect(result.strategy).toBe("direct")
      expect(result.rollbackRequired).toBe(false)
    })

    it("should rollback on deployment failure", async () => {
      const evolution = createEvolution("add_feature")
      const validation = createValidationResult(0, 10, 0)

      // Mock deployment failure
      vi.spyOn(manager as any, "executeDeployment").mockResolvedValue(false)
      vi.spyOn(manager as any, "rollbackDeployment").mockResolvedValue(
        undefined,
      )

      const result = await manager.deployEvolution(evolution, validation)

      expect(result.success).toBe(false)
      expect(result.rollbackRequired).toBe(true)
      expect(result.message).toContain("rolled back")
    })

    it("should rollback on monitoring failure", async () => {
      const evolution = createEvolution("add_feature")
      const validation = createValidationResult(0, 10, 0)

      // Mock monitoring failure
      vi.spyOn(manager as any, "executeDeployment").mockResolvedValue(true)
      vi.spyOn(manager as any, "monitorDeployment").mockResolvedValue(false)
      vi.spyOn(manager as any, "rollbackDeployment").mockResolvedValue(
        undefined,
      )

      const result = await manager.deployEvolution(evolution, validation)

      expect(result.success).toBe(false)
      expect(result.rollbackRequired).toBe(true)
      expect(result.message).toContain("Monitoring detected issues")
    })
  })

  describe("Active Deployments", () => {
    it("should track active deployments", async () => {
      const evolution = createEvolution("fix_bugs")
      const validation = createValidationResult(10, 5, 0)

      // Start deployment without waiting
      const deploymentPromise = manager.deployEvolution(evolution, validation)

      // Check active deployments immediately
      const activeDeployments = await manager.getActiveDeployments()
      expect(activeDeployments.length).toBeGreaterThan(0)

      // Clean up
      await deploymentPromise
    })

    it("should remove completed deployments from active list", async () => {
      const evolution = createEvolution("fix_bugs")
      const validation = createValidationResult(10, 5, 0)

      // Mock quick completion
      vi.spyOn(manager as any, "executeDeployment").mockResolvedValue(true)
      vi.spyOn(manager as any, "monitorDeployment").mockResolvedValue(true)

      await manager.deployEvolution(evolution, validation)

      const activeDeployments = await manager.getActiveDeployments()
      expect(activeDeployments.length).toBe(0)
    })
  })
})

// Helper functions

function createEvolution(type: string): EvolutionResult {
  return {
    id: `evolution-${Date.now()}`,
    requestId: `request-${Date.now()}`,
    status: "completed" as any,
    hypothesis: {
      id: `hypothesis-${Date.now()}`,
      type: type as any,
      description: `Test ${type} evolution`,
      expectedImpact: [],
      confidence: 0.8,
      risks: [],
      dependencies: [],
    },
    changes: [
      {
        file: "test.ts",
        originalContent: "original",
        evolvedContent: "evolved",
        diff: "diff",
        explanation: "test change",
      },
    ],
    metrics: {
      before: {},
      after: {},
      improvement: {},
    },
    testResults: {
      passed: true,
      totalTests: 10,
      passedTests: 10,
      failedTests: 0,
      details: "All tests passed",
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
  }
}

function createValidationResult(
  performanceImprovement: number,
  memoryIncrease: number,
  errorRateChange: number,
): ValidationResult {
  return {
    valid: true,
    report: {} as any,
    metrics: {
      baseline: {} as any,
      evolved: {} as any,
      comparison: {
        performance: {
          improvement: performanceImprovement,
          significant: Math.abs(performanceImprovement) > 5,
          confidence: 0.95,
          baselineOps: 1000,
          evolvedOps: 1000 * (1 + performanceImprovement / 100),
        } as any,
        memory: {
          increase: memoryIncrease,
          leakDetected: false,
          baselineMemory: 100000000,
          evolvedMemory: 100000000 * (1 + memoryIncrease / 100),
        } as any,
        reliability: {
          errorRateChange,
          newErrorTypes: [],
          baselineErrorRate: 0.01,
          evolvedErrorRate: 0.01 + errorRateChange,
        } as any,
        overall: {
          confidence: 0.9,
          recommendation: "proceed",
        } as any,
      },
    },
    decision: {
      approved: true,
      failures: [],
      warnings: [],
    } as any,
  }
}
