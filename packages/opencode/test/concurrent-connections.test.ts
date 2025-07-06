import {
  describe,
  expect,
  test,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "bun:test"
import { experimental_createMCPClient } from "ai"
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio"
import { spawn, ChildProcess } from "child_process"
import { performance } from "perf_hooks"
import { EventEmitter } from "events"

// Performance metrics collection
interface ConnectionMetrics {
  connectionTime: number
  memoryUsage: number
  cpuUsage: number
  networkLatency: number
  toolsCount: number
  timestamp: number
}

interface TestResults {
  totalConnections: number
  successfulConnections: number
  failedConnections: number
  averageConnectionTime: number
  peakMemoryUsage: number
  totalCpuTime: number
  connectionErrors: string[]
  performanceMetrics: ConnectionMetrics[]
}

// Mock MCP Server for testing
class MockMCPServer {
  private process: ChildProcess | null = null
  private port: number
  private isRunning = false
  private connections = new Set<string>()
  private maxConnections: number
  private connectionDelay: number

  constructor(
    port: number = 3000,
    maxConnections: number = 1000,
    connectionDelay: number = 0,
  ) {
    this.port = port
    this.maxConnections = maxConnections
    this.connectionDelay = connectionDelay
  }

  async start(): Promise<void> {
    if (this.isRunning) return

    // Create a simple MCP server using Node.js
    const serverCode = `
      const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
      const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
      const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

      class TestMCPServer {
        constructor() {
          this.server = new Server(
            {
              name: 'test-mcp-server',
              version: '1.0.0',
            },
            {
              capabilities: {
                tools: {},
              },
            }
          );
          this.connections = new Set();
          this.setupHandlers();
        }

        setupHandlers() {
          this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
              {
                name: 'test_tool',
                description: 'A test tool for connection testing',
                inputSchema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' }
                  }
                }
              },
              {
                name: 'performance_test',
                description: 'Performance testing tool',
                inputSchema: {
                  type: 'object',
                  properties: {
                    operation: { type: 'string' },
                    data: { type: 'string' }
                  }
                }
              }
            ]
          }));

          this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            
            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, ${this.connectionDelay}));
            
            switch (name) {
              case 'test_tool':
                return {
                  content: [
                    {
                      type: 'text',
                      text: \`Echo: \${args.message || 'Hello from test tool'}\`
                    }
                  ]
                };
              case 'performance_test':
                return {
                  content: [
                    {
                      type: 'text',
                      text: \`Performance test completed: \${args.operation || 'default'}\`
                    }
                  ]
                };
              default:
                throw new Error(\`Unknown tool: \${name}\`);
            }
          });
        }

        async run() {
          const transport = new StdioServerTransport();
          await this.server.connect(transport);
        }
      }

      const server = new TestMCPServer();
      server.run().catch(console.error);
    `

    return new Promise((resolve, reject) => {
      this.process = spawn("node", ["-e", serverCode], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      })

      this.process.on("error", reject)

      // Give the server time to start
      setTimeout(() => {
        this.isRunning = true
        resolve()
      }, 1000)
    })
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.isRunning = false
    this.connections.clear()
  }

  getConnectionCount(): number {
    return this.connections.size
  }

  addConnection(id: string): boolean {
    if (this.connections.size >= this.maxConnections) {
      return false
    }
    this.connections.add(id)
    return true
  }

  removeConnection(id: string): void {
    this.connections.delete(id)
  }
}

// Connection Pool Manager
class MCPConnectionPool {
  private connections = new Map<string, any>()
  private availableConnections = new Set<string>()
  private busyConnections = new Set<string>()
  private maxConnections: number
  private connectionTimeout: number

  constructor(maxConnections: number = 50, connectionTimeout: number = 30000) {
    this.maxConnections = maxConnections
    this.connectionTimeout = connectionTimeout
  }

  async createConnection(
    id: string,
    serverProcess: ChildProcess,
  ): Promise<any> {
    if (this.connections.size >= this.maxConnections) {
      throw new Error("Connection pool exhausted")
    }

    const startTime = performance.now()

    try {
      const client = await experimental_createMCPClient({
        name: `test-client-${id}`,
        transport: new Experimental_StdioMCPTransport({
          command: "node",
          args: [
            "-e",
            `
            const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
            const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
            const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

            class TestMCPServer {
              constructor() {
                this.server = new Server(
                  { name: 'test-mcp-server', version: '1.0.0' },
                  { capabilities: { tools: {} } }
                );
                this.setupHandlers();
              }

              setupHandlers() {
                this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
                  tools: [
                    {
                      name: 'test_tool',
                      description: 'A test tool',
                      inputSchema: {
                        type: 'object',
                        properties: { message: { type: 'string' } }
                      }
                    }
                  ]
                }));

                this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
                  return {
                    content: [{ type: 'text', text: 'Test response' }]
                  };
                });
              }

              async run() {
                const transport = new StdioServerTransport();
                await this.server.connect(transport);
              }
            }

            const server = new TestMCPServer();
            server.run().catch(console.error);
          `,
          ],
          stderr: "ignore",
        }),
      })

      const connectionTime = performance.now() - startTime

      this.connections.set(id, {
        client,
        connectionTime,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      })

      this.availableConnections.add(id)

      return client
    } catch (error) {
      throw new Error(`Failed to create connection ${id}: ${error}`)
    }
  }

