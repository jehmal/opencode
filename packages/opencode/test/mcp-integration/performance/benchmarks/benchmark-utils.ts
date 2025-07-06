/**
 * Comprehensive benchmark utilities for MCP performance testing
 * Provides timing, memory tracking, statistical analysis, and reporting capabilities
 */

/**
 * High-precision timer for measuring operation duration
 */
export namespace Timer {
  /**
   * Creates a high-precision timer using performance.now()
   * @returns Timer instance with start/stop/elapsed methods
   */
  export function create() {
    let startTime = 0
    let endTime = 0
    let isRunning = false

    return {
      /**
       * Starts the timer
       * @returns The timer instance for chaining
       */
      start() {
        startTime = performance.now()
        isRunning = true
        endTime = 0
        return this
      },

      /**
       * Stops the timer
       * @returns The elapsed time in milliseconds
       */
      stop(): number {
        if (!isRunning) throw new Error("Timer not started")
        endTime = performance.now()
        isRunning = false
        return endTime - startTime
      },

      /**
       * Gets elapsed time without stopping the timer
       * @returns Current elapsed time in milliseconds
       */
      elapsed(): number {
        if (!isRunning) return endTime - startTime
        return performance.now() - startTime
      },

      /**
       * Resets the timer to initial state
       */
      reset() {
        startTime = 0
        endTime = 0
        isRunning = false
      },

      /**
       * Whether the timer is currently running
       */
      get running() {
        return isRunning
      },
    }
  }

  /**
   * Times an async operation
   * @param operation - The async operation to time
   * @returns Promise resolving to [result, duration]
   */
  export async function time<T>(
    operation: () => Promise<T>,
  ): Promise<[T, number]> {
    const timer = create().start()
    try {
      const result = await operation()
      const duration = timer.stop()
      return [result, duration]
    } catch (error) {
      timer.stop()
      throw error
    }
  }

  /**
   * Times a synchronous operation
   * @param operation - The sync operation to time
   * @returns [result, duration]
   */
  export function timeSync<T>(operation: () => T): [T, number] {
    const timer = create().start()
    try {
      const result = operation()
      const duration = timer.stop()
      return [result, duration]
    } catch (error) {
      timer.stop()
      throw error
    }
  }
}

/**
 * Memory usage tracking and monitoring
 */
export namespace Memory {
  export interface MemorySnapshot {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
    arrayBuffers: number
    timestamp: number
  }

  export interface MemoryDelta {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
    arrayBuffers: number
    duration: number
  }

  /**
   * Takes a snapshot of current memory usage
   * @returns Memory usage snapshot
   */
  export function snapshot(): MemorySnapshot {
    const usage = process.memoryUsage()
    return {
      ...usage,
      timestamp: performance.now(),
    }
  }

  /**
   * Calculates memory delta between two snapshots
   * @param before - Initial memory snapshot
   * @param after - Final memory snapshot
   * @returns Memory usage delta
   */
  export function delta(
    before: MemorySnapshot,
    after: MemorySnapshot,
  ): MemoryDelta {
    return {
      rss: after.rss - before.rss,
      heapTotal: after.heapTotal - before.heapTotal,
      heapUsed: after.heapUsed - before.heapUsed,
      external: after.external - before.external,
      arrayBuffers: after.arrayBuffers - before.arrayBuffers,
      duration: after.timestamp - before.timestamp,
    }
  }

  /**
   * Monitors memory usage during an async operation
   * @param operation - The operation to monitor
   * @returns Promise resolving to [result, memoryDelta]
   */
  export async function monitor<T>(
    operation: () => Promise<T>,
  ): Promise<[T, MemoryDelta]> {
    const before = snapshot()
    try {
      const result = await operation()
      const after = snapshot()
      return [result, delta(before, after)]
    } catch (error) {
      const after = snapshot()
      const memDelta = delta(before, after)
      throw new Error(
        `Operation failed with memory delta: ${formatBytes(memDelta.heapUsed)}. Original error: ${error}`,
      )
    }
  }

