import type {
  DgmTool,
  DgmToolCall,
  DgmToolResult,
  DgmProcessStatus,
  DgmMetrics,
} from "../schemas"

/**
 * DGM Client Interface
 */
export interface IDgmClient {
  /**
   * Initialize the DGM client and start the Python process
   */
  initialize(): Promise<void>

  /**
   * Shutdown the DGM client and stop the Python process
   */
  shutdown(): Promise<void>

  /**
   * Call a DGM tool
   */
  callTool(call: DgmToolCall): Promise<DgmToolResult>

  /**
   * List all available tools
   */
  listTools(): Promise<DgmTool[]>

  /**
   * Get information about a specific tool
   */
  getTool(name: string): Promise<DgmTool | null>

  /**
   * Get the current process status
   */
  getStatus(): Promise<DgmProcessStatus>

  /**
   * Get metrics about tool usage
   */
  getMetrics(): Promise<DgmMetrics>

  /**
   * Check if the client is connected
   */
  isConnected(): boolean
}

/**
 * DGM Client Events
 */
export interface DgmClientEvents {
  connected: () => void
  disconnected: (error?: Error) => void
  error: (error: Error) => void
  toolCall: (call: DgmToolCall) => void
  toolResult: (result: DgmToolResult) => void
}

/**
 * DGM Client Options
 */
export interface DgmClientOptions {
  pythonPath?: string
  dgmPath: string
  timeout?: number
  maxRetries?: number
  retryDelay?: number
  logLevel?: "debug" | "info" | "warn" | "error"
  enableMetrics?: boolean
  onError?: (error: Error) => void
  onConnect?: () => void
  onDisconnect?: () => void
}
