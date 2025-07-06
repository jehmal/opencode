import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { App } from "../src/app/app"
import { BashTool } from "../src/tool/bash"
import { ReadTool } from "../src/tool/read"
import { WriteTool } from "../src/tool/write"
import { GlobTool } from "../src/tool/glob"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { spawn, ChildProcess } from "child_process"
import { createServer, Server } from "http"
import { Socket } from "net"

interface ResourceMetrics {
  memory: {
    used: number
    free: number
    total: number
    heapUsed: number
    heapTotal: number
    external: number
  }
  cpu: {
    usage: number
    loadAverage: number[]
  }
  network: {
    connections: number
    sockets: number
  }
  fileDescriptors: {
    open: number
    limit: number
  }
  timestamp: number
}

interface TestConfig {
  memoryLimitMB: number
  cpuTimeoutMs: number
  networkTimeoutMs: number
  fdLimit: number
  cleanupTimeoutMs: number
}

class ResourceMonitor {
  private metrics: ResourceMetrics[] = []
  private monitoring = false
  private interval?: Timer

  start(intervalMs = 100): void {
    this.monitoring = true
    this.metrics = []

    this.interval = setInterval(() => {
      if (!this.monitoring) return

      const memUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage()

      this.metrics.push({
        memory: {
          used: memUsage.rss,
          free: os.freemem(),
          total: os.totalmem(),
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
        },
        cpu: {
          usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
          loadAverage: os.loadavg(),
        },
        network: {
          connections: 0, // Will be populated by specific tests
          sockets: 0,
        },
        fileDescriptors: {
          open: 0, // Will be populated by specific tests
          limit: 0,
        },
        timestamp: Date.now(),
      })
    }, intervalMs)
  }

  stop(): ResourceMetrics[] {
    this.monitoring = false
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = undefined
    }
    return [...this.metrics]
  }

  getLatest(): ResourceMetrics | undefined {
    return this.metrics[this.metrics.length - 1]
  }

  getMemoryTrend(): { increasing: boolean; rate: number } {
    if (this.metrics.length < 2) return { increasing: false, rate: 0 }

    const recent = this.metrics.slice(-10)
    const first = recent[0]
    const last = recent[recent.length - 1]
    const timeDiff = last.timestamp - first.timestamp
    const memoryDiff = last.memory.heapUsed - first.memory.heapUsed

    return {
      increasing: memoryDiff > 0,
      rate: memoryDiff / timeDiff, // bytes per ms
    }
  }

  detectMemoryLeak(thresholdMB = 50): boolean {
    const trend = this.getMemoryTrend()
    return (
      trend.increasing && trend.rate * 1000 * 60 > thresholdMB * 1024 * 1024
    ) // MB per minute
  }

  getCpuTrend(): { average: number; peak: number; sustained: boolean } {
    if (this.metrics.length === 0)
      return { average: 0, peak: 0, sustained: false }

    const cpuValues = this.metrics.map((m) => m.cpu.usage)
    const average = cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length
    const peak = Math.max(...cpuValues)
    const sustained = cpuValues.slice(-5).every((v) => v > average * 0.8)

    return { average, peak, sustained }
  }
}

class ResourceExhauster {
  private memoryBuffers: Buffer[] = []
  private cpuWorkers: ChildProcess[] = []
  private networkConnections: Socket[] = []
  private fileHandles: number[] = []
  private servers: Server[] = []

