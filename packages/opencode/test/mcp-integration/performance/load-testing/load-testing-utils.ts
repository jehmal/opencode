import { performance } from "perf_hooks"
import { MCPRequest, MCPResponse, MCPError } from "../../mocks/shared/types"

export interface PerformanceMetrics {
  responseTime: number
  cpuUsage: number
  memoryUsage: number
  timestamp: number
  success: boolean
  errorCode?: number
  errorMessage?: string
}

export interface LoadTestMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  requestsPerSecond: number
  errorsPerSecond: number
  peakMemoryUsage: number
  averageCpuUsage: number
  testDuration: number
  concurrentConnections: number
}

export interface ConnectionMetrics {
  connectionId: string
  startTime: number
  endTime?: number
  requestCount: number
  errorCount: number
  averageResponseTime: number
  status: "active" | "completed" | "failed"
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private connections: Map<string, ConnectionMetrics> = new Map()
  private startTime: number = 0
  private endTime: number = 0

  start(): void {
    this.startTime = performance.now()
    this.metrics = []
    this.connections.clear()
  }

  stop(): void {
    this.endTime = performance.now()
  }

  recordRequest(
    connectionId: string,
    responseTime: number,
    success: boolean,
    error?: MCPError,
  ): void {
    const metric: PerformanceMetrics = {
      responseTime,
      cpuUsage: this.getCpuUsage(),
      memoryUsage: this.getMemoryUsage(),
      timestamp: performance.now(),
      success,
      errorCode: error?.code,
      errorMessage: error?.message,
    }

    this.metrics.push(metric)
    this.updateConnectionMetrics(connectionId, responseTime, success)
  }

  private updateConnectionMetrics(
    connectionId: string,
    responseTime: number,
    success: boolean,
  ): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.requestCount++
      if (!success) connection.errorCount++
      connection.averageResponseTime =
        (connection.averageResponseTime * (connection.requestCount - 1) +
          responseTime) /
        connection.requestCount
    }
  }

  addConnection(connectionId: string): void {
    this.connections.set(connectionId, {
      connectionId,
      startTime: performance.now(),
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      status: "active",
    })
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.endTime = performance.now()
      connection.status = "completed"
    }
  }

  failConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.endTime = performance.now()
      connection.status = "failed"
    }
  }

  getMetrics(): LoadTestMetrics {
    const responseTimes = this.metrics.map((m) => m.responseTime)
    const successfulRequests = this.metrics.filter((m) => m.success).length
    const failedRequests = this.metrics.length - successfulRequests
    const testDuration = (this.endTime - this.startTime) / 1000

    responseTimes.sort((a, b) => a - b)

    return {
      totalRequests: this.metrics.length,
      successfulRequests,
      failedRequests,
      averageResponseTime: this.average(responseTimes),
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      p95ResponseTime: this.percentile(responseTimes, 95),
      p99ResponseTime: this.percentile(responseTimes, 99),
      requestsPerSecond: this.metrics.length / testDuration,
      errorsPerSecond: failedRequests / testDuration,
      peakMemoryUsage: Math.max(...this.metrics.map((m) => m.memoryUsage)),
      averageCpuUsage: this.average(this.metrics.map((m) => m.cpuUsage)),
      testDuration,
      concurrentConnections: this.connections.size,
    }
  }

  getConnectionMetrics(): ConnectionMetrics[] {
    return Array.from(this.connections.values())
  }

  private getCpuUsage(): number {
    if (process.cpuUsage) {
      const usage = process.cpuUsage()
      return (usage.user + usage.system) / 1000000
    }
    return 0
  }

  private getMemoryUsage(): number {
    return process.memoryUsage().heapUsed / 1024 / 1024
  }

  private average(numbers: number[]): number {
    return numbers.length > 0
      ? numbers.reduce((a, b) => a + b, 0) / numbers.length
      : 0
  }

  private percentile(numbers: number[], p: number): number {
    if (numbers.length === 0) return 0
    const index = Math.ceil((p / 100) * numbers.length) - 1
    return numbers[Math.max(0, index)]
  }
}

