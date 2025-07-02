/**
 * TypeScript Metrics Collector
 * Lightweight in-memory metrics collection with periodic flushing
 */

import { performance } from 'perf_hooks'
import { EventEmitter } from 'events'
import {
  ExecutionMetrics,
  AggregatedMetrics,
  MetricsCollector as IMetricsCollector,
  ExecutionTracker as IExecutionTracker,
  ExecutionStatus,
  ErrorDetail,
  Language,
  AggregationPeriod,
  RpcMetrics,
  ResourceMetrics
} from './types'

export class ExecutionTracker implements IExecutionTracker {
  private metrics: ExecutionMetrics
  private startMark: number

  constructor(
    public readonly executionId: string,
    private collector: MetricsCollector,
    params: {
      toolId: string
      sessionId: string
      messageId: string
      language: Language
    }
  ) {
    this.startMark = performance.now()
    this.metrics = {
      ...params,
      executionId,
      startTime: new Date().toISOString(),
      status: 'success' // Default, will be updated
    }
  }

  recordRpcMetrics(metrics: Partial<RpcMetrics>): void {
    this.metrics.rpcMetrics = {
      ...this.metrics.rpcMetrics,
      ...metrics
    }
  }

  recordResourceMetrics(metrics: Partial<ResourceMetrics>): void {
    this.metrics.resourceMetrics = {
      ...this.metrics.resourceMetrics,
      ...metrics
    }
  }

  recordCustomMetric(key: string, value: any): void {
    if (!this.metrics.customMetrics) {
      this.metrics.customMetrics = {}
    }
    this.metrics.customMetrics[key] = value
  }

  complete(status: ExecutionStatus, error?: ErrorDetail): void {
    const endMark = performance.now()
    this.metrics.endTime = new Date().toISOString()
    this.metrics.duration = endMark - this.startMark
    this.metrics.status = status
    if (error) {
      this.metrics.error = error
    }

    this.collector.recordExecution(this.metrics)
  }
}

export class MetricsCollector extends EventEmitter implements IMetricsCollector {
  private executions: ExecutionMetrics[] = []
  private aggregatedCache = new Map<string, AggregatedMetrics>()
  private flushTimer?: NodeJS.Timer
  private readonly maxBufferSize: number
  private readonly flushInterval: number

  constructor(options: {
    maxBufferSize?: number
    flushInterval?: number // milliseconds
    autoFlush?: boolean
  } = {}) {
    super()
    this.maxBufferSize = options.maxBufferSize || 1000
    this.flushInterval = options.flushInterval || 60000 // 1 minute

    if (options.autoFlush !== false) {
      this.startAutoFlush()
    }
  }

  startExecution(params: {
    toolId: string
    executionId: string
    sessionId: string
    messageId: string
    language: Language
  }): ExecutionTracker {
    return new ExecutionTracker(params.executionId, this, params)
  }

  recordExecution(metrics: ExecutionMetrics): void {
    this.executions.push(metrics)
    this.emit('execution', metrics)

    // Check if we need to flush
    if (this.executions.length >= this.maxBufferSize) {
      this.flush().catch(error => {
        this.emit('error', error)
      })
    }
  }

  getMetrics(toolId?: string): ExecutionMetrics[] {
    if (!toolId) {
      return [...this.executions]
    }
    return this.executions.filter(m => m.toolId === toolId)
  }

  getAggregatedMetrics(
    toolId: string,
    language: Language,
    period: AggregationPeriod
  ): AggregatedMetrics | null {
    const cacheKey = `${toolId}-${language}-${period}`
    
    // Check cache first
    const cached = this.aggregatedCache.get(cacheKey)
    if (cached && this.isCacheValid(cached, period)) {
      return cached
    }

    // Calculate aggregated metrics
    const relevantMetrics = this.executions.filter(
      m => m.toolId === toolId && m.language === language
    )

    if (relevantMetrics.length === 0) {
      return null
    }

    const aggregated = this.calculateAggregatedMetrics(
      relevantMetrics,
      toolId,
      language,
      period
    )

    // Cache the result
    this.aggregatedCache.set(cacheKey, aggregated)
    return aggregated
  }

