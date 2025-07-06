import { z } from "zod"
import path from "path"
import { Log } from "../../../src/util/log"
import { NamedError } from "../../../src/util/error"
import { mergeDeep } from "remeda"

export namespace TestConfig {
  const log = Log.create({ service: "test-config" })

  export const McpTestServer = z
    .object({
      type: z
        .enum(["local", "remote", "mock"])
        .describe("Type of MCP server for testing"),
      name: z.string().describe("Unique name for the test server"),
      enabled: z
        .boolean()
        .default(true)
        .describe("Enable this server for testing"),
      timeout: z
        .number()
        .default(30000)
        .describe("Connection timeout in milliseconds"),
      retries: z.number().default(3).describe("Number of retry attempts"),
    })
    .strict()

  export const McpLocalTestServer = McpTestServer.extend({
    type: z.literal("local"),
    command: z
      .string()
      .array()
      .describe("Command and arguments to run the MCP server"),
    environment: z
      .record(z.string(), z.string())
      .optional()
      .describe("Environment variables for the server process"),
    workingDirectory: z
      .string()
      .optional()
      .describe("Working directory for the server process"),
    startupDelay: z
      .number()
      .default(1000)
      .describe("Delay after startup before testing"),
  }).strict()

  export const McpRemoteTestServer = McpTestServer.extend({
    type: z.literal("remote"),
    url: z.string().url().describe("URL of the remote MCP server"),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .describe("HTTP headers for remote connections"),
    auth: z
      .object({
        type: z.enum(["bearer", "basic", "api-key"]),
        token: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        apiKey: z.string().optional(),
        header: z.string().optional(),
      })
      .optional()
      .describe("Authentication configuration"),
  }).strict()

  export const McpMockServer = McpTestServer.extend({
    type: z.literal("mock"),
    port: z.number().default(0).describe("Port for mock server (0 for random)"),
    responses: z
      .record(
        z.string(),
        z.object({
          method: z.string(),
          response: z.any(),
          delay: z.number().optional(),
          error: z.boolean().optional(),
        }),
      )
      .describe("Mock responses for different methods"),
    fixtures: z.string().optional().describe("Path to fixture files"),
  }).strict()

  export const TestServer = z.discriminatedUnion("type", [
    McpLocalTestServer,
    McpRemoteTestServer,
    McpMockServer,
  ])
  export type TestServer = z.infer<typeof TestServer>

  export const TestData = z
    .object({
      fixtures: z.string().describe("Path to test fixture files"),
      temp: z.string().describe("Path to temporary test files"),
      output: z.string().describe("Path to test output files"),
      snapshots: z.string().describe("Path to test snapshot files"),
    })
    .strict()

  export const ParallelExecution = z
    .object({
      enabled: z
        .boolean()
        .default(true)
        .describe("Enable parallel test execution"),
      maxConcurrency: z
        .number()
        .default(4)
        .describe("Maximum concurrent test processes"),
      isolation: z
        .enum(["none", "process", "container"])
        .default("process")
        .describe("Test isolation level"),
      sharedResources: z
        .string()
        .array()
        .default([])
        .describe("Resources that cannot be used in parallel"),
    })
    .strict()

  export const TestTimeouts = z
    .object({
      connection: z
        .number()
        .default(10000)
        .describe("Connection timeout in milliseconds"),
      request: z
        .number()
        .default(30000)
        .describe("Request timeout in milliseconds"),
      test: z
        .number()
        .default(60000)
        .describe("Individual test timeout in milliseconds"),
      suite: z
        .number()
        .default(300000)
        .describe("Test suite timeout in milliseconds"),
      cleanup: z
        .number()
        .default(5000)
        .describe("Cleanup timeout in milliseconds"),
    })
    .strict()

  export const TestRetries = z
    .object({
      connection: z.number().default(3).describe("Connection retry attempts"),
      request: z.number().default(2).describe("Request retry attempts"),
      test: z.number().default(1).describe("Test retry attempts"),
      flaky: z.number().default(3).describe("Retry attempts for flaky tests"),
    })
    .strict()

  export const TestEnvironment = z
    .object({
      name: z.string().describe("Environment name (local, ci, mock)"),
      description: z.string().optional().describe("Environment description"),
      servers: z
        .record(z.string(), TestServer)
        .describe("MCP servers for this environment"),
      data: TestData.describe("Test data paths"),
      parallel: ParallelExecution.describe("Parallel execution settings"),
      timeouts: TestTimeouts.describe("Timeout configurations"),
      retries: TestRetries.describe("Retry configurations"),
      variables: z
        .record(z.string(), z.string())
        .default({})
        .describe("Environment-specific variables"),
      setup: z
        .object({
          beforeAll: z
            .string()
            .array()
            .optional()
            .describe("Commands to run before all tests"),
          afterAll: z
            .string()
            .array()
            .optional()
            .describe("Commands to run after all tests"),
          beforeEach: z
            .string()
            .array()
            .optional()
            .describe("Commands to run before each test"),
          afterEach: z
            .string()
            .array()
            .optional()
            .describe("Commands to run after each test"),
        })
        .optional()
        .describe("Setup and teardown commands"),
    })
    .strict()

