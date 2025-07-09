/**
 * Performance Regression Test
 *
 * Runs performance benchmarks and compares against baseline
 * to detect performance regressions
 */

import { performance } from "perf_hooks"
import * as fs from "fs/promises"
import * as path from "path"
import { DGMBridge } from "../../src/dgm/bridge"
import { DGMConfig } from "../../src/dgm/types"

interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
}

interface PerformanceBaseline {
  metrics: PerformanceMetric[]
  version: string
  timestamp: number
}

interface RegressionResult {
  metric: string
  baseline: number
  current: number
  change: number
  changePercent: number
  regression: boolean
  threshold: number
}

class PerformanceRegressionTest {
  private config: DGMConfig = {
    enabled: true,
    pythonPath: "python3",
    dgmPath: undefined,
    timeout: 30000,
    maxRetries: 3,
    healthCheckInterval: 5000,
  }

  private baselinePath = path.join(
    process.cwd(),
    ".opencode",
    "performance",
    "baseline.json",
  )

  // Regression thresholds (percentage increase that triggers a regression)
  private thresholds = {
    startup_time: 10, // 10% increase
    health_check_latency: 15, // 15% increase
    bridge_call_latency: 15, // 15% increase
    memory_usage: 20, // 20% increase
    throughput: -10, // 10% decrease (negative because lower is worse)
  }

  async run(): Promise<void> {
    console.log("=== Performance Regression Test ===\n")

    // Load baseline
    const baseline = await this.loadBaseline()

    // Run current benchmarks
    const currentMetrics = await this.runBenchmarks()

    // Compare and detect regressions
    const results = this.compareMetrics(baseline, currentMetrics)

    // Report results
    this.reportResults(results)

    // Save current metrics if requested
    if (process.argv.includes("--save-baseline")) {
      await this.saveBaseline(currentMetrics)
      console.log("\n✅ New baseline saved")
    }

    // Exit with error if regressions detected
    const hasRegressions = results.some((r) => r.regression)
    if (hasRegressions) {
      console.error("\n❌ Performance regressions detected!")
      process.exit(1)
    } else {
      console.log("\n✅ No performance regressions detected")
    }
  }

  private async loadBaseline(): Promise<PerformanceBaseline | null> {
    try {
      const data = await fs.readFile(this.baselinePath, "utf-8")
      return JSON.parse(data)
    } catch (error) {
      console.warn("⚠️  No baseline found, will create one after this run")
      return null
    }
  }

  private async saveBaseline(metrics: PerformanceMetric[]): Promise<void> {
    const baseline: PerformanceBaseline = {
      metrics,
      version: process.env.npm_package_version || "unknown",
      timestamp: Date.now(),
    }

    await fs.mkdir(path.dirname(this.baselinePath), { recursive: true })
    await fs.writeFile(this.baselinePath, JSON.stringify(baseline, null, 2))
  }

  private async runBenchmarks(): Promise<PerformanceMetric[]> {
    const metrics: PerformanceMetric[] = []
    const bridge = new DGMBridge(this.config)

    try {
      // 1. Startup time
      const startupTime = await this.measureStartupTime()
      metrics.push({
        name: "startup_time",
        value: startupTime,
        unit: "ms",
        timestamp: Date.now(),
      })

      // Initialize bridge for other tests
      await bridge.initialize()

      // 2. Health check latency
      const healthCheckLatency = await this.measureLatency(
        "health_check",
        () => bridge.healthCheck(),
        50,
      )
      metrics.push({
        name: "health_check_latency",
        value: healthCheckLatency,
        unit: "ms",
        timestamp: Date.now(),
      })

      // 3. Bridge call latency
      const bridgeCallLatency = await this.measureLatency(
        "bridge_call",
        () => bridge.getTools(),
        50,
      )
      metrics.push({
        name: "bridge_call_latency",
        value: bridgeCallLatency,
        unit: "ms",
        timestamp: Date.now(),
      })

      // 4. Memory usage
      const memoryUsage = await this.measureMemoryUsage(bridge)
      metrics.push({
        name: "memory_usage",
        value: memoryUsage,
        unit: "MB",
        timestamp: Date.now(),
      })

      // 5. Throughput
      const throughput = await this.measureThroughput(bridge)
      metrics.push({
        name: "throughput",
        value: throughput,
        unit: "req/s",
        timestamp: Date.now(),
      })
    } finally {
      await bridge.shutdown()
    }

    return metrics
  }

