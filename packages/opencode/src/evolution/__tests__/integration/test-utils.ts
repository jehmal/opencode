/**
 * Test Utilities for Integration Testing
 * Provides helper functions and mock data for tests
 */

import type { UsageAnalyzer } from "../../orchestrator/usage-analyzer"
import type { EvolutionOrchestrator } from "../../orchestrator/evolution-orchestrator"
import type { ImprovementHypothesis } from "../../types"
import { Log } from "../../../util/log"

const log = Log.create({ service: "test-utils" })

export interface UsagePattern {
  name: string
  usages: Array<{
    tool: string
    duration: number
    memoryUsed: number
    errorCount: number
    timestamp?: number
  }>
}

export interface MockEvolution {
  id: string
  hypothesis: ImprovementHypothesis
  state: string
  startTime: number
  result?: {
    metrics?: {
      performanceGain?: number
    }
  }
}

export class TestUtilities {
  /**
   * Simulate usage patterns for testing
   */
  static async simulateUsagePattern(
    analyzer: UsageAnalyzer,
    pattern: UsagePattern,
  ): Promise<void> {
    log.info(`Simulating usage pattern: ${pattern.name}`)

    // In a real implementation, this would record actual usage data
    // For testing, we're simulating what the analyzer would detect
    for (const usage of pattern.usages) {
      // Add timestamp if not provided
      if (!usage.timestamp) {
        usage.timestamp = Date.now()
      }

      // Small delay for realism
      await this.sleep(10)
    }
  }

  /**
   * Wait for an evolution to be created and completed
   */
  static async waitForEvolution(
    orchestrator: EvolutionOrchestrator,
    timeout: number = 30000,
  ): Promise<MockEvolution> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const evolutions = orchestrator.getActiveEvolutions()

      if (evolutions.length > 0) {
        const evolution = evolutions[0]

        // Wait for completion
        while (
          evolution.state !== "completed" &&
          evolution.state !== "failed"
        ) {
          if (Date.now() - startTime > timeout) {
            throw new Error("Timeout waiting for evolution completion")
          }
          await this.sleep(100)
        }

        return evolution
      }

      await this.sleep(100)
    }

    throw new Error("Timeout waiting for evolution")
  }

  /**
   * Create a mock hypothesis for testing
   */
  static createMockHypothesis(type: string): ImprovementHypothesis {
    return {
      id: `hypothesis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: type as any, // Type assertion for testing
      description: `Test hypothesis for ${type}`,
      confidence: 0.8,
      targetTool: "test-tool",
      metrics: {
        expectedImprovement: 0.15,
      },
    }
  }

  /**
   * Create performance bottleneck patterns
   */
  static createBottleneckPatterns(): UsagePattern[] {
    return [
      {
        name: "Slow File I/O",
        usages: [
          {
            tool: "read",
            duration: 500,
            memoryUsed: 10 * 1024 * 1024,
            errorCount: 0,
          },
          {
            tool: "write",
            duration: 800,
            memoryUsed: 20 * 1024 * 1024,
            errorCount: 0,
          },
          {
            tool: "read",
            duration: 600,
            memoryUsed: 15 * 1024 * 1024,
            errorCount: 0,
          },
        ],
      },
      {
        name: "Memory Intensive Operations",
        usages: [
          {
            tool: "analyze",
            duration: 200,
            memoryUsed: 100 * 1024 * 1024,
            errorCount: 0,
          },
          {
            tool: "process",
            duration: 300,
            memoryUsed: 150 * 1024 * 1024,
            errorCount: 0,
          },
          {
            tool: "transform",
            duration: 250,
            memoryUsed: 200 * 1024 * 1024,
            errorCount: 0,
          },
        ],
      },
      {
        name: "Redundant Operations",
        usages: [
          {
            tool: "check",
            duration: 50,
            memoryUsed: 5 * 1024 * 1024,
            errorCount: 0,
          },
          {
            tool: "check",
            duration: 50,
            memoryUsed: 5 * 1024 * 1024,
            errorCount: 0,
          },
          {
            tool: "check",
            duration: 50,
            memoryUsed: 5 * 1024 * 1024,
            errorCount: 0,
          },
          {
            tool: "check",
            duration: 50,
            memoryUsed: 5 * 1024 * 1024,
            errorCount: 0,
          },
        ],
      },
    ]
  }

  /**
   * Create error-prone patterns
   */
  static createErrorPatterns(): UsagePattern[] {
    return [
      {
        name: "Frequent Errors",
        usages: [
          {
            tool: "parse",
            duration: 100,
            memoryUsed: 10 * 1024 * 1024,
            errorCount: 3,
          },
          {
            tool: "validate",
            duration: 150,
            memoryUsed: 15 * 1024 * 1024,
            errorCount: 2,
          },
          {
            tool: "compile",
            duration: 200,
            memoryUsed: 20 * 1024 * 1024,
            errorCount: 5,
          },
        ],
      },
    ]
  }

  /**
   * Calculate percentile from array of numbers
   */
  static percentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }

  /**
   * Sleep helper
   */
  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Generate random performance metrics
   */
  static generatePerformanceMetrics(
    baseline: number,
    variance: number = 0.1,
  ): number {
    const min = baseline * (1 - variance)
    const max = baseline * (1 + variance)
    return Math.random() * (max - min) + min
  }

  /**
   * Verify evolution structure
   */
  static verifyEvolutionStructure(evolution: any): boolean {
    return !!(
      evolution.id &&
      evolution.hypothesis &&
      evolution.state &&
      typeof evolution.startTime === "number"
    )
  }

  /**
   * Create test fixtures directory
   */
  static async createTestFixtures(): Promise<void> {
    const fs = await import("fs/promises")
    const path = await import("path")

    const fixturesDir = path.join(
      process.cwd(),
      "opencode/packages/opencode/src/evolution/__tests__/integration/__fixtures__",
    )

    await fs.mkdir(fixturesDir, { recursive: true })

    // Create fixture files
    const fixtures = {
      "slow-performance.json": {
        patterns: [
          {
            type: "performance-hotspot",
            tool: "bash",
            avgDuration: 500,
            occurrences: 100,
          },
        ],
      },
      "breaking-changes.json": {
        changes: [
          {
            file: "api.js",
            type: "signature-change",
            risk: "high",
          },
        ],
      },
      "success-patterns.json": {
        evolutions: [
          {
            type: "performance",
            improvement: 0.25,
            risk: 0.1,
          },
        ],
      },
    }

    for (const [filename, content] of Object.entries(fixtures)) {
      const filepath = path.join(fixturesDir, filename)
      await fs.writeFile(filepath, JSON.stringify(content, null, 2))
    }

    log.info("Test fixtures created")
  }
}
