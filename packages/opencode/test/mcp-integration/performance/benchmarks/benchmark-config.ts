import { z } from "zod"
import { Log } from "../../../../src/util/log"
import { NamedError } from "../../../../src/util/error"

export namespace BenchmarkConfig {
  const log = Log.create({ service: "benchmark-config" })

  // Payload size configurations
  export const PayloadSize = z
    .object({
      name: z.string().describe("Payload size identifier"),
      bytes: z.number().min(1).describe("Size in bytes"),
      description: z.string().describe("Human-readable description"),
      category: z
        .enum(["tiny", "small", "medium", "large", "huge"])
        .describe("Size category"),
    })
    .strict()

  export const PayloadSizes = z
    .object({
      tiny: PayloadSize,
      small: PayloadSize,
      medium: PayloadSize,
      large: PayloadSize,
      huge: PayloadSize,
    })
    .strict()

  // Concurrency level configurations
  export const ConcurrencyLevel = z
    .object({
      name: z.string().describe("Concurrency level identifier"),
      concurrent: z.number().min(1).describe("Number of concurrent operations"),
      description: z.string().describe("Use case description"),
      category: z
        .enum(["single", "light", "moderate", "heavy", "extreme"])
        .describe("Load category"),
    })
    .strict()

  export const ConcurrencyLevels = z
    .object({
      single: ConcurrencyLevel,
      light: ConcurrencyLevel,
      moderate: ConcurrencyLevel,
      heavy: ConcurrencyLevel,
      extreme: ConcurrencyLevel,
    })
    .strict()

  // Test duration configurations
  export const TestDuration = z
    .object({
      name: z.string().describe("Duration identifier"),
      milliseconds: z.number().min(100).describe("Duration in milliseconds"),
      iterations: z
        .number()
        .min(1)
        .optional()
        .describe("Number of iterations (overrides duration)"),
      description: z.string().describe("Duration description"),
      category: z
        .enum(["quick", "short", "medium", "long", "extended"])
        .describe("Duration category"),
    })
    .strict()

  export const TestDurations = z
    .object({
      quick: TestDuration,
      short: TestDuration,
      medium: TestDuration,
      long: TestDuration,
      extended: TestDuration,
    })
    .strict()

  // Mock server configurations
  export const MockServerConfig = z
    .object({
      name: z.string().describe("Mock server identifier"),
      type: z.enum(["stdio", "websocket", "sse"]).describe("Transport type"),
      port: z
        .number()
        .min(1024)
        .max(65535)
        .optional()
        .describe("Port number (for network transports)"),
      latency: z
        .object({
          min: z.number().min(0).describe("Minimum response latency in ms"),
          max: z.number().min(0).describe("Maximum response latency in ms"),
          distribution: z
            .enum(["uniform", "normal", "exponential"])
            .describe("Latency distribution"),
        })
        .describe("Simulated latency configuration"),
      reliability: z
        .object({
          successRate: z.number().min(0).max(1).describe("Success rate (0-1)"),
          errorTypes: z
            .array(z.enum(["timeout", "connection", "protocol", "server"]))
            .describe("Types of errors to simulate"),
          errorRate: z.number().min(0).max(1).describe("Error rate (0-1)"),
        })
        .describe("Reliability simulation"),
      capabilities: z.array(z.string()).describe("Mock server capabilities"),
      tools: z
        .array(
          z.object({
            name: z.string(),
            description: z.string(),
            inputSchema: z.record(z.any()).optional(),
            complexity: z
              .enum(["simple", "moderate", "complex"])
              .describe("Tool complexity"),
          }),
        )
        .describe("Available tools"),
    })
    .strict()

