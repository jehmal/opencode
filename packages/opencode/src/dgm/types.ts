/**
 * Type definitions for DGM integration
 */

import { z } from "zod"

/**
 * DGM configuration schema
 */
export const DGMConfig = z.object({
  enabled: z.boolean().default(false).describe("Enable DGM integration"),
  pythonPath: z
    .string()
    .default("python3")
    .describe("Path to Python executable"),
  dgmPath: z
    .string()
    .optional()
    .describe("Path to DGM module (defaults to auto-discovery)"),
  timeout: z
    .number()
    .default(30000)
    .describe("Timeout for DGM operations in milliseconds"),
  maxRetries: z
    .number()
    .default(3)
    .describe("Maximum retry attempts for failed operations"),
  healthCheckInterval: z
    .number()
    .default(60000)
    .describe("Health check interval in milliseconds"),
})

export type DGMConfig = z.infer<typeof DGMConfig>

/**
 * DGM bridge status
 */
export enum DGMStatus {
  UNINITIALIZED = "uninitialized",
  INITIALIZING = "initializing",
  READY = "ready",
  ERROR = "error",
  DISCONNECTED = "disconnected",
}

/**
 * DGM health check result
 */
export interface DGMHealthCheck {
  status: DGMStatus
  timestamp: number
  version?: string
  capabilities?: string[]
  error?: string
}

/**
 * DGM tool definition
 */
export interface DGMTool {
  id: string
  name: string
  description: string
  parameters: any // JSON Schema
  pythonModule: string
  pythonFunction: string
}

/**
 * DGM message format for IPC
 */
export interface DGMMessage {
  id: string
  type: "request" | "response" | "error" | "event"
  method: string
  params?: any
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

/**
 * DGM event types
 */
export enum DGMEvent {
  CONNECTED = "dgm:connected",
  DISCONNECTED = "dgm:disconnected",
  ERROR = "dgm:error",
  TOOL_REGISTERED = "dgm:tool:registered",
  TOOL_UNREGISTERED = "dgm:tool:unregistered",
  HEALTH_CHECK = "dgm:health:check",
}

/**
 * DGM bridge interface
 */
export interface IDGMBridge {
  status: DGMStatus

  /**
   * Initialize the bridge connection
   */
  initialize(): Promise<void>

  /**
   * Shutdown the bridge
   */
  shutdown(): Promise<void>

  /**
   * Perform health check
   */
  healthCheck(): Promise<DGMHealthCheck>

  /**
   * Get available tools from DGM
   */
  getTools(): Promise<DGMTool[]>

  /**
   * Execute a DGM tool
   */
  executeTool(toolId: string, params: any, context: any): Promise<any>

  /**
   * Register event listener
   */
  on(event: DGMEvent, handler: (data: any) => void): void

  /**
   * Unregister event listener
   */
  off(event: DGMEvent, handler: (data: any) => void): void
}
