/**
 * JSON-RPC Instrumentation Middleware
 * Lightweight, non-blocking metrics collection for JSON-RPC calls
 */

import { performance } from 'perf_hooks'
import { 
  JsonRpcRequest, 
  JsonRpcResponse, 
  JsonRpcError 
} from '../../../protocol/typescript/src/types'
import { 
  ExecutionMetrics, 
  RpcMetrics, 
  ExecutionStatus,
  Language 
} from './types'
import { MetricsCollector } from './collector'

export interface MiddlewareContext {
  metricsCollector: MetricsCollector
  language: Language
}

export class JsonRpcInstrumentationMiddleware {
  private pendingRequests = new Map<string | number, {
    startTime: number
    requestSize: number
    executionTracker?: any
  }>()

  constructor(private context: MiddlewareContext) {}

  /**
   * Instrument outgoing request
   */
  instrumentRequest(request: JsonRpcRequest): JsonRpcRequest {
    const startTime = performance.now()
    const requestStr = JSON.stringify(request)
    const requestSize = Buffer.byteLength(requestStr, 'utf8')

    // Store pending request info
    this.pendingRequests.set(request.id, {
      startTime,
      requestSize
    })

    // For tool.execute requests, start execution tracking
    if (request.method === 'tool.execute' && request.params) {
      const { tool, parameters, context } = request.params
      const executionTracker = this.context.metricsCollector.startExecution({
        toolId: tool,
        executionId: String(request.id),
        sessionId: context.sessionId,
        messageId: context.messageId,
        language: this.context.language
      })

      // Update pending request with tracker
      const pending = this.pendingRequests.get(request.id)
      if (pending) {
        pending.executionTracker = executionTracker
      }
    }

    return request
  }

  /**
   * Instrument incoming response
   */
  instrumentResponse(response: JsonRpcResponse): JsonRpcResponse {
    const endTime = performance.now()
    const responseStr = JSON.stringify(response)
    const responseSize = Buffer.byteLength(responseStr, 'utf8')

    const pending = this.pendingRequests.get(response.id)
    if (!pending) {
      return response
    }

    this.pendingRequests.delete(response.id)

    const transportTime = endTime - pending.startTime

    // Record RPC metrics if we have an execution tracker
    if (pending.executionTracker) {
      const rpcMetrics: Partial<RpcMetrics> = {
        requestSize: pending.requestSize,
        responseSize,
        transportTime
      }

      pending.executionTracker.recordRpcMetrics(rpcMetrics)

      // Complete execution based on response
      if (response.error) {
        pending.executionTracker.complete('error', {
          code: String(response.error.code),
          message: response.error.message,
          context: response.error.data
        })
      } else {
        pending.executionTracker.complete('success')
      }
    }

    return response
  }

  /**
   * Create request interceptor for outgoing calls
   */
  createRequestInterceptor(): (request: JsonRpcRequest) => JsonRpcRequest {
    return (request: JsonRpcRequest) => {
      try {
        return this.instrumentRequest(request)
      } catch (error) {
        // Don't let instrumentation errors affect normal operation
        console.error('Metrics instrumentation error:', error)
        return request
      }
    }
  }

  /**
   * Create response interceptor for incoming responses
   */
  createResponseInterceptor(): (response: JsonRpcResponse) => JsonRpcResponse {
    return (response: JsonRpcResponse) => {
      try {
        return this.instrumentResponse(response)
      } catch (error) {
        // Don't let instrumentation errors affect normal operation
        console.error('Metrics instrumentation error:', error)
        return response
      }
    }
  }

  /**
   * Handle request timeout
   */
  handleTimeout(requestId: string | number): void {
    const pending = this.pendingRequests.get(requestId)
    if (pending?.executionTracker) {
      pending.executionTracker.complete('timeout')
    }
    this.pendingRequests.delete(requestId)
  }

  /**
   * Handle request cancellation
   */
  handleCancellation(requestId: string | number): void {
    const pending = this.pendingRequests.get(requestId)
    if (pending?.executionTracker) {
      pending.executionTracker.complete('cancelled')
    }
    this.pendingRequests.delete(requestId)
  }

  /**
   * Get active request count
   */
  getActiveRequestCount(): number {
    return this.pendingRequests.size
  }
}

/**
 * Helper to wrap a function with metrics collection
 */
export function withMetrics<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  toolId: string,
  metricsCollector: MetricsCollector,
  language: Language = 'typescript'
): T {
  return (async (...args: Parameters<T>) => {
    const executionId = `${toolId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const tracker = metricsCollector.startExecution({
      toolId,
      executionId,
      sessionId: 'direct-call',
      messageId: 'direct-call',
      language
    })

    const startMem = process.memoryUsage().heapUsed

    try {
      const result = await fn(...args)
      
      const endMem = process.memoryUsage().heapUsed
      tracker.recordResourceMetrics({
        memoryDelta: endMem - startMem
      })
      
      tracker.complete('success')
      return result
    } catch (error) {
      tracker.complete('error', {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || String(error),
        stack: error.stack
      })
      throw error
    }
  }) as T
}