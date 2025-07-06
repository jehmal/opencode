import { experimental_createMCPClient, type Tool } from "ai"
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio"
import { z } from "zod"
import { Log } from "../../../src/util/log"
import { NamedError } from "../../../src/util/error"
import { Config } from "../../../src/config/config"
import { TestEnvironment } from "./TestEnvironment"
import { MockServer } from "./MockServer"

export namespace MCPTestClient {
  const log = Log.create({ service: "mcp-test-client" })

  export const ClientFailed = NamedError.create(
    "MCPTestClientFailed",
    z.object({
      operation: z.string(),
      serverName: z.string().optional(),
      reason: z.string(),
    }),
  )

  export interface ClientConfig {
    name: string
    type: "local" | "remote" | "mock"
    command?: string[]
    url?: string
    environment?: Record<string, string>
    timeout?: number
    retries?: number
    mockConfig?: MockServer.Config
  }

  export interface ToolCall {
    name: string
    parameters: Record<string, any>
  }

  export interface ToolResult {
    success: boolean
    result?: any
    error?: string
    duration: number
  }

  export interface ClientMetrics {
    connectTime: number
    toolCalls: number
    successfulCalls: number
    failedCalls: number
    averageResponseTime: number
    errors: string[]
  }

  export class Instance {
    private client?: Awaited<ReturnType<typeof experimental_createMCPClient>>
    private mockServer?: MockServer.Instance
    private metrics: ClientMetrics
    private startTime: number

    constructor(
      private config: ClientConfig,
      private environment: TestEnvironment.Instance,
    ) {
      this.metrics = {
        connectTime: 0,
        toolCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageResponseTime: 0,
        errors: [],
      }
      this.startTime = Date.now()
    }