  private calculateAggregatedMetrics(
    metrics: ExecutionMetrics[],
    toolId: string,
    language: Language,
    period: AggregationPeriod
  ): AggregatedMetrics {
    const now = new Date()
    const periodStart = this.getPeriodStart(now, period)

    // Filter metrics within the period
    const periodMetrics = metrics.filter(m => {
      const startTime = new Date(m.startTime)
      return startTime >= periodStart && startTime <= now
    })

    // Count by status
    const statusCounts = {
      success: 0,
      error: 0,
      timeout: 0,
      cancelled: 0
    }

    const durations: number[] = []
    const errorBreakdown: Record<string, number> = {}

    for (const metric of periodMetrics) {
      statusCounts[metric.status]++
      
      if (metric.duration !== undefined) {
        durations.push(metric.duration)
      }

      if (metric.error) {
        errorBreakdown[metric.error.code] = (errorBreakdown[metric.error.code] || 0) + 1
      }
    }

    // Calculate duration statistics
    durations.sort((a, b) => a - b)
    const durationStats = this.calculatePercentiles(durations)

    return {
      toolId,
      language,
      period,
      startTime: periodStart.toISOString(),
      endTime: now.toISOString(),
      totalExecutions: periodMetrics.length,
      successCount: statusCounts.success,
      errorCount: statusCounts.error,
      timeoutCount: statusCounts.timeout,
      cancelledCount: statusCounts.cancelled,
      successRate: periodMetrics.length > 0 
        ? statusCounts.success / periodMetrics.length 
        : 0,
      averageDuration: durationStats.average,
      minDuration: durationStats.min,
      maxDuration: durationStats.max,
      p50Duration: durationStats.p50,
      p90Duration: durationStats.p90,
      p95Duration: durationStats.p95,
      p99Duration: durationStats.p99,
      errorBreakdown
    }
  }

  private calculatePercentiles(values: number[]): {
    average: number
    min: number
    max: number
    p50: number
    p90: number
    p95: number
    p99: number
  } {
    if (values.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0
      }
    }

    const sum = values.reduce((a, b) => a + b, 0)
    const average = sum / values.length

    return {
      average,
      min: values[0],
      max: values[values.length - 1],
      p50: this.percentile(values, 0.5),
      p90: this.percentile(values, 0.9),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99)
    }
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0
    const index = Math.ceil(sortedValues.length * p) - 1
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))]
  }

  private getPeriodStart(now: Date, period: AggregationPeriod): Date {
    const start = new Date(now)
    
    switch (period) {
      case 'minute':
        start.setSeconds(0, 0)
        break
      case 'hour':
        start.setMinutes(0, 0, 0)
        break
      case 'day':
        start.setHours(0, 0, 0, 0)
        break
      case 'week':
        start.setDate(start.getDate() - start.getDay())
        start.setHours(0, 0, 0, 0)
        break
    }
    
    return start
  }

  private isCacheValid(cached: AggregatedMetrics, period: AggregationPeriod): boolean {
    const now = new Date()
    const cacheAge = now.getTime() - new Date(cached.endTime).getTime()
    
    // Cache validity in milliseconds
    const maxAge = {
      minute: 10000,    // 10 seconds
      hour: 60000,      // 1 minute
      day: 300000,      // 5 minutes
      week: 600000      // 10 minutes
    }
    
    return cacheAge < maxAge[period]
  }

  async flush(): Promise<void> {
    if (this.executions.length === 0) {
      return
    }

    const metricsToFlush = [...this.executions]
    this.executions = []

    try {
      await this.persistMetrics(metricsToFlush)
      this.emit('flush', metricsToFlush.length)
    } catch (error) {
      // Re-add metrics on failure
      this.executions.unshift(...metricsToFlush)
      throw error
    }
  }

  private async persistMetrics(metrics: ExecutionMetrics[]): Promise<void> {
    // Override this method to implement persistence
    // Default implementation just logs
    console.log(`Flushing ${metrics.length} metrics`)
  }

  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        this.emit('error', error)
      })
    }, this.flushInterval)
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }
  }
}

// Global metrics collector instance
let globalCollector: MetricsCollector | null = null

export function getGlobalMetricsCollector(): MetricsCollector {
  if (!globalCollector) {
    globalCollector = new MetricsCollector()
  }
  return globalCollector
}

export function setGlobalMetricsCollector(collector: MetricsCollector): void {
  if (globalCollector) {
    globalCollector.stop()
  }
  globalCollector = collector
}