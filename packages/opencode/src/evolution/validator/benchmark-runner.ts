/**
 * Benchmark Runner for Performance Validation
 * Executes performance tests in isolated sandboxes
 */

import { EventEmitter } from "events"
import type { EvolutionRequestType } from "../types"
import { SandboxManager } from "../sandbox/sandbox-manager"
import type {
  SandboxConfig,
  BenchmarkResults,
  BenchmarkRun,
  AggregatedMetrics,
} from "./performance-validator"

export interface BenchmarkSuite {
  name: string
  warmupCode?: string
  benchmarks: Benchmark[]
}

export interface Benchmark {
  name: string
  code: string
  setup?: string
  teardown?: string
  iterations?: number
  samples?: number
  measureMemory?: boolean
  forceGC?: boolean
  expectErrors?: boolean
}

export interface Sandbox {
  execute(code: string): Promise<any>
  getMemoryUsage(): Promise<number>
  getCpuUsage(): Promise<number>
  cleanup(): Promise<void>
}

export class BenchmarkRunner extends EventEmitter {
  private benchmarks: Map<string, BenchmarkSuite> = new Map()
  private sandboxManager: SandboxManager

  constructor(private sandboxConfig: SandboxConfig) {
    super()
    this.sandboxManager = new SandboxManager({
      tempDir: "/tmp/evolution-benchmarks",
      maxConcurrentSandboxes: 5,
      defaultTimeout: this.sandboxConfig.resourceLimits.timeout,
    })
    this.registerDefaultBenchmarks()
  }

  async runBenchmarks(
    code: string,
    type: EvolutionRequestType,
  ): Promise<BenchmarkResults> {
    const suite = this.selectBenchmarkSuite(type)
    const sandbox = await this.createSandbox()

    try {
      // Warm up (3 runs)
      if (suite.warmupCode) {
        for (let i = 0; i < 3; i++) {
          await sandbox.execute(suite.warmupCode)
        }
      }

      // Actual benchmarks
      const results: BenchmarkResults = {
        timestamp: Date.now(),
        runs: [],
        aggregated: {} as AggregatedMetrics,
      }

      // Run each benchmark multiple times
      for (const benchmark of suite.benchmarks) {
        const runResults = await this.runBenchmark(sandbox, benchmark, code)
        results.runs.push(...runResults)
      }

      // Aggregate results
      results.aggregated = this.aggregateResults(results.runs)

      return results
    } finally {
      await sandbox.cleanup()
    }
  }

  private async runBenchmark(
    sandbox: Sandbox,
    benchmark: Benchmark,
    code: string,
  ): Promise<BenchmarkRun[]> {
    const runs: BenchmarkRun[] = []
    const iterations = benchmark.iterations || 1000
    const samples = benchmark.samples || 10

    for (let i = 0; i < samples; i++) {
      const start = process.hrtime.bigint()

      try {
        await sandbox.execute(`
          ${code}
          ${benchmark.setup || ""}
          
          for (let i = 0; i < ${iterations}; i++) {
            ${benchmark.code}
          }
          
          ${benchmark.teardown || ""}
        `)

        const end = process.hrtime.bigint()
        const duration = Number(end - start) / 1_000_000 // Convert to ms

        runs.push({
          name: benchmark.name,
          iteration: i,
          duration,
          opsPerSecond: (iterations / duration) * 1000,
          memoryUsed: await sandbox.getMemoryUsage(),
          cpuUsage: await sandbox.getCpuUsage(),
        })
      } catch (error) {
        if (!benchmark.expectErrors) {
          runs.push({
            name: benchmark.name,
            iteration: i,
            duration: 0,
            opsPerSecond: 0,
            memoryUsed: 0,
            cpuUsage: 0,
            errors: [error as Error],
          })
        }
      }

      // Force garbage collection if requested
      if (benchmark.forceGC && global.gc) {
        global.gc()
      }
    }

    return runs
  }