export class LoadGenerator {
  private monitor: PerformanceMonitor
  private activeConnections: Set<string> = new Set()
  private requestId = 0

  constructor(monitor: PerformanceMonitor) {
    this.monitor = monitor
  }

  async generateLoad(
    targetFunction: (request: MCPRequest) => Promise<MCPResponse>,
    concurrentConnections: number,
    requestsPerConnection: number,
    requestDelay: number = 0,
  ): Promise<void> {
    const connections = Array.from({ length: concurrentConnections }, (_, i) =>
      this.createConnection(
        i.toString(),
        targetFunction,
        requestsPerConnection,
        requestDelay,
      ),
    )

    await Promise.all(connections)
  }

  async generateBurstLoad(
    targetFunction: (request: MCPRequest) => Promise<MCPResponse>,
    burstSize: number,
    burstInterval: number,
    burstCount: number,
  ): Promise<void> {
    for (let i = 0; i < burstCount; i++) {
      const burst = Array.from({ length: burstSize }, (_, j) =>
        this.sendSingleRequest(`burst-${i}-${j}`, targetFunction),
      )

      await Promise.all(burst)

      if (i < burstCount - 1) {
        await this.delay(burstInterval)
      }
    }
  }

  async generateRampUpLoad(
    targetFunction: (request: MCPRequest) => Promise<MCPResponse>,
    startConnections: number,
    endConnections: number,
    rampDuration: number,
    requestsPerConnection: number,
  ): Promise<void> {
    const steps = 10
    const stepDuration = rampDuration / steps
    const connectionIncrement = (endConnections - startConnections) / steps

    for (let step = 0; step < steps; step++) {
      const currentConnections = Math.floor(
        startConnections + connectionIncrement * step,
      )

      const connections = Array.from({ length: currentConnections }, (_, i) =>
        this.createConnection(
          `ramp-${step}-${i}`,
          targetFunction,
          requestsPerConnection,
        ),
      )

      Promise.all(connections)
      await this.delay(stepDuration)
    }
  }

  private async createConnection(
    connectionId: string,
    targetFunction: (request: MCPRequest) => Promise<MCPResponse>,
    requestCount: number,
    delay: number = 0,
  ): Promise<void> {
    this.monitor.addConnection(connectionId)
    this.activeConnections.add(connectionId)

    try {
      for (let i = 0; i < requestCount; i++) {
        await this.sendSingleRequest(connectionId, targetFunction)
        if (delay > 0) {
          await this.delay(delay)
        }
      }
      this.monitor.removeConnection(connectionId)
    } catch (error) {
      this.monitor.failConnection(connectionId)
    } finally {
      this.activeConnections.delete(connectionId)
    }
  }

  private async sendSingleRequest(
    connectionId: string,
    targetFunction: (request: MCPRequest) => Promise<MCPResponse>,
  ): Promise<void> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: ++this.requestId,
      method: "tools/list",
      params: {},
    }

    const startTime = performance.now()
    let success = false
    let error: MCPError | undefined

    try {
      const response = await targetFunction(request)
      success = !response.error
      error = response.error
    } catch (err) {
      error = {
        code: -32603,
        message: err instanceof Error ? err.message : "Unknown error",
      }
    }

    const responseTime = performance.now() - startTime
    this.monitor.recordRequest(connectionId, responseTime, success, error)
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  getActiveConnectionCount(): number {
    return this.activeConnections.size
  }
}

export class MetricsCollector {
  private metrics: LoadTestMetrics[] = []

  addMetrics(metrics: LoadTestMetrics): void {
    this.metrics.push(metrics)
  }

