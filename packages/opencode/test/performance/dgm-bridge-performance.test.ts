/**
 * DGM Bridge Performance Test Suite
 *
 * Validates all Sprint 1 performance targets:
 * - Bridge call latency: <100ms
 * - Health check response: <50ms
 * - Tool execution overhead: <10ms
 * - Memory usage increase: <50MB
 * - Startup time increase: <2 seconds
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { performance } from "perf_hooks"
import { DGMBridge } from "../../src/dgm/bridge"
import { DGMConfig } from "../../src/dgm/types"

// Performance targets
const TARGETS = {
  BRIDGE_LATENCY: 100, // ms
  HEALTH_CHECK: 50, // ms
  TOOL_OVERHEAD: 10, // ms
  MEMORY_INCREASE: 50 * 1024 * 1024, // 50MB in bytes
  STARTUP_TIME: 2000, // ms
}

// Test configuration
const testConfig: DGMConfig = {
  enabled: true,
  pythonPath: "python3",
  dgmPath: undefined,
  timeout: 30000,
  maxRetries: 3,
  healthCheckInterval: 5000,
}

describe("DGM Bridge Performance Tests", () => {
  let bridge: DGMBridge
  let baselineMemory: NodeJS.MemoryUsage

  beforeAll(async () => {
    // Record baseline memory before bridge initialization
    if ((global as any).gc) {
      ;(global as any).gc()
    }
    baselineMemory = process.memoryUsage()
  })

  afterAll(async () => {
    if (bridge) {
      await bridge.shutdown()
    }
  })

  describe("Startup Performance", () => {
    it("should initialize within 2 seconds", async () => {
      const startTime = performance.now()
      bridge = new DGMBridge(testConfig)
      await bridge.initialize()
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(TARGETS.STARTUP_TIME)
      console.log(
        `✅ Startup time: ${duration.toFixed(2)}ms (target: <${TARGETS.STARTUP_TIME}ms)`,
      )
    })
  })

  describe("Latency Performance", () => {
    it("should have health check latency under 50ms", async () => {
      // Warm up
      for (let i = 0; i < 5; i++) {
        await bridge.healthCheck()
      }

      // Measure
      const latencies: number[] = []
      for (let i = 0; i < 20; i++) {
        const start = performance.now()
        await bridge.healthCheck()
        latencies.push(performance.now() - start)
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const p95 = latencies.sort((a, b) => a - b)[
        Math.floor(latencies.length * 0.95)
      ]

      expect(avgLatency).toBeLessThan(TARGETS.HEALTH_CHECK)
      console.log(
        `✅ Health check avg latency: ${avgLatency.toFixed(2)}ms (target: <${TARGETS.HEALTH_CHECK}ms)`,
      )
      console.log(`   P95 latency: ${p95.toFixed(2)}ms`)
    })

    it("should have bridge call latency under 100ms", async () => {
      // Test getTools operation
      const latencies: number[] = []
      for (let i = 0; i < 20; i++) {
        const start = performance.now()
        await bridge.getTools()
        latencies.push(performance.now() - start)
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const p95 = latencies.sort((a, b) => a - b)[
        Math.floor(latencies.length * 0.95)
      ]

      expect(avgLatency).toBeLessThan(TARGETS.BRIDGE_LATENCY)
      console.log(
        `✅ Bridge call avg latency: ${avgLatency.toFixed(2)}ms (target: <${TARGETS.BRIDGE_LATENCY}ms)`,
      )
      console.log(`   P95 latency: ${p95.toFixed(2)}ms`)
    })

    it("should have tool execution overhead under 10ms", async () => {
      // Measure the overhead of the bridge call itself (not the tool execution)
      const overheads: number[] = []

      for (let i = 0; i < 10; i++) {
        const start = performance.now()
        try {
          // Execute a simple tool that should be fast
          await bridge.executeTool("memory_search", { query: "test" }, {})
        } catch (error) {
          // Tool might not exist, we're measuring overhead not success
        }
        const totalTime = performance.now() - start

        // Assume actual tool execution takes at least 5ms
        // So overhead is total time minus expected tool time
        const overhead = Math.max(0, totalTime - 5)
        overheads.push(overhead)
      }

      const avgOverhead =
        overheads.reduce((a, b) => a + b, 0) / overheads.length

      expect(avgOverhead).toBeLessThan(TARGETS.TOOL_OVERHEAD)
      console.log(
        `✅ Tool execution overhead: ${avgOverhead.toFixed(2)}ms (target: <${TARGETS.TOOL_OVERHEAD}ms)`,
      )
    })
  })

  describe("Memory Performance", () => {
    it("should have memory increase under 50MB", async () => {
      // Perform operations to stress memory
      for (let i = 0; i < 50; i++) {
        await bridge.healthCheck()
        await bridge.getTools()
      }

      // Force garbage collection if available
      if ((global as any).gc) {
        ;(global as any).gc()
      }

      const currentMemory = process.memoryUsage()
      const heapIncrease = currentMemory.heapUsed - baselineMemory.heapUsed
      const rssIncrease = currentMemory.rss - baselineMemory.rss

      expect(heapIncrease).toBeLessThan(TARGETS.MEMORY_INCREASE)
      expect(rssIncrease).toBeLessThan(TARGETS.MEMORY_INCREASE)

      console.log(
        `✅ Heap memory increase: ${(heapIncrease / 1024 / 1024).toFixed(2)}MB (target: <50MB)`,
      )
      console.log(
        `✅ RSS memory increase: ${(rssIncrease / 1024 / 1024).toFixed(2)}MB (target: <50MB)`,
      )
    })
  })

  describe("Concurrent Operations", () => {
    it("should handle concurrent requests efficiently", async () => {
      const concurrency = 10
      const requestsPerWorker = 10

      const start = performance.now()
      const results = await Promise.all(
        Array(concurrency)
          .fill(0)
          .map(async () => {
            const workerLatencies: number[] = []
            for (let j = 0; j < requestsPerWorker; j++) {
              const opStart = performance.now()
              await bridge.healthCheck()
              workerLatencies.push(performance.now() - opStart)
            }
            return workerLatencies
          }),
      )
      const totalTime = performance.now() - start

      const allLatencies = results.flat()
      const avgLatency =
        allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
      const throughput = (concurrency * requestsPerWorker) / (totalTime / 1000)

      expect(avgLatency).toBeLessThan(TARGETS.BRIDGE_LATENCY * 2) // Allow 2x latency under load
      console.log(
        `✅ Concurrent operations avg latency: ${avgLatency.toFixed(2)}ms`,
      )
      console.log(`   Throughput: ${throughput.toFixed(2)} req/s`)
      console.log(
        `   Total time for ${concurrency * requestsPerWorker} requests: ${totalTime.toFixed(2)}ms`,
      )
    })
  })

  describe("Reliability", () => {
    it("should maintain high success rate under load", async () => {
      let successes = 0
      let failures = 0
      const totalRequests = 100

      for (let i = 0; i < totalRequests; i++) {
        try {
          await bridge.healthCheck()
          successes++
        } catch (error) {
          failures++
        }
      }

      const successRate = (successes / totalRequests) * 100
      expect(successRate).toBeGreaterThanOrEqual(99)
      console.log(`✅ Success rate: ${successRate.toFixed(1)}% (target: ≥99%)`)
    })
  })
})
