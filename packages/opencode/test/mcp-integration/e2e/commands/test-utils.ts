import { beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import os from "os"
import * as prompts from "@clack/prompts"

export interface TestConfig {
  mcp?: Record<string, any>
  [key: string]: any
}

export class TestConfigManager {
  private originalConfigPath: string
  private testConfigPath: string
  private backupPath: string | null = null

  constructor(testName: string) {
    const testDir = path.join(os.tmpdir(), "dgmo-test", testName)
    this.testConfigPath = path.join(testDir, "config.json")
    this.originalConfigPath = path.join(
      process.env.HOME || os.homedir(),
      ".config",
      "dgmo",
      "config.json",
    )
  }

  async setup() {
    await fs.mkdir(path.dirname(this.testConfigPath), { recursive: true })

    try {
      await fs.access(this.originalConfigPath)
      this.backupPath = this.originalConfigPath + ".test-backup"
      await fs.copyFile(this.originalConfigPath, this.backupPath)
    } catch {
      // No original config to backup
    }

    process.env.DGMO_CONFIG_PATH = path.dirname(this.testConfigPath)
  }

  async cleanup() {
    if (this.backupPath) {
      try {
        await fs.copyFile(this.backupPath, this.originalConfigPath)
        await fs.unlink(this.backupPath)
      } catch {
        // Ignore cleanup errors
      }
    }

    try {
      await fs.rm(path.dirname(this.testConfigPath), {
        recursive: true,
        force: true,
      })
    } catch {
      // Ignore cleanup errors
    }

    delete process.env.DGMO_CONFIG_PATH
  }

  async writeConfig(config: TestConfig) {
    await fs.writeFile(this.testConfigPath, JSON.stringify(config, null, 2))
  }

  async readConfig(): Promise<TestConfig> {
    try {
      const content = await fs.readFile(this.testConfigPath, "utf-8")
      return JSON.parse(content)
    } catch {
      return {}
    }
  }

  async configExists(): Promise<boolean> {
    try {
      await fs.access(this.testConfigPath)
      return true
    } catch {
      return false
    }
  }

  getConfigPath(): string {
    return this.testConfigPath
  }
}

export class MockPrompts {
  private responses: Map<string, any> = new Map()
  private callOrder: string[] = []
  private currentIndex = 0

  setResponse(promptType: string, value: any) {
    this.responses.set(promptType, value)
  }

  setSequence(sequence: Array<{ type: string; value: any }>) {
    this.callOrder = sequence.map((s) => s.type)
    sequence.forEach((s) => this.setResponse(s.type, s.value))
  }

  mockPrompts() {
    const originalPrompts = { ...prompts }

    prompts.text = async (options: any) => {
      const response = this.getNextResponse("text")
      if (prompts.isCancel(response)) {
        return response
      }

      if (options.validate && response !== undefined) {
        const validation = options.validate(response)
        if (validation) {
          throw new Error(`Validation failed: ${validation}`)
        }
      }

      return response
    }

    prompts.select = async (options: any) => {
      const response = this.getNextResponse("select")
      if (prompts.isCancel(response)) {
        return response
      }

      const validValues = options.options.map((opt: any) => opt.value)
      if (!validValues.includes(response)) {
        throw new Error(`Invalid select value: ${response}`)
      }

      return response
    }

    prompts.confirm = async (options: any) => {
      const response = this.getNextResponse("confirm")
      if (prompts.isCancel(response)) {
        return response
      }
      return response
    }

    prompts.intro = () => {}
    prompts.outro = () => {}
    prompts.log = {
      info: () => {},
      success: () => {},
      error: () => {},
      warn: () => {},
    }

    return originalPrompts
  }

  private getNextResponse(type: string): any {
    if (this.callOrder.length > 0) {
      const expectedType = this.callOrder[this.currentIndex]
      if (expectedType !== type) {
        throw new Error(
          `Expected prompt type '${expectedType}' but got '${type}'`,
        )
      }
      this.currentIndex++
    }

    return this.responses.get(type)
  }

  reset() {
    this.responses.clear()
    this.callOrder = []
    this.currentIndex = 0
  }

  getCallCount(): number {
    return this.currentIndex
  }

  hasMoreCalls(): boolean {
    return this.currentIndex < this.callOrder.length
  }
}

export function createMockServer(
  name: string,
  type: "local" | "remote",
  options: any = {},
) {
  const baseConfig = {
    type,
    ...options,
  }

  if (type === "local") {
    return {
      ...baseConfig,
      command: options.command || ["node", "mock-server.js"],
      ...(options.environment && { environment: options.environment }),
    }
  } else {
    return {
      ...baseConfig,
      url: options.url || "https://api.example.com/mcp",
    }
  }
}

export function createTestConfig(
  servers: Record<string, any> = {},
): TestConfig {
  return {
    mcp: servers,
  }
}

export const CANCEL_SYMBOL = Symbol("cancel")

export function createCancelledResponse() {
  return CANCEL_SYMBOL
}
