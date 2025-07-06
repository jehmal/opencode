#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js"

interface EchoConfig {
  prefix?: string
  suffix?: string
  uppercase?: boolean
  delay?: number
}

class EchoServer {
  private server: Server
  private config: EchoConfig

  constructor(config: EchoConfig = {}) {
    this.config = {
      prefix: "",
      suffix: "",
      uppercase: false,
      delay: 0,
      ...config,
    }

    this.server = new Server(
      {
        name: "echo-test-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    this.setupHandlers()
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "echo",
            description: "Echo back the input with optional transformations",
            inputSchema: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "Message to echo back",
                },
                transform: {
                  type: "string",
                  enum: ["none", "uppercase", "lowercase", "reverse"],
                  description: "Optional transformation to apply",
                  default: "none",
                },
              },
              required: ["message"],
            },
          } as Tool,
        ],
      }
    })

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      if (name === "echo") {
        const { message, transform = "none" } = args as {
          message: string
          transform?: string
        }

        let result = `${this.config.prefix}${message}${this.config.suffix}`

        switch (transform) {
          case "uppercase":
            result = result.toUpperCase()
            break
          case "lowercase":
            result = result.toLowerCase()
            break
          case "reverse":
            result = result.split("").reverse().join("")
            break
        }

        if (this.config.delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.config.delay))
        }

        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        }
      }

      throw new Error(`Unknown tool: ${name}`)
    })
  }

  async run() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error("Echo test server running on stdio")
  }
}

if (require.main === module) {
  const config: EchoConfig = {}

  if (process.env.ECHO_PREFIX) {
    config.prefix = process.env.ECHO_PREFIX
  }

  if (process.env.ECHO_SUFFIX) {
    config.suffix = process.env.ECHO_SUFFIX
  }

  if (process.env.ECHO_UPPERCASE === "true") {
    config.uppercase = true
  }

  if (process.env.ECHO_DELAY) {
    config.delay = parseInt(process.env.ECHO_DELAY, 10)
  }

  const server = new EchoServer(config)
  server.run().catch(console.error)
}

export { EchoServer }