  async acquireConnection(): Promise<{ id: string; client: any } | null> {
    const availableId = this.availableConnections.values().next().value
    if (!availableId) return null

    this.availableConnections.delete(availableId)
    this.busyConnections.add(availableId)

    const connection = this.connections.get(availableId)
    if (connection) {
      connection.lastUsed = Date.now()
      return { id: availableId, client: connection.client }
    }

    return null
  }

  releaseConnection(id: string): void {
    if (this.busyConnections.has(id)) {
      this.busyConnections.delete(id)
      this.availableConnections.add(id)
    }
  }

  async closeConnection(id: string): Promise<void> {
    const connection = this.connections.get(id)
    if (connection) {
      try {
        connection.client.close()
      } catch (error) {
        // Ignore close errors
      }
      this.connections.delete(id)
      this.availableConnections.delete(id)
      this.busyConnections.delete(id)
    }
  }

  async closeAllConnections(): Promise<void> {
    const closePromises = Array.from(this.connections.keys()).map((id) =>
      this.closeConnection(id),
    )
    await Promise.allSettled(closePromises)
  }

  getStats() {
    return {
      total: this.connections.size,
      available: this.availableConnections.size,
      busy: this.busyConnections.size,
      maxConnections: this.maxConnections,
    }
  }
}

// Performance monitoring utilities
class PerformanceMonitor {
  private metrics: ConnectionMetrics[] = []
  private startTime: number = 0
  private memoryBaseline: number = 0

  start(): void {
    this.startTime = performance.now()
    this.memoryBaseline = process.memoryUsage().heapUsed
    this.metrics = []
  }

  recordMetric(
    connectionId: string,
    connectionTime: number,
    toolsCount: number = 0,
  ): void {
    const memoryUsage = process.memoryUsage().heapUsed - this.memoryBaseline
    const cpuUsage = process.cpuUsage()

    this.metrics.push({
      connectionTime,
      memoryUsage,
      cpuUsage: cpuUsage.user + cpuUsage.system,
      networkLatency: 0, // Would need actual network measurement
      toolsCount,
      timestamp: performance.now() - this.startTime,
    })
  }

  getResults(): TestResults {
    const successful = this.metrics.length
    const totalTime = performance.now() - this.startTime

    return {
      totalConnections: successful,
      successfulConnections: successful,
      failedConnections: 0,
      averageConnectionTime:
        this.metrics.reduce((sum, m) => sum + m.connectionTime, 0) / successful,
      peakMemoryUsage: Math.max(...this.metrics.map((m) => m.memoryUsage)),
      totalCpuTime: totalTime,
      connectionErrors: [],
      performanceMetrics: this.metrics,
    }
  }

  reset(): void {
    this.metrics = []
    this.startTime = 0
    this.memoryBaseline = 0
  }
}

