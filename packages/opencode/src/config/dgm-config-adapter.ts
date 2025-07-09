/**
 * DGM Configuration Adapter
 * Handles synchronization between DGMO config format and shared DGM config
 */

import { Config } from "./config"
import {
  ConfigSyncService,
  ConfigChangeEvent,
} from "../../../../shared/config/sync-service"
import { DGMConfig } from "../../../../shared/config/schema"
import { Log } from "../util/log"
import * as path from "path"

export class DGMConfigAdapter {
  private static instance: DGMConfigAdapter | null = null
  private syncService: ConfigSyncService
  private log = Log.create({ service: "dgm-config-adapter" })
  private initialized = false

  private constructor() {
    const configPath = path.join(process.cwd(), ".dgmo", "dgm-config.json")
    this.syncService = new ConfigSyncService(configPath)
  }

  static getInstance(): DGMConfigAdapter {
    if (!this.instance) {
      this.instance = new DGMConfigAdapter()
    }
    return this.instance
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      await this.syncService.initialize()

      // Listen for config changes
      this.syncService.on("change", this.handleConfigChange.bind(this))

      // Sync initial config from DGMO
      await this.syncFromDGMO()

      this.initialized = true
      this.log.info("DGM config adapter initialized")
    } catch (error) {
      this.log.error("Failed to initialize DGM config adapter", error)
      throw error
    }
  }

  /**
   * Sync configuration from DGMO format to shared format
   */
  private async syncFromDGMO(): Promise<void> {
    try {
      const dgmoConfig = await Config.get()

      if (!dgmoConfig.dgm) {
        this.log.debug("No DGM config in DGMO config")
        return
      }

      // Map DGMO config to shared DGM config format
      const dgmConfig: Partial<DGMConfig> = {
        enabled: dgmoConfig.dgm.enabled ?? false,
        pythonPath: dgmoConfig.dgm.pythonPath,
        dgmPath: dgmoConfig.dgm.dgmPath,
        evolutionSettings: dgmoConfig.dgm.evolutionSettings || {
          autoApprove: false,
          maxConcurrentEvolutions: 5,
          performanceThreshold: 0.8,
        },
        communication: dgmoConfig.dgm.communication || {
          timeout: dgmoConfig.dgm.timeout ?? 30000,
          retryAttempts: dgmoConfig.dgm.maxRetries ?? 3,
          healthCheckInterval: dgmoConfig.dgm.healthCheckInterval ?? 60000,
        },
      }

      // Handle legacy fields for backward compatibility
      if (
        !dgmoConfig.dgm.communication &&
        (dgmoConfig.dgm.timeout ||
          dgmoConfig.dgm.maxRetries ||
          dgmoConfig.dgm.healthCheckInterval)
      ) {
        dgmConfig.communication = {
          timeout: dgmoConfig.dgm.timeout ?? 30000,
          retryAttempts: dgmoConfig.dgm.maxRetries ?? 3,
          healthCheckInterval: dgmoConfig.dgm.healthCheckInterval ?? 60000,
        }
      }

      await this.syncService.updateConfig(dgmConfig, "api")
      this.log.debug("Synced config from DGMO to shared format")
    } catch (error) {
      this.log.error("Failed to sync from DGMO config", error)
    }
  }

  /**
   * Handle configuration changes from the sync service
   */
  private handleConfigChange(event: ConfigChangeEvent): void {
    if (event.type === "validation_error") {
      this.log.error("Config validation errors", event.errors)
      return
    }

    if (event.source === "file" && event.config) {
      // Config changed externally, update DGMO config
      this.updateDGMOConfig(event.config)
    }
  }

  /**
   * Update DGMO config when shared config changes
   */
  private async updateDGMOConfig(dgmConfig: DGMConfig): Promise<void> {
    try {
      const currentConfig = await Config.get()

      // Map shared config back to DGMO format
      const updatedDgm = {
        ...currentConfig.dgm,
        enabled: dgmConfig.enabled,
        pythonPath: dgmConfig.pythonPath,
        dgmPath: dgmConfig.dgmPath,
        evolutionSettings: dgmConfig.evolutionSettings,
        communication: dgmConfig.communication,
        // Keep legacy fields updated for backward compatibility
        timeout: dgmConfig.communication.timeout,
        maxRetries: dgmConfig.communication.retryAttempts,
        healthCheckInterval: dgmConfig.communication.healthCheckInterval,
      }

      // Note: This would require adding an update method to Config
      // For now, we'll just log the change
      this.log.info("DGM config changed externally", updatedDgm)
    } catch (error) {
      this.log.error("Failed to update DGMO config", error)
    }
  }

  /**
   * Get current DGM configuration
   */
  getConfig(): DGMConfig {
    return this.syncService.getConfig()
  }

  /**
   * Update DGM configuration
   */
  async updateConfig(updates: Partial<DGMConfig>): Promise<void> {
    await this.syncService.updateConfig(updates, "api")
  }

  /**
   * Export configuration for Python
   */
  exportForPython(): string {
    return this.syncService.exportForPython()
  }

  /**
   * Stop the adapter and cleanup
   */
  async stop(): Promise<void> {
    await this.syncService.stop()
    this.initialized = false
  }
}
