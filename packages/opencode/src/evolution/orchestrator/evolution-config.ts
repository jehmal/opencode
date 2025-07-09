/**
 * Evolution Configuration Manager
 * Manages user settings and configuration for the evolution system
 */

import { EventEmitter } from "events"
import { Log } from "../../util/log"
import { readFile, writeFile } from "fs/promises"
import * as path from "path"
import type { OrchestratorConfig } from "./evolution-orchestrator"

const log = Log.create({ service: "evolution-config" })

/**
 * Evolution configuration
 */
export interface EvolutionConfig extends OrchestratorConfig {
  enabled: boolean
  cycleInterval: number
  maxConcurrentEvolutions: number
  autoApprove: {
    enabled: boolean
    maxRiskLevel: number
    types: string[]
  }
  priorities: Record<string, number>
  sandbox: {
    timeout: number
    memoryLimit: number
    cpuLimit: number
  }
  metrics: {
    trackingEnabled: boolean
    retentionDays: number
    exportPath?: string
  }
  notifications: {
    enabled: boolean
    channels: string[]
    events: string[]
  }
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EvolutionConfig = {
  enabled: true,
  cycleInterval: 300000, // 5 minutes
  maxConcurrentEvolutions: 3,
  autoApprove: {
    enabled: false,
    maxRiskLevel: 0.2,
    types: ["fix_bugs", "improve_performance"],
  },
  priorities: {
    fix_bugs: 1.0,
    enhance_security: 0.9,
    improve_performance: 0.8,
    optimize_memory: 0.7,
    add_feature: 0.6,
    improve_readability: 0.5,
    refactor_code: 0.4,
    custom: 0.3,
  },
  sandbox: {
    timeout: 60000,
    memoryLimit: 512 * 1024 * 1024,
    cpuLimit: 0.5,
  },
  metrics: {
    trackingEnabled: true,
    retentionDays: 30,
  },
  notifications: {
    enabled: false,
    channels: [],
    events: ["evolution:completed", "evolution:failed"],
  },
}

/**
 * Evolution Configuration Manager
 */
export class EvolutionConfigManager extends EventEmitter {
  private config: EvolutionConfig
  private configPath: string

  constructor(configPath?: string) {
    super()
    this.config = { ...DEFAULT_CONFIG }
    this.configPath =
      configPath || path.join(process.cwd(), ".evolution", "config.json")
  }

  /**
   * Initialize configuration
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfig()
      log.info("Configuration loaded", { path: this.configPath })
    } catch (error) {
      log.info("Using default configuration", { error })
      await this.saveConfig()
    }
  }

  /**
   * Get current configuration
   */
  async getConfig(): Promise<EvolutionConfig> {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<EvolutionConfig>): Promise<void> {
    const oldConfig = { ...this.config }

    // Deep merge configuration
    this.config = this.deepMerge(this.config, updates)

    // Save to disk
    await this.saveConfig()

    log.info("Configuration updated", { updates })

    // Emit change event
    this.emit("config-updated", {
      oldConfig,
      newConfig: this.config,
      changes: updates,
    })
  }

  /**
   * Reset to default configuration
   */
  async resetToDefault(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG }
    await this.saveConfig()

    log.info("Configuration reset to default")
    this.emit("config-reset")
  }

  /**
   * Validate configuration
   */
  validateConfig(config: any): config is EvolutionConfig {
    // Basic validation
    if (typeof config !== "object" || config === null) {
      return false
    }

    // Check required fields
    const required = ["enabled", "cycleInterval", "maxConcurrentEvolutions"]
    for (const field of required) {
      if (!(field in config)) {
        return false
      }
    }

    // Validate types
    if (typeof config.enabled !== "boolean") return false
    if (typeof config.cycleInterval !== "number" || config.cycleInterval < 0)
      return false
    if (
      typeof config.maxConcurrentEvolutions !== "number" ||
      config.maxConcurrentEvolutions < 1
    )
      return false

    return true
  }

  /**
   * Get configuration value by path
   */
  get<T = any>(path: string): T | undefined {
    const keys = path.split(".")
    let value: any = this.config

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key]
      } else {
        return undefined
      }
    }

    return value as T
  }

  /**
   * Set configuration value by path
   */
  async set(path: string, value: any): Promise<void> {
    const keys = path.split(".")
    const updates: any = {}
    let current = updates

    // Build nested update object
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {}
      current = current[keys[i]]
    }
    current[keys[keys.length - 1]] = value

    await this.updateConfig(updates)
  }

  /**
   * Load configuration from disk
   */
  private async loadConfig(): Promise<void> {
    const content = await readFile(this.configPath, "utf-8")
    const loaded = JSON.parse(content)

    if (!this.validateConfig(loaded)) {
      throw new Error("Invalid configuration format")
    }

    this.config = this.deepMerge(DEFAULT_CONFIG, loaded)
  }

  /**
   * Save configuration to disk
   */
  private async saveConfig(): Promise<void> {
    const dir = path.dirname(this.configPath)

    // Ensure directory exists
    try {
      await readFile(dir)
    } catch {
      const { mkdir } = await import("fs/promises")
      await mkdir(dir, { recursive: true })
    }

    await writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2),
      "utf-8",
    )
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target }

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          source[key] &&
          typeof source[key] === "object" &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(result[key] || {}, source[key])
        } else {
          result[key] = source[key]
        }
      }
    }

    return result
  }

  /**
   * Export configuration
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2)
  }

  /**
   * Import configuration
   */
  async importConfig(configJson: string): Promise<void> {
    const imported = JSON.parse(configJson)

    if (!this.validateConfig(imported)) {
      throw new Error("Invalid configuration format")
    }

    await this.updateConfig(imported)
  }
}