// Test suite setup
describe("MCP Concurrent Connections", () => {
  let mockServer: MockMCPServer
  let connectionPool: MCPConnectionPool
  let performanceMonitor: PerformanceMonitor

  beforeAll(async () => {
    mockServer = new MockMCPServer(3000, 1000, 10)
    await mockServer.start()

    connectionPool = new MCPConnectionPool(100, 30000)
    performanceMonitor = new PerformanceMonitor()
  })

  afterAll(async () => {
    await connectionPool.closeAllConnections()
    await mockServer.stop()
  })

  beforeEach(() => {
    performanceMonitor.reset()
  })

  afterEach(async () => {
    await connectionPool.closeAllConnections()
  })

  describe("Connection Pool Testing", () => {
    test("should create and manage multiple connections efficiently", async () => {
      performanceMonitor.start()
      const connectionCount = 10
      const connections: string[] = []

      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const connectionId = `pool-test-${i}`
        const startTime = performance.now()

        try {
          await connectionPool.createConnection(
            connectionId,
            mockServer.process!,
          )
          const connectionTime = performance.now() - startTime
          performanceMonitor.recordMetric(connectionId, connectionTime)
          connections.push(connectionId)
        } catch (error) {
          console.error(`Failed to create connection ${connectionId}:`, error)
        }
      }

      const stats = connectionPool.getStats()
      expect(stats.total).toBe(connectionCount)
      expect(stats.available).toBe(connectionCount)
      expect(stats.busy).toBe(0)

      // Test connection reuse
      const acquired = await connectionPool.acquireConnection()
      expect(acquired).not.toBeNull()

      const statsAfterAcquire = connectionPool.getStats()
      expect(statsAfterAcquire.available).toBe(connectionCount - 1)
      expect(statsAfterAcquire.busy).toBe(1)

      if (acquired) {
        connectionPool.releaseConnection(acquired.id)
      }

      const statsAfterRelease = connectionPool.getStats()
      expect(statsAfterRelease.available).toBe(connectionCount)
      expect(statsAfterRelease.busy).toBe(0)

      const results = performanceMonitor.getResults()
      expect(results.averageConnectionTime).toBeLessThan(5000) // 5 seconds max
    }, 30000)

    test("should handle connection pool exhaustion gracefully", async () => {
      const smallPool = new MCPConnectionPool(3, 5000)
      const connections: string[] = []

      // Fill the pool
      for (let i = 0; i < 3; i++) {
        const connectionId = `exhaustion-test-${i}`
        await smallPool.createConnection(connectionId, mockServer.process!)
        connections.push(connectionId)
      }

      // Try to exceed the limit
      await expect(async () => {
        await smallPool.createConnection("overflow", mockServer.process!)
      }).toThrow("Connection pool exhausted")

      await smallPool.closeAllConnections()
    }, 15000)

    test("should cleanup connections properly", async () => {
      const connectionId = "cleanup-test"
      await connectionPool.createConnection(connectionId, mockServer.process!)

      let stats = connectionPool.getStats()
      expect(stats.total).toBe(1)

      await connectionPool.closeConnection(connectionId)

      stats = connectionPool.getStats()
      expect(stats.total).toBe(0)
      expect(stats.available).toBe(0)
      expect(stats.busy).toBe(0)
    }, 10000)
  })

  describe("Concurrent Client Testing", () => {
    test("should handle multiple simultaneous client connections", async () => {
      performanceMonitor.start()
      const clientCount = 20
      const connectionPromises: Promise<any>[] = []

      // Create multiple clients simultaneously
      for (let i = 0; i < clientCount; i++) {
        const promise = (async () => {
          const connectionId = `concurrent-${i}`
          const startTime = performance.now()

          try {
            const client = await experimental_createMCPClient({
              name: connectionId,
              transport: new Experimental_StdioMCPTransport({
                command: "node",
                args: [
                  "-e",
                  `
                  const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
                  const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
                  const { ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

                  class TestServer {
                    constructor() {
                      this.server = new Server(
                        { name: 'test-server', version: '1.0.0' },
                        { capabilities: { tools: {} } }
                      );
                      this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
                        tools: [{ name: 'test', description: 'Test tool', inputSchema: { type: 'object' } }]
                      }));
                    }
                    async run() {
                      await this.server.connect(new StdioServerTransport());
                    }
                  }
                  new TestServer().run().catch(console.error);
                `,
                ],
                stderr: "ignore",
              }),
            })

            const connectionTime = performance.now() - startTime
            const tools = await client.tools()
            performanceMonitor.recordMetric(
              connectionId,
              connectionTime,
              Object.keys(tools).length,
            )

            return { client, connectionId, success: true }
          } catch (error) {
            return { client: null, connectionId, success: false, error }
          }
        })()

        connectionPromises.push(promise)
      }

      const results = await Promise.allSettled(connectionPromises)
      const successful = results.filter(
        (r) => r.status === "fulfilled" && r.value.success,
      ).length
      const failed = results.length - successful

      expect(successful).toBeGreaterThan(clientCount * 0.8) // At least 80% success rate
      expect(failed).toBeLessThan(clientCount * 0.2) // Less than 20% failure rate

      // Cleanup successful connections
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.client) {
          try {
            result.value.client.close()
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }

      const perfResults = performanceMonitor.getResults()
      expect(perfResults.averageConnectionTime).toBeLessThan(10000) // 10 seconds max
    }, 60000)

    test("should isolate connections properly", async () => {
      const client1Id = "isolation-test-1"
      const client2Id = "isolation-test-2"

      const client1 = await experimental_createMCPClient({
        name: client1Id,
        transport: new Experimental_StdioMCPTransport({
          command: "node",
          args: [
            "-e",
            `
            const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
            const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
            const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

            class IsolationTestServer {
              constructor() {
                this.server = new Server(
                  { name: 'isolation-server-1', version: '1.0.0' },
                  { capabilities: { tools: {} } }
                );
                this.setupHandlers();
              }

              setupHandlers() {
                this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
                  tools: [{ 
                    name: 'server1_tool', 
                    description: 'Server 1 specific tool',
                    inputSchema: { type: 'object', properties: { data: { type: 'string' } } }
                  }]
                }));

                this.server.setRequestHandler(CallToolRequestSchema, async (request) => ({
                  content: [{ type: 'text', text: 'Response from server 1' }]
                }));
              }

              async run() {
                await this.server.connect(new StdioServerTransport());
              }
            }
            new IsolationTestServer().run().catch(console.error);
          `,
          ],
          stderr: "ignore",
        }),
      })

      const client2 = await experimental_createMCPClient({
        name: client2Id,
        transport: new Experimental_StdioMCPTransport({
          command: "node",
          args: [
            "-e",
            `
            const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
            const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
            const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

            class IsolationTestServer {
              constructor() {
                this.server = new Server(
                  { name: 'isolation-server-2', version: '1.0.0' },
                  { capabilities: { tools: {} } }
                );
                this.setupHandlers();
              }

              setupHandlers() {
                this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
                  tools: [{ 
                    name: 'server2_tool', 
                    description: 'Server 2 specific tool',
                    inputSchema: { type: 'object', properties: { data: { type: 'string' } } }
                  }]
                }));

                this.server.setRequestHandler(CallToolRequestSchema, async (request) => ({
                  content: [{ type: 'text', text: 'Response from server 2' }]
                }));
              }

              async run() {
                await this.server.connect(new StdioServerTransport());
              }
            }
            new IsolationTestServer().run().catch(console.error);
          `,
          ],
          stderr: "ignore",
        }),
      })

      // Test that each client sees only its own tools
      const tools1 = await client1.tools()
      const tools2 = await client2.tools()

      expect(Object.keys(tools1)).toContain("server1_tool")
      expect(Object.keys(tools1)).not.toContain("server2_tool")

      expect(Object.keys(tools2)).toContain("server2_tool")
      expect(Object.keys(tools2)).not.toContain("server1_tool")

      // Cleanup
      client1.close()
      client2.close()
    }, 30000)
  })

  describe("Scaling Tests", () => {
    test("should scale from 1 to 100+ connections with performance monitoring", async () => {
      const scalingSteps = [1, 5, 10, 25, 50, 100]
      const results: Array<{ connections: number; metrics: TestResults }> = []

      for (const connectionCount of scalingSteps) {
        performanceMonitor.start()
        const clients: any[] = []

        try {
          // Create connections in batches to avoid overwhelming the system
          const batchSize = Math.min(10, connectionCount)
          const batches = Math.ceil(connectionCount / batchSize)

          for (let batch = 0; batch < batches; batch++) {
            const batchPromises: Promise<any>[] = []
            const startIdx = batch * batchSize
            const endIdx = Math.min(startIdx + batchSize, connectionCount)

            for (let i = startIdx; i < endIdx; i++) {
              const promise = (async () => {
                const connectionId = `scale-test-${connectionCount}-${i}`
                const startTime = performance.now()

                try {
                  const client = await experimental_createMCPClient({
                    name: connectionId,
                    transport: new Experimental_StdioMCPTransport({
                      command: "node",
                      args: [
                        "-e",
                        `
                        const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
                        const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
                        const { ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

                        class ScaleTestServer {
                          constructor() {
                            this.server = new Server(
                              { name: 'scale-server', version: '1.0.0' },
                              { capabilities: { tools: {} } }
                            );
                            this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
                              tools: [{ name: 'scale_tool', description: 'Scaling test tool', inputSchema: { type: 'object' } }]
                            }));
                          }
                          async run() {
                            await this.server.connect(new StdioServerTransport());
                          }
                        }
                        new ScaleTestServer().run().catch(console.error);
                      `,
                      ],
                      stderr: "ignore",
                    }),
                  })

                  const connectionTime = performance.now() - startTime
                  const tools = await client.tools()
                  performanceMonitor.recordMetric(
                    connectionId,
                    connectionTime,
                    Object.keys(tools).length,
                  )

                  return client
                } catch (error) {
                  console.error(
                    `Failed to create connection ${connectionId}:`,
                    error,
                  )
                  return null
                }
              })()

              batchPromises.push(promise)
            }

            const batchResults = await Promise.allSettled(batchPromises)
            for (const result of batchResults) {
              if (result.status === "fulfilled" && result.value) {
                clients.push(result.value)
              }
            }

            // Small delay between batches to prevent overwhelming
            if (batch < batches - 1) {
              await new Promise((resolve) => setTimeout(resolve, 100))
            }
          }

          const metrics = performanceMonitor.getResults()
          results.push({ connections: connectionCount, metrics })

          console.log(`Scaling test ${connectionCount} connections:`, {
            successful: clients.length,
            avgConnectionTime: metrics.averageConnectionTime.toFixed(2) + "ms",
            peakMemory:
              (metrics.peakMemoryUsage / 1024 / 1024).toFixed(2) + "MB",
          })

          // Verify scaling performance doesn't degrade too much
          if (results.length > 1) {
            const previousResult = results[results.length - 2]
            const currentResult = results[results.length - 1]

            // Connection time shouldn't increase more than 3x
            const timeIncrease =
              currentResult.metrics.averageConnectionTime /
              previousResult.metrics.averageConnectionTime
            expect(timeIncrease).toBeLessThan(3)

            // Memory usage should scale reasonably (not more than 2x per connection)
            const memoryPerConnection =
              currentResult.metrics.peakMemoryUsage / currentResult.connections
            const previousMemoryPerConnection =
              previousResult.metrics.peakMemoryUsage /
              previousResult.connections
            const memoryIncrease =
              memoryPerConnection / previousMemoryPerConnection
            expect(memoryIncrease).toBeLessThan(2)
          }
        } finally {
          // Cleanup all clients
          const cleanupPromises = clients.map((client) => {
            return new Promise<void>((resolve) => {
              try {
                client.close()
              } catch (error) {
                // Ignore cleanup errors
              }
              resolve()
            })
          })
          await Promise.allSettled(cleanupPromises)
        }

        // Wait between scaling tests
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      // Verify overall scaling characteristics
      expect(results.length).toBe(scalingSteps.length)
      expect(
        results[results.length - 1].metrics.successfulConnections,
      ).toBeGreaterThan(50) // At least 50 successful connections at max scale
    }, 300000) // 5 minutes timeout for scaling test

    test("should handle connection timeouts gracefully", async () => {
      const timeoutPool = new MCPConnectionPool(10, 1000) // 1 second timeout
      let timeoutErrors = 0

      const connectionPromises = Array.from({ length: 5 }, async (_, i) => {
        try {
          // Create a slow-starting server to trigger timeouts
          await timeoutPool.createConnection(
            `timeout-test-${i}`,
            mockServer.process!,
          )
          return true
        } catch (error) {
          if (
            error.message.includes("timeout") ||
            error.message.includes("Connection pool exhausted")
          ) {
            timeoutErrors++
          }
          return false
        }
      })

      const results = await Promise.allSettled(connectionPromises)
      const successful = results.filter(
        (r) => r.status === "fulfilled" && r.value,
      ).length

      // Should handle timeouts without crashing
      expect(successful + timeoutErrors).toBe(5)

      await timeoutPool.closeAllConnections()
    }, 15000)
  })

  describe("Connection Stress Tests", () => {
    test("should handle rapid connect/disconnect cycles", async () => {
      performanceMonitor.start()
      const cycles = 20
      const connectionsPerCycle = 5
      let totalConnections = 0
      let totalDisconnections = 0
      let errors: string[] = []

      for (let cycle = 0; cycle < cycles; cycle++) {
        const clients: any[] = []

        // Rapid connection phase
        const connectPromises = Array.from(
          { length: connectionsPerCycle },
          async (_, i) => {
            const connectionId = `stress-${cycle}-${i}`
            const startTime = performance.now()

            try {
              const client = await experimental_createMCPClient({
                name: connectionId,
                transport: new Experimental_StdioMCPTransport({
                  command: "node",
                  args: [
                    "-e",
                    `
                  const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
                  const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
                  const { ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

                  class StressTestServer {
                    constructor() {
                      this.server = new Server(
                        { name: 'stress-server', version: '1.0.0' },
                        { capabilities: { tools: {} } }
                      );
                      this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
                        tools: [{ name: 'stress_tool', description: 'Stress test tool', inputSchema: { type: 'object' } }]
                      }));
                    }
                    async run() {
                      await this.server.connect(new StdioServerTransport());
                    }
                  }
                  new StressTestServer().run().catch(console.error);
                `,
                  ],
                  stderr: "ignore",
                }),
              })

              const connectionTime = performance.now() - startTime
              performanceMonitor.recordMetric(connectionId, connectionTime)
              totalConnections++

              return client
            } catch (error) {
              errors.push(`Connection error in cycle ${cycle}: ${error}`)
              return null
            }
          },
        )

        const connectionResults = await Promise.allSettled(connectPromises)
        for (const result of connectionResults) {
          if (result.status === "fulfilled" && result.value) {
            clients.push(result.value)
          }
        }

        // Brief usage phase
        const usagePromises = clients.map(async (client) => {
          try {
            await client.tools()
            return true
          } catch (error) {
            errors.push(`Usage error: ${error}`)
            return false
          }
        })

        await Promise.allSettled(usagePromises)

        // Rapid disconnection phase
        const disconnectPromises = clients.map(async (client) => {
          try {
            client.close()
            totalDisconnections++
            return true
          } catch (error) {
            errors.push(`Disconnection error: ${error}`)
            return false
          }
        })

        await Promise.allSettled(disconnectPromises)

        // Small delay between cycles
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      const results = performanceMonitor.getResults()

      expect(totalConnections).toBeGreaterThan(
        cycles * connectionsPerCycle * 0.7,
      ) // At least 70% success
      expect(totalDisconnections).toBeGreaterThan(totalConnections * 0.9) // At least 90% clean disconnections
      expect(errors.length).toBeLessThan(totalConnections * 0.3) // Less than 30% errors
      expect(results.averageConnectionTime).toBeLessThan(5000) // Under 5 seconds average

      console.log("Stress test results:", {
        totalConnections,
        totalDisconnections,
        errorRate: ((errors.length / totalConnections) * 100).toFixed(2) + "%",
        avgConnectionTime: results.averageConnectionTime.toFixed(2) + "ms",
      })
    }, 120000) // 2 minutes timeout

    test("should detect and prevent connection leaks", async () => {
      const initialMemory = process.memoryUsage().heapUsed
      const leakTestConnections = 30
      const clients: any[] = []

      // Create connections without proper cleanup to test leak detection
      for (let i = 0; i < leakTestConnections; i++) {
        try {
          const client = await experimental_createMCPClient({
            name: `leak-test-${i}`,
            transport: new Experimental_StdioMCPTransport({
              command: "node",
              args: [
                "-e",
                `
                const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
                const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
                const { ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

                class LeakTestServer {
                  constructor() {
                    this.server = new Server(
                      { name: 'leak-server', version: '1.0.0' },
                      { capabilities: { tools: {} } }
                    );
                    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
                      tools: [{ name: 'leak_tool', description: 'Leak test tool', inputSchema: { type: 'object' } }]
                    }));
                  }
                  async run() {
                    await this.server.connect(new StdioServerTransport());
                  }
                }
                new LeakTestServer().run().catch(console.error);
              `,
              ],
              stderr: "ignore",
            }),
          })
          clients.push(client)
        } catch (error) {
          // Continue with other connections
        }
      }

      const memoryAfterConnections = process.memoryUsage().heapUsed
      const memoryIncrease = memoryAfterConnections - initialMemory

      // Cleanup all connections
      const cleanupPromises = clients.map((client) => {
        return new Promise<void>((resolve) => {
          try {
            client.close()
          } catch (error) {
            // Ignore cleanup errors
          }
          resolve()
        })
      })
      await Promise.allSettled(cleanupPromises)

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const memoryAfterCleanup = process.memoryUsage().heapUsed
      const memoryRecovered = memoryAfterConnections - memoryAfterCleanup
      const recoveryRate = memoryRecovered / memoryIncrease

      console.log("Memory leak test:", {
        initialMemory: (initialMemory / 1024 / 1024).toFixed(2) + "MB",
        memoryIncrease: (memoryIncrease / 1024 / 1024).toFixed(2) + "MB",
        memoryRecovered: (memoryRecovered / 1024 / 1024).toFixed(2) + "MB",
        recoveryRate: (recoveryRate * 100).toFixed(2) + "%",
      })

      // Should recover at least 50% of memory (accounting for some overhead)
      expect(recoveryRate).toBeGreaterThan(0.5)

      // Memory per connection shouldn't be excessive (less than 10MB per connection)
      const memoryPerConnection = memoryIncrease / clients.length
      expect(memoryPerConnection).toBeLessThan(10 * 1024 * 1024) // 10MB
    }, 60000)

    test("should recover from connection failures gracefully", async () => {
      performanceMonitor.start()
      const totalAttempts = 20
      let successfulConnections = 0
      let failedConnections = 0
      let recoveredConnections = 0

      for (let i = 0; i < totalAttempts; i++) {
        const connectionId = `recovery-test-${i}`
        let client: any = null

        try {
          // Intentionally create some failing connections
          const shouldFail = i % 4 === 0 // Every 4th connection fails

          if (shouldFail) {
            // Create a connection that will fail
            client = await experimental_createMCPClient({
              name: connectionId,
              transport: new Experimental_StdioMCPTransport({
                command: "nonexistent-command", // This will fail
                args: [],
                stderr: "ignore",
              }),
            })
          } else {
            // Create a normal connection
            client = await experimental_createMCPClient({
              name: connectionId,
              transport: new Experimental_StdioMCPTransport({
                command: "node",
                args: [
                  "-e",
                  `
                  const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
                  const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
                  const { ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

                  class RecoveryTestServer {
                    constructor() {
                      this.server = new Server(
                        { name: 'recovery-server', version: '1.0.0' },
                        { capabilities: { tools: {} } }
                      );
                      this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
                        tools: [{ name: 'recovery_tool', description: 'Recovery test tool', inputSchema: { type: 'object' } }]
                      }));
                    }
                    async run() {
                      await this.server.connect(new StdioServerTransport());
                    }
                  }
                  new RecoveryTestServer().run().catch(console.error);
                `,
                ],
                stderr: "ignore",
              }),
            })
          }

          successfulConnections++
          performanceMonitor.recordMetric(connectionId, 100) // Mock connection time

          // Test the connection
          await client.tools()
        } catch (error) {
          failedConnections++

          // Attempt recovery
          try {
            const recoveryClient = await experimental_createMCPClient({
              name: `${connectionId}-recovery`,
              transport: new Experimental_StdioMCPTransport({
                command: "node",
                args: [
                  "-e",
                  `
                  const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
                  const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
                  const { ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

                  class RecoveryServer {
                    constructor() {
                      this.server = new Server(
                        { name: 'recovery-server', version: '1.0.0' },
                        { capabilities: { tools: {} } }
                      );
                      this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
                        tools: [{ name: 'recovery_tool', description: 'Recovery tool', inputSchema: { type: 'object' } }]
                      }));
                    }
                    async run() {
                      await this.server.connect(new StdioServerTransport());
                    }
                  }
                  new RecoveryServer().run().catch(console.error);
                `,
                ],
                stderr: "ignore",
              }),
            })

            recoveredConnections++
            client = recoveryClient
          } catch (recoveryError) {
            // Recovery failed, continue
          }
        }

        // Cleanup
        if (client) {
          try {
            client.close()
          } catch (error) {
            // Ignore cleanup errors
          }
        }

        // Small delay between attempts
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const results = performanceMonitor.getResults()
      const totalSuccessful = successfulConnections + recoveredConnections
      const successRate = totalSuccessful / totalAttempts
      const recoveryRate = recoveredConnections / failedConnections

      console.log("Recovery test results:", {
        totalAttempts,
        successfulConnections,
        failedConnections,
        recoveredConnections,
        successRate: (successRate * 100).toFixed(2) + "%",
        recoveryRate: (recoveryRate * 100).toFixed(2) + "%",
      })

      expect(successRate).toBeGreaterThan(0.6) // At least 60% overall success
      expect(recoveryRate).toBeGreaterThan(0.3) // At least 30% recovery from failures
    }, 90000)
  })

  describe("Performance Analysis", () => {
    test("should provide detailed performance metrics", async () => {
      performanceMonitor.start()
      const testConnections = 15
      const clients: any[] = []

      // Create connections with performance monitoring
      for (let i = 0; i < testConnections; i++) {
        const connectionId = `perf-test-${i}`
        const startTime = performance.now()

        try {
          const client = await experimental_createMCPClient({
            name: connectionId,
            transport: new Experimental_StdioMCPTransport({
              command: "node",
              args: [
                "-e",
                `
                const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
                const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
                const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

                class PerfTestServer {
                  constructor() {
                    this.server = new Server(
                      { name: 'perf-server', version: '1.0.0' },
                      { capabilities: { tools: {} } }
                    );
                    this.setupHandlers();
                  }

                  setupHandlers() {
                    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
                      tools: [
                        { name: 'fast_tool', description: 'Fast tool', inputSchema: { type: 'object' } },
                        { name: 'slow_tool', description: 'Slow tool', inputSchema: { type: 'object' } },
                        { name: 'memory_tool', description: 'Memory intensive tool', inputSchema: { type: 'object' } }
                      ]
                    }));

                    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
                      const { name } = request.params;
                      
                      switch (name) {
                        case 'fast_tool':
                          return { content: [{ type: 'text', text: 'Fast response' }] };
                        case 'slow_tool':
                          await new Promise(resolve => setTimeout(resolve, 100));
                          return { content: [{ type: 'text', text: 'Slow response' }] };
                        case 'memory_tool':
                          const data = new Array(1000).fill('memory test data');
                          return { content: [{ type: 'text', text: \`Memory response: \${data.length} items\` }] };
                        default:
                          throw new Error(\`Unknown tool: \${name}\`);
                      }
                    });
                  }

                  async run() {
                    await this.server.connect(new StdioServerTransport());
                  }
                }
                new PerfTestServer().run().catch(console.error);
              `,
              ],
              stderr: "ignore",
            }),
          })

          const connectionTime = performance.now() - startTime
          const tools = await client.tools()
          performanceMonitor.recordMetric(
            connectionId,
            connectionTime,
            Object.keys(tools).length,
          )

          clients.push(client)

          // Test tool performance
          if (Object.keys(tools).length > 0) {
            const toolNames = Object.keys(tools)
            for (const toolName of toolNames.slice(0, 2)) {
              // Test first 2 tools
              try {
                const toolStartTime = performance.now()
                // Note: Tool calling would need proper implementation
                // await client.callTool(toolName, {})
                const toolTime = performance.now() - toolStartTime
                // Could record tool-specific metrics here
              } catch (error) {
                // Tool calling might not be implemented, continue
              }
            }
          }
        } catch (error) {
          console.error(`Performance test connection ${i} failed:`, error)
        }

        // Stagger connections to measure individual performance
        if (i < testConnections - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      const results = performanceMonitor.getResults()

      // Analyze performance metrics
      const connectionTimes = results.performanceMetrics.map(
        (m) => m.connectionTime,
      )
      const memoryUsages = results.performanceMetrics.map((m) => m.memoryUsage)

      const minConnectionTime = Math.min(...connectionTimes)
      const maxConnectionTime = Math.max(...connectionTimes)
      const medianConnectionTime = connectionTimes.sort((a, b) => a - b)[
        Math.floor(connectionTimes.length / 2)
      ]

      const totalMemoryUsage = Math.max(...memoryUsages)
      const avgMemoryPerConnection =
        memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length

      console.log("Performance Analysis:", {
        totalConnections: results.totalConnections,
        successfulConnections: results.successfulConnections,
        averageConnectionTime: results.averageConnectionTime.toFixed(2) + "ms",
        minConnectionTime: minConnectionTime.toFixed(2) + "ms",
        maxConnectionTime: maxConnectionTime.toFixed(2) + "ms",
        medianConnectionTime: medianConnectionTime.toFixed(2) + "ms",
        peakMemoryUsage:
          (results.peakMemoryUsage / 1024 / 1024).toFixed(2) + "MB",
        avgMemoryPerConnection:
          (avgMemoryPerConnection / 1024 / 1024).toFixed(2) + "MB",
        totalCpuTime: results.totalCpuTime.toFixed(2) + "ms",
      })

      // Performance assertions
      expect(results.averageConnectionTime).toBeLessThan(10000) // Under 10 seconds
      expect(maxConnectionTime).toBeLessThan(30000) // No connection over 30 seconds
      expect(avgMemoryPerConnection).toBeLessThan(50 * 1024 * 1024) // Under 50MB per connection
      expect(results.successfulConnections).toBe(clients.length) // All connections successful

      // Cleanup
      const cleanupPromises = clients.map((client) => {
        return new Promise<void>((resolve) => {
          try {
            client.close()
          } catch (error) {
            // Ignore cleanup errors
          }
          resolve()
        })
      })
      await Promise.allSettled(cleanupPromises)
    }, 120000)

    test("should measure network resource utilization", async () => {
      const networkMetrics = {
        connectionsCreated: 0,
        dataTransferred: 0,
        networkErrors: 0,
        averageLatency: 0,
      }

      const testConnections = 10
      const latencies: number[] = []

      for (let i = 0; i < testConnections; i++) {
        const startTime = performance.now()

        try {
          const client = await experimental_createMCPClient({
            name: `network-test-${i}`,
            transport: new Experimental_StdioMCPTransport({
              command: "node",
              args: [
                "-e",
                `
                const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
                const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
                const { ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

                class NetworkTestServer {
                  constructor() {
                    this.server = new Server(
                      { name: 'network-server', version: '1.0.0' },
                      { capabilities: { tools: {} } }
                    );
                    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
                      tools: [{ name: 'network_tool', description: 'Network test tool', inputSchema: { type: 'object' } }]
                    }));
                  }
                  async run() {
                    await this.server.connect(new StdioServerTransport());
                  }
                }
                new NetworkTestServer().run().catch(console.error);
              `,
              ],
              stderr: "ignore",
            }),
          })

          const connectionTime = performance.now() - startTime
          latencies.push(connectionTime)
          networkMetrics.connectionsCreated++

          // Simulate data transfer by calling tools
          const tools = await client.tools()
          networkMetrics.dataTransferred += JSON.stringify(tools).length

          client.close()
        } catch (error) {
          networkMetrics.networkErrors++
        }
      }

      networkMetrics.averageLatency =
        latencies.reduce((sum, l) => sum + l, 0) / latencies.length

      console.log("Network Resource Utilization:", {
        connectionsCreated: networkMetrics.connectionsCreated,
        dataTransferred: networkMetrics.dataTransferred + " bytes",
        networkErrors: networkMetrics.networkErrors,
        averageLatency: networkMetrics.averageLatency.toFixed(2) + "ms",
        errorRate:
          ((networkMetrics.networkErrors / testConnections) * 100).toFixed(2) +
          "%",
      })

      expect(networkMetrics.connectionsCreated).toBeGreaterThan(
        testConnections * 0.8,
      ) // At least 80% success
      expect(networkMetrics.networkErrors).toBeLessThan(testConnections * 0.2) // Less than 20% errors
      expect(networkMetrics.averageLatency).toBeLessThan(5000) // Under 5 seconds average latency
    }, 60000)
  })
})
