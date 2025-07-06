import { z } from "zod"
import {
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPMethods,
  MCPErrorCodes,
} from "../mocks/shared/types"

/**
 * MCP Server connection types
 */
export type ServerTransport = "stdio" | "sse" | "websocket"

/**
 * MCP Server states during lifecycle
 */
export type ServerState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "crashed"

/**
 * Server capability definitions
 */
export interface ServerCapabilities {
  tools?: {
    listChanged?: boolean
  }
  resources?: {
    subscribe?: boolean
    listChanged?: boolean
  }
  prompts?: {
    listChanged?: boolean
  }
  logging?: {
    level?:
      | "debug"
      | "info"
      | "notice"
      | "warning"
      | "error"
      | "critical"
      | "alert"
      | "emergency"
  }
  experimental?: Record<string, any>
}

/**
 * Complete server configuration
 */
export interface ServerConfiguration {
  name: string
  transport: ServerTransport
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  capabilities?: ServerCapabilities
  timeout?: number
  retries?: number
  metadata?: Record<string, any>
}

/**
 * Server lifecycle event types
 */
export interface ServerLifecycleEvent {
  type: "state_change" | "capability_change" | "error" | "message"
  timestamp: number
  serverId: string
  data: any
}

/**
 * Mock server response configuration
 */
export interface MockServerResponse {
  method: string
  response: MCPResponse | MCPError
  delay?: number
  shouldFail?: boolean
}

/**
 * Zod schemas for validation
 */
export const ServerConfigurationSchema = z.object({
  name: z.string().min(1),
  transport: z.enum(["stdio", "sse", "websocket"]),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().url().optional(),
  capabilities: z
    .object({
      tools: z.object({ listChanged: z.boolean().optional() }).optional(),
      resources: z
        .object({
          subscribe: z.boolean().optional(),
          listChanged: z.boolean().optional(),
        })
        .optional(),
      prompts: z.object({ listChanged: z.boolean().optional() }).optional(),
      logging: z
        .object({
          level: z
            .enum([
              "debug",
              "info",
              "notice",
              "warning",
              "error",
              "critical",
              "alert",
              "emergency",
            ])
            .optional(),
        })
        .optional(),
      experimental: z.record(z.any()).optional(),
    })
    .optional(),
  timeout: z.number().positive().optional(),
  retries: z.number().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
})

/**
 * Factory functions for creating server configurations
 */
export class ServerFixtures {
  /**
   * Creates a basic stdio server configuration
   */
  static createStdioServer(
    overrides: Partial<ServerConfiguration> = {},
  ): ServerConfiguration {
    return {
      name: "test-stdio-server",
      transport: "stdio",
      command: "node",
      args: ["./mock-server.js"],
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: true },
        logging: { level: "info" },
      },
      timeout: 30000,
      retries: 3,
      ...overrides,
    }
  }

  /**
   * Creates a WebSocket server configuration
   */
  static createWebSocketServer(
    overrides: Partial<ServerConfiguration> = {},
  ): ServerConfiguration {
    return {
      name: "test-websocket-server",
      transport: "websocket",
      url: "ws://localhost:8080/mcp",
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: true },
        logging: { level: "debug" },
      },
      timeout: 15000,
      retries: 5,
      ...overrides,
    }
  }

  /**
   * Creates an SSE server configuration
   */
  static createSSEServer(
    overrides: Partial<ServerConfiguration> = {},
  ): ServerConfiguration {
    return {
      name: "test-sse-server",
      transport: "sse",
      url: "http://localhost:3000/mcp/events",
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false },
        logging: { level: "warning" },
      },
      timeout: 60000,
      retries: 1,
      ...overrides,
    }
  }

  /**
   * Creates a server configuration with minimal capabilities
   */
  static createMinimalServer(
    overrides: Partial<ServerConfiguration> = {},
  ): ServerConfiguration {
    return {
      name: "minimal-server",
      transport: "stdio",
      command: "echo",
      args: ["hello"],
      capabilities: {},
      ...overrides,
    }
  }

  /**
   * Creates a server configuration with all capabilities enabled
   */
  static createFullCapabilityServer(
    overrides: Partial<ServerConfiguration> = {},
  ): ServerConfiguration {
    return {
      name: "full-capability-server",
      transport: "stdio",
      command: "node",
      args: ["./full-server.js"],
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: true },
        logging: { level: "debug" },
        experimental: {
          customFeature: true,
          betaAPI: { version: "1.0" },
        },
      },
      timeout: 45000,
      retries: 2,
      env: {
        NODE_ENV: "test",
        DEBUG: "*",
      },
      metadata: {
        version: "1.0.0",
        author: "test-suite",
      },
      ...overrides,
    }
  }

  /**
   * Creates server configurations for different environments
   */
  static createEnvironmentServers(): Record<string, ServerConfiguration> {
    return {
      development: this.createStdioServer({
        name: "dev-server",
        env: { NODE_ENV: "development", DEBUG: "mcp:*" },
        timeout: 60000,
      }),
      testing: this.createStdioServer({
        name: "test-server",
        env: { NODE_ENV: "test", LOG_LEVEL: "error" },
        timeout: 10000,
      }),
      production: this.createWebSocketServer({
        name: "prod-server",
        url: "wss://api.example.com/mcp",
        timeout: 30000,
        retries: 5,
      }),
    }
  }
}