  export const TestProfile = z
    .object({
      name: z.string().describe("Profile name (fast, full, integration)"),
      description: z.string().optional().describe("Profile description"),
      environment: z.string().describe("Environment to use"),
      include: z
        .string()
        .array()
        .default([])
        .describe("Test patterns to include"),
      exclude: z
        .string()
        .array()
        .default([])
        .describe("Test patterns to exclude"),
      tags: z.string().array().default([]).describe("Test tags to run"),
      parallel: z.boolean().default(true).describe("Enable parallel execution"),
      coverage: z.boolean().default(false).describe("Enable code coverage"),
      verbose: z.boolean().default(false).describe("Enable verbose output"),
      bail: z.boolean().default(false).describe("Stop on first failure"),
      timeout: z.number().optional().describe("Override default timeouts"),
    })
    .strict()

  export const Config = z
    .object({
      $schema: z
        .string()
        .optional()
        .describe("JSON schema reference for test configuration validation"),
      version: z.string().default("1.0.0").describe("Configuration version"),
      environments: z
        .record(z.string(), TestEnvironment)
        .describe("Test environment configurations"),
      profiles: z
        .record(z.string(), TestProfile)
        .describe("Test execution profiles"),
      defaults: z
        .object({
          environment: z
            .string()
            .default("local")
            .describe("Default environment"),
          profile: z.string().default("fast").describe("Default profile"),
        })
        .describe("Default settings"),
      reporting: z
        .object({
          enabled: z.boolean().default(true).describe("Enable test reporting"),
          format: z
            .enum(["json", "junit", "html", "console"])
            .array()
            .default(["console"])
            .describe("Report formats"),
          output: z
            .string()
            .default("test-results")
            .describe("Report output directory"),
          includeSkipped: z
            .boolean()
            .default(false)
            .describe("Include skipped tests in reports"),
        })
        .optional()
        .describe("Test reporting configuration"),
      debugging: z
        .object({
          enabled: z.boolean().default(false).describe("Enable debug mode"),
          breakOnFailure: z
            .boolean()
            .default(false)
            .describe("Break on test failure"),
          logLevel: z
            .enum(["error", "warn", "info", "debug", "trace"])
            .default("info")
            .describe("Log level for debugging"),
          saveArtifacts: z
            .boolean()
            .default(true)
            .describe("Save test artifacts on failure"),
        })
        .optional()
        .describe("Debugging configuration"),
    })
    .strict()

  export type Config = z.infer<typeof Config>
  export type TestEnvironment = z.infer<typeof TestEnvironment>
  export type TestProfile = z.infer<typeof TestProfile>

  let cachedConfig: Config | null = null

  export async function load(configPath?: string): Promise<Config> {
    if (cachedConfig) return cachedConfig

    const defaultPath = path.join(__dirname, "environments", "local.json")
    const targetPath = configPath || defaultPath

    try {
      const data = await Bun.file(targetPath).json()
      const parsed = Config.safeParse(data)

      if (!parsed.success) {
        throw new ConfigValidationError({
          path: targetPath,
          issues: parsed.error.issues,
        })
      }

      cachedConfig = parsed.data
      log.info("loaded test config", { path: targetPath, config: cachedConfig })
      return cachedConfig
    } catch (error) {
      if (error instanceof ConfigValidationError) throw error

      throw new ConfigLoadError({
        path: targetPath,
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  export async function loadEnvironment(
    name: string,
  ): Promise<TestEnvironment> {
    const envPath = path.join(__dirname, "environments", `${name}.json`)

    try {
      const data = await Bun.file(envPath).json()
      const parsed = TestEnvironment.safeParse(data)

      if (!parsed.success) {
        throw new ConfigValidationError({
          path: envPath,
          issues: parsed.error.issues,
        })
      }

      log.info("loaded test environment", { name, path: envPath })
      return parsed.data
    } catch (error) {
      if (error instanceof ConfigValidationError) throw error

      throw new ConfigLoadError({
        path: envPath,
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  export function merge(base: Config, override: Partial<Config>): Config {
    return mergeDeep(base, override) as Config
  }

  export function getEnvironment(
    config: Config,
    name?: string,
  ): TestEnvironment {
    const envName = name || config.defaults.environment
    const environment = config.environments[envName]

    if (!environment) {
      throw new EnvironmentNotFoundError({ name: envName })
    }

    return environment
  }

  export function getProfile(config: Config, name?: string): TestProfile {
    const profileName = name || config.defaults.profile
    const profile = config.profiles[profileName]

    if (!profile) {
      throw new ProfileNotFoundError({ name: profileName })
    }

    return profile
  }

  export function getServer(
    environment: TestEnvironment,
    name: string,
  ): TestServer {
    const server = environment.servers[name]

    if (!server) {
      throw new ServerNotFoundError({ name, environment: environment.name })
    }

    return server
  }

  export function clearCache(): void {
    cachedConfig = null
  }

  export const ConfigLoadError = NamedError.create(
    "TestConfigLoadError",
    z.object({
      path: z.string(),
      message: z.string(),
    }),
  )

  export const ConfigValidationError = NamedError.create(
    "TestConfigValidationError",
    z.object({
      path: z.string(),
      issues: z.custom<z.ZodIssue[]>(),
    }),
  )

  export const EnvironmentNotFoundError = NamedError.create(
    "TestEnvironmentNotFoundError",
    z.object({
      name: z.string(),
    }),
  )

  export const ProfileNotFoundError = NamedError.create(
    "TestProfileNotFoundError",
    z.object({
      name: z.string(),
    }),
  )

  export const ServerNotFoundError = NamedError.create(
    "TestServerNotFoundError",
    z.object({
      name: z.string(),
      environment: z.string(),
    }),
  )
}
