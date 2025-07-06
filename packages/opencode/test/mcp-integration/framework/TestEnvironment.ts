import { z } from "zod"
import { Log } from "../../../src/util/log"
import { NamedError } from "../../../src/util/error"
import { App } from "../../../src/app/app"
import { Config } from "../../../src/config/config"
import { Global } from "../../../src/global"
import path from "path"
import fs from "fs/promises"
import os from "os"

export namespace TestEnvironment {
  const log = Log.create({ service: "test-environment" })

  export const EnvironmentFailed = NamedError.create(
    "TestEnvironmentFailed",
    z.object({
      operation: z.string(),
      reason: z.string(),
    }),
  )

  export interface EnvironmentConfig {
    name: string
    isolated: boolean
    tempDir?: string
    configOverrides?: Partial<Config.Schema>
    preserveState?: boolean
    cleanupTimeout?: number
  }

  export interface ResourceLimits {
    maxMemoryMB?: number
    maxCpuPercent?: number
    maxDiskMB?: number
    maxNetworkConnections?: number
  }

  export interface EnvironmentState {
    startTime: number
    tempDir: string
    configPath: string
    originalConfig?: Config.Schema
    processes: Set<number>
    resources: Map<string, any>
    cleanup: Array<() => Promise<void>>
  }

  export class Instance {
    private state: EnvironmentState
    private config: EnvironmentConfig

    constructor(config: EnvironmentConfig) {
      this.config = config
      this.state = {
        startTime: Date.now(),
        tempDir: "",
        configPath: "",
        processes: new Set(),
        resources: new Map(),
        cleanup: [],
      }
    }