  private async measureStartupTime(): Promise<number> {
    const times: number[] = []

    for (let i = 0; i < 3; i++) {
      const bridge = new DGMBridge(this.config)
      const start = performance.now()
      await bridge.initialize()
      const duration = performance.now() - start
      times.push(duration)
      await bridge.shutdown()
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    return times.reduce((a, b) => a + b, 0) / times.length
  }

  private async measureLatency(
    name: string,
    operation: () => Promise<any>,
    iterations: number,
  ): Promise<number> {
    // Warm up
    for (let i = 0; i < 10; i++) {
      await operation()
    }

    const times: number[] = []
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await operation()
      times.push(performance.now() - start)
    }

    return times.reduce((a, b) => a + b, 0) / times.length
  }

  private async measureMemoryUsage(bridge: DGMBridge): Promise<number> {
    if ((global as any).gc) {
      ;(global as any).gc()
    }

    const baseline = process.memoryUsage()

    // Perform operations
    for (let i = 0; i < 100; i++) {
      await bridge.healthCheck()
    }

    const current = process.memoryUsage()
    const increase = (current.heapUsed - baseline.heapUsed) / 1024 / 1024

    return increase
  }

  private async measureThroughput(bridge: DGMBridge): Promise<number> {
    const duration = 5000 // 5 seconds
    const start = performance.now()
    let count = 0

    while (performance.now() - start < duration) {
      await bridge.healthCheck()
      count++
    }

    return count / (duration / 1000)
  }

  private compareMetrics(
    baseline: PerformanceBaseline | null,
    current: PerformanceMetric[],
  ): RegressionResult[] {
    if (!baseline) {
      return []
    }

    const results: RegressionResult[] = []

    for (const metric of current) {
      const baselineMetric = baseline.metrics.find(
        (m) => m.name === metric.name,
      )
      if (!baselineMetric) continue

      const change = metric.value - baselineMetric.value
      const changePercent = (change / baselineMetric.value) * 100
      const threshold =
        this.thresholds[metric.name as keyof typeof this.thresholds] || 10

      // For throughput, lower is worse, so invert the logic
      const regression =
        metric.name === "throughput"
          ? changePercent < threshold
          : changePercent > threshold

      results.push({
        metric: metric.name,
        baseline: baselineMetric.value,
        current: metric.value,
        change,
        changePercent,
        regression,
        threshold,
      })
    }

    return results
  }

  private reportResults(results: RegressionResult[]): void {
    if (results.length === 0) {
      console.log("No baseline to compare against")
      return
    }

    console.log("Performance Comparison:\n")
    console.log(
      "Metric                  Baseline    Current     Change      Status",
    )
    console.log("─".repeat(70))

    for (const result of results) {
      const status = result.regression ? "❌ REGRESSION" : "✅ OK"
      const changeStr =
        result.change >= 0
          ? `+${result.change.toFixed(2)}`
          : result.change.toFixed(2)
      const percentStr =
        result.changePercent >= 0
          ? `+${result.changePercent.toFixed(1)}%`
          : `${result.changePercent.toFixed(1)}%`

      console.log(
        `${result.metric.padEnd(20)} ${result.baseline.toFixed(2).padStart(10)} ${result.current.toFixed(2).padStart(10)} ${changeStr.padStart(10)} (${percentStr.padStart(6)})  ${status}`,
      )
    }
  }
}

// Run the test
if (require.main === module) {
  const test = new PerformanceRegressionTest()
  test.run().catch(console.error)
}
