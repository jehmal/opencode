/**
 * DGM Bridge Performance Benchmark
 *
 * Measures:
 * - Latency: Round-trip time for bridge calls (<100ms target)
 * - Memory: Memory overhead of bridge operations (<50MB target)
 * - Startup: Time to initialize bridge (<2s target)
 * - Throughput: Requests per second
 * - Reliability: Success rate under load
 */

import { DGMBridge } from "../dgm/bridge"
import { DGMConfig } from "../dgm/types"
import { Log } from "../util/log"
import { performance } from "perf_hooks"
import * as fs from "fs/promises"
import * as path from "path"

const log = Log.create({ service: "bridge-benchmark" })

interface BenchmarkResult {
  metric: string
  value: number
  unit: string
  target?: number
  passed?: boolean
  details?: any
}

interface BenchmarkSummary {
  timestamp: number
  results: BenchmarkResult[]
  overallPassed: boolean
  recommendations: string[]
}

class BridgeBenchmark {
  private config: DGMConfig = {
    enabled: true,
    pythonPath: "python3",
    dgmPath: undefined,
    timeout: 30000,
    maxRetries: 3,
    healthCheckInterval: 5000,
  }

  private results: BenchmarkResult[] = []

  /**
   * Run all benchmarks
   */
  async runAll(): Promise<BenchmarkSummary> {
    log.info("Starting DGM Bridge performance benchmarks")

    try {
      // 1. Startup time benchmark
      await this.benchmarkStartup()

      // 2. Latency benchmarks
      await this.benchmarkLatency()

      // 3. Memory overhead benchmark
      await this.benchmarkMemory()

      // 4. Throughput benchmark
      await this.benchmarkThroughput()

      // 5. Reliability under load
      await this.benchmarkReliability()

      // Generate summary
      return this.generateSummary()
    } catch (error) {
      log.error("Benchmark failed", { error })
      throw error
    }
  }

  /**
   * Benchmark startup time
   */
  private async benchmarkStartup(): Promise<void> {
    log.info("Benchmarking startup time...")

    const iterations = 5
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const bridge = new DGMBridge(this.config)
      const startTime = performance.now()

      try {
        await bridge.initialize()
        const endTime = performance.now()
        const duration = endTime - startTime

        times.push(duration)
        log.info(`Startup iteration ${i + 1}: ${duration.toFixed(2)}ms`)

        await bridge.shutdown()
      } catch (error) {
        log.error(`Startup iteration ${i + 1} failed`, { error })
      }

      // Wait between iterations
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    const avgStartup = times.reduce((a, b) => a + b, 0) / times.length
    const maxStartup = Math.max(...times)
    const minStartup = Math.min(...times)

    this.results.push({
      metric: "startup_time_avg",
      value: avgStartup,
      unit: "ms",
      target: 2000,
      passed: avgStartup < 2000,
      details: {
        iterations,
        times,
        max: maxStartup,
        min: minStartup,
      },
    })
  }

  /**
   * Benchmark latency
   */
  private async benchmarkLatency(): Promise<void> {
    log.info("Benchmarking latency...")

    const latencyBridge = new DGMBridge(this.config)
    await latencyBridge.initialize()

    try {
      // Warm up
      for (let i = 0; i < 10; i++) {
        await latencyBridge.healthCheck()
      }

      // Measure different operations
      await this.measureOperationLatency(
        latencyBridge,
        "health_check",
        () => latencyBridge.healthCheck(),
        100,
      )

      await this.measureOperationLatency(
        latencyBridge,
        "get_tools",
        () => latencyBridge.getTools(),
        100,
      )

      await this.measureOperationLatency(
        latencyBridge,
        "execute_tool",
        () => latencyBridge.executeTool("memory_search", { query: "test" }, {}),
        100,
      )
    } finally {
      await latencyBridge.shutdown()
    }
  }

  /**
   * Measure operation latency
   */
  private async measureOperationLatency(
    _bridge: DGMBridge,
    operation: string,
    fn: () => Promise<any>,
    iterations: number,
  ): Promise<void> {
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()
      try {
        await fn()
        const endTime = performance.now()
        times.push(endTime - startTime)
      } catch (error) {
        log.warn(`Operation ${operation} failed`, { error })
      }
    }

