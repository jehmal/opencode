import { experimental_createMCPClient } from "ai"
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio"
import { z } from "zod"
import { Log } from "../../../src/util/log"

export namespace MCPTestFramework {
  const log = Log.create({ service: "mcp-test-framework" })

  export const TestServerConfig = z.object({
    name: z.string(),
    type: z.enum(["local", "remote"]),
    command: z.array(z.string()).optional(),
    url: z.string().optional(),
    environment: z.record(z.string()).optional(),
    timeout: z.number().default(30000),
  })

  export type TestServerConfig = z.infer<typeof TestServerConfig>

  export interface TestContext {
    sessionID: string
    messageID: string
    abort: AbortSignal
    metadata: () => void
  }

  export class MCPTestOrchestrator {
    private clients = new Map<
      string,
      Awaited<ReturnType<typeof experimental_createMCPClient>>
    >()
    private cleanupHandlers: (() => Promise<void>)[] = []

    async startServer(config: TestServerConfig) {
      log.info("starting test server", { name: config.name, type: config.type })

      let client: Awaited<ReturnType<typeof experimental_createMCPClient>>

      if (config.type === "local") {
        if (!config.command) {
          throw new Error(`Local server ${config.name} requires command`)
        }
        const [cmd, ...args] = config.command
        client = await experimental_createMCPClient({
          name: config.name,
          transport: new Experimental_StdioMCPTransport({
            stderr: "ignore",
            command: cmd,
            args,
            env: {
              ...process.env,
              ...(config.environment || {}),
            },
          }),
        })
      } else if (config.type === "remote") {
        if (!config.url) {
          throw new Error(`Remote server ${config.name} requires url`)
        }
        client = await experimental_createMCPClient({
          name: config.name,
          transport: {
            type: "sse",
            url: config.url,
          },
        })
      } else {
        throw new Error(`Unsupported server type: ${config.type}`)
      }

      this.clients.set(config.name, client)
      this.cleanupHandlers.push(async () => {
        log.info("cleaning up test server", { name: config.name })
        client.close()
      })

      return client
    }

    async getClient(name: string) {
      const client = this.clients.get(name)
      if (!client) {
        throw new Error(`Client ${name} not found. Did you start the server?`)
      }
      return client
    }

    async getTools(serverName?: string) {
      const result: Record<string, any> = {}

      if (serverName) {
        const client = await this.getClient(serverName)
        const tools = await client.tools()
        for (const [toolName, tool] of Object.entries(tools)) {
          result[`${serverName}_${toolName}`] = tool
        }
      } else {
        for (const [clientName, client] of this.clients.entries()) {
          const tools = await client.tools()
          for (const [toolName, tool] of Object.entries(tools)) {
            result[`${clientName}_${toolName}`] = tool
          }
        }
      }

      return result
    }

    async cleanup() {
      log.info("cleaning up all test servers", {
        count: this.cleanupHandlers.length,
      })
      await Promise.all(this.cleanupHandlers.map((handler) => handler()))
      this.clients.clear()
      this.cleanupHandlers.length = 0
    }

    createTestContext(sessionID = "test-session"): TestContext {
      return {
        sessionID,
        messageID: `msg-${Date.now()}`,
        abort: AbortSignal.any([]),
        metadata: () => {},
      }
    }
  }

  export async function withTestServer<T>(
    config: TestServerConfig,
    testFn: (orchestrator: MCPTestOrchestrator) => Promise<T>,
  ): Promise<T> {
    const orchestrator = new MCPTestOrchestrator()
    try {
      await orchestrator.startServer(config)
      return await testFn(orchestrator)
    } finally {
      await orchestrator.cleanup()
    }
  }

  export async function withMultipleTestServers<T>(
    configs: TestServerConfig[],
    testFn: (orchestrator: MCPTestOrchestrator) => Promise<T>,
  ): Promise<T> {
    const orchestrator = new MCPTestOrchestrator()
    try {
      await Promise.all(
        configs.map((config) => orchestrator.startServer(config)),
      )
      return await testFn(orchestrator)
    } finally {
      await orchestrator.cleanup()
    }
  }
}