    async connect(): Promise<void> {
      const connectStart = Date.now()

      try {
        log.info("connecting to MCP server", {
          name: this.config.name,
          type: this.config.type,
        })

        switch (this.config.type) {
          case "mock":
            await this.connectMock()
            break
          case "local":
            await this.connectLocal()
            break
          case "remote":
            await this.connectRemote()
            break
          default:
            throw new Error(`Unsupported client type: ${this.config.type}`)
        }

        this.metrics.connectTime = Date.now() - connectStart
        log.info("connected successfully", {
          name: this.config.name,
          connectTime: this.metrics.connectTime,
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        this.metrics.errors.push(`Connection failed: ${errorMsg}`)
        throw ClientFailed.create({
          operation: "connect",
          serverName: this.config.name,
          reason: errorMsg,
        })
      }
    }

    private async connectMock(): Promise<void> {
      if (!this.config.mockConfig) {
        throw new Error("Mock configuration required for mock client")
      }

      this.mockServer = await MockServer.create(this.config.mockConfig)
      await this.mockServer.start()

      // Create client that connects to mock server
      this.client = await experimental_createMCPClient({
        name: this.config.name,
        transport: {
          type: "sse",
          url: this.mockServer.getUrl(),
        },
      })
    }

    private async connectLocal(): Promise<void> {
      if (!this.config.command) {
        throw new Error("Command required for local client")
      }

      const [cmd, ...args] = this.config.command

      this.client = await experimental_createMCPClient({
        name: this.config.name,
        transport: new Experimental_StdioMCPTransport({
          stderr: "ignore",
          command: cmd,
          args,
          env: {
            ...process.env,
            ...this.config.environment,
          },
        }),
      })
    }

    private async connectRemote(): Promise<void> {
      if (!this.config.url) {
        throw new Error("URL required for remote client")
      }

      this.client = await experimental_createMCPClient({
        name: this.config.name,
        transport: {
          type: "sse",
          url: this.config.url,
        },
      })
    }

    async getTools(): Promise<Record<string, Tool>> {
      if (!this.client) {
        throw ClientFailed.create({
          operation: "getTools",
          serverName: this.config.name,
          reason: "Client not connected",
        })
      }

      try {
        return await this.client.tools()
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        this.metrics.errors.push(`Get tools failed: ${errorMsg}`)
        throw ClientFailed.create({
          operation: "getTools",
          serverName: this.config.name,
          reason: errorMsg,
        })
      }
    }

    async callTool(
      name: string,
      parameters: Record<string, any> = {},
    ): Promise<ToolResult> {
      if (!this.client) {
        throw ClientFailed.create({
          operation: "callTool",
          serverName: this.config.name,
          reason: "Client not connected",
        })
      }

      const callStart = Date.now()
      this.metrics.toolCalls++

      try {
        log.debug("calling tool", { name, parameters })

        const tools = await this.client.tools()
        const tool = tools[name]

        if (!tool) {
          throw new Error(`Tool '${name}' not found`)
        }

        // Call the tool
        const result = await tool.execute(parameters)

        const duration = Date.now() - callStart
        this.updateResponseTimeMetrics(duration)
        this.metrics.successfulCalls++

        log.debug("tool call successful", { name, duration })

        return {
          success: true,
          result,
          duration,
        }
      } catch (error) {
        const duration = Date.now() - callStart
        const errorMsg = error instanceof Error ? error.message : String(error)

        this.updateResponseTimeMetrics(duration)
        this.metrics.failedCalls++
        this.metrics.errors.push(`Tool call failed (${name}): ${errorMsg}`)

        log.error("tool call failed", { name, error: errorMsg, duration })

        return {
          success: false,
          error: errorMsg,
          duration,
        }
      }
    }

    async testConnection(): Promise<boolean> {
      try {
        await this.getTools()
        return true
      } catch {
        return false
      }
    }

    async waitForConnection(timeoutMs = 10000): Promise<void> {
      const start = Date.now()

      while (Date.now() - start < timeoutMs) {
        if (await this.testConnection()) {
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      throw ClientFailed.create({
        operation: "waitForConnection",
        serverName: this.config.name,
        reason: `Connection timeout after ${timeoutMs}ms`,
      })
    }

    getMetrics(): ClientMetrics {
      return { ...this.metrics }
    }

    getConfig(): ClientConfig {
      return { ...this.config }
    }

    isConnected(): boolean {
      return !!this.client
    }

    isMock(): boolean {
      return this.config.type === "mock"
    }

    getMockServer(): MockServer.Instance | undefined {
      return this.mockServer
    }

    private updateResponseTimeMetrics(duration: number): void {
      const totalCalls = this.metrics.successfulCalls + this.metrics.failedCalls
      if (totalCalls === 1) {
        this.metrics.averageResponseTime = duration
      } else {
        this.metrics.averageResponseTime =
          (this.metrics.averageResponseTime * (totalCalls - 1) + duration) /
          totalCalls
      }
    }

    async cleanup(): Promise<void> {
      log.info("cleaning up test client", { name: this.config.name })

      try {
        if (this.client) {
          this.client.close()
          this.client = undefined
        }

        if (this.mockServer) {
          await this.mockServer.stop()
          this.mockServer = undefined
        }
      } catch (error) {
        log.warn("cleanup error", {
          name: this.config.name,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  export async function create(
    environment: TestEnvironment.Instance,
    config?: Partial<ClientConfig>,
  ): Promise<Instance> {
    const defaultConfig: ClientConfig = {
      name: "test-client",
      type: "mock",
      timeout: 10000,
      retries: 3,
      mockConfig: {
        name: "test-mock-server",
        tools: {},
        resources: [],
        port: 0, // Auto-assign port
      },
      ...config,
    }

    const client = new Instance(defaultConfig, environment)
    await client.connect()
    return client
  }

  export async function createLocal(
    environment: TestEnvironment.Instance,
    command: string[],
    options: Partial<ClientConfig> = {},
  ): Promise<Instance> {
    const config: ClientConfig = {
      name: options.name || "test-local-client",
      type: "local",
      command,
      environment: options.environment,
      timeout: options.timeout || 10000,
      retries: options.retries || 3,
      ...options,
    }

    const client = new Instance(config, environment)
    await client.connect()
    return client
  }

  export async function createRemote(
    environment: TestEnvironment.Instance,
    url: string,
    options: Partial<ClientConfig> = {},
  ): Promise<Instance> {
    const config: ClientConfig = {
      name: options.name || "test-remote-client",
      type: "remote",
      url,
      timeout: options.timeout || 10000,
      retries: options.retries || 3,
      ...options,
    }

    const client = new Instance(config, environment)
    await client.connect()
    return client
  }

  export async function createMock(
    environment: TestEnvironment.Instance,
    mockConfig: MockServer.Config,
    options: Partial<ClientConfig> = {},
  ): Promise<Instance> {
    const config: ClientConfig = {
      name: options.name || "test-mock-client",
      type: "mock",
      mockConfig,
      timeout: options.timeout || 10000,
      retries: options.retries || 3,
      ...options,
    }

    const client = new Instance(config, environment)
    await client.connect()
    return client
  }

  export function fromConfig(
    environment: TestEnvironment.Instance,
    mcpConfig: Config.Mcp,
    name: string,
  ): Promise<Instance> {
    if (mcpConfig.type === "local") {
      return createLocal(environment, mcpConfig.command, {
        name,
        environment: mcpConfig.environment,
      })
    } else if (mcpConfig.type === "remote") {
      return createRemote(environment, mcpConfig.url, { name })
    } else {
      throw new Error(`Unsupported MCP config type: ${(mcpConfig as any).type}`)
    }
  }
}
