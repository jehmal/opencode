import { z } from "zod"

/**
 * DGM Tool Schema
 */
export const DgmToolSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

/**
 * DGM Tool Call Schema
 */
export const DgmToolCallSchema = z.object({
  tool: z.string().min(1),
  arguments: z.record(z.unknown()).optional(),
  timeout: z.number().positive().optional(),
})

/**
 * DGM Tool Result Schema
 */
export const DgmToolResultSchema = z.object({
  success: z.boolean(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
  metadata: z
    .object({
      duration: z.number(),
      timestamp: z.string(),
      version: z.string().optional(),
    })
    .optional(),
})

/**
 * DGM Configuration Schema
 */
export const DgmConfigSchema = z.object({
  pythonPath: z.string().default("python3"),
  dgmPath: z.string(),
  timeout: z.number().positive().default(30000),
  maxRetries: z.number().nonnegative().default(3),
  retryDelay: z.number().nonnegative().default(1000),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  enableMetrics: z.boolean().default(true),
})

/**
 * DGM Process Status Schema
 */
export const DgmProcessStatusSchema = z.object({
  pid: z.number().positive().optional(),
  status: z.enum(["starting", "running", "stopping", "stopped", "error"]),
  startTime: z.string().optional(),
  uptime: z.number().optional(),
  memoryUsage: z.number().optional(),
  cpuUsage: z.number().optional(),
})

/**
 * DGM Metrics Schema
 */
export const DgmMetricsSchema = z.object({
  totalCalls: z.number(),
  successfulCalls: z.number(),
  failedCalls: z.number(),
  averageResponseTime: z.number(),
  toolMetrics: z.record(
    z.object({
      calls: z.number(),
      successes: z.number(),
      failures: z.number(),
      averageTime: z.number(),
    }),
  ),
})

export type DgmTool = z.infer<typeof DgmToolSchema>
export type DgmToolCall = z.infer<typeof DgmToolCallSchema>
export type DgmToolResult = z.infer<typeof DgmToolResultSchema>
export type DgmConfig = z.infer<typeof DgmConfigSchema>
export type DgmProcessStatus = z.infer<typeof DgmProcessStatusSchema>
export type DgmMetrics = z.infer<typeof DgmMetricsSchema>
