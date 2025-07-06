import { z } from "zod"

export namespace MCPTestFixtures {
  export const MockServerResponse = z.object({
    id: z.string(),
    result: z.any().optional(),
    error: z
      .object({
        code: z.number(),
        message: z.string(),
        data: z.any().optional(),
      })
      .optional(),
  })

  export type MockServerResponse = z.infer<typeof MockServerResponse>

  export const TestData = {
    sampleTools: {
      "test-server_echo": {
        name: "echo",
        description: "Echo back the input",
        inputSchema: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
          required: ["message"],
        },
      },
      "test-server_add": {
        name: "add",
        description: "Add two numbers",
        inputSchema: {
          type: "object",
          properties: {
            a: { type: "number" },
            b: { type: "number" },
          },
          required: ["a", "b"],
        },
      },
    },

    sampleConfigs: {
      localEcho: {
        name: "test-echo",
        type: "local" as const,
        command: [
          "node",
          "-e",
          `
          const readline = require('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          rl.on('line', (line) => {
            try {
              const msg = JSON.parse(line);
              if (msg.method === 'tools/list') {
                console.log(JSON.stringify({
                  id: msg.id,
                  result: {
                    tools: [{
                      name: 'echo',
                      description: 'Echo back input',
                      inputSchema: {
                        type: 'object',
                        properties: { message: { type: 'string' } },
                        required: ['message']
                      }
                    }]
                  }
                }));
              } else if (msg.method === 'tools/call') {
                console.log(JSON.stringify({
                  id: msg.id,
                  result: {
                    content: [{
                      type: 'text',
                      text: msg.params.arguments.message || 'Hello from test server!'
                    }]
                  }
                }));
              }
            } catch (e) {
              console.log(JSON.stringify({
                id: 1,
                error: { code: -1, message: e.message }
              }));
            }
          });
        `,
        ],
        environment: {
          NODE_ENV: "test",
        },
      },

      remoteExample: {
        name: "test-remote",
        type: "remote" as const,
        url: "http://localhost:3001/mcp",
      },
    },

    sampleMessages: {
      toolsList: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      },

      toolCall: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "echo",
          arguments: {
            message: "Hello, MCP!",
          },
        },
      },

      initialize: {
        jsonrpc: "2.0",
        id: 0,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          clientInfo: {
            name: "dgmo-test",
            version: "1.0.0",
          },
        },
      },
    },
  }

  export class MockMCPServer {
    private responses = new Map<string, MockServerResponse>()
    private tools = new Map<string, any>()

    addTool(name: string, tool: any) {
      this.tools.set(name, tool)
      return this
    }

    addResponse(method: string, response: MockServerResponse) {
      this.responses.set(method, response)
      return this
    }

    getResponse(method: string): MockServerResponse | undefined {
      return this.responses.get(method)
    }

    getTools() {
      return Array.from(this.tools.values())
    }

    static createEchoServer(): MockMCPServer {
      return new MockMCPServer()
        .addTool("echo", TestData.sampleTools["test-server_echo"])
        .addResponse("tools/list", {
          id: "1",
          result: {
            tools: [TestData.sampleTools["test-server_echo"]],
          },
        })
        .addResponse("tools/call", {
          id: "2",
          result: {
            content: [
              {
                type: "text",
                text: "Echo: Hello, MCP!",
              },
            ],
          },
        })
    }

    static createMathServer(): MockMCPServer {
      return new MockMCPServer()
        .addTool("add", TestData.sampleTools["test-server_add"])
        .addResponse("tools/list", {
          id: "1",
          result: {
            tools: [TestData.sampleTools["test-server_add"]],
          },
        })
        .addResponse("tools/call", {
          id: "2",
          result: {
            content: [
              {
                type: "text",
                text: "Result: 42",
              },
            ],
          },
        })
    }
  }

  export const CommonTestCases = {
    serverStartup: {
      name: "Server Startup",
      description: "Test that MCP server starts successfully",
      timeout: 10000,
    },

    toolDiscovery: {
      name: "Tool Discovery",
      description: "Test that tools can be discovered from server",
      timeout: 5000,
    },

    toolExecution: {
      name: "Tool Execution",
      description: "Test that tools can be executed successfully",
      timeout: 5000,
    },

    errorHandling: {
      name: "Error Handling",
      description: "Test that errors are handled gracefully",
      timeout: 5000,
    },

    concurrentRequests: {
      name: "Concurrent Requests",
      description: "Test handling of multiple simultaneous requests",
      timeout: 15000,
    },
  }
}
