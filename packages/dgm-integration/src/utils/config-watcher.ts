import {
  type UnifiedConfig,
  type ConfigChangeEvent,
} from "../schemas/unified-config.schema"
import { ConfigLoader } from "./config-loader"
import { ConfigValidator } from "./config-validator"
import { Log } from "../../../opencode/src/util/log"
import fs from "fs"
import path from "path"
import { EventEmitter } from "events"

/**
 * Configuration Watcher
 * Monitors configuration files for changes and triggers hot-reload
 */
export class ConfigWatcher extends EventEmitter {
  private log = Log.create({ service: "config-watcher" })
  private watcher?: fs.FSWatcher
  private configPath: string
  private currentConfig: UnifiedConfig
  private isWatching: boolean = false
  private reloadDebounced: () => void

  constructor(configPath: string, initialConfig: UnifiedConfig) {
    super()
    this.configPath = configPath
    this.currentConfig = initialConfig

    // Debounce reload to handle rapid file changes
    this.reloadDebounced = this.createDebouncedReload()
  }

  /**
   * Start watching configuration file
   */
  start(): void {
    if (this.isWatching) {
      this.log.warn("Configuration watcher already running")
      return
    }

    try {
      this.watcher = fs.watch(this.configPath, (eventType, filename) => {
        if (eventType === "change") {
          this.log.info("Configuration file changed", {
            file: filename || this.configPath,
          })
          this.reloadDebounced()
        }
      })

      this.isWatching = true
      this.log.info("Started watching configuration file", {
        path: this.configPath,
      })

      // Also watch parent directory for file replacements
      const dir = path.dirname(this.configPath)
      fs.watch(dir, (_eventType, filename) => {
        if (filename === path.basename(this.configPath)) {
          this.log.info("Configuration file replaced", {
            file: filename,
          })
          this.reloadDebounced()
        }
      })
    } catch (error) {
      this.log.error("Failed to start configuration watcher", {
        error: error instanceof Error ? error.message : "Unknown error",
      })
      throw error
    }
  }

  /**
   * Stop watching configuration file
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = undefined
      this.isWatching = false
      this.log.info("Stopped watching configuration file")
    }
  }

  /**
   * Create debounced reload function
   */
  private createDebouncedReload(): () => void {
    let timeoutId: NodeJS.Timeout | null = null

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(() => {
        this.reload().catch((error) => {
          this.log.error("Failed to reload configuration", {
            error: error instanceof Error ? error.message : "Unknown error",
          })
        })
      }, 500) // Wait 500ms after last change
    }
  }

  /**
   * Reload configuration
   */
  private async reload(): Promise<void> {
    try {
      this.log.info("Reloading configuration")

      // Load new configuration
      const newConfig = await ConfigLoader.load({
        configPath: this.configPath,
        migrate: true,
      })

      // Compare with current configuration
      const changes = this.detectChanges(this.currentConfig, newConfig)

      if (changes.length === 0) {
        this.log.info("No configuration changes detected")
        return
      }

      // Validate new configuration
      const validation = ConfigValidator.validateUnifiedConfig(newConfig)
      if (!validation.valid) {
        this.log.error("Invalid configuration after reload", {
          errors: validation.errors,
        })
        this.emit("error", new Error("Invalid configuration"))
        return
      }

      // Store old config for rollback
      const oldConfig = this.currentConfig
      this.currentConfig = newConfig

      // Emit change events
      for (const change of changes) {
        this.emit("change", change)
      }

      // Emit reload event
      this.emit("reload", {
        oldConfig,
        newConfig,
        changes,
      })

      this.log.info("Configuration reloaded successfully", {
        changeCount: changes.length,
      })
    } catch (error) {
      this.log.error("Failed to reload configuration", {
        error: error instanceof Error ? error.message : "Unknown error",
      })
      this.emit("error", error)
    }
  }

  /**
   * Detect changes between configurations
   */
  private detectChanges(
    oldConfig: any,
    newConfig: any,
    path: string = "",
  ): ConfigChangeEvent[] {
    const changes: ConfigChangeEvent[] = []

    // Check for additions and modifications
    for (const key in newConfig) {
      const newPath = path ? `${path}.${key}` : key
      const oldValue = oldConfig?.[key]
      const newValue = newConfig[key]

      if (oldValue === undefined) {
        // Addition
        changes.push({
          timestamp: new Date().toISOString(),
          type: "create",
          path: newPath,
          newValue,
          source: {
            file: this.configPath,
            environment: false,
            default: false,
            override: false,
            timestamp: new Date().toISOString(),
          },
        })
      } else if (
        typeof newValue === "object" &&
        newValue !== null &&
        !Array.isArray(newValue)
      ) {
        // Recurse into objects
        changes.push(...this.detectChanges(oldValue, newValue, newPath))
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        // Modification
        changes.push({
          timestamp: new Date().toISOString(),
          type: "update",
          path: newPath,
          oldValue,
          newValue,
          source: {
            file: this.configPath,
            environment: false,
            default: false,
            override: false,
            timestamp: new Date().toISOString(),
          },
        })
      }
    }

    // Check for deletions
    for (const key in oldConfig) {
      if (!(key in newConfig)) {
        const deletePath = path ? `${path}.${key}` : key
        changes.push({
          timestamp: new Date().toISOString(),
          type: "delete",
          path: deletePath,
          oldValue: oldConfig[key],
          source: {
            file: this.configPath,
            environment: false,
            default: false,
            override: false,
            timestamp: new Date().toISOString(),
          },
        })
      }
    }

    return changes
  }

  /**
   * Get current configuration
   */
  getCurrentConfig(): UnifiedConfig {
    return this.currentConfig
  }

  /**
   * Force reload configuration
   */
  async forceReload(): Promise<void> {
    await this.reload()
  }
}

/**
 * Configuration watcher events
 */
export interface ConfigWatcherEvents {
  change: (event: ConfigChangeEvent) => void
  reload: (event: ReloadEvent) => void
  error: (error: Error) => void
}

/**
 * Reload event
 */
export interface ReloadEvent {
  oldConfig: UnifiedConfig
  newConfig: UnifiedConfig
  changes: ConfigChangeEvent[]
}

/**
 * Create configuration watcher
 */
export async function createConfigWatcher(
  configPath?: string,
): Promise<ConfigWatcher | null> {
  const log = Log.create({ service: "config-watcher" })

  // Find config file if not provided
  if (!configPath) {
    configPath = (await ConfigLoader.findConfigFile()) || undefined
  }

  if (!configPath) {
    log.warn("No configuration file found to watch")
    return null
  }

  // Load initial configuration
  const config = await ConfigLoader.load({ configPath })

  // Check if hot reload is enabled
  if (!config.features.enableHotReload) {
    log.info("Hot reload is disabled in configuration")
    return null
  }

  // Create and return watcher
  return new ConfigWatcher(configPath, config)
}
