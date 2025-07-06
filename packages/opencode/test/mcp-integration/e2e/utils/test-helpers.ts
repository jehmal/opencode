import { spawn, type ChildProcess } from "child_process"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { randomUUID } from "crypto"
import type {
  TestEnvironment,
  CommandResult,
  TestConfig,
  ProcessInfo,
  McpCommand,
} from "./types"

export class MockConfigManager {
  private environments = new Map<string, TestEnvironment>()

  async createTestEnvironment(id?: string): Promise<TestEnvironment> {
    const envId = id || randomUUID()
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `dgmo-test-${envId}-`),
    )
    const configDir = path.join(tempDir, ".config", "dgmo")
    const configPath = path.join(configDir, "config.json")

    await fs.mkdir(configDir, { recursive: true })

    const cleanup = async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
        this.environments.delete(envId)
      } catch (error) {
        console.warn(`Failed to cleanup test environment ${envId}:`, error)
      }
    }

    const env: TestEnvironment = {
      id: envId,
      configDir,
      configPath,
      tempDir,
      cleanup,
    }

    this.environments.set(envId, env)
    return env
  }

  async writeConfig(env: TestEnvironment, config: TestConfig): Promise<void> {
    const configContent = JSON.stringify(config, null, 2)
    await fs.writeFile(env.configPath, configContent, "utf-8")
  }

  async readConfig(env: TestEnvironment): Promise<TestConfig> {
    try {
      const content = await fs.readFile(env.configPath, "utf-8")
      return JSON.parse(content)
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        return {}
      }
      throw error
    }
  }

  async backupConfig(env: TestEnvironment): Promise<string> {
    const backupPath = `${env.configPath}.backup-${Date.now()}`
    try {
      await fs.copyFile(env.configPath, backupPath)
      return backupPath
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        return backupPath
      }
      throw error
    }
  }

  async restoreConfig(env: TestEnvironment, backupPath: string): Promise<void> {
    try {
      await fs.copyFile(backupPath, env.configPath)
      await fs.unlink(backupPath)
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        await fs.unlink(env.configPath).catch(() => {})
      } else {
        throw error
      }
    }
  }

  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.environments.values()).map((env) =>
      env.cleanup(),
    )
    await Promise.allSettled(cleanupPromises)
    this.environments.clear()
  }
}

export class TestEnvironmentManager {
  private static instance: TestEnvironmentManager
  private configManager = new MockConfigManager()

  static getInstance(): TestEnvironmentManager {
    if (!TestEnvironmentManager.instance) {
      TestEnvironmentManager.instance = new TestEnvironmentManager()
    }
    return TestEnvironmentManager.instance
  }

  async createIsolatedEnvironment(
    config?: TestConfig,
  ): Promise<TestEnvironment> {
    const env = await this.configManager.createTestEnvironment()

    if (config) {
      await this.configManager.writeConfig(env, config)
    }

    return env
  }

  async withEnvironment<T>(
    config: TestConfig,
    fn: (env: TestEnvironment) => Promise<T>,
  ): Promise<T> {
    const env = await this.createIsolatedEnvironment(config)
    try {
      return await fn(env)
    } finally {
      await env.cleanup()
    }
  }

  getConfigManager(): MockConfigManager {
    return this.configManager
  }

  async cleanup(): Promise<void> {
    await this.configManager.cleanupAll()
  }
}

export class CommandRunner {
  private static dgmoPath = path.resolve(__dirname, "../../../../bin/dgmo")

  static async run(
    command: McpCommand,
    args: string[] = [],
    options: {
      env?: TestEnvironment
      timeout?: number
      input?: string
      cwd?: string
    } = {},
  ): Promise<CommandResult> {
    const { env, timeout = 30000, input, cwd } = options

    const fullArgs = ["mcp", command, ...args]
    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      const childEnv = {
        ...process.env,
        ...(env ? { DGMO_CONFIG_DIR: env.configDir } : {}),
        NODE_ENV: "test",
      }

      const child = spawn("bun", [CommandRunner.dgmoPath, ...fullArgs], {
        cwd: cwd || process.cwd(),
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
      })

      let stdout = ""
      let stderr = ""

      child.stdout?.on("data", (data) => {
        stdout += data.toString()
      })

      child.stderr?.on("data", (data) => {
        stderr += data.toString()
      })

      if (input) {
        child.stdin?.write(input)
        child.stdin?.end()
      }

      const timeoutId = setTimeout(() => {
        child.kill("SIGTERM")
        reject(new Error(`Command timed out after ${timeout}ms`))
      }, timeout)

      child.on("close", (exitCode) => {
        clearTimeout(timeoutId)
        const duration = Date.now() - startTime

        resolve({
          exitCode: exitCode || 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration,
          success: exitCode === 0,
        })
      })

      child.on("error", (error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
    })
  }

  static async runWithInput(
    command: McpCommand,
    args: string[],
    inputs: string[],
    env?: TestEnvironment,
  ): Promise<CommandResult> {
    const inputString = inputs.join("\n") + "\n"
    return CommandRunner.run(command, args, { env, input: inputString })
  }
}

export class ConfigBuilder {
  private config: TestConfig = {}

  static create(): ConfigBuilder {
    return new ConfigBuilder()
  }