    const validTimes = times.filter((t) => t > 0)
    if (validTimes.length === 0) {
      log.error(`No valid measurements for ${operation}`)
      return
    }

    const avgLatency = validTimes.reduce((a, b) => a + b, 0) / validTimes.length
    const p50 = this.percentile(validTimes, 0.5)
    const p95 = this.percentile(validTimes, 0.95)
    const p99 = this.percentile(validTimes, 0.99)

    this.results.push({
      metric: `latency_${operation}_avg`,
      value: avgLatency,
      unit: "ms",
      target: 100,
      passed: avgLatency < 100,
      details: {
        iterations: validTimes.length,
        p50,
        p95,
        p99,
        successRate: (validTimes.length / iterations) * 100,
      },
    })
  }

  /**
   * Benchmark memory overhead
   */
  private async benchmarkMemory(): Promise<void> {
    log.info("Benchmarking memory overhead...")

    // Force garbage collection if available
    if ((global as any).gc) {
      ;(global as any).gc()
    }

    const baselineMemory = process.memoryUsage()
    const bridge = new DGMBridge(this.config)

    try {
      await bridge.initialize()

      // Perform some operations
      for (let i = 0; i < 100; i++) {
        await bridge.healthCheck()
        await bridge.getTools()
      }

      const currentMemory = process.memoryUsage()
      const heapIncrease =
        (currentMemory.heapUsed - baselineMemory.heapUsed) / 1024 / 1024
      const rssIncrease = (currentMemory.rss - baselineMemory.rss) / 1024 / 1024

      this.results.push({
        metric: "memory_heap_increase",
        value: heapIncrease,
        unit: "MB",
        target: 50,
        passed: heapIncrease < 50,
        details: {
          baseline: baselineMemory,
          current: currentMemory,
        },
      })

      this.results.push({
        metric: "memory_rss_increase",
        value: rssIncrease,
        unit: "MB",
        target: 50,
        passed: rssIncrease < 50,
      })
    } finally {
      await bridge.shutdown()
    }
  }

  /**
   * Benchmark throughput
   */
  private async benchmarkThroughput(): Promise<void> {
    log.info("Benchmarking throughput...")

    const bridge = new DGMBridge(this.config)
    await bridge.initialize()

    try {
      const duration = 10000 // 10 seconds
      const startTime = performance.now()
      let requestCount = 0
      let errorCount = 0

      while (performance.now() - startTime < duration) {
        try {
          await bridge.healthCheck()
          requestCount++
        } catch (error) {
          errorCount++
        }
      }

      const actualDuration = (performance.now() - startTime) / 1000
      const throughput = requestCount / actualDuration

      this.results.push({
        metric: "throughput_requests_per_second",
        value: throughput,
        unit: "req/s",
        details: {
          totalRequests: requestCount,
          errors: errorCount,
          duration: actualDuration,
          errorRate: (errorCount / (requestCount + errorCount)) * 100,
        },
      })
    } finally {
      await bridge.shutdown()
    }
  }

  /**
   * Benchmark reliability under load
   */
  private async benchmarkReliability(): Promise<void> {
    log.info("Benchmarking reliability under load...")

    const bridge = new DGMBridge(this.config)
    await bridge.initialize()

    try {
      const concurrency = 10
      const requestsPerWorker = 100
      const results = await Promise.all(
        Array(concurrency)
          .fill(0)
          .map(async (_, workerIndex) => {
            let successes = 0
            let failures = 0
            const latencies: number[] = []

            for (let i = 0; i < requestsPerWorker; i++) {
              const startTime = performance.now()
              try {
                await bridge.executeTool(
                  "memory_search",
                  {
                    query: `test-${workerIndex}-${i}`,
                  },
                  {},
                )
                successes++
                latencies.push(performance.now() - startTime)
              } catch (error) {
                failures++
              }
            }

            return { successes, failures, latencies }
          }),
      )

      const totalSuccesses = results.reduce((sum, r) => sum + r.successes, 0)
      const totalFailures = results.reduce((sum, r) => sum + r.failures, 0)
      const allLatencies = results.flatMap((r) => r.latencies)
      const successRate =
        (totalSuccesses / (totalSuccesses + totalFailures)) * 100

      this.results.push({
        metric: "reliability_success_rate",
        value: successRate,
        unit: "%",
        target: 99,
        passed: successRate >= 99,
        details: {
          concurrency,
          totalRequests: totalSuccesses + totalFailures,
          successes: totalSuccesses,
          failures: totalFailures,
          avgLatencyUnderLoad:
            allLatencies.length > 0
              ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
              : 0,
        },
      })
    } finally {
      await bridge.shutdown()
    }
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil(sorted.length * p) - 1
    return sorted[Math.max(0, index)]
  }

  /**
   * Generate benchmark summary
   */
  private generateSummary(): BenchmarkSummary {
    const overallPassed = this.results.every((r) => r.passed !== false)
    const recommendations: string[] = []

    // Analyze results and generate recommendations
    for (const result of this.results) {
      if (result.passed === false) {
        if (result.metric.includes("latency")) {
          recommendations.push(
            `Optimize ${result.metric}: Current ${result.value.toFixed(2)}${result.unit} exceeds target ${result.target}${result.unit}`,
          )
        } else if (result.metric.includes("memory")) {
          recommendations.push(
            `Reduce memory usage: ${result.metric} is ${result.value.toFixed(2)}${result.unit}, target is ${result.target}${result.unit}`,
          )
        } else if (result.metric.includes("startup")) {
          recommendations.push(
            `Improve startup time: Current ${result.value.toFixed(2)}${result.unit} exceeds target ${result.target}${result.unit}`,
          )
        }
      }
    }

    // Add general recommendations based on patterns
    const avgLatency = this.results
      .filter((r) => r.metric.includes("latency_") && r.metric.includes("_avg"))
      .map((r) => r.value)
      .reduce((a, b, _, arr) => a + b / arr.length, 0)

    if (avgLatency > 50) {
      recommendations.push(
        "Consider implementing connection pooling to reuse Python processes",
      )
      recommendations.push(
        "Investigate using binary protocol (MessagePack) instead of JSON for large payloads",
      )
    }

    const throughput = this.results.find(
      (r) => r.metric === "throughput_requests_per_second",
    )
    if (throughput && throughput.value < 100) {
      recommendations.push(
        "Low throughput detected. Consider batching requests or implementing request pipelining",
      )
    }

    return {
      timestamp: Date.now(),
      results: this.results,
      overallPassed,
      recommendations,
    }
  }
}