  // Test data generation parameters
  export const TestDataGeneration = z
    .object({
      seed: z.number().optional().describe("Random seed for reproducible data"),
      stringLength: z
        .object({
          min: z.number().min(1),
          max: z.number().min(1),
        })
        .describe("String length range"),
      arraySize: z
        .object({
          min: z.number().min(0),
          max: z.number().min(0),
        })
        .describe("Array size range"),
      objectDepth: z
        .object({
          min: z.number().min(1),
          max: z.number().min(1),
        })
        .describe("Object nesting depth range"),
      dataTypes: z
        .array(
          z.enum(["string", "number", "boolean", "array", "object", "null"]),
        )
        .describe("Data types to generate"),
      patterns: z
        .object({
          email: z.boolean().default(false).describe("Generate email patterns"),
          url: z.boolean().default(false).describe("Generate URL patterns"),
          uuid: z.boolean().default(false).describe("Generate UUID patterns"),
          timestamp: z
            .boolean()
            .default(false)
            .describe("Generate timestamp patterns"),
        })
        .describe("Special data patterns"),
    })
    .strict()

  // Environment detection and configuration
  export const EnvironmentConfig = z
    .object({
      name: z.string().describe("Environment name"),
      type: z
        .enum(["local", "ci", "staging", "production"])
        .describe("Environment type"),
      resources: z
        .object({
          cpu: z.object({
            cores: z.number().min(1).describe("Available CPU cores"),
            frequency: z.number().optional().describe("CPU frequency in GHz"),
          }),
          memory: z.object({
            total: z.number().min(1).describe("Total memory in MB"),
            available: z.number().min(1).describe("Available memory in MB"),
          }),
          network: z
            .object({
              bandwidth: z
                .number()
                .optional()
                .describe("Network bandwidth in Mbps"),
              latency: z.number().optional().describe("Network latency in ms"),
            })
            .optional(),
        })
        .describe("System resources"),
      limits: z
        .object({
          maxConcurrency: z
            .number()
            .min(1)
            .describe("Maximum concurrent operations"),
          maxMemoryUsage: z
            .number()
            .min(1)
            .describe("Maximum memory usage in MB"),
          maxTestDuration: z
            .number()
            .min(1000)
            .describe("Maximum test duration in ms"),
        })
        .describe("Environment limits"),
      features: z
        .object({
          profiling: z
            .boolean()
            .default(false)
            .describe("Enable performance profiling"),
          monitoring: z
            .boolean()
            .default(true)
            .describe("Enable resource monitoring"),
          debugging: z.boolean().default(false).describe("Enable debug mode"),
        })
        .describe("Environment features"),
    })
    .strict()

  // Test scenario definitions
  export const TestScenario = z
    .object({
      name: z.string().describe("Scenario name"),
      description: z.string().describe("Scenario description"),
      category: z
        .enum(["functional", "performance", "stress", "load", "endurance"])
        .describe("Test category"),
      priority: z
        .enum(["low", "medium", "high", "critical"])
        .describe("Test priority"),
      tags: z.array(z.string()).default([]).describe("Test tags"),
      setup: z
        .object({
          servers: z.array(z.string()).describe("Required mock servers"),
          payloadSize: z.string().describe("Payload size category"),
          concurrency: z.string().describe("Concurrency level"),
          duration: z.string().describe("Test duration"),
          iterations: z.number().optional().describe("Number of iterations"),
        })
        .describe("Test setup configuration"),
      operations: z
        .array(
          z.object({
            type: z
              .enum([
                "initialize",
                "call_tool",
                "list_tools",
                "get_prompt",
                "list_prompts",
                "list_resources",
                "read_resource",
                "subscribe",
                "unsubscribe",
              ])
              .describe("Operation type"),
            tool: z
              .string()
              .optional()
              .describe("Tool name for tool operations"),
            resource: z
              .string()
              .optional()
              .describe("Resource name for resource operations"),
            parameters: z
              .record(z.any())
              .optional()
              .describe("Operation parameters"),
            weight: z
              .number()
              .min(0)
              .max(1)
              .default(1)
              .describe("Operation weight in scenario"),
            validation: z
              .object({
                expectedStatus: z.enum(["success", "error"]).default("success"),
                maxLatency: z
                  .number()
                  .optional()
                  .describe("Maximum acceptable latency in ms"),
                minThroughput: z
                  .number()
                  .optional()
                  .describe("Minimum acceptable throughput"),
              })
              .optional()
              .describe("Operation validation criteria"),
          }),
        )
        .describe("Operations to perform"),
      metrics: z
        .object({
          latency: z.boolean().default(true).describe("Measure latency"),
          throughput: z.boolean().default(true).describe("Measure throughput"),
          errorRate: z.boolean().default(true).describe("Measure error rate"),
          resourceUsage: z
            .boolean()
            .default(false)
            .describe("Measure resource usage"),
          customMetrics: z
            .array(z.string())
            .default([])
            .describe("Custom metrics to collect"),
        })
        .describe("Metrics to collect"),
      thresholds: z
        .object({
          maxLatency: z
            .number()
            .optional()
            .describe("Maximum acceptable latency in ms"),
          minThroughput: z
            .number()
            .optional()
            .describe("Minimum acceptable throughput"),
          maxErrorRate: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe("Maximum acceptable error rate"),
          maxMemoryUsage: z
            .number()
            .optional()
            .describe("Maximum memory usage in MB"),
        })
        .describe("Performance thresholds"),
    })
    .strict()