  withMcpServer(
    name: string,
    serverConfig: TestConfig["mcp"][string],
  ): ConfigBuilder {
    if (!this.config.mcp) {
      this.config.mcp = {}
    }
    this.config.mcp[name] = serverConfig
    return this
  }

  withLocalServer(
    name: string,
    command: string[],
    options: {
      environment?: Record<string, string>
      enabled?: boolean
    } = {},
  ): ConfigBuilder {
    return this.withMcpServer(name, {
      type: "local",
      command,
      ...options,
    })
  }

  withRemoteServer(
    name: string,
    url: string,
    options: {
      enabled?: boolean
    } = {},
  ): ConfigBuilder {
    return this.withMcpServer(name, {
      type: "remote",
      url,
      ...options,
    })
  }

  withDisabledServer(
    name: string,
    serverConfig: Omit<TestConfig["mcp"][string], "enabled">,
  ): ConfigBuilder {
    return this.withMcpServer(name, {
      ...serverConfig,
      enabled: false,
    })
  }

  withProperty(key: string, value: any): ConfigBuilder {
    this.config[key] = value
    return this
  }

  build(): TestConfig {
    return { ...this.config }
  }

  static validLocalConfig(): TestConfig {
    return ConfigBuilder.create()
      .withLocalServer("test-local", ["echo", "hello"])
      .build()
  }

  static validRemoteConfig(): TestConfig {
    return ConfigBuilder.create()
      .withRemoteServer("test-remote", "http://localhost:3000/mcp")
      .build()
  }

  static mixedConfig(): TestConfig {
    return ConfigBuilder.create()
      .withLocalServer("local-server", ["node", "server.js"])
      .withRemoteServer("remote-server", "https://api.example.com/mcp")
      .withDisabledServer("disabled-server", {
        type: "local",
        command: ["disabled", "command"],
      })
      .build()
  }

  static invalidConfig(): TestConfig {
    return {
      mcp: {
        "invalid-local": {
          type: "local",
          // Missing required command field
        } as any,
        "invalid-remote": {
          type: "remote",
          url: "not-a-valid-url",
        },
        "invalid-type": {
          type: "unknown",
        } as any,
      },
    }
  }
}

export class ProcessManager {
  private processes = new Map<string, ProcessInfo>()

  async startMockServer(
    name: string,
    command: string[],
    options: {
      port?: number
      env?: Record<string, string>
      cwd?: string
    } = {},
  ): Promise<ProcessInfo> {
    const { port, env = {}, cwd } = options

    return new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...env },
        stdio: ["pipe", "pipe", "pipe"],
      })

      const cleanup = async () => {
        return new Promise<void>((resolve) => {
          if (child.killed) {
            resolve()
            return
          }

          child.kill("SIGTERM")

          const timeout = setTimeout(() => {
            child.kill("SIGKILL")
            resolve()
          }, 5000)

          child.on("close", () => {
            clearTimeout(timeout)
            resolve()
          })
        })
      }

      const processInfo: ProcessInfo = {
        pid: child.pid!,
        command,
        port,
        cleanup,
      }

      child.on("error", (error) => {
        reject(error)
      })

      // Wait a bit for the process to start
      setTimeout(() => {
        if (!child.killed) {
          this.processes.set(name, processInfo)
          resolve(processInfo)
        }
      }, 1000)
    })
  }

  async stopProcess(name: string): Promise<void> {
    const process = this.processes.get(name)
    if (process) {
      await process.cleanup()
      this.processes.delete(name)
    }
  }

  async stopAll(): Promise<void> {
    const cleanupPromises = Array.from(this.processes.values()).map((p) =>
      p.cleanup(),
    )
    await Promise.allSettled(cleanupPromises)
    this.processes.clear()
  }

  getProcess(name: string): ProcessInfo | undefined {
    return this.processes.get(name)
  }

  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values())
  }
}

export class TestHelpers {
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    options: {
      timeout?: number
      interval?: number
      timeoutMessage?: string
    } = {},
  ): Promise<void> {
    const {
      timeout = 10000,
      interval = 100,
      timeoutMessage = "Condition not met within timeout",
    } = options
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, interval))
    }

    throw new Error(timeoutMessage)
  }

  static async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number
      delay?: number
      backoff?: boolean
    } = {},
  ): Promise<T> {
    const { maxAttempts = 3, delay = 1000, backoff = false } = options
    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error

        if (attempt === maxAttempts) {
          break
        }

        const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }

    throw lastError!
  }

  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage?: string,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            timeoutMessage || `Operation timed out after ${timeoutMs}ms`,
          ),
        )
      }, timeoutMs)
    })

    return Promise.race([promise, timeoutPromise])
  }

  static generateRandomPort(): number {
    return Math.floor(Math.random() * (65535 - 3000) + 3000)
  }

  static async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = require("net").createServer()

      server.listen(port, () => {
        server.close(() => resolve(true))
      })

      server.on("error", () => resolve(false))
    })
  }

  static async findAvailablePort(startPort: number = 3000): Promise<number> {
    let port = startPort
    while (!(await TestHelpers.isPortAvailable(port))) {
      port++
      if (port > 65535) {
        throw new Error("No available ports found")
      }
    }
    return port
  }
}

// Global test environment manager instance
export const testEnv = TestEnvironmentManager.getInstance()

// Cleanup function for test teardown
export async function globalTestCleanup(): Promise<void> {
  await testEnv.cleanup()
}