  async exhaustMemory(targetMB: number, stepMB = 10): Promise<void> {
    const steps = Math.ceil(targetMB / stepMB)

    for (let i = 0; i < steps; i++) {
      const buffer = Buffer.alloc(stepMB * 1024 * 1024, "x")
      this.memoryBuffers.push(buffer)

      // Small delay to allow monitoring
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  async createMemoryLeak(durationMs: number, leakRateMB = 1): Promise<void> {
    const startTime = Date.now()
    const interval = setInterval(() => {
      if (Date.now() - startTime > durationMs) {
        clearInterval(interval)
        return
      }

      const buffer = Buffer.alloc(leakRateMB * 1024 * 1024, "leak")
      this.memoryBuffers.push(buffer)
    }, 1000)
  }

  async saturateCPU(
    durationMs: number,
    cores = os.cpus().length,
  ): Promise<void> {
    const workers: Promise<void>[] = []

    for (let i = 0; i < cores; i++) {
      workers.push(
        new Promise((resolve) => {
          const worker = spawn("node", [
            "-e",
            `
          const start = Date.now();
          while (Date.now() - start < ${durationMs}) {
            Math.random() * Math.random();
          }
        `,
          ])

          this.cpuWorkers.push(worker)
          worker.on("close", () => resolve())
        }),
      )
    }

    await Promise.all(workers)
  }

  async exhaustFileDescriptors(targetCount: number): Promise<void> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-test-"))

    try {
      for (let i = 0; i < targetCount; i++) {
        const filePath = path.join(tempDir, `file-${i}.tmp`)
        const fd = fs.openSync(filePath, "w")
        this.fileHandles.push(fd)

        if (i % 100 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      }
    } catch (error) {
      // Expected when we hit the limit
    }
  }

  async exhaustNetworkConnections(targetCount: number): Promise<void> {
    const server = createServer()
    this.servers.push(server)

    return new Promise((resolve, reject) => {
      server.listen(0, () => {
        const port = (server.address() as any)?.port
        if (!port) {
          reject(new Error("Failed to get server port"))
          return
        }

        let connected = 0
        const connectNext = () => {
          if (connected >= targetCount) {
            resolve()
            return
          }

          const socket = new Socket()
          this.networkConnections.push(socket)

          socket.connect(port, "localhost", () => {
            connected++
            if (connected < targetCount) {
              setTimeout(connectNext, 1)
            } else {
              resolve()
            }
          })

          socket.on("error", () => {
            connected++
            if (connected < targetCount) {
              setTimeout(connectNext, 1)
            } else {
              resolve()
            }
          })
        }

        connectNext()
      })

      server.on("error", reject)
    })
  }

  cleanup(): void {
    // Clean memory
    this.memoryBuffers.length = 0

    // Clean CPU workers
    this.cpuWorkers.forEach((worker) => {
      try {
        worker.kill("SIGTERM")
      } catch {}
    })
    this.cpuWorkers.length = 0

    // Clean network connections
    this.networkConnections.forEach((socket) => {
      try {
        socket.destroy()
      } catch {}
    })
    this.networkConnections.length = 0

    // Clean servers
    this.servers.forEach((server) => {
      try {
        server.close()
      } catch {}
    })
    this.servers.length = 0

    // Clean file descriptors
    this.fileHandles.forEach((fd) => {
      try {
        fs.closeSync(fd)
      } catch {}
    })
    this.fileHandles.length = 0

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  }
}

const testConfig: TestConfig = {
  memoryLimitMB: 100,
  cpuTimeoutMs: 5000,
  networkTimeoutMs: 10000,
  fdLimit: 1000,
  cleanupTimeoutMs: 5000,
}

const ctx = {
  sessionID: "resource-test",
  messageID: "",
  abort: AbortSignal.any([]),
  metadata: () => {},
}

let monitor: ResourceMonitor
let exhauster: ResourceExhauster

beforeEach(() => {
  monitor = new ResourceMonitor()
  exhauster = new ResourceExhauster()
})

afterEach(async () => {
  monitor.stop()
  exhauster.cleanup()

  // Wait for cleanup
  await new Promise((resolve) => setTimeout(resolve, 100))
})

describe("Resource Limits - Memory Exhaustion", () => {
  test("gradual memory consumption increase", async () => {
    monitor.start(50)

    const initialMemory = process.memoryUsage().heapUsed

    // Gradually increase memory usage
    await exhauster.exhaustMemory(50, 5) // 50MB in 5MB steps

    const metrics = monitor.stop()
    const finalMemory = process.memoryUsage().heapUsed

    expect(finalMemory).toBeGreaterThan(initialMemory + 40 * 1024 * 1024) // At least 40MB increase
    expect(metrics.length).toBeGreaterThan(0)

    // Verify gradual increase pattern
    const memoryValues = metrics.map((m) => m.memory.heapUsed)
    const increases = memoryValues.filter(
      (val, i) => i > 0 && val > memoryValues[i - 1],
    )
    expect(increases.length).toBeGreaterThan(memoryValues.length * 0.5) // Most samples should show increase
  })

  test("memory leak detection under load", async () => {
    monitor.start(100)

    // Create a controlled memory leak
    await exhauster.createMemoryLeak(3000, 2) // 2MB per second for 3 seconds

    // Wait for monitoring to detect the leak
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const isLeaking = monitor.detectMemoryLeak(1) // 1MB per minute threshold
    expect(isLeaking).toBe(true)

    monitor.stop()
  })

  test("large payload memory impact", async () => {
    monitor.start()

    const largePayload = "x".repeat(10 * 1024 * 1024) // 10MB string

    await App.provide({ cwd: process.cwd() }, async () => {
      const tempFile = path.join(os.tmpdir(), "large-payload-test.txt")

      // Test writing large payload
      const writeResult = await WriteTool.execute(
        {
          filePath: tempFile,
          content: largePayload,
        },
        ctx,
      )

      expect(writeResult.success).toBe(true)

      // Test reading large payload
      const readResult = await ReadTool.execute(
        {
          filePath: tempFile,
        },
        ctx,
      )

      expect(readResult.success).toBe(true)
      expect(readResult.output.length).toBeGreaterThan(10 * 1024 * 1024)

      // Cleanup
      fs.unlinkSync(tempFile)
    })

    const metrics = monitor.stop()
    const peakMemory = Math.max(...metrics.map((m) => m.memory.heapUsed))
    const initialMemory = metrics[0]?.memory.heapUsed || 0

    expect(peakMemory).toBeGreaterThan(initialMemory + 5 * 1024 * 1024) // At least 5MB increase
  })

  test("memory cleanup validation", async () => {
    monitor.start()

    const initialMemory = process.memoryUsage().heapUsed

    // Allocate and then cleanup memory
    await exhauster.exhaustMemory(30, 10)
    const peakMemory = process.memoryUsage().heapUsed

    exhauster.cleanup()

    // Force garbage collection and wait
    if (global.gc) global.gc()
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const finalMemory = process.memoryUsage().heapUsed
    const cleanupRatio =
      (peakMemory - finalMemory) / (peakMemory - initialMemory)

    monitor.stop()

    expect(cleanupRatio).toBeGreaterThan(0.5) // At least 50% cleanup
  })

  test("out-of-memory recovery testing", async () => {
    monitor.start()

    let errorCaught = false
    let recoverySuccessful = false

    try {
      // Try to allocate an extremely large amount of memory
      await exhauster.exhaustMemory(1000, 100) // 1GB
    } catch (error) {
      errorCaught = true

      // Test recovery by performing a simple operation
      try {
        await App.provide({ cwd: process.cwd() }, async () => {
          const result = await GlobTool.execute(
            {
              pattern: "*.json",
              path: undefined,
            },
            ctx,
          )

          recoverySuccessful = result.success
        })
      } catch {}
    }

    monitor.stop()

    // Either we should catch an OOM error or successfully allocate (depending on system)
    // But recovery should always work
    if (errorCaught) {
      expect(recoverySuccessful).toBe(true)
    }
  })
})

describe("Resource Limits - CPU Saturation", () => {
  test("CPU-intensive tool operations", async () => {
    monitor.start(100)

    await App.provide({ cwd: process.cwd() }, async () => {
      // Create a CPU-intensive bash operation
      const result = await BashTool.execute(
        {
          command:
            "for i in {1..1000}; do echo $((i * i * i)) > /dev/null; done",
          description: "CPU intensive calculation",
        },
        ctx,
      )

      expect(result.success).toBe(true)
    })

    const metrics = monitor.stop()
    const cpuTrend = monitor.getCpuTrend()

    expect(cpuTrend.peak).toBeGreaterThan(0)
    expect(metrics.length).toBeGreaterThan(0)
  })

  test("multi-core utilization testing", async () => {
    monitor.start(200)

    // Saturate multiple CPU cores
    await exhauster.saturateCPU(2000, Math.min(4, os.cpus().length))

    const metrics = monitor.stop()
    const loadAverages = metrics.map((m) => m.cpu.loadAverage[0])
    const maxLoad = Math.max(...loadAverages)

    expect(maxLoad).toBeGreaterThan(1) // Should show significant load
  })

  test("CPU throttling under load", async () => {
    monitor.start(100)

    const startTime = Date.now()

    // Create sustained CPU load
    await exhauster.saturateCPU(3000, os.cpus().length)

    const endTime = Date.now()
    const actualDuration = endTime - startTime

    const metrics = monitor.stop()
    const cpuTrend = monitor.getCpuTrend()

    // Under heavy load, operations might take longer than expected
    expect(actualDuration).toBeGreaterThanOrEqual(2500) // Allow some variance
    expect(cpuTrend.sustained).toBe(true)
  })

  test("performance degradation curves", async () => {
    const results: { cores: number; duration: number; avgCpu: number }[] = []

    for (const cores of [1, 2, 4]) {
      if (cores > os.cpus().length) continue

      monitor.start(100)
      const startTime = Date.now()

      await exhauster.saturateCPU(1000, cores)

      const endTime = Date.now()
      const metrics = monitor.stop()
      const avgCpu =
        metrics.reduce((sum, m) => sum + m.cpu.usage, 0) / metrics.length

      results.push({
        cores,
        duration: endTime - startTime,
        avgCpu,
      })

      // Cleanup between tests
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    expect(results.length).toBeGreaterThan(0)

    // More cores should generally result in higher CPU usage
    if (results.length > 1) {
      const sorted = results.sort((a, b) => a.cores - b.cores)
      expect(sorted[sorted.length - 1].avgCpu).toBeGreaterThanOrEqual(
        sorted[0].avgCpu,
      )
    }
  })

  test("CPU recovery after load spikes", async () => {
    monitor.start(100)

    // Baseline CPU usage
    await new Promise((resolve) => setTimeout(resolve, 500))
    const baselineMetrics = monitor.getLatest()
    const baselineCpu = baselineMetrics?.cpu.usage || 0

    // Create CPU spike
    await exhauster.saturateCPU(1000, 2)

    // Recovery period
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const metrics = monitor.stop()
    const finalMetrics = metrics[metrics.length - 1]
    const finalCpu = finalMetrics?.cpu.usage || 0

    // CPU usage should return close to baseline
    expect(Math.abs(finalCpu - baselineCpu)).toBeLessThan(baselineCpu + 0.1)
  })
})
