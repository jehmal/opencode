import {
  describe,
  expect,
  test,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "bun:test"
import { experimental_createMCPClient, type Tool } from "ai"
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio"
import { App } from "../src/app/app"
import { MCP } from "../src/mcp"
import { SessionPerformance } from "../src/session/performance"
import { Log } from "../src/util/log"
import type {
  MCPRequest,
  MCPResponse,
  MCPTool,
  MockServerBehavior,
} from "./mcp-integration/mocks/shared/types"

const log = Log.create({ service: "throughput-test" })

interface ThroughputMetrics {
  requestsPerSecond: number
  averageLatency: number
  p95Latency: number
  p99Latency: number
  errorRate: number
  totalRequests: number
  totalErrors: number
  duration: number
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
  }
}

interface PayloadTestResult {
  payloadSize: number
  throughput: ThroughputMetrics
  serialization: {
    serializeTime: number
    deserializeTime: number
    overhead: number
  }
}

interface SustainedTestResult {
  intervals: ThroughputMetrics[]
  degradation: {
    initialRps: number
    finalRps: number
    degradationPercent: number
  }
  stability: {
    rpsVariance: number
    latencyVariance: number
    memoryGrowth: number
  }
}

class ThroughputTestFramework {
  private clients: Map<string, any> = new Map()
  private testSessionId: string = `throughput-test-${Date.now()}`

  async setup() {
    // Create mock MCP servers for testing
    await this.createMockServers()

    // Initialize performance tracking
    SessionPerformance.getTracker(this.testSessionId)
  }

  async teardown() {
    // Close all clients
    for (const client of this.clients.values()) {
      try {
        await client.close()
      } catch (error) {
        log.warn("Failed to close client", { error })
      }
    }
    this.clients.clear()

    // Save performance report
    const report = SessionPerformance.getReport(this.testSessionId)
    if (report) {
      await SessionPerformance.saveReport(this.testSessionId, report)
    }

    SessionPerformance.remove(this.testSessionId)
  }

  private async createMockServers() {
    // Create high-performance mock server
    const fastServer = await this.createMockServer("fast-server", {
      responseDelay: 1,
      failureRate: 0,
    })
    this.clients.set("fast", fastServer)

    // Create variable latency server
    const variableServer = await this.createMockServer("variable-server", {
      responseDelay: 10,
      failureRate: 0.01,
    })
    this.clients.set("variable", variableServer)

    // Create slow server for stress testing
    const slowServer = await this.createMockServer("slow-server", {
      responseDelay: 100,
      failureRate: 0.05,
    })
    this.clients.set("slow", slowServer)
  }

  private async createMockServer(name: string, behavior: MockServerBehavior) {
    // Mock server implementation that simulates MCP protocol
    const mockTools: MCPTool[] = [
      {
        name: "echo",
        description: "Echo input data",
        inputSchema: {
          type: "object",
          properties: {
            data: { type: "string" },
            size: { type: "number" },
          },
          required: ["data"],
        },
      },
      {
        name: "compute",
        description: "Perform computation",
        inputSchema: {
          type: "object",
          properties: {
            operation: { type: "string" },
            iterations: { type: "number" },
          },
          required: ["operation"],
        },
      },
      {
        name: "memory",
        description: "Memory allocation test",
        inputSchema: {
          type: "object",
          properties: {
            size: { type: "number" },
            pattern: { type: "string" },
          },
          required: ["size"],
        },
      },
    ]

    // Create mock client that simulates tool execution
    const mockClient = {
      name,
      async tools() {
        const tools: Record<string, Tool> = {}
        for (const tool of mockTools) {
          tools[tool.name] = {
            description: tool.description,
            parameters: tool.inputSchema,
            execute: async (params: any) => {
              const startTime = performance.now()

              // Simulate processing delay
              if (behavior.delay || behavior.responseDelay) {
                await new Promise((resolve) =>
                  setTimeout(
                    resolve,
                    behavior.delay || behavior.responseDelay || 0,
                  ),
                )
              }

              // Simulate failures
              if (
                behavior.failureRate &&
                Math.random() < behavior.failureRate
              ) {
                throw new Error(`Simulated failure in ${tool.name}`)
              }

              // Generate response based on tool type
              let result: any
              switch (tool.name) {
                case "echo":
                  result = {
                    echoed: params.data,
                    size: params.data?.length || 0,
                    timestamp: Date.now(),
                  }
                  break
                case "compute":
                  result = {
                    operation: params.operation,
                    result: this.simulateComputation(params.iterations || 100),
                    duration: performance.now() - startTime,
                  }
                  break
                case "memory":
                  result = {
                    allocated: params.size,
                    pattern: params.pattern,
                    data: this.generateTestData(params.size || 1024),
                  }
                  break
                default:
                  result = { success: true }
              }

              return {
                content: [{ type: "text", text: JSON.stringify(result) }],
              }
            },
          }
        }
        return tools
      },
      async close() {
        // Mock close
      },
    }

    return mockClient
  }