  getAggregatedMetrics(): LoadTestMetrics {
    if (this.metrics.length === 0) {
      throw new Error("No metrics collected")
    }

    const totalRequests = this.sum((m) => m.totalRequests)
    const successfulRequests = this.sum((m) => m.successfulRequests)
    const failedRequests = this.sum((m) => m.failedRequests)

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: this.average((m) => m.averageResponseTime),
      minResponseTime: this.min((m) => m.minResponseTime),
      maxResponseTime: this.max((m) => m.maxResponseTime),
      p95ResponseTime: this.average((m) => m.p95ResponseTime),
      p99ResponseTime: this.average((m) => m.p99ResponseTime),
      requestsPerSecond: this.average((m) => m.requestsPerSecond),
      errorsPerSecond: this.average((m) => m.errorsPerSecond),
      peakMemoryUsage: this.max((m) => m.peakMemoryUsage),
      averageCpuUsage: this.average((m) => m.averageCpuUsage),
      testDuration: this.max((m) => m.testDuration),
      concurrentConnections: this.max((m) => m.concurrentConnections),
    }
  }

  private sum(selector: (m: LoadTestMetrics) => number): number {
    return this.metrics.reduce((sum, m) => sum + selector(m), 0)
  }

  private average(selector: (m: LoadTestMetrics) => number): number {
    return this.sum(selector) / this.metrics.length
  }

  private min(selector: (m: LoadTestMetrics) => number): number {
    return Math.min(...this.metrics.map(selector))
  }

  private max(selector: (m: LoadTestMetrics) => number): number {
    return Math.max(...this.metrics.map(selector))
  }
}

export class TestResultValidator {
  static validatePerformanceThresholds(
    metrics: LoadTestMetrics,
    thresholds: {
      maxAverageResponseTime?: number
      maxP95ResponseTime?: number
      maxP99ResponseTime?: number
      minRequestsPerSecond?: number
      maxErrorRate?: number
      maxMemoryUsage?: number
      maxCpuUsage?: number
    },
  ): { passed: boolean; failures: string[] } {
    const failures: string[] = []

    if (
      thresholds.maxAverageResponseTime &&
      metrics.averageResponseTime > thresholds.maxAverageResponseTime
    ) {
      failures.push(
        `Average response time ${metrics.averageResponseTime}ms exceeds threshold ${thresholds.maxAverageResponseTime}ms`,
      )
    }

    if (
      thresholds.maxP95ResponseTime &&
      metrics.p95ResponseTime > thresholds.maxP95ResponseTime
    ) {
      failures.push(
        `P95 response time ${metrics.p95ResponseTime}ms exceeds threshold ${thresholds.maxP95ResponseTime}ms`,
      )
    }

    if (
      thresholds.maxP99ResponseTime &&
      metrics.p99ResponseTime > thresholds.maxP99ResponseTime
    ) {
      failures.push(
        `P99 response time ${metrics.p99ResponseTime}ms exceeds threshold ${thresholds.maxP99ResponseTime}ms`,
      )
    }

    if (
      thresholds.minRequestsPerSecond &&
      metrics.requestsPerSecond < thresholds.minRequestsPerSecond
    ) {
      failures.push(
        `Requests per second ${metrics.requestsPerSecond} below threshold ${thresholds.minRequestsPerSecond}`,
      )
    }

    const errorRate = metrics.failedRequests / metrics.totalRequests
    if (thresholds.maxErrorRate && errorRate > thresholds.maxErrorRate) {
      failures.push(
        `Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(thresholds.maxErrorRate * 100).toFixed(2)}%`,
      )
    }

    if (
      thresholds.maxMemoryUsage &&
      metrics.peakMemoryUsage > thresholds.maxMemoryUsage
    ) {
      failures.push(
        `Peak memory usage ${metrics.peakMemoryUsage}MB exceeds threshold ${thresholds.maxMemoryUsage}MB`,
      )
    }

    if (
      thresholds.maxCpuUsage &&
      metrics.averageCpuUsage > thresholds.maxCpuUsage
    ) {
      failures.push(
        `Average CPU usage ${metrics.averageCpuUsage}% exceeds threshold ${thresholds.maxCpuUsage}%`,
      )
    }

    return {
      passed: failures.length === 0,
      failures,
    }
  }