  // Benchmark suite organization
  export const BenchmarkSuite = z
    .object({
      name: z.string().describe("Suite name"),
      description: z.string().describe("Suite description"),
      version: z.string().default("1.0.0").describe("Suite version"),
      scenarios: z.array(z.string()).describe("Scenario names to include"),
      execution: z
        .object({
          parallel: z
            .boolean()
            .default(false)
            .describe("Run scenarios in parallel"),
          randomOrder: z
            .boolean()
            .default(false)
            .describe("Randomize execution order"),
          warmup: z
            .object({
              enabled: z
                .boolean()
                .default(true)
                .describe("Enable warmup phase"),
              iterations: z
                .number()
                .min(1)
                .default(3)
                .describe("Warmup iterations"),
            })
            .describe("Warmup configuration"),
          cooldown: z
            .object({
              enabled: z
                .boolean()
                .default(true)
                .describe("Enable cooldown phase"),
              duration: z
                .number()
                .min(1000)
                .default(5000)
                .describe("Cooldown duration in ms"),
            })
            .describe("Cooldown configuration"),
        })
        .describe("Execution configuration"),
      reporting: z
        .object({
          formats: z
            .array(z.enum(["json", "csv", "html", "console"]))
            .default(["console", "json"])
            .describe("Report formats"),
          includeRawData: z
            .boolean()
            .default(false)
            .describe("Include raw measurement data"),
          aggregation: z
            .enum(["mean", "median", "p95", "p99"])
            .default("p95")
            .describe("Primary aggregation method"),
          comparison: z
            .object({
              enabled: z
                .boolean()
                .default(false)
                .describe("Enable comparison with baseline"),
              baseline: z.string().optional().describe("Baseline results file"),
              threshold: z
                .number()
                .min(0)
                .default(0.05)
                .describe("Significant change threshold"),
            })
            .describe("Comparison configuration"),
        })
        .describe("Reporting configuration"),
    })
    .strict()

  // Main benchmark configuration
  export const Config = z
    .object({
      $schema: z.string().optional().describe("JSON schema reference"),
      version: z.string().default("1.0.0").describe("Configuration version"),
      metadata: z
        .object({
          name: z.string().describe("Benchmark configuration name"),
          description: z.string().describe("Configuration description"),
          author: z.string().optional().describe("Configuration author"),
          created: z.string().optional().describe("Creation date"),
          updated: z.string().optional().describe("Last update date"),
        })
        .describe("Configuration metadata"),
      environment: EnvironmentConfig.describe("Environment configuration"),
      payloadSizes: PayloadSizes.describe("Payload size definitions"),
      concurrencyLevels: ConcurrencyLevels.describe(
        "Concurrency level definitions",
      ),
      testDurations: TestDurations.describe("Test duration definitions"),
      mockServers: z
        .record(z.string(), MockServerConfig)
        .describe("Mock server configurations"),
      dataGeneration: TestDataGeneration.describe(
        "Test data generation parameters",
      ),
      scenarios: z
        .record(z.string(), TestScenario)
        .describe("Test scenario definitions"),
      suites: z
        .record(z.string(), BenchmarkSuite)
        .describe("Benchmark suite definitions"),
      defaults: z
        .object({
          suite: z
            .string()
            .default("standard")
            .describe("Default benchmark suite"),
          environment: z
            .string()
            .default("local")
            .describe("Default environment"),
          outputDir: z
            .string()
            .default("benchmark-results")
            .describe("Default output directory"),
          timeout: z.number().default(300000).describe("Default timeout in ms"),
        })
        .describe("Default settings"),
    })
    .strict()