  private simulateComputation(iterations: number): number {
    let result = 0
    for (let i = 0; i < iterations; i++) {
      result += Math.sqrt(i) * Math.sin(i)
    }
    return result
  }

  private generateTestData(size: number): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let result = ""
    for (let i = 0; i < size; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  async measureThroughput(
    clientName: string,
    toolName: string,
    params: any,
    options: {
      duration: number // milliseconds
      maxConcurrency?: number
      targetRps?: number
    },
  ): Promise<ThroughputMetrics> {
    const client = this.clients.get(clientName)
    if (!client) throw new Error(`Client ${clientName} not found`)

    const tools = await client.tools()
    const tool = tools[toolName]
    if (!tool) throw new Error(`Tool ${toolName} not found`)

    const startTime = Date.now()
    const endTime = startTime + options.duration
    const latencies: number[] = []
    let totalRequests = 0
    let totalErrors = 0
    let activeRequests = 0
    const maxConcurrency = options.maxConcurrency || 100

    const memoryBefore = process.memoryUsage()

    // Rate limiting setup
    const targetRps = options.targetRps
    const intervalMs = targetRps ? 1000 / targetRps : 0
    let lastRequestTime = 0

    const executeRequest = async (): Promise<void> => {
      if (activeRequests >= maxConcurrency) return

      activeRequests++
      totalRequests++
      const requestStart = performance.now()

      try {
        await tool.execute(params)
        const latency = performance.now() - requestStart
        latencies.push(latency)
      } catch (error) {
        totalErrors++
        log.warn("Request failed", { error: error.message })
      } finally {
        activeRequests--
      }
    }

    // Main execution loop
    while (Date.now() < endTime) {
      const now = Date.now()

      // Rate limiting
      if (targetRps && now - lastRequestTime < intervalMs) {
        await new Promise((resolve) => setTimeout(resolve, 1))
        continue
      }

      lastRequestTime = now
      executeRequest() // Fire and forget

      // Small delay to prevent overwhelming the event loop
      await new Promise((resolve) => setImmediate(resolve))
    }

    // Wait for remaining requests to complete
    while (activeRequests > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    const memoryAfter = process.memoryUsage()
    const duration = Date.now() - startTime

    // Calculate metrics
    latencies.sort((a, b) => a - b)
    const averageLatency =
      latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
    const p95Index = Math.floor(latencies.length * 0.95)
    const p99Index = Math.floor(latencies.length * 0.99)

    return {
      requestsPerSecond: (totalRequests / duration) * 1000,
      averageLatency,
      p95Latency: latencies[p95Index] || 0,
      p99Latency: latencies[p99Index] || 0,
      errorRate: totalErrors / totalRequests,
      totalRequests,
      totalErrors,
      duration,
      memoryUsage: {
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        external: memoryAfter.external - memoryBefore.external,
        rss: memoryAfter.rss - memoryBefore.rss,
      },
    }
  }

  async measurePayloadPerformance(
    clientName: string,
    payloadSizes: number[],
  ): Promise<PayloadTestResult[]> {
    const results: PayloadTestResult[] = []

    for (const size of payloadSizes) {
      const testData = this.generateTestData(size)

      // Measure serialization performance
      const serializeStart = performance.now()
      const serialized = JSON.stringify({ data: testData })
      const serializeTime = performance.now() - serializeStart

      const deserializeStart = performance.now()
      const deserialized = JSON.parse(serialized)
      const deserializeTime = performance.now() - deserializeStart

      // Measure throughput with this payload size
      const throughput = await this.measureThroughput(
        clientName,
        "echo",
        { data: testData },
        {
          duration: 5000, // 5 seconds
          maxConcurrency: 50,
        },
      )

      results.push({
        payloadSize: size,
        throughput,
        serialization: {
          serializeTime,
          deserializeTime,
          overhead: (serialized.length - testData.length) / testData.length,
        },
      })
    }

    return results
  }

  async measureSustainedThroughput(
    clientName: string,
    toolName: string,
    params: any,
    options: {
      totalDuration: number // milliseconds
      intervalDuration: number // milliseconds
      maxConcurrency?: number
    },
  ): Promise<SustainedTestResult> {
    const intervals: ThroughputMetrics[] = []
    const startTime = Date.now()
    const endTime = startTime + options.totalDuration

    while (Date.now() < endTime) {
      const intervalMetrics = await this.measureThroughput(
        clientName,
        toolName,
        params,
        {
          duration: options.intervalDuration,
          maxConcurrency: options.maxConcurrency,
        },
      )

      intervals.push(intervalMetrics)

      // Small break between intervals
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Calculate degradation and stability metrics
    const initialRps = intervals[0]?.requestsPerSecond || 0
    const finalRps = intervals[intervals.length - 1]?.requestsPerSecond || 0
    const degradationPercent = ((initialRps - finalRps) / initialRps) * 100

    const rpsValues = intervals.map((i) => i.requestsPerSecond)
    const latencyValues = intervals.map((i) => i.averageLatency)
    const memoryValues = intervals.map((i) => i.memoryUsage.heapUsed)

    const rpsVariance = this.calculateVariance(rpsValues)
    const latencyVariance = this.calculateVariance(latencyValues)
    const memoryGrowth = memoryValues[memoryValues.length - 1] - memoryValues[0]

    return {
      intervals,
      degradation: {
        initialRps,
        finalRps,
        degradationPercent,
      },
      stability: {
        rpsVariance,
        latencyVariance,
        memoryGrowth,
      },
    }
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length
  }

  async measureBatchPerformance(
    clientName: string,
    toolName: string,
    batchSizes: number[],
    params: any,
  ): Promise<Array<{ batchSize: number; metrics: ThroughputMetrics }>> {
    const results = []

    for (const batchSize of batchSizes) {
      // Execute batch of requests
      const client = this.clients.get(clientName)
      const tools = await client.tools()
      const tool = tools[toolName]

      const startTime = performance.now()
      const promises = Array(batchSize)
        .fill(null)
        .map(() => tool.execute(params))

      try {
        await Promise.all(promises)
        const duration = performance.now() - startTime

        const metrics: ThroughputMetrics = {
          requestsPerSecond: (batchSize / duration) * 1000,
          averageLatency: duration / batchSize,
          p95Latency: duration, // Simplified for batch
          p99Latency: duration,
          errorRate: 0,
          totalRequests: batchSize,
          totalErrors: 0,
          duration,
          memoryUsage: process.memoryUsage(),
        }

        results.push({ batchSize, metrics })
      } catch (error) {
        log.error("Batch execution failed", { batchSize, error })
      }
    }

    return results
  }
}

describe("MCP Throughput Testing", () => {
  let framework: ThroughputTestFramework

  beforeAll(async () => {
    framework = new ThroughputTestFramework()
    await framework.setup()
  })

  afterAll(async () => {
    await framework.teardown()
  })

  describe("Tool Execution Throughput", () => {
    test("high-frequency tool calls (100+ calls/second)", async () => {
      const metrics = await framework.measureThroughput(
        "fast",
        "echo",
        { data: "test" },
        {
          duration: 10000, // 10 seconds
          maxConcurrency: 50,
          targetRps: 150,
        },
      )

      expect(metrics.requestsPerSecond).toBeGreaterThan(100)
      expect(metrics.errorRate).toBeLessThan(0.01) // Less than 1% error rate
      expect(metrics.averageLatency).toBeLessThan(100) // Less than 100ms average

      log.info("High-frequency test results", metrics)
    }, 15000)

    test("parallel tool execution across connections", async () => {
      const promises = [
        framework.measureThroughput(
          "fast",
          "echo",
          { data: "test1" },
          {
            duration: 5000,
            maxConcurrency: 25,
          },
        ),
        framework.measureThroughput(
          "variable",
          "echo",
          { data: "test2" },
          {
            duration: 5000,
            maxConcurrency: 25,
          },
        ),
        framework.measureThroughput(
          "slow",
          "echo",
          { data: "test3" },
          {
            duration: 5000,
            maxConcurrency: 10,
          },
        ),
      ]

      const results = await Promise.all(promises)

      // Verify all connections performed adequately
      results.forEach((metrics, index) => {
        expect(metrics.totalRequests).toBeGreaterThan(0)
        expect(metrics.errorRate).toBeLessThan(0.1)
        log.info(`Parallel connection ${index} results`, metrics)
      })

      // Total throughput should be sum of individual throughputs
      const totalRps = results.reduce((sum, r) => sum + r.requestsPerSecond, 0)
      expect(totalRps).toBeGreaterThan(50)
    }, 10000)

    test("batch tool execution testing", async () => {
      const batchSizes = [1, 5, 10, 25, 50, 100]
      const results = await framework.measureBatchPerformance(
        "fast",
        "echo",
        batchSizes,
        { data: "batch-test" },
      )

      results.forEach(({ batchSize, metrics }) => {
        expect(metrics.totalRequests).toBe(batchSize)
        expect(metrics.requestsPerSecond).toBeGreaterThan(0)
        log.info(`Batch size ${batchSize} results`, metrics)
      })

      // Verify batch efficiency improves with size (up to a point)
      const smallBatch = results.find((r) => r.batchSize === 5)
      const mediumBatch = results.find((r) => r.batchSize === 25)

      if (smallBatch && mediumBatch) {
        expect(mediumBatch.metrics.requestsPerSecond).toBeGreaterThan(
          smallBatch.metrics.requestsPerSecond,
        )
      }
    }, 15000)

    test("tool call queuing and backpressure handling", async () => {
      // Test with limited concurrency to force queuing
      const metrics = await framework.measureThroughput(
        "variable",
        "compute",
        {
          operation: "heavy",
          iterations: 1000,
        },
        {
          duration: 8000,
          maxConcurrency: 5, // Force queuing
          targetRps: 50,
        },
      )

      expect(metrics.totalRequests).toBeGreaterThan(0)
      expect(metrics.errorRate).toBeLessThan(0.05) // Should handle backpressure gracefully

      // Latency should be higher due to queuing but still reasonable
      expect(metrics.averageLatency).toBeLessThan(1000)

      log.info("Backpressure test results", metrics)
    }, 12000)
  })

  describe("Payload Size Testing", () => {
    test("variable payload size performance", async () => {
      const payloadSizes = [
        100, // Small: < 1KB
        1024, // 1KB
        5120, // 5KB
        10240, // 10KB
        51200, // 50KB
        102400, // 100KB
      ]

      const results = await framework.measurePayloadPerformance(
        "fast",
        payloadSizes,
      )

      results.forEach((result) => {
        expect(result.throughput.totalRequests).toBeGreaterThan(0)
        expect(result.serialization.serializeTime).toBeGreaterThan(0)
        expect(result.serialization.deserializeTime).toBeGreaterThan(0)

        log.info(`Payload size ${result.payloadSize} bytes`, {
          rps: result.throughput.requestsPerSecond,
          avgLatency: result.throughput.averageLatency,
          serializationOverhead: result.serialization.overhead,
        })
      })

      // Verify performance degrades gracefully with payload size
      const small = results.find((r) => r.payloadSize === 1024)
      const large = results.find((r) => r.payloadSize === 51200)

      if (small && large) {
        expect(small.throughput.requestsPerSecond).toBeGreaterThan(
          large.throughput.requestsPerSecond,
        )
        expect(large.throughput.averageLatency).toBeGreaterThan(
          small.throughput.averageLatency,
        )
      }
    }, 30000)

    test("serialization performance impact", async () => {
      const testSizes = [1024, 10240, 102400] // 1KB, 10KB, 100KB

      for (const size of testSizes) {
        const testData = framework["generateTestData"](size)

        // Measure serialization time
        const iterations = 1000
        const serializeStart = performance.now()
        for (let i = 0; i < iterations; i++) {
          JSON.stringify({ data: testData })
        }
        const serializeTime = performance.now() - serializeStart

        // Measure deserialization time
        const serialized = JSON.stringify({ data: testData })
        const deserializeStart = performance.now()
        for (let i = 0; i < iterations; i++) {
          JSON.parse(serialized)
        }
        const deserializeTime = performance.now() - deserializeStart

        const avgSerializeTime = serializeTime / iterations
        const avgDeserializeTime = deserializeTime / iterations

        log.info(`Serialization performance for ${size} bytes`, {
          avgSerializeTime,
          avgDeserializeTime,
          totalTime: avgSerializeTime + avgDeserializeTime,
        })

        // Serialization should be reasonable even for large payloads
        expect(avgSerializeTime).toBeLessThan(50) // Less than 50ms per operation
        expect(avgDeserializeTime).toBeLessThan(50)
      }
    }, 10000)
  })

  describe("Message Processing Tests", () => {
    test("request/response throughput measurement", async () => {
      const metrics = await framework.measureThroughput(
        "fast",
        "echo",
        { data: "ping" },
        {
          duration: 5000,
          maxConcurrency: 30,
        },
      )

      expect(metrics.requestsPerSecond).toBeGreaterThan(50)
      expect(metrics.p95Latency).toBeLessThan(200)
      expect(metrics.p99Latency).toBeLessThan(500)

      log.info("Request/response throughput", {
        rps: metrics.requestsPerSecond,
        p95: metrics.p95Latency,
        p99: metrics.p99Latency,
      })
    }, 8000)

    test("message queuing under load", async () => {
      // Simulate high load with limited processing capacity
      const heavyMetrics = await framework.measureThroughput(
        "slow",
        "compute",
        {
          operation: "intensive",
          iterations: 5000,
        },
        {
          duration: 10000,
          maxConcurrency: 3, // Very limited concurrency
          targetRps: 20, // Higher target than capacity
        },
      )

      expect(heavyMetrics.totalRequests).toBeGreaterThan(0)
      expect(heavyMetrics.errorRate).toBeLessThan(0.1) // Should handle queuing gracefully

      // Latency will be high due to queuing, but should not timeout
      expect(heavyMetrics.averageLatency).toBeGreaterThan(100)
      expect(heavyMetrics.averageLatency).toBeLessThan(5000) // But not excessive

      log.info("Message queuing under load", heavyMetrics)
    }, 15000)

    test("protocol overhead analysis", async () => {
      // Test minimal vs full payloads to measure protocol overhead
      const minimalMetrics = await framework.measureThroughput(
        "fast",
        "echo",
        { data: "x" },
        {
          duration: 3000,
          maxConcurrency: 20,
        },
      )

      const fullMetrics = await framework.measureThroughput(
        "fast",
        "echo",
        {
          data: "x".repeat(1000),
          metadata: { timestamp: Date.now(), id: "test" },
        },
        {
          duration: 3000,
          maxConcurrency: 20,
        },
      )

      const overheadRatio =
        fullMetrics.averageLatency / minimalMetrics.averageLatency

      log.info("Protocol overhead analysis", {
        minimalLatency: minimalMetrics.averageLatency,
        fullLatency: fullMetrics.averageLatency,
        overheadRatio,
      })

      // Overhead should be reasonable
      expect(overheadRatio).toBeLessThan(5) // Less than 5x overhead
      expect(minimalMetrics.requestsPerSecond).toBeGreaterThan(
        fullMetrics.requestsPerSecond,
      )
    }, 8000)
  })

  describe("Sustained Throughput Tests", () => {
    test("long-running high-throughput scenario", async () => {
      const sustainedResult = await framework.measureSustainedThroughput(
        "fast",
        "echo",
        { data: "sustained" },
        {
          totalDuration: 30000, // 30 seconds
          intervalDuration: 5000, // 5 second intervals
          maxConcurrency: 40,
        },
      )

      expect(sustainedResult.intervals.length).toBeGreaterThan(0)

      // Check for performance stability
      expect(sustainedResult.degradation.degradationPercent).toBeLessThan(20) // Less than 20% degradation
      expect(sustainedResult.stability.rpsVariance).toBeLessThan(1000) // Reasonable variance

      log.info("Sustained throughput results", {
        intervals: sustainedResult.intervals.length,
        degradation: sustainedResult.degradation,
        stability: sustainedResult.stability,
      })

      // Memory should not grow excessively
      expect(sustainedResult.stability.memoryGrowth).toBeLessThan(
        100 * 1024 * 1024,
      ) // Less than 100MB growth
    }, 35000)

    test("performance stability over time", async () => {
      const sustainedResult = await framework.measureSustainedThroughput(
        "variable",
        "compute",
        {
          operation: "stable",
          iterations: 100,
        },
        {
          totalDuration: 20000, // 20 seconds
          intervalDuration: 4000, // 4 second intervals
          maxConcurrency: 15,
        },
      )

      const intervals = sustainedResult.intervals
      expect(intervals.length).toBeGreaterThanOrEqual(4)

      // Check that performance remains relatively stable
      const firstInterval = intervals[0]
      const lastInterval = intervals[intervals.length - 1]

      const rpsChange = Math.abs(
        lastInterval.requestsPerSecond - firstInterval.requestsPerSecond,
      )
      const rpsChangePercent =
        (rpsChange / firstInterval.requestsPerSecond) * 100

      expect(rpsChangePercent).toBeLessThan(30) // Less than 30% change

      log.info("Performance stability analysis", {
        firstRps: firstInterval.requestsPerSecond,
        lastRps: lastInterval.requestsPerSecond,
        changePercent: rpsChangePercent,
      })
    }, 25000)

    test("memory leak detection under load", async () => {
      const memoryBefore = process.memoryUsage()

      // Run sustained load
      await framework.measureSustainedThroughput(
        "fast",
        "memory",
        {
          size: 1024,
          pattern: "test",
        },
        {
          totalDuration: 15000, // 15 seconds
          intervalDuration: 3000, // 3 second intervals
          maxConcurrency: 20,
        },
      )

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      const memoryAfter = process.memoryUsage()
      const heapGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed
      const heapGrowthMB = heapGrowth / (1024 * 1024)

      log.info("Memory leak detection", {
        heapGrowthMB,
        beforeHeap: memoryBefore.heapUsed / (1024 * 1024),
        afterHeap: memoryAfter.heapUsed / (1024 * 1024),
      })

      // Memory growth should be reasonable (less than 50MB for this test)
      expect(heapGrowthMB).toBeLessThan(50)
    }, 20000)

    test("throughput degradation monitoring", async () => {
      // Test with increasing load to monitor degradation
      const loads = [10, 25, 50, 100, 200]
      const results = []

      for (const targetRps of loads) {
        const metrics = await framework.measureThroughput(
          "variable",
          "echo",
          { data: "load-test" },
          {
            duration: 5000,
            maxConcurrency: 50,
            targetRps,
          },
        )

        results.push({
          targetRps,
          actualRps: metrics.requestsPerSecond,
          latency: metrics.averageLatency,
          errorRate: metrics.errorRate,
        })

        // Small break between load tests
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      log.info("Throughput degradation analysis", results)

      // Verify graceful degradation
      results.forEach((result) => {
        expect(result.errorRate).toBeLessThan(0.1) // Error rate should stay low
        expect(result.latency).toBeLessThan(2000) // Latency should not explode
      })

      // Find the saturation point
      const saturationPoint = results.find(
        (r) => r.actualRps < r.targetRps * 0.8,
      )
      if (saturationPoint) {
        log.info("Saturation detected at", {
          targetRps: saturationPoint.targetRps,
        })
      }
    }, 30000)
  })

  describe("Performance Metrics Validation", () => {
    test("metrics accuracy and consistency", async () => {
      // Run the same test multiple times to verify consistency
      const iterations = 3
      const results = []

      for (let i = 0; i < iterations; i++) {
        const metrics = await framework.measureThroughput(
          "fast",
          "echo",
          { data: "consistency" },
          {
            duration: 3000,
            maxConcurrency: 20,
          },
        )
        results.push(metrics)

        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      // Calculate variance in results
      const rpsValues = results.map((r) => r.requestsPerSecond)
      const latencyValues = results.map((r) => r.averageLatency)

      const rpsVariance = framework["calculateVariance"](rpsValues)
      const latencyVariance = framework["calculateVariance"](latencyValues)

      log.info("Metrics consistency analysis", {
        rpsVariance,
        latencyVariance,
        rpsValues,
        latencyValues,
      })

      // Variance should be reasonable for consistent test conditions
      const rpsCV =
        Math.sqrt(rpsVariance) /
        (rpsValues.reduce((a, b) => a + b) / rpsValues.length)
      expect(rpsCV).toBeLessThan(0.3) // Coefficient of variation less than 30%
    }, 15000)

    test("resource utilization trends", async () => {
      const resourceMetrics = []
      const testDuration = 10000
      const sampleInterval = 1000

      // Start background throughput test
      const throughputPromise = framework.measureThroughput(
        "variable",
        "compute",
        {
          operation: "resource-test",
          iterations: 500,
        },
        {
          duration: testDuration,
          maxConcurrency: 30,
        },
      )

      // Sample resource usage during the test
      const startTime = Date.now()
      while (Date.now() - startTime < testDuration) {
        resourceMetrics.push({
          timestamp: Date.now() - startTime,
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        })

        await new Promise((resolve) => setTimeout(resolve, sampleInterval))
      }

      await throughputPromise

      log.info("Resource utilization trends", {
        samples: resourceMetrics.length,
        memoryTrend: {
          start: resourceMetrics[0]?.memory.heapUsed,
          end: resourceMetrics[resourceMetrics.length - 1]?.memory.heapUsed,
        },
      })

      expect(resourceMetrics.length).toBeGreaterThan(5)
    }, 15000)
  })
})
