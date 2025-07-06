import { z } from "zod"
import path from "path"
import fs from "fs/promises"
import { Config } from "../../../src/config/config"
import { Log } from "../../../src/util/log"
import { NamedError } from "../../../src/util/error"

export namespace ConfigHelpers {
  const log = Log.create({ service: "config-helpers" })

  export const TestConfigError = NamedError.create(
    "TestConfigError",
    z.object({
      operation: z.string(),
      path: z.string().optional(),
      reason: z.string(),
    }),
  )

  export interface TestConfig extends Config.Info {
    _testMetadata?: {
      originalPath?: string
      backupPath?: string
      isTemporary?: boolean
      cleanup?: (() => Promise<void>)[]
    }
  }

  export interface ConfigOptions {
    temporary?: boolean
    backup?: boolean
    basePath?: string
    filename?: string
  }

  export async function createTestConfig(
    config: Partial<Config.Info>,
    options: ConfigOptions = {},
  ): Promise<{ config: TestConfig; path: string; cleanup: () => Promise<void> }> {
    const {
      temporary = true,
      backup = false,
      basePath = process.cwd(),
      filename = "dgmo.json",
    } = options

    const configPath = temporary
      ? path.join(await fs.mkdtemp(path.join(basePath, "test-config-")), filename)
      : path.join(basePath, filename)

    let backupPath: string | undefined
    const cleanupTasks: (() => Promise<void>)[] = []

    try {
      if (backup && !temporary) {
        backupPath = `${configPath}.backup.${Date.now()}`
        try {
          await fs.copyFile(configPath, backupPath)
          cleanupTasks.push(async () => {
            if (backupPath) {
              await fs.copyFile(backupPath, configPath).catch(() => {})
              await fs.unlink(backupPath).catch(() => {})
            }
          })
        } catch (err) {
          log.info("no existing config to backup", { path: configPath })
        }
      }

      const testConfig: TestConfig = {
        ...config,
        _testMetadata: {
          originalPath: configPath,
          backupPath,
          isTemporary: temporary,
          cleanup: cleanupTasks,
        },
      }

      await writeConfig(configPath, testConfig)

      if (temporary) {
        cleanupTasks.push(async () => {
          await fs.rm(path.dirname(configPath), { recursive: true, force: true })
        })
      }

      const cleanup = async () => {
        for (const task of cleanupTasks.reverse()) {
          await task().catch((err) => log.error("cleanup failed", { err }))
        }
      }

      return { config: testConfig, path: configPath, cleanup }
    } catch (err) {
      for (const task of cleanupTasks.reverse()) {
        await task().catch(() => {})
      }
      throw new TestConfigError({
        operation: "create",
        path: configPath,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  export async function writeConfig(configPath: string, config: Config.Info): Promise<void> {
    try {
      await fs.mkdir(path.dirname(configPath), { recursive: true })
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))
      log.info("config written", { path: configPath })
    } catch (err) {
      throw new TestConfigError({
        operation: "write",
        path: configPath,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  export async function readConfig(configPath: string): Promise<Config.Info> {
    try {
      const content = await fs.readFile(configPath, "utf-8")
      const data = JSON.parse(content)
      const result = Config.Info.parse(data)
      log.info("config read", { path: configPath })
      return result
    } catch (err) {
      throw new TestConfigError({
        operation: "read",
        path: configPath,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  export function createMcpConfig(
    name: string,
    type: "local" | "remote",
    options: {
      command?: string[]
      url?: string
      environment?: Record<string, string>
      enabled?: boolean
    } = {},
  ): Record<string, Config.Mcp> {
    if (type === "local") {
      return {
        [name]: {
          type: "local",
          command: options.command || ["echo", "test"],
          environment: options.environment,
          enabled: options.enabled ?? true,
        },
      }
    } else {
      return {
        [name]: {
          type: "remote",
          url: options.url || "http://localhost:3000",
          enabled: options.enabled ?? true,
        },
      }
    }
  }

  export function createMinimalConfig(): Config.Info {
    return {
      model: "anthropic/claude-3-sonnet-20240229",
    }
  }

  export async function withTestConfig<T>(
    config: Partial<Config.Info>,
    fn: (configPath: string) => Promise<T>,
    options: ConfigOptions = {},
  ): Promise<T> {
    const { config: testConfig, path: configPath, cleanup } = await createTestConfig(
      config,
      options,
    )

    try {
      return await fn(configPath)
    } finally {
      await cleanup()
    }
  }
}