  export type Config = z.infer<typeof Config>
  export type TestScenario = z.infer<typeof TestScenario>
  export type BenchmarkSuite = z.infer<typeof BenchmarkSuite>
  export type MockServerConfig = z.infer<typeof MockServerConfig>
  export type EnvironmentConfig = z.infer<typeof EnvironmentConfig>
  export type PayloadSize = z.infer<typeof PayloadSize>
  export type ConcurrencyLevel = z.infer<typeof ConcurrencyLevel>
  export type TestDuration = z.infer<typeof TestDuration>

  // Predefined configurations
  export const DEFAULT_PAYLOAD_SIZES: z.infer<typeof PayloadSizes> = {
    tiny: {
      name: "tiny",
      bytes: 100,
      description: "Minimal payload for basic operations",
      category: "tiny",
    },
    small: {
      name: "small",
      bytes: 1024, // 1KB
      description: "Small payload for typical tool calls",
      category: "small",
    },
    medium: {
      name: "medium",
      bytes: 10240, // 10KB
      description: "Medium payload for complex operations",
      category: "medium",
    },
    large: {
      name: "large",
      bytes: 102400, // 100KB
      description: "Large payload for data-intensive operations",
      category: "large",
    },
    huge: {
      name: "huge",
      bytes: 1048576, // 1MB
      description: "Huge payload for stress testing",
      category: "huge",
    },
  }

  export const DEFAULT_CONCURRENCY_LEVELS: z.infer<typeof ConcurrencyLevels> = {
    single: {
      name: "single",
      concurrent: 1,
      description: "Single-threaded execution",
      category: "single",
    },
    light: {
      name: "light",
      concurrent: 5,
      description: "Light concurrent load",
      category: "light",
    },
    moderate: {
      name: "moderate",
      concurrent: 10,
      description: "Moderate concurrent load",
      category: "moderate",
    },
    heavy: {
      name: "heavy",
      concurrent: 25,
      description: "Heavy concurrent load",
      category: "heavy",
    },
    extreme: {
      name: "extreme",
      concurrent: 50,
      description: "Extreme concurrent load for stress testing",
      category: "extreme",
    },
  }

  export const DEFAULT_TEST_DURATIONS: z.infer<typeof TestDurations> = {
    quick: {
      name: "quick",
      milliseconds: 5000,
      description: "Quick test for development",
      category: "quick",
    },
    short: {
      name: "short",
      milliseconds: 30000,
      description: "Short test for CI/CD",
      category: "short",
    },
    medium: {
      name: "medium",
      milliseconds: 120000,
      description: "Medium test for thorough validation",
      category: "medium",
    },
    long: {
      name: "long",
      milliseconds: 300000,
      description: "Long test for performance analysis",
      category: "long",
    },
    extended: {
      name: "extended",
      milliseconds: 600000,
      description: "Extended test for endurance testing",
      category: "extended",
    },
  }

  // Environment detection
  export function detectEnvironment(): EnvironmentConfig {
    const isCI = process.env.CI === "true"
    const nodeEnv = process.env.NODE_ENV || "development"

    // Basic resource detection
    const cpuCores = require("os").cpus().length
    const totalMemory = Math.round(require("os").totalmem() / 1024 / 1024) // MB
    const availableMemory = Math.round(require("os").freemem() / 1024 / 1024) // MB

    return {
      name: isCI ? "ci" : "local",
      type: isCI ? "ci" : "local",
      resources: {
        cpu: {
          cores: cpuCores,
        },
        memory: {
          total: totalMemory,
          available: availableMemory,
        },
      },
      limits: {
        maxConcurrency: isCI ? Math.min(cpuCores * 2, 20) : cpuCores * 4,
        maxMemoryUsage: Math.round(availableMemory * 0.8),
        maxTestDuration: isCI ? 180000 : 600000, // 3min CI, 10min local
      },
      features: {
        profiling: !isCI,
        monitoring: true,
        debugging: nodeEnv === "development",
      },
    }
  }