  private aggregateResults(runs: BenchmarkRun[]): AggregatedMetrics {
    const opsPerSecond = runs
      .map((r) => r.opsPerSecond)
      .filter((ops) => ops > 0)
    const memory = runs.map((r) => r.memoryUsed)
    const errors = runs.filter((r) => r.errors && r.errors.length > 0)

    return {
      meanOpsPerSecond: this.calculateMean(opsPerSecond),
      medianOpsPerSecond: this.calculateMedian(opsPerSecond),
      stdDevOpsPerSecond: this.calculateStdDev(opsPerSecond),
      p95OpsPerSecond: this.calculatePercentile(opsPerSecond, 95),
      p99OpsPerSecond: this.calculatePercentile(opsPerSecond, 99),
      meanMemory: this.calculateMean(memory),
      peakMemory: Math.max(...memory),
      errorRate: errors.length / runs.length,
    }
  }

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0
    const mean = this.calculateMean(values)
    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      values.length
    return Math.sqrt(variance)
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[index]
  }

  private async createSandbox(): Promise<Sandbox> {
    // Create a minimal test suite for benchmarking
    const testSuite = `
      // Benchmark test suite
      module.exports = {
        run: async () => ({ success: true })
      };
    `

    const sandboxInstance = await this.sandboxManager.createSandbox(
      "", // Code will be provided during benchmark execution
      testSuite,
      this.sandboxConfig.resourceLimits,
    )

    return {
      execute: async (code: string) => {
        return sandboxInstance.execute(code)
      },
      getMemoryUsage: async () => {
        const metrics = await sandboxInstance.getMetrics()
        return metrics.memory.used
      },
      getCpuUsage: async () => {
        const metrics = await sandboxInstance.getMetrics()
        return metrics.cpu.usage
      },
      cleanup: async () => {
        await sandboxInstance.cleanup()
      },
    }
  }

  private selectBenchmarkSuite(type: EvolutionRequestType): BenchmarkSuite {
    // Select appropriate benchmark suite based on evolution type
    switch (type) {
      case "improve_performance":
        return this.benchmarks.get("performance")!
      case "optimize_memory":
        return this.benchmarks.get("memory")!
      case "enhance_security":
      case "fix_bugs":
        return this.benchmarks.get("reliability")!
      default:
        return this.benchmarks.get("general")!
    }
  }

  private registerDefaultBenchmarks() {
    // Performance benchmarks
    this.benchmarks.set("performance", {
      name: "Performance Benchmarks",
      benchmarks: [
        {
          name: "Function Call Overhead",
          code: "testFunction();",
          setup: "const testFunction = evolution.targetFunction;",
          iterations: 10000,
        },
        {
          name: "Data Processing Speed",
          code: "processData(testData);",
          setup: "const testData = generateTestData(1000);",
          iterations: 1000,
        },
        {
          name: "Algorithm Complexity",
          code: "algorithm.run(input);",
          setup: "const input = generateComplexInput();",
          iterations: 100,
        },
      ],
    })

    // Memory benchmarks
    this.benchmarks.set("memory", {
      name: "Memory Benchmarks",
      benchmarks: [
        {
          name: "Memory Allocation",
          code: "allocateMemory(1024 * 1024);",
          iterations: 100,
          measureMemory: true,
        },
        {
          name: "Garbage Collection Impact",
          code: "createAndDiscardObjects(1000);",
          iterations: 50,
          forceGC: true,
        },
      ],
    })

    // Reliability benchmarks
    this.benchmarks.set("reliability", {
      name: "Reliability Benchmarks",
      benchmarks: [
        {
          name: "Error Handling",
          code: "tryRiskyOperation();",
          iterations: 1000,
          expectErrors: true,
        },
        {
          name: "Edge Case Handling",
          code: "handleEdgeCase(edgeCaseInput);",
          setup: "const edgeCaseInput = generateEdgeCases();",
          iterations: 500,
        },
      ],
    })

    // General benchmarks
    this.benchmarks.set("general", {
      name: "General Benchmarks",
      benchmarks: [
        {
          name: "Overall Performance",
          code: "runGeneralTest();",
          iterations: 1000,
        },
      ],
    })
  }
}