  /**
   * Formats bytes into human-readable string
   * @param bytes - Number of bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))
    const sign = bytes < 0 ? "-" : ""
    return `${sign}${parseFloat((Math.abs(bytes) / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  /**
   * Creates a memory tracker that samples at intervals
   * @param intervalMs - Sampling interval in milliseconds
   * @returns Memory tracker instance
   */
  export function createTracker(intervalMs = 100) {
    const samples: MemorySnapshot[] = []
    let interval: Timer | null = null

    return {
      /**
       * Starts memory tracking
       */
      start() {
        samples.length = 0
        samples.push(snapshot())
        interval = setInterval(() => {
          samples.push(snapshot())
        }, intervalMs)
      },

      /**
       * Stops memory tracking
       * @returns Array of memory snapshots
       */
      stop(): MemorySnapshot[] {
        if (interval) {
          clearInterval(interval)
          interval = null
        }
        samples.push(snapshot())
        return [...samples]
      },

      /**
       * Gets current samples without stopping
       */
      getSamples(): MemorySnapshot[] {
        return [...samples]
      },
    }
  }
}

/**
 * Statistical analysis utilities for benchmark results
 */
export namespace Statistics {
  export interface Stats {
    count: number
    min: number
    max: number
    mean: number
    median: number
    p95: number
    p99: number
    stdDev: number
    variance: number
  }

  /**
   * Calculates comprehensive statistics for a dataset
   * @param values - Array of numeric values
   * @returns Statistical analysis
   */
  export function analyze(values: number[]): Stats {
    if (values.length === 0) {
      throw new Error("Cannot analyze empty dataset")
    }

    const sorted = [...values].sort((a, b) => a - b)
    const count = values.length
    const min = sorted[0]
    const max = sorted[count - 1]
    const mean = values.reduce((sum, val) => sum + val, 0) / count

    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count
    const stdDev = Math.sqrt(variance)

    return {
      count,
      min,
      max,
      mean,
      median: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      stdDev,
      variance,
    }
  }

  /**
   * Calculates a specific percentile from sorted data
   * @param sortedValues - Pre-sorted array of values
   * @param percentile - Percentile to calculate (0-100)
   * @returns Percentile value
   */
  export function percentile(
    sortedValues: number[],
    percentile: number,
  ): number {
    if (percentile < 0 || percentile > 100) {
      throw new Error("Percentile must be between 0 and 100")
    }

    const index = (percentile / 100) * (sortedValues.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)

    if (lower === upper) {
      return sortedValues[lower]
    }

    const weight = index - lower
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
  }

  /**
   * Calculates throughput statistics
   * @param operations - Number of operations
   * @param durationMs - Duration in milliseconds
   * @returns Throughput metrics
   */
  export function throughput(operations: number, durationMs: number) {
    const opsPerSecond = (operations / durationMs) * 1000
    const avgLatencyMs = durationMs / operations

    return {
      operations,
      durationMs,
      opsPerSecond,
      avgLatencyMs,
      opsPerMinute: opsPerSecond * 60,
    }
  }

  /**
   * Compares two statistical datasets
   * @param baseline - Baseline statistics
   * @param current - Current statistics
   * @returns Comparison metrics
   */
  export function compare(baseline: Stats, current: Stats) {
    const meanChange = ((current.mean - baseline.mean) / baseline.mean) * 100
    const medianChange =
      ((current.median - baseline.median) / baseline.median) * 100
    const p95Change = ((current.p95 - baseline.p95) / baseline.p95) * 100

    return {
      meanChange,
      medianChange,
      p95Change,
      isRegression: meanChange > 5 || p95Change > 10,
      isImprovement: meanChange < -5 && p95Change < -5,
    }
  }
}

/**
 * Resource monitoring utilities
 */
export namespace ResourceMonitor {
  export interface ResourceSnapshot {
    cpu: {
      user: number
      system: number
    }
    memory: Memory.MemorySnapshot
    timestamp: number
  }

  export interface ResourceUsage {
    cpu: {
      userPercent: number
      systemPercent: number
    }
    memory: Memory.MemoryDelta
    duration: number
  }

  /**
   * Takes a snapshot of current resource usage
   * @returns Resource usage snapshot
   */
  export function snapshot(): ResourceSnapshot {
    const cpuUsage = process.cpuUsage()
    return {
      cpu: cpuUsage,
      memory: Memory.snapshot(),
      timestamp: performance.now(),
    }
  }

  /**
   * Calculates resource usage between two snapshots
   * @param before - Initial resource snapshot
   * @param after - Final resource snapshot
   * @returns Resource usage metrics
   */
  export function usage(
    before: ResourceSnapshot,
    after: ResourceSnapshot,
  ): ResourceUsage {
    const duration = after.timestamp - before.timestamp
    const cpuDelta = {
      user: after.cpu.user - before.cpu.user,
      system: after.cpu.system - before.cpu.system,
    }

    return {
      cpu: {
        userPercent: (cpuDelta.user / (duration * 1000)) * 100,
        systemPercent: (cpuDelta.system / (duration * 1000)) * 100,
      },
      memory: Memory.delta(before.memory, after.memory),
      duration,
    }
  }