  // Configuration validation
  export function validateConfig(config: unknown): Config {
    const result = Config.safeParse(config)
    if (!result.success) {
      throw new ConfigValidationError({
        issues: result.error.issues,
        message: "Invalid benchmark configuration",
      })
    }
    return result.data
  }

  // Configuration builder helpers
  export function createLightLoadScenario(
    name: string,
    description: string,
  ): TestScenario {
    return {
      name,
      description,
      category: "performance",
      priority: "medium",
      tags: ["light", "performance"],
      setup: {
        servers: ["basic-mock"],
        payloadSize: "small",
        concurrency: "light",
        duration: "short",
      },
      operations: [
        {
          type: "initialize",
          weight: 0.1,
        },
        {
          type: "list_tools",
          weight: 0.3,
        },
        {
          type: "call_tool",
          tool: "echo",
          weight: 0.6,
        },
      ],
      metrics: {
        latency: true,
        throughput: true,
        errorRate: true,
        resourceUsage: false,
        customMetrics: [],
      },
      thresholds: {
        maxLatency: 1000,
        minThroughput: 10,
        maxErrorRate: 0.01,
      },
    }
  }

  export function createMediumLoadScenario(
    name: string,
    description: string,
  ): TestScenario {
    return {
      name,
      description,
      category: "load",
      priority: "high",
      tags: ["medium", "load"],
      setup: {
        servers: ["standard-mock"],
        payloadSize: "medium",
        concurrency: "moderate",
        duration: "medium",
      },
      operations: [
        {
          type: "initialize",
          weight: 0.05,
        },
        {
          type: "list_tools",
          weight: 0.15,
        },
        {
          type: "call_tool",
          tool: "complex-operation",
          weight: 0.6,
        },
        {
          type: "list_resources",
          weight: 0.1,
        },
        {
          type: "read_resource",
          resource: "test-resource",
          weight: 0.1,
        },
      ],
      metrics: {
        latency: true,
        throughput: true,
        errorRate: true,
        resourceUsage: true,
        customMetrics: ["memory_peak", "cpu_usage"],
      },
      thresholds: {
        maxLatency: 2000,
        minThroughput: 25,
        maxErrorRate: 0.02,
        maxMemoryUsage: 512,
      },
    }
  }

  export function createHeavyLoadScenario(
    name: string,
    description: string,
  ): TestScenario {
    return {
      name,
      description,
      category: "stress",
      priority: "critical",
      tags: ["heavy", "stress"],
      setup: {
        servers: ["high-performance-mock"],
        payloadSize: "large",
        concurrency: "heavy",
        duration: "long",
      },
      operations: [
        {
          type: "initialize",
          weight: 0.02,
        },
        {
          type: "call_tool",
          tool: "data-processor",
          weight: 0.7,
        },
        {
          type: "call_tool",
          tool: "batch-operation",
          weight: 0.2,
        },
        {
          type: "read_resource",
          resource: "large-dataset",
          weight: 0.08,
        },
      ],
      metrics: {
        latency: true,
        throughput: true,
        errorRate: true,
        resourceUsage: true,
        customMetrics: [
          "memory_peak",
          "cpu_usage",
          "gc_time",
          "connection_pool",
        ],
      },
      thresholds: {
        maxLatency: 5000,
        minThroughput: 50,
        maxErrorRate: 0.05,
        maxMemoryUsage: 1024,
      },
    }
  }

  // Error types
  export const ConfigValidationError = NamedError.create(
    "BenchmarkConfigValidationError",
    z.object({
      issues: z.custom<z.ZodIssue[]>(),
      message: z.string(),
    }),
  )

  export const EnvironmentDetectionError = NamedError.create(
    "BenchmarkEnvironmentDetectionError",
    z.object({
      message: z.string(),
      cause: z.string().optional(),
    }),
  )

