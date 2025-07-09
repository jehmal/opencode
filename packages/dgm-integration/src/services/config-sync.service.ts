import {
  type UnifiedConfig,
  type ConfigChangeEvent,
} from "../schemas/unified-config.schema"
import { ConfigLoader } from "../utils/config-loader"

import { ConfigWatcher, createConfigWatcher } from "../utils/config-watcher"
import { Log } from "../../../opencode/src/util/log"
import { EventEmitter } from "events"
import path from "path"
import fs from "fs/promises"

/**
 * Configuration Synchronization Service
 * Manages configuration synchronization between DGMO and DGM systems
 */
export class ConfigSyncService extends EventEmitter {
  private log = Log.create({ service: "config-sync" })
  private config: UnifiedConfig
  private watcher?: ConfigWatcher
  private syncInterval?: NodeJS.Timeout
  private isRunning: boolean = false
  private configPath: string
  private pythonConfigPath?: string

  constructor(config: UnifiedConfig, configPath: string) {
    super()
    this.config = config
    this.configPath = configPath
  }

  /**
   * Start the synchronization service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.log.warn("Configuration sync service already running")
      return
    }

    this.log.info("Starting configuration sync service")
    this.isRunning = true

    // Set up Python config path
    this.pythonConfigPath = path.join(
      path.dirname(this.configPath),
      "dgm-config.json",
    )

    // Initial sync
    await this.syncToPython()

    // Set up file watcher if hot reload is enabled
    if (this.config.features.enableHotReload) {
      const watcher = await createConfigWatcher(this.configPath)
      if (watcher) {
        this.watcher = watcher
        this.watcher.on("change", this.handleConfigChange.bind(this))
        this.watcher.on("reload", this.handleConfigReload.bind(this))
        this.watcher.on("error", this.handleWatcherError.bind(this))
        this.watcher.start()
      }
    }

    // Set up periodic sync if auto-sync is enabled
    if (this.config.features.enableAutoSync) {
      this.syncInterval = setInterval(
        () => this.performSync(),
        this.config.sync.interval,
      )
    }

    this.log.info("Configuration sync service started", {
      hotReload: this.config.features.enableHotReload,
      autoSync: this.config.features.enableAutoSync,
      syncInterval: this.config.sync.interval,
    })
  }

  /**
   * Stop the synchronization service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.log.info("Stopping configuration sync service")
    this.isRunning = false

    // Stop watcher
    if (this.watcher) {
      this.watcher.stop()
      this.watcher = undefined
    }

    // Clear sync interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = undefined
    }

    this.log.info("Configuration sync service stopped")
  }

  /**
   * Perform synchronization
   */
  private async performSync(): Promise<void> {
    try {
      this.log.info("Performing configuration sync")

      // Sync to Python config
      await this.syncToPython()

      // Check for conflicts
      const conflicts = await this.detectConflicts()
      if (conflicts.length > 0) {
        await this.resolveConflicts(conflicts)
      }

      this.emit("sync", {
        timestamp: new Date().toISOString(),
        success: true,
      })

      this.log.info("Configuration sync completed successfully")
    } catch (error) {
      this.log.error("Configuration sync failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      })

      this.emit("sync", {
        timestamp: new Date().toISOString(),
        success: false,
        error,
      })

      // Retry if configured
      if (this.config.sync.retryAttempts > 0) {
        this.scheduleRetry()
      }
    }
  }

  /**
   * Sync configuration to Python format
   */
  private async syncToPython(): Promise<void> {
    if (!this.pythonConfigPath) {
      return
    }

    // Convert to Python-compatible format
    const pythonConfig = this.convertToPythonFormat(this.config)

    // Write Python config
    await fs.writeFile(
      this.pythonConfigPath,
      JSON.stringify(pythonConfig, null, 2),
    )

    this.log.info("Synced configuration to Python format", {
      path: this.pythonConfigPath,
    })
  }

  /**
   * Convert configuration to Python format
   */
  private convertToPythonFormat(config: UnifiedConfig): any {
    const bridge = config.dgm.bridge

    return {
      // Bridge configuration
      bridge: bridge
        ? {
            host: bridge.host,
            port: bridge.port,
            log_level: bridge.logLevel,
            log_file: bridge.logFile,
            dgm_path: bridge.dgmPath,
            max_iterations: bridge.maxIterations,
            mutation_rate: bridge.mutationRate,
            population_size: bridge.populationSize,
            max_subprocesses: bridge.maxSubprocesses,
            subprocess_timeout: bridge.subprocessTimeout,
            enable_cors: bridge.enableCors,
            cors_origins: bridge.corsOrigins,
          }
        : {},
      // DGM configuration
      dgm: {
        python_path: config.dgm.pythonPath,
        dgm_path: config.dgm.dgmPath,
        timeout: config.dgm.timeout,
        max_retries: config.dgm.maxRetries,
        retry_delay: config.dgm.retryDelay,
        log_level: config.dgm.logLevel,
        enable_metrics: config.dgm.enableMetrics,
        health_check_interval: config.dgm.healthCheckInterval,
        auto_reconnect: config.dgm.autoReconnect,
        reconnect_delay: config.dgm.reconnectDelay,
        max_reconnect_attempts: config.dgm.maxReconnectAttempts,
      },

      // Features
      features: {
        enable_dgm: config.features.enableDgm,
        enable_metrics: config.features.enableMetrics,
        enable_health_checks: config.features.enableHealthChecks,
        enable_auto_sync: config.features.enableAutoSync,
        enable_hot_reload: config.features.enableHotReload,
        debug_mode: config.features.debugMode,
      },

      // Metadata
      metadata: {
        version: config.metadata.version,
        last_modified: config.metadata.lastModified,
        synced_at: new Date().toISOString(),
      },
    }
  }

  /**
   * Detect configuration conflicts
   */
  private async detectConflicts(): Promise<ConfigConflict[]> {
    const conflicts: ConfigConflict[] = []

    // Check if Python config exists
    if (!this.pythonConfigPath) {
      return conflicts
    }

    try {
      const pythonContent = await fs.readFile(this.pythonConfigPath, "utf-8")
      const pythonConfig = JSON.parse(pythonContent)

      // Check for version mismatch
      if (pythonConfig.metadata?.version !== this.config.metadata.version) {
        conflicts.push({
          type: "version",
          path: "metadata.version",
          localValue: this.config.metadata.version,
          remoteValue: pythonConfig.metadata?.version,
        })
      }

      // Check for modification time conflicts
      const localTime = new Date(this.config.metadata.lastModified).getTime()
      const remoteTime = new Date(
        pythonConfig.metadata?.last_modified || 0,
      ).getTime()

      if (remoteTime > localTime) {
        conflicts.push({
          type: "timestamp",
          path: "metadata.lastModified",
          localValue: this.config.metadata.lastModified,
          remoteValue: pythonConfig.metadata?.last_modified,
        })
      }
    } catch (error) {
      // No Python config file yet
      this.log.info("No existing Python config found")
    }

    return conflicts
  }

  /**
   * Resolve configuration conflicts
   */
  private async resolveConflicts(conflicts: ConfigConflict[]): Promise<void> {
    this.log.warn("Configuration conflicts detected", {
      count: conflicts.length,
    })

    for (const conflict of conflicts) {
      switch (this.config.sync.conflictResolution) {
        case "local":
          // Keep local version
          this.log.info(`Keeping local value for ${conflict.path}`)
          break

        case "remote":
          // Use remote version - would need to reload config
          this.log.info(`Would use remote value for ${conflict.path}`)
          break

        case "merge":
          // Attempt to merge - for now just keep local
          this.log.info(`Merging conflict for ${conflict.path}`)
          break

        case "manual":
          // Emit event for manual resolution
          this.emit("conflict", conflict)
          break
      }
    }
  }

  /**
   * Handle configuration change
   */
  private handleConfigChange(event: ConfigChangeEvent): void {
    this.log.info("Configuration changed", {
      path: event.path,
      type: event.type,
    })

    // Update internal config reference
    if (this.watcher) {
      this.config = this.watcher.getCurrentConfig()
    }

    // Trigger sync
    this.performSync()
  }

  /**
   * Handle configuration reload
   */
  private handleConfigReload(event: any): void {
    this.log.info("Configuration reloaded", {
      changeCount: event.changes.length,
    })

    // Update internal config
    this.config = event.newConfig

    // Emit reload event
    this.emit("reload", event)
  }

  /**
   * Handle watcher error
   */
  private handleWatcherError(error: Error): void {
    this.log.error("Configuration watcher error", {
      error: error.message,
    })

    this.emit("error", error)
  }

  /**
   * Schedule retry
   */
  private scheduleRetry(): void {
    setTimeout(() => this.performSync(), this.config.sync.retryDelay)
  }

  /**
   * Get current configuration
   */
  getCurrentConfig(): UnifiedConfig {
    return this.config
  }

  /**
   * Force synchronization
   */
  async forceSync(): Promise<void> {
    await this.performSync()
  }
}

/**
 * Configuration conflict
 */
export interface ConfigConflict {
  type: "version" | "timestamp" | "value"
  path: string
  localValue: any
  remoteValue: any
}

/**
 * Create configuration sync service
 */
export async function createConfigSyncService(
  configPath?: string,
): Promise<ConfigSyncService | null> {
  // Find config file if not provided
  if (!configPath) {
    configPath = (await ConfigLoader.findConfigFile()) || undefined
  }

  if (!configPath) {
    return null
  }

  // Load configuration
  const config = await ConfigLoader.load({ configPath })

  // Check if DGM is enabled
  if (!config.features.enableDgm) {
    return null
  }

  // Create and return service
  return new ConfigSyncService(config, configPath)
}