  /**
   * Monitors resource usage during an operation
   * @param operation - The operation to monitor
   * @returns Promise resolving to [result, resourceUsage]
   */
  export async function monitor<T>(
    operation: () => Promise<T>,
  ): Promise<[T, ResourceUsage]> {
    const before = snapshot()
    try {
      const result = await operation()
      const after = snapshot()
      return [result, usage(before, after)]
    } catch (error) {
      const after = snapshot()
      const resourceUsage = usage(before, after)
      throw new Error(
        `Operation failed with CPU: ${resourceUsage.cpu.userPercent.toFixed(2)}%, Memory: ${Memory.formatBytes(resourceUsage.memory.heapUsed)}. Original error: ${error}`,
      )
    }
  }
}

/**
 * Benchmark execution and management utilities
 */
export namespace Benchmark {
  export interface BenchmarkOptions {
    iterations?: number
    warmupIterations?: number
    maxDuration?: number
    minIterations?: number
    collectMemory?: boolean
    collectResources?: boolean
  }

  export interface BenchmarkResult {
    name: string
    iterations: number
    durations: number[]
    stats: Statistics.Stats
    memory?: Memory.MemoryDelta[]
    resources?: ResourceMonitor.ResourceUsage[]
    totalDuration: number
    throughput: ReturnType<typeof Statistics.throughput>
  }

  /**
   * Runs a benchmark with specified options
   * @param name - Benchmark name
   * @param operation - Operation to benchmark
   * @param options - Benchmark configuration
   * @returns Benchmark results
   */
  export async function run<T>(
    name: string,
    operation: () => Promise<T>,
    options: BenchmarkOptions = {},
  ): Promise<BenchmarkResult> {
    const {
      iterations = 100,
      warmupIterations = 10,
      maxDuration = 30000,
      minIterations = 10,
      collectMemory = false,
      collectResources = false,
    } = options

    const durations: number[] = []
    const memoryDeltas: Memory.MemoryDelta[] = []
    const resourceUsages: ResourceMonitor.ResourceUsage[] = []

    const benchmarkStart = performance.now()

    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      await operation()
    }

    // Benchmark phase
    let iteration = 0
    while (iteration < iterations) {
      if (
        iteration >= minIterations &&
        performance.now() - benchmarkStart > maxDuration
      ) {
        break
      }

      if (collectMemory && collectResources) {
        const [, resourceUsage] = await ResourceMonitor.monitor(async () => {
          const [, memoryDelta] = await Memory.monitor(async () => {
            const [, duration] = await Timer.time(operation)
            durations.push(duration)
            return duration
          })
          memoryDeltas.push(memoryDelta)
          return memoryDelta
        })
        resourceUsages.push(resourceUsage)
      } else if (collectMemory) {
        const [, memoryDelta] = await Memory.monitor(async () => {
          const [, duration] = await Timer.time(operation)
          durations.push(duration)
          return duration
        })
        memoryDeltas.push(memoryDelta)
      } else if (collectResources) {
        const [, resourceUsage] = await ResourceMonitor.monitor(async () => {
          const [, duration] = await Timer.time(operation)
          durations.push(duration)
          return duration
        })
        resourceUsages.push(resourceUsage)
      } else {
        const [, duration] = await Timer.time(operation)
        durations.push(duration)
      }

      iteration++
    }

    const totalDuration = performance.now() - benchmarkStart
    const stats = Statistics.analyze(durations)
    const throughput = Statistics.throughput(iteration, totalDuration)