/**
 * Main benchmark runner
 */
export async function runBridgeBenchmark(): Promise<void> {
  const benchmark = new BridgeBenchmark()

  try {
    const summary = await benchmark.runAll()

    // Print results
    console.log("\n=== DGM Bridge Performance Benchmark Results ===\n")

    for (const result of summary.results) {
      const status = result.passed === false ? "❌ FAILED" : "✅ PASSED"
      const targetStr = result.target
        ? ` (target: ${result.target}${result.unit})`
        : ""

      console.log(
        `${status} ${result.metric}: ${result.value.toFixed(2)}${result.unit}${targetStr}`,
      )

      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`)
      }
    }

    console.log("\n=== Summary ===")
    console.log(`Overall: ${summary.overallPassed ? "✅ PASSED" : "❌ FAILED"}`)

    if (summary.recommendations.length > 0) {
      console.log("\n=== Recommendations ===")
      for (const rec of summary.recommendations) {
        console.log(`- ${rec}`)
      }
    }

    // Save results to file
    const resultsDir = path.join(process.cwd(), ".opencode", "benchmarks")
    await fs.mkdir(resultsDir, { recursive: true })

    const filename = `bridge-benchmark-${new Date().toISOString().replace(/:/g, "-")}.json`
    const filepath = path.join(resultsDir, filename)

    await fs.writeFile(filepath, JSON.stringify(summary, null, 2))
    console.log(`\nResults saved to: ${filepath}`)
  } catch (error) {
    console.error("Benchmark failed:", error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  runBridgeBenchmark()
}
