/**
 * Performance tracking for DGM operations
 */

// import { Decimal } from 'decimal.js'; // Reserved for future cost calculations

export type OperationType =
  | "memory-search"
  | "memory-store"
  | "memory-update"
  | "tool-execution"
  | "bridge-init"
  | "bridge-call"

export interface PerformanceReport {
  totalOperations: number
  averageLatency: number
  maxLatency: number
  minLatency: number
  operationBreakdown: Record<
    OperationType,
    {
      count: number
      avgLatency: number
      totalTime: number
    }
  >
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
  }
}

export class PerformanceMetric {
  private startTime: number
  private endTime?: number

  constructor(
    public readonly operation: OperationType,
    public readonly metadata?: Record<string, any>,
  ) {
    this.startTime = performance.now()
  }

  end(): number {
    this.endTime = performance.now()
    return this.getDuration()
  }

  getDuration(): number {
    if (!this.endTime) {
      return performance.now() - this.startTime
    }
    return this.endTime - this.startTime
  }

  isComplete(): boolean {
    return this.endTime !== undefined
  }
}

export class PerformanceTracker {
  private metrics: PerformanceMetric[] = []
  private maxMetrics = 1000 // Keep last 1000 metrics

  startOperation(
    type: OperationType,
    metadata?: Record<string, any>,
  ): PerformanceMetric {
    const metric = new PerformanceMetric(type, metadata)
    this.metrics.push(metric)

    // Maintain size limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    return metric
  }

  getReport(): PerformanceReport {
    const completedMetrics = this.metrics.filter((m) => m.isComplete())

    if (completedMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        operationBreakdown: {} as any,
        memoryUsage: this.getMemoryUsage(),
      }
    }

    const durations = completedMetrics.map((m) => m.getDuration())
    const operationMap = new Map<OperationType, number[]>()

    // Group by operation type
    completedMetrics.forEach((metric) => {
      const existing = operationMap.get(metric.operation) || []
      existing.push(metric.getDuration())
      operationMap.set(metric.operation, existing)
    })

    // Calculate breakdown
    const operationBreakdown: Record<string, any> = {}
    operationMap.forEach((durations, operation) => {
      const sum = durations.reduce((a, b) => a + b, 0)
      operationBreakdown[operation] = {
        count: durations.length,
        avgLatency: sum / durations.length,
        totalTime: sum,
      }
    })

    return {
      totalOperations: completedMetrics.length,
      averageLatency: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxLatency: Math.max(...durations),
      minLatency: Math.min(...durations),
      operationBreakdown,
      memoryUsage: this.getMemoryUsage(),
    }
  }

  private getMemoryUsage() {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const usage = process.memoryUsage()
      return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
      }
    }

    // Fallback for environments without process.memoryUsage
    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
    }
  }

  clear() {
    this.metrics = []
  }

  // Advanced analysis methods
  getPercentile(percentile: number): number {
    const durations = this.metrics
      .filter((m) => m.isComplete())
      .map((m) => m.getDuration())
      .sort((a, b) => a - b)

    if (durations.length === 0) return 0

    const index = Math.ceil((percentile / 100) * durations.length) - 1
    return durations[Math.max(0, index)] ?? 0
  }

  getOperationStats(operation: OperationType) {
    const operationMetrics = this.metrics.filter(
      (m) => m.operation === operation && m.isComplete(),
    )

    if (operationMetrics.length === 0) {
      return null
    }

    const durations = operationMetrics.map((m) => m.getDuration())
    const sum = durations.reduce((a, b) => a + b, 0)

    // Calculate standard deviation
    const avg = sum / durations.length
    const variance =
      durations.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) /
      durations.length
    const stdDev = Math.sqrt(variance)

    return {
      count: durations.length,
      average: avg,
      min: Math.min(...durations),
      max: Math.max(...durations),
      standardDeviation: stdDev,
      p50: this.getPercentileForOperation(operation, 50),
      p95: this.getPercentileForOperation(operation, 95),
      p99: this.getPercentileForOperation(operation, 99),
    }
  }

  private getPercentileForOperation(
    operation: OperationType,
    percentile: number,
  ): number {
    const durations = this.metrics
      .filter((m) => m.operation === operation && m.isComplete())
      .map((m) => m.getDuration())
      .sort((a, b) => a - b)

    if (durations.length === 0) return 0

    const index = Math.ceil((percentile / 100) * durations.length) - 1
    return durations[Math.max(0, index)] ?? 0
  }
}
