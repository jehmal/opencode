/**
 * Simple DGM Bridge Performance Benchmark
 * Tests actual TypeScript-Python communication performance
 */

import { spawn, ChildProcess } from "child_process"
import { performance } from "perf_hooks"

interface BenchmarkResult {
  operation: string
  avgLatency: number
  minLatency: number
  maxLatency: number
  p50: number
  p95: number
  p99: number
  successRate: number
}

class SimpleBridgeBenchmark {
  private process: ChildProcess | null = null
  private messageBuffer = ""
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void
      reject: (error: any) => void
      startTime: number
    }
  >()

  async initialize(): Promise<void> {
    console.log("Initializing Python bridge...")

    // Spawn Python process
    this.process = spawn("python3", ["-m", "dgm.bridge.stdio_server"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONPATH: "/mnt/c/Users/jehma/Desktop/AI/DGMSTT",
      },
    })

    // Handle stdout (messages from Python)
    this.process.stdout?.on("data", (data: Buffer) => {
      this.messageBuffer += data.toString()
      this.processMessages()
    })

    // Handle stderr (errors and logs)
    this.process.stderr?.on("data", (data: Buffer) => {
      const message = data.toString().trim()
      if (message) {
        console.error("Python stderr:", message)
      }
    })

    // Handle process exit
    this.process.on("exit", (code, signal) => {
      console.log("Python process exited", { code, signal })
    })

    // Wait for initial handshake
    await this.sendRequest("handshake", { version: "1.0" })
    console.log("Bridge initialized successfully")
  }

  private processMessages(): void {
    const lines = this.messageBuffer.split("\n")
    this.messageBuffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const message = JSON.parse(line)
        this.handleMessage(message)
      } catch (error) {
        console.error("Failed to parse message:", line)
      }
    }
  }

  private handleMessage(message: any): void {
    const pending = this.pendingRequests.get(message.id)
    if (pending) {
      const latency = performance.now() - pending.startTime
      this.pendingRequests.delete(message.id)

      if (message.type === "error") {
        pending.reject({ error: message.error, latency })
      } else {
        pending.resolve({ result: message.result, latency })
      }
    }
  }

  private async sendRequest(
    method: string,
    params?: any,
  ): Promise<{ result: any; latency: number }> {
    const id = `${method}-${Date.now()}-${Math.random()}`
    const message = {
      id,
      type: "request",
      method,
      params,
    }

    return new Promise((resolve, reject) => {
      const startTime = performance.now()
      this.pendingRequests.set(id, { resolve, reject, startTime })

      const messageStr = JSON.stringify(message) + "\n"
      this.process?.stdin?.write(messageStr, (error) => {
        if (error) {
          this.pendingRequests.delete(id)
          reject(error)
        }
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request timeout: ${method}`))
        }
      }, 5000)
    })
  }

  async benchmarkOperation(
    operation: string,
    method: string,
    params?: any,
    iterations: number = 100,
  ): Promise<BenchmarkResult> {
    console.log(`\nBenchmarking ${operation}...`)

    const latencies: number[] = []
    let successes = 0
    let failures = 0

    // Warm up
    for (let i = 0; i < 10; i++) {
      try {
        await this.sendRequest(method, params)
      } catch (error) {
        // Ignore warm-up errors
      }
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      try {
        const { latency } = await this.sendRequest(method, params)
        latencies.push(latency)
        successes++
      } catch (error: any) {
        if (error.latency) {
          latencies.push(error.latency)
        }
        failures++
      }

      // Progress indicator
      if ((i + 1) % 20 === 0) {
        process.stdout.write(".")
      }
    }
    console.log() // New line after progress dots

    // Calculate statistics
    const sortedLatencies = [...latencies].sort((a, b) => a - b)
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const minLatency = sortedLatencies[0] || 0
    const maxLatency = sortedLatencies[sortedLatencies.length - 1] || 0
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0
    const successRate = (successes / iterations) * 100

    return {
      operation,
      avgLatency,
      minLatency,
      maxLatency,
      p50,
      p95,
      p99,
      successRate,
    }
  }

  async runBenchmarks(): Promise<void> {
    console.log("\n=== DGM Bridge End-to-End Performance Benchmark ===")

    const results: BenchmarkResult[] = []

    // Benchmark different operations
    results.push(await this.benchmarkOperation("health_check", "health"))
    results.push(await this.benchmarkOperation("tools_list", "tools.list"))
    results.push(
      await this.benchmarkOperation(
        "tool_execute",
        "tools.execute",
        {
          toolId: "memory_search",
          params: { query: "test" },
          context: {},
        },
        50,
      ),
    )

    // Print results
    console.log("\n=== Performance Results ===\n")

    for (const result of results) {
      const status = result.avgLatency < 100 ? "✅ PASSED" : "❌ FAILED"
      console.log(`${status} ${result.operation}:`)
      console.log(
        `  Average latency: ${result.avgLatency.toFixed(2)}ms (target: <100ms)`,
      )
      console.log(`  Min: ${result.minLatency.toFixed(2)}ms`)
      console.log(`  Max: ${result.maxLatency.toFixed(2)}ms`)
      console.log(`  P50: ${result.p50.toFixed(2)}ms`)
      console.log(`  P95: ${result.p95.toFixed(2)}ms`)
      console.log(`  P99: ${result.p99.toFixed(2)}ms`)
      console.log(`  Success rate: ${result.successRate.toFixed(1)}%`)
      console.log()
    }

    // Test startup time
    console.log("=== Startup Time Test ===")
    const startupTimes: number[] = []

    for (let i = 0; i < 3; i++) {
      const startTime = performance.now()
      const testBench = new SimpleBridgeBenchmark()
      await testBench.initialize()
      const endTime = performance.now()
      const duration = endTime - startTime
      startupTimes.push(duration)
      console.log(`  Iteration ${i + 1}: ${duration.toFixed(2)}ms`)
      testBench.shutdown()
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    const avgStartup =
      startupTimes.reduce((a, b) => a + b, 0) / startupTimes.length
    const startupStatus = avgStartup < 2000 ? "✅ PASSED" : "❌ FAILED"
    console.log(
      `\n${startupStatus} Average startup time: ${avgStartup.toFixed(2)}ms (target: <2000ms)`,
    )

    // Memory test
    console.log("\n=== Memory Overhead Test ===")
    const baselineMemory = process.memoryUsage()

    // Perform many operations
    for (let i = 0; i < 100; i++) {
      await this.sendRequest("health")
    }

    const currentMemory = process.memoryUsage()
    const heapIncrease =
      (currentMemory.heapUsed - baselineMemory.heapUsed) / 1024 / 1024
    const rssIncrease = (currentMemory.rss - baselineMemory.rss) / 1024 / 1024

    const memoryStatus =
      heapIncrease < 50 && rssIncrease < 50 ? "✅ PASSED" : "❌ FAILED"
    console.log(`${memoryStatus} Memory increase:`)
    console.log(`  Heap: ${heapIncrease.toFixed(2)}MB (target: <50MB)`)
    console.log(`  RSS: ${rssIncrease.toFixed(2)}MB (target: <50MB)`)

    // Recommendations
    console.log("\n=== Recommendations ===")
    const avgLatencies = results.map((r) => r.avgLatency)
    const overallAvg =
      avgLatencies.reduce((a, b) => a + b, 0) / avgLatencies.length

    if (overallAvg > 50) {
      console.log(
        "- Consider implementing connection pooling to reuse Python processes",
      )
      console.log(
        "- Investigate using MessagePack instead of JSON for serialization",
      )
    }

    if (results.some((r) => r.avgLatency > 100)) {
      console.log("- Some operations exceed the 100ms latency target")
      console.log("- Profile the Python code to identify bottlenecks")
      console.log(
        "- Consider implementing caching for frequently accessed data",
      )
    }

    if (results.some((r) => r.successRate < 99)) {
      console.log("- Success rate is below 99% for some operations")
      console.log("- Investigate error handling and retry mechanisms")
      console.log("- Check for resource constraints or race conditions")
    }

    console.log("\nBenchmark complete!")
  }

  shutdown(): void {
    if (this.process && !this.process.killed) {
      this.process.kill()
    }
  }
}

// Run the benchmark
async function main() {
  const benchmark = new SimpleBridgeBenchmark()

  try {
    await benchmark.initialize()
    await benchmark.runBenchmarks()
  } catch (error) {
    console.error("Benchmark failed:", error)
  } finally {
    benchmark.shutdown()
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}