    return {
      name,
      iterations: iteration,
      durations,
      stats,
      memory: memoryDeltas.length > 0 ? memoryDeltas : undefined,
      resources: resourceUsages.length > 0 ? resourceUsages : undefined,
      totalDuration,
      throughput,
    }
  }

  /**
   * Runs multiple benchmarks and compares results
   * @param benchmarks - Array of benchmark configurations
   * @returns Array of benchmark results
   */
  export async function suite(
    benchmarks: Array<{
      name: string
      operation: () => Promise<any>
      options?: BenchmarkOptions
    }>,
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = []

    for (const benchmark of benchmarks) {
      const result = await run(
        benchmark.name,
        benchmark.operation,
        benchmark.options,
      )
      results.push(result)
    }

    return results
  }

  /**
   * Validates benchmark results against thresholds
   * @param result - Benchmark result to validate
   * @param thresholds - Performance thresholds
   * @returns Validation result
   */
  export function validate(
    result: BenchmarkResult,
    thresholds: {
      maxMean?: number
      maxP95?: number
      maxP99?: number
      minThroughput?: number
    },
  ) {
    const failures: string[] = []

    if (thresholds.maxMean && result.stats.mean > thresholds.maxMean) {
      failures.push(
        `Mean latency ${result.stats.mean.toFixed(2)}ms exceeds threshold ${thresholds.maxMean}ms`,
      )
    }

    if (thresholds.maxP95 && result.stats.p95 > thresholds.maxP95) {
      failures.push(
        `P95 latency ${result.stats.p95.toFixed(2)}ms exceeds threshold ${thresholds.maxP95}ms`,
      )
    }

    if (thresholds.maxP99 && result.stats.p99 > thresholds.maxP99) {
      failures.push(
        `P99 latency ${result.stats.p99.toFixed(2)}ms exceeds threshold ${thresholds.maxP99}ms`,
      )
    }

    if (
      thresholds.minThroughput &&
      result.throughput.opsPerSecond < thresholds.minThroughput
    ) {
      failures.push(
        `Throughput ${result.throughput.opsPerSecond.toFixed(2)} ops/sec below threshold ${thresholds.minThroughput} ops/sec`,
      )
    }

    return {
      passed: failures.length === 0,
      failures,
    }
  }
}

/**
 * Benchmark result formatting and reporting
 */
export namespace Report {
  /**
   * Formats a benchmark result as a human-readable string
   * @param result - Benchmark result to format
   * @returns Formatted report string
   */
  export function format(result: Benchmark.BenchmarkResult): string {
    const lines = [
      `Benchmark: ${result.name}`,
      `Iterations: ${result.iterations}`,
      `Total Duration: ${result.totalDuration.toFixed(2)}ms`,
      "",
      "Latency Statistics:",
      `  Mean: ${result.stats.mean.toFixed(2)}ms`,
      `  Median: ${result.stats.median.toFixed(2)}ms`,
      `  Min: ${result.stats.min.toFixed(2)}ms`,
      `  Max: ${result.stats.max.toFixed(2)}ms`,
      `  P95: ${result.stats.p95.toFixed(2)}ms`,
      `  P99: ${result.stats.p99.toFixed(2)}ms`,
      `  Std Dev: ${result.stats.stdDev.toFixed(2)}ms`,
      "",
      "Throughput:",
      `  Operations/sec: ${result.throughput.opsPerSecond.toFixed(2)}`,
      `  Operations/min: ${result.throughput.opsPerMinute.toFixed(2)}`,
      `  Avg Latency: ${result.throughput.avgLatencyMs.toFixed(2)}ms`,
    ]

    if (result.memory && result.memory.length > 0) {
      const memStats = Statistics.analyze(result.memory.map((m) => m.heapUsed))
      lines.push(
        "",
        "Memory Usage:",
        `  Mean Heap Delta: ${Memory.formatBytes(memStats.mean)}`,
        `  Max Heap Delta: ${Memory.formatBytes(memStats.max)}`,
        `  P95 Heap Delta: ${Memory.formatBytes(memStats.p95)}`,
      )
    }

    if (result.resources && result.resources.length > 0) {
      const cpuStats = Statistics.analyze(
        result.resources.map((r) => r.cpu.userPercent),
      )
      lines.push(
        "",
        "Resource Usage:",
        `  Mean CPU: ${cpuStats.mean.toFixed(2)}%`,
        `  Max CPU: ${cpuStats.max.toFixed(2)}%`,
        `  P95 CPU: ${cpuStats.p95.toFixed(2)}%`,
      )
    }

    return lines.join("\n")
  }

