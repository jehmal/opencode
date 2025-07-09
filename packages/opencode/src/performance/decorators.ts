/**
 * Performance decorators for tool execution tracking
 */

import type { Tool } from "../tool/tool"
import { MetricsCollector } from "./metrics-collector"
import { Log } from "../util/log"
import { Config } from "../config/config"
import type { PerformanceDecoratorOptions } from "./types"

/**
 * Decorator to track performance of tool execution
 */
export function trackPerformance(options?: PerformanceDecoratorOptions) {
  return function <T extends Tool.Info>(tool: T): T {
    const log = Log.create({ service: `performance-${tool.id}` })
    const originalExecute = tool.execute

    const wrappedExecute: typeof tool.execute = async (args, ctx) => {
      // Check if performance tracking is enabled
      const config = await Config.get()
      if (!config.performance?.enabled) {
        return originalExecute(args, ctx)
      }

      // Apply sampling if configured
      if (options?.sampleRate !== undefined) {
        const random = Math.random()
        if (random > options.sampleRate) {
          return originalExecute(args, ctx)
        }
      }

      // Start tracking
      const executionId = MetricsCollector.startToolExecution(
        tool.id,
        ctx.sessionID,
        ctx.messageID,
        args,
      )

      const startMemory =
        options?.trackMemory && typeof process !== "undefined"
          ? process.memoryUsage()
          : null

      try {
        // Execute the tool
        const result = await originalExecute(args, ctx)

        // Complete tracking with success
        const metrics = MetricsCollector.completeToolExecution(
          executionId,
          true,
          result.output,
        )

        if (metrics && startMemory && options?.trackMemory) {
          const endMemory = process.memoryUsage()
          metrics.memoryUsed = endMemory.heapUsed - startMemory.heapUsed
        }

        // Add performance metadata to result
        return {
          ...result,
          metadata: {
            ...result.metadata,
            performance: {
              executionId,
              duration: metrics?.duration,
              timestamp: Date.now(),
              ...(options?.customMetadata || {}),
            },
          },
        }
      } catch (error) {
        // Complete tracking with failure
        MetricsCollector.completeToolExecution(
          executionId,
          false,
          null,
          error instanceof Error ? error : new Error(String(error)),
        )

        log.error("Tool execution failed", {
          toolId: tool.id,
          executionId,
          error: error instanceof Error ? error.message : String(error),
        })

        // Re-throw to preserve error handling
        throw error
      }
    }

    // Return tool with wrapped execute
    return {
      ...tool,
      execute: wrappedExecute,
    }
  }
}

/**
 * Create a performance-tracked version of a tool
 */
export function withPerformanceTracking<T extends Tool.Info>(
  tool: T,
  options?: PerformanceDecoratorOptions,
): T {
  return trackPerformance(options)(tool)
}

/**
 * Batch decorator application for multiple tools
 */
export function trackAllTools(
  tools: Tool.Info[],
  options?: PerformanceDecoratorOptions,
): Tool.Info[] {
  return tools.map((tool) => withPerformanceTracking(tool, options))
}

/**
 * Conditional performance tracking based on tool ID
 */
export function trackSelectiveTools(
  tools: Tool.Info[],
  selector: (toolId: string) => boolean | PerformanceDecoratorOptions,
): Tool.Info[] {
  return tools.map((tool) => {
    const result = selector(tool.id)

    if (result === false) {
      return tool
    }

    const options = result === true ? undefined : result
    return withPerformanceTracking(tool, options)
  })
}

/**
 * High-level decorator for class methods (future use)
 */
export function measurePerformance(
  _target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const originalMethod = descriptor.value

  descriptor.value = async function (...args: any[]) {
    const startTime = performance.now()
    const startMemory =
      typeof process !== "undefined" ? process.memoryUsage().heapUsed : 0

    try {
      const result = await originalMethod.apply(this, args)
      const duration = performance.now() - startTime
      const memoryDelta =
        typeof process !== "undefined"
          ? process.memoryUsage().heapUsed - startMemory
          : 0

      Log.create({ service: "performance-measure" }).info(
        "Method execution completed",
        {
          method: propertyKey,
          duration,
          memoryDelta,
          success: true,
        },
      )

      return result
    } catch (error) {
      const duration = performance.now() - startTime

      Log.create({ service: "performance-measure" }).error(
        "Method execution failed",
        {
          method: propertyKey,
          duration,
          error: error instanceof Error ? error.message : String(error),
        },
      )

      throw error
    }
  }

  return descriptor
}