    async initialize(): Promise<void> {
      log.info("initializing test environment", { name: this.config.name })

      try {
        await this.setupTempDirectory()
        await this.setupConfiguration()
        await this.setupIsolation()

        log.info("test environment ready", {
          name: this.config.name,
          tempDir: this.state.tempDir,
          isolated: this.config.isolated,
        })
      } catch (error) {
        await this.cleanup()
        throw EnvironmentFailed.create({
          operation: "initialize",
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }

    private async setupTempDirectory(): Promise<void> {
      if (this.config.tempDir) {
        this.state.tempDir = this.config.tempDir
        await fs.mkdir(this.state.tempDir, { recursive: true })
      } else {
        this.state.tempDir = await fs.mkdtemp(
          path.join(os.tmpdir(), `opencode-test-${this.config.name}-`),
        )
      }

      // Add cleanup for temp directory
      this.state.cleanup.push(async () => {
        if (!this.config.preserveState) {
          await fs.rm(this.state.tempDir, { recursive: true, force: true })
        }
      })
    }

    private async setupConfiguration(): Promise<void> {
      if (this.config.isolated) {
        // Create isolated config
        this.state.configPath = path.join(this.state.tempDir, "config.json")

        // Save original config if it exists
        try {
          this.state.originalConfig = await Config.get()
        } catch {
          // No existing config, that's fine
        }

        // Create test config
        const testConfig: Partial<Config.Schema> = {
          mcp: {},
          ...this.config.configOverrides,
        }

        await fs.writeFile(
          this.state.configPath,
          JSON.stringify(testConfig, null, 2),
        )

        // Override global config path for this test
        const originalConfigPath = Global.Path.config
        Global.Path.config = path.dirname(this.state.configPath)

        // Add cleanup to restore original config path
        this.state.cleanup.push(async () => {
          Global.Path.config = originalConfigPath
        })
      } else {
        // Use existing config with overrides
        if (this.config.configOverrides) {
          const currentConfig = await Config.get()
          const mergedConfig = {
            ...currentConfig,
            ...this.config.configOverrides,
          }

          // Save current config for restoration
          this.state.originalConfig = currentConfig

          // Apply overrides (this would need Config.set() method)
          // For now, we'll just log that overrides were requested
          log.warn(
            "config overrides requested but Config.set() not available",
            {
              overrides: this.config.configOverrides,
            },
          )
        }
      }
    }

    private async setupIsolation(): Promise<void> {
      if (!this.config.isolated) return

      // Set up process isolation
      const originalExit = process.exit
      process.exit = ((code?: number) => {
        log.warn("process.exit() called in test environment", { code })
        throw new Error(`Test tried to exit process with code ${code}`)
      }) as typeof process.exit

      // Add cleanup to restore original exit
      this.state.cleanup.push(async () => {
        process.exit = originalExit
      })

      // Set up environment variable isolation
      const originalEnv = { ...process.env }

      // Add cleanup to restore environment
      this.state.cleanup.push(async () => {
        // Clear current env and restore original
        for (const key of Object.keys(process.env)) {
          delete process.env[key]
        }
        Object.assign(process.env, originalEnv)
      })
    }

    getTempDir(): string {
      return this.state.tempDir
    }

    getConfigPath(): string {
      return this.state.configPath
    }

    async createTempFile(name: string, content: string): Promise<string> {
      const filePath = path.join(this.state.tempDir, name)
      await fs.writeFile(filePath, content)
      return filePath
    }

    async createTempDir(name: string): Promise<string> {
      const dirPath = path.join(this.state.tempDir, name)
      await fs.mkdir(dirPath, { recursive: true })
      return dirPath
    }

    async readTempFile(name: string): Promise<string> {
      const filePath = path.join(this.state.tempDir, name)
      return await fs.readFile(filePath, "utf-8")
    }

    async tempFileExists(name: string): Promise<boolean> {
      const filePath = path.join(this.state.tempDir, name)
      try {
        await fs.access(filePath)
        return true
      } catch {
        return false
      }
    }

    setResource(key: string, value: any): void {
      this.state.resources.set(key, value)
    }

    getResource<T>(key: string): T | undefined {
      return this.state.resources.get(key)
    }

    hasResource(key: string): boolean {
      return this.state.resources.has(key)
    }

    addCleanup(fn: () => Promise<void>): void {
      this.state.cleanup.push(fn)
    }

    trackProcess(pid: number): void {
      this.state.processes.add(pid)
    }

    async killTrackedProcesses(): Promise<void> {
      for (const pid of this.state.processes) {
        try {
          process.kill(pid, "SIGTERM")

          // Wait a bit for graceful shutdown
          await new Promise((resolve) => setTimeout(resolve, 1000))

          // Force kill if still running
          try {
            process.kill(pid, "SIGKILL")
          } catch {
            // Process already dead
          }
        } catch (error) {
          log.warn("failed to kill tracked process", { pid, error })
        }
      }
      this.state.processes.clear()
    }

    getUptime(): number {
      return Date.now() - this.state.startTime
    }

    getState(): Readonly<EnvironmentState> {
      return { ...this.state }
    }

    getConfig(): Readonly<EnvironmentConfig> {
      return { ...this.config }
    }

    async cleanup(): Promise<void> {
      log.info("cleaning up test environment", {
        name: this.config.name,
        uptime: this.getUptime(),
        cleanupTasks: this.state.cleanup.length,
      })

      const timeout = this.config.cleanupTimeout || 30000
      const cleanupPromise = this.performCleanup()

      try {
        await Promise.race([
          cleanupPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Cleanup timeout")), timeout),
          ),
        ])
      } catch (error) {
        log.error("cleanup failed or timed out", {
          name: this.config.name,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    private async performCleanup(): Promise<void> {
      // Kill tracked processes first
      await this.killTrackedProcesses()

      // Run cleanup functions in reverse order
      const cleanupTasks = [...this.state.cleanup].reverse()

      for (const cleanup of cleanupTasks) {
        try {
          await cleanup()
        } catch (error) {
          log.warn("cleanup task failed", {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      this.state.cleanup.length = 0
      this.state.resources.clear()
    }
  }

  export async function create(
    config?: Partial<EnvironmentConfig>,
  ): Promise<Instance> {
    const defaultConfig: EnvironmentConfig = {
      name: "test-env",
      isolated: true,
      preserveState: false,
      cleanupTimeout: 30000,
      ...config,
    }

    const environment = new Instance(defaultConfig)
    await environment.initialize()
    return environment
  }

  export async function createIsolated(name: string): Promise<Instance> {
    return create({
      name,
      isolated: true,
      preserveState: false,
    })
  }

  export async function createShared(name: string): Promise<Instance> {
    return create({
      name,
      isolated: false,
      preserveState: true,
    })
  }

  export async function createWithConfig(
    name: string,
    configOverrides: Partial<Config.Schema>,
  ): Promise<Instance> {
    return create({
      name,
      isolated: true,
      configOverrides,
      preserveState: false,
    })
  }
}