  static compareWithBaseline(
    current: LoadTestMetrics,
    baseline: LoadTestMetrics,
    tolerancePercent: number = 10,
  ): { passed: boolean; regressions: string[] } {
    const regressions: string[] = []
    const tolerance = tolerancePercent / 100

    const checkRegression = (
      currentValue: number,
      baselineValue: number,
      metricName: string,
      lowerIsBetter: boolean = true,
    ) => {
      const change = (currentValue - baselineValue) / baselineValue
      const threshold = lowerIsBetter ? tolerance : -tolerance

      if (change > threshold) {
        const direction = lowerIsBetter ? "increased" : "decreased"
        regressions.push(
          `${metricName} ${direction} by ${(change * 100).toFixed(2)}% (${currentValue} vs ${baselineValue})`,
        )
      }
    }

    checkRegression(
      current.averageResponseTime,
      baseline.averageResponseTime,
      "Average response time",
    )
    checkRegression(
      current.p95ResponseTime,
      baseline.p95ResponseTime,
      "P95 response time",
    )
    checkRegression(
      current.p99ResponseTime,
      baseline.p99ResponseTime,
      "P99 response time",
    )
    checkRegression(
      current.requestsPerSecond,
      baseline.requestsPerSecond,
      "Requests per second",
      false,
    )
    checkRegression(
      current.peakMemoryUsage,
      baseline.peakMemoryUsage,
      "Peak memory usage",
    )
    checkRegression(
      current.averageCpuUsage,
      baseline.averageCpuUsage,
      "Average CPU usage",
    )

    return {
      passed: regressions.length === 0,
      regressions,
    }
  }
}

export class ResourceCleanup {
  private cleanupTasks: (() => Promise<void>)[] = []

  addCleanupTask(task: () => Promise<void>): void {
    this.cleanupTasks.push(task)
  }

  async cleanup(): Promise<void> {
    const results = await Promise.allSettled(
      this.cleanupTasks.map((task) => task()),
    )

    const failures = results
      .filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      )
      .map((result) => result.reason)

    if (failures.length > 0) {
      console.warn("Some cleanup tasks failed:", failures)
    }

    this.cleanupTasks = []
  }

  static async withCleanup<T>(
    setup: (cleanup: ResourceCleanup) => Promise<T>,
    test: (resource: T) => Promise<void>,
  ): Promise<void> {
    const cleanup = new ResourceCleanup()
    let resource: T

    try {
      resource = await setup(cleanup)
      await test(resource)
    } finally {
      await cleanup.cleanup()
    }
  }
}

export function formatMetricsReport(metrics: LoadTestMetrics): string {
  return `
Load Test Results:
==================
Total Requests: ${metrics.totalRequests}
Successful: ${metrics.successfulRequests} (${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%)
Failed: ${metrics.failedRequests} (${((metrics.failedRequests / metrics.totalRequests) * 100).toFixed(2)}%)

Response Times:
- Average: ${metrics.averageResponseTime.toFixed(2)}ms
- Min: ${metrics.minResponseTime.toFixed(2)}ms
- Max: ${metrics.maxResponseTime.toFixed(2)}ms
- P95: ${metrics.p95ResponseTime.toFixed(2)}ms
- P99: ${metrics.p99ResponseTime.toFixed(2)}ms

Throughput:
- Requests/sec: ${metrics.requestsPerSecond.toFixed(2)}
- Errors/sec: ${metrics.errorsPerSecond.toFixed(2)}

Resource Usage:
- Peak Memory: ${metrics.peakMemoryUsage.toFixed(2)}MB
- Average CPU: ${metrics.averageCpuUsage.toFixed(2)}%

Test Configuration:
- Duration: ${metrics.testDuration.toFixed(2)}s
- Concurrent Connections: ${metrics.concurrentConnections}
`.trim()
}
