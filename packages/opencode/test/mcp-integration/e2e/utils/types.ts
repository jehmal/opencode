import type { Config } from "../../../../src/config/config"

export interface TestEnvironment {
  id: string
  configDir: string
  configPath: string
  tempDir: string
  cleanup: () => Promise<void>
}

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
  duration: number
  success: boolean
}

export interface MockServerConfig {
  name: string
  port: number
  type: "local" | "remote"
  tools?: MockTool[]
  resources?: MockResource[]
  shouldFail?: boolean
  responseDelay?: number
}

export interface MockTool {
  name: string
  description?: string
  parameters?: {
    type: "object"
    properties: Record<string, any>
    required?: string[]
  }
  handler?: (params: any) => any
}

export interface MockResource {
  uri: string
  name?: string
  description?: string
  mimeType?: string
  content?: string
}

export interface TestConfig {
  mcp?: Record<string, Config.Mcp>
  [key: string]: any
}

export interface ProcessInfo {
  pid: number
  command: string[]
  port?: number
  cleanup: () => Promise<void>
}

export interface TestAssertion {
  name: string
  condition: boolean
  message?: string
  actual?: any
  expected?: any
}

export interface PerformanceThresholds {
  maxExecutionTime?: number
  maxMemoryUsage?: number
  maxCpuUsage?: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export type McpCommand =
  | "list"
  | "add"
  | "remove"
  | "enable"
  | "disable"
  | "wizard"
  | "status"
  | "test"
  | "tools"
  | "resources"
  | "debug"
  | "logs"
  | "health"

export interface CommandTestCase {
  name: string
  command: McpCommand
  args?: string[]
  options?: Record<string, any>
  expectedExitCode?: number
  expectedOutput?: string | RegExp
  expectedError?: string | RegExp
  setup?: () => Promise<void>
  cleanup?: () => Promise<void>
}