  /**
   * Formats multiple benchmark results as a comparison table
   * @param results - Array of benchmark results
   * @returns Formatted comparison table
   */
  export function compare(results: Benchmark.BenchmarkResult[]): string {
    if (results.length === 0) return "No benchmark results to compare"

    const headers = [
      "Benchmark",
      "Iterations",
      "Mean (ms)",
      "P95 (ms)",
      "P99 (ms)",
      "Ops/sec",
    ]
    const rows = results.map((result) => [
      result.name,
      result.iterations.toString(),
      result.stats.mean.toFixed(2),
      result.stats.p95.toFixed(2),
      result.stats.p99.toFixed(2),
      result.throughput.opsPerSecond.toFixed(2),
    ])

    const colWidths = headers.map((header, i) =>
      Math.max(header.length, ...rows.map((row) => row[i].length)),
    )

    const formatRow = (row: string[]) =>
      row.map((cell, i) => cell.padEnd(colWidths[i])).join(" | ")

    const separator = colWidths.map((width) => "-".repeat(width)).join("-|-")

    return [formatRow(headers), separator, ...rows.map(formatRow)].join("\n")
  }

  /**
   * Exports benchmark results as JSON
   * @param results - Benchmark results to export
   * @returns JSON string
   */
  export function toJSON(
    results: Benchmark.BenchmarkResult | Benchmark.BenchmarkResult[],
  ): string {
    return JSON.stringify(results, null, 2)
  }

  /**
   * Creates a summary report for a benchmark suite
   * @param results - Array of benchmark results
   * @returns Summary report string
   */
  export function summary(results: Benchmark.BenchmarkResult[]): string {
    if (results.length === 0) return "No benchmark results to summarize"

    const totalOperations = results.reduce((sum, r) => sum + r.iterations, 0)
    const totalDuration = results.reduce((sum, r) => sum + r.totalDuration, 0)
    const avgThroughput =
      results.reduce((sum, r) => sum + r.throughput.opsPerSecond, 0) /
      results.length

    const fastest = results.reduce((min, r) =>
      r.stats.mean < min.stats.mean ? r : min,
    )
    const slowest = results.reduce((max, r) =>
      r.stats.mean > max.stats.mean ? r : max,
    )

    return [
      "Benchmark Suite Summary",
      "========================",
      `Total Benchmarks: ${results.length}`,
      `Total Operations: ${totalOperations}`,
      `Total Duration: ${totalDuration.toFixed(2)}ms`,
      `Average Throughput: ${avgThroughput.toFixed(2)} ops/sec`,
      "",
      `Fastest: ${fastest.name} (${fastest.stats.mean.toFixed(2)}ms mean)`,
      `Slowest: ${slowest.name} (${slowest.stats.mean.toFixed(2)}ms mean)`,
      "",
      "Individual Results:",
      compare(results),
    ].join("\n")
  }
}

/**
 * Latency measurement utilities for network operations
 */
export namespace Latency {
  export interface LatencyMeasurement {
    connectTime: number
    firstByteTime: number
    totalTime: number
    transferTime: number
  }

  /**
   * Measures network latency for HTTP requests
   * @param url - URL to measure latency for
   * @param options - Fetch options
   * @returns Latency measurements
   */
  export async function measureHTTP(
    url: string,
    options?: RequestInit,
  ): Promise<LatencyMeasurement> {
    const startTime = performance.now()
    let connectTime = 0
    let firstByteTime = 0

    try {
      const response = await fetch(url, options)
      connectTime = performance.now() - startTime

      const reader = response.body?.getReader()
      if (reader) {
        const { done } = await reader.read()
        firstByteTime = performance.now() - startTime
        reader.releaseLock()
      }

      await response.text()
      const totalTime = performance.now() - startTime

      return {
        connectTime,
        firstByteTime: firstByteTime || connectTime,
        totalTime,
        transferTime: totalTime - (firstByteTime || connectTime),
      }
    } catch (error) {
      const totalTime = performance.now() - startTime
      throw new Error(
        `Latency measurement failed after ${totalTime.toFixed(2)}ms: ${error}`,
      )
    }
  }

  /**
   * Measures round-trip latency for a function call
   * @param operation - Operation to measure
   * @returns Round-trip time in milliseconds
   */
  export async function measureRoundTrip<T>(
    operation: () => Promise<T>,
  ): Promise<[T, number]> {
    return Timer.time(operation)
  }

  /**
   * Measures latency distribution over multiple samples
   * @param operation - Operation to measure
   * @param samples - Number of samples to take
   * @returns Latency statistics
   */
  export async function distribution<T>(
    operation: () => Promise<T>,
    samples = 100,
  ): Promise<Statistics.Stats> {
    const latencies: number[] = []

    for (let i = 0; i < samples; i++) {
      const [, latency] = await Timer.time(operation)
      latencies.push(latency)
    }

    return Statistics.analyze(latencies)
  }
}
