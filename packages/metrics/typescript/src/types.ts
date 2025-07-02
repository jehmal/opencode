/**
 * DGMSTT Metrics Types
 * Lightweight metrics collection for cross-language tool execution
 */

export type Language = 'typescript' | 'python'
export type ExecutionStatus = 'success' | 'error' | 'timeout' | 'cancelled'
export type AggregationPeriod = 'minute' | 'hour' | 'day' | 'week'

export interface ErrorDetail {
  code: string
  message: string
  stack?: string
  context?: Record<string, any>
}

export interface RpcMetrics {
  requestSize: number
  responseSize: number
  serializationTime: number
  transportTime: number
}

export interface ResourceMetrics {
  cpuUsage?: number
  memoryUsed?: number
  memoryDelta?: number
}

export interface ExecutionMetrics {
  toolId: string
  executionId: string
  sessionId: string
  messageId: string
  language: Language
  startTime: string // ISO 8601
  endTime?: string
  duration?: number // milliseconds
  status: ExecutionStatus
  error?: ErrorDetail
  rpcMetrics?: RpcMetrics
  resourceMetrics?: ResourceMetrics
  customMetrics?: Record<string, any>
}

export interface AggregatedMetrics {
  toolId: string
  language: Language
  period: AggregationPeriod
  startTime: string
  endTime: string
  totalExecutions: number
  successCount: number
  errorCount: number
  timeoutCount: number
  cancelledCount: number
  successRate: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  p50Duration: number
  p90Duration: number
  p95Duration: number
  p99Duration: number
  errorBreakdown: Record<string, number>
}

export interface MetricsCollector {
  startExecution(params: {
    toolId: string
    executionId: string
    sessionId: string
    messageId: string
    language: Language
  }): ExecutionTracker
  
  getMetrics(toolId?: string): ExecutionMetrics[]
  getAggregatedMetrics(
    toolId: string,
    language: Language,
    period: AggregationPeriod
  ): AggregatedMetrics | null
  
  flush(): Promise<void>
}

export interface ExecutionTracker {
  executionId: string
  
  recordRpcMetrics(metrics: Partial<RpcMetrics>): void
  recordResourceMetrics(metrics: Partial<ResourceMetrics>): void
  recordCustomMetric(key: string, value: any): void
  
  complete(status: ExecutionStatus, error?: ErrorDetail): void
}