  // Default configuration factory
  export function createDefaultConfig(): Config {
    const environment = detectEnvironment()

    return {
      version: "1.0.0",
      metadata: {
        name: "MCP Performance Benchmark Configuration",
        description:
          "Comprehensive performance testing configuration for MCP servers",
        created: new Date().toISOString(),
      },
      environment,
      payloadSizes: DEFAULT_PAYLOAD_SIZES,
      concurrencyLevels: DEFAULT_CONCURRENCY_LEVELS,
      testDurations: DEFAULT_TEST_DURATIONS,
      mockServers: {
        "basic-mock": {
          name: "basic-mock",
          type: "stdio",
          latency: { min: 10, max: 50, distribution: "uniform" },
          reliability: {
            successRate: 0.99,
            errorTypes: ["timeout"],
            errorRate: 0.01,
          },
          capabilities: ["tools"],
          tools: [
            {
              name: "echo",
              description: "Simple echo tool",
              complexity: "simple",
            },
          ],
        },
        "standard-mock": {
          name: "standard-mock",
          type: "websocket",
          port: 8080,
          latency: { min: 20, max: 100, distribution: "normal" },
          reliability: {
            successRate: 0.98,
            errorTypes: ["timeout", "connection"],
            errorRate: 0.02,
          },
          capabilities: ["tools", "resources"],
          tools: [
            {
              name: "complex-operation",
              description: "Complex processing tool",
              complexity: "moderate",
            },
          ],
        },
        "high-performance-mock": {
          name: "high-performance-mock",
          type: "stdio",
          latency: { min: 5, max: 25, distribution: "exponential" },
          reliability: {
            successRate: 0.995,
            errorTypes: ["server"],
            errorRate: 0.005,
          },
          capabilities: ["tools", "resources", "prompts"],
          tools: [
            {
              name: "data-processor",
              description: "High-performance data processor",
              complexity: "complex",
            },
            {
              name: "batch-operation",
              description: "Batch processing tool",
              complexity: "complex",
            },
          ],
        },
      },
      dataGeneration: {
        stringLength: { min: 10, max: 1000 },
        arraySize: { min: 1, max: 100 },
        objectDepth: { min: 1, max: 5 },
        dataTypes: ["string", "number", "boolean", "array", "object"],
        patterns: {
          email: true,
          url: true,
          uuid: true,
          timestamp: true,
        },
      },
      scenarios: {
        "light-load": createLightLoadScenario(
          "light-load",
          "Light load performance test",
        ),
        "medium-load": createMediumLoadScenario(
          "medium-load",
          "Medium load performance test",
        ),
        "heavy-load": createHeavyLoadScenario(
          "heavy-load",
          "Heavy load stress test",
        ),
      },
      suites: {
        quick: {
          name: "quick",
          description: "Quick benchmark suite for development",
          version: "1.0.0",
          scenarios: ["light-load"],
          execution: {
            parallel: false,
            randomOrder: false,
            warmup: { enabled: true, iterations: 1 },
            cooldown: { enabled: true, duration: 2000 },
          },
          reporting: {
            formats: ["console"],
            includeRawData: false,
            aggregation: "mean",
            comparison: { enabled: false, threshold: 0.1 },
          },
        },
        standard: {
          name: "standard",
          description: "Standard benchmark suite",
          version: "1.0.0",
          scenarios: ["light-load", "medium-load"],
          execution: {
            parallel: false,
            randomOrder: false,
            warmup: { enabled: true, iterations: 3 },
            cooldown: { enabled: true, duration: 5000 },
          },
          reporting: {
            formats: ["console", "json"],
            includeRawData: false,
            aggregation: "p95",
            comparison: { enabled: false, threshold: 0.05 },
          },
        },
        comprehensive: {
          name: "comprehensive",
          description: "Comprehensive benchmark suite",
          version: "1.0.0",
          scenarios: ["light-load", "medium-load", "heavy-load"],
          execution: {
            parallel: false,
            randomOrder: true,
            warmup: { enabled: true, iterations: 5 },
            cooldown: { enabled: true, duration: 10000 },
          },
          reporting: {
            formats: ["console", "json", "html"],
            includeRawData: true,
            aggregation: "p99",
            comparison: { enabled: true, threshold: 0.03 },
          },
        },
      },
      defaults: {
        suite: "standard",
        environment: environment.name,
        outputDir: "benchmark-results",
        timeout: 300000,
      },
    }
  }
}
