import { type UnifiedConfig } from "../schemas/unified-config.schema"
import { ConfigValidator } from "./config-validator"
import { Log } from "../../../opencode/src/util/log"
import fs from "fs/promises"
import path from "path"

/**
 * Configuration Migration Utilities
 * Handles version upgrades and configuration format changes
 */
export class ConfigMigrator {
  private static log = Log.create({ service: "config-migrator" })

  /**
   * Migration registry mapping versions to migration functions
   */
  private static migrations: Map<string, MigrationFunction> = new Map([
    ["0.1.0", ConfigMigrator.migrateFrom0_1_0],
    ["0.2.0", ConfigMigrator.migrateFrom0_2_0],
    ["0.3.0", ConfigMigrator.migrateFrom0_3_0],
  ])

  /**
   * Migrate configuration to the latest version
   */
  static async migrate(
    config: any,
    targetVersion: string = "1.0.0",
  ): Promise<UnifiedConfig> {
    const currentVersion = config.metadata?.version || "0.1.0"

    if (currentVersion === targetVersion) {
      this.log.info("Configuration is already at target version", {
        version: targetVersion,
      })
      return config as UnifiedConfig
    }

    this.log.info("Starting configuration migration", {
      from: currentVersion,
      to: targetVersion,
    })

    let migratedConfig = { ...config }
    const migrationPath = this.getMigrationPath(currentVersion, targetVersion)

    for (const version of migrationPath) {
      const migrationFn = this.migrations.get(version)
      if (migrationFn) {
        this.log.info(`Applying migration for version ${version}`)
        migratedConfig = await migrationFn(migratedConfig)
      }
    }

    // Update version
    migratedConfig.metadata = {
      ...migratedConfig.metadata,
      version: targetVersion,
      lastModified: new Date().toISOString(),
    }

    // Validate migrated configuration
    const validation = ConfigValidator.validateUnifiedConfig(migratedConfig)
    if (!validation.valid) {
      throw new Error(
        `Migration resulted in invalid configuration: ${JSON.stringify(validation.errors)}`,
      )
    }

    this.log.info("Configuration migration completed successfully")
    return migratedConfig as UnifiedConfig
  }

  /**
   * Get migration path between versions
   */
  private static getMigrationPath(from: string, to: string): string[] {
    const versions = ["0.1.0", "0.2.0", "0.3.0", "1.0.0"]
    const fromIndex = versions.indexOf(from)
    const toIndex = versions.indexOf(to)

    if (fromIndex === -1 || toIndex === -1) {
      throw new Error(`Invalid version range: ${from} -> ${to}`)
    }

    return versions.slice(fromIndex + 1, toIndex + 1)
  }

  /**
   * Migration from 0.1.0 to 0.2.0
   * - Add metadata structure
   * - Add feature flags
   */
  private static async migrateFrom0_1_0(config: any): Promise<any> {
    return {
      ...config,
      metadata: {
        version: "0.2.0",
        lastModified: new Date().toISOString(),
      },
      features: {
        enableDgm: true,
        enableMetrics: true,
        enableHealthChecks: true,
        enableAutoSync: false,
        enableHotReload: false,
        debugMode: false,
      },
    }
  }

  /**
   * Migration from 0.2.0 to 0.3.0
   * - Add sync configuration
   * - Restructure DGM config
   */
  private static async migrateFrom0_2_0(config: any): Promise<any> {
    const dgmConfig = config.dgm || {}

    return {
      ...config,
      metadata: {
        ...config.metadata,
        version: "0.3.0",
      },
      dgm: {
        pythonPath: dgmConfig.pythonPath || "python3",
        dgmPath:
          dgmConfig.dgmPath || "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm",
        timeout: dgmConfig.timeout || 30000,
        maxRetries: dgmConfig.maxRetries || 3,
        retryDelay: dgmConfig.retryDelay || 1000,
        logLevel: dgmConfig.logLevel || "info",
        enableMetrics: dgmConfig.enableMetrics ?? true,
        healthCheckInterval: dgmConfig.healthCheckInterval || 60000,
        autoReconnect: dgmConfig.autoReconnect ?? true,
        reconnectDelay: dgmConfig.reconnectDelay || 5000,
        maxReconnectAttempts: dgmConfig.maxReconnectAttempts || 10,
      },
      sync: {
        interval: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        conflictResolution: "merge",
      },
    }
  }

  /**
   * Migration from 0.3.0 to 1.0.0
   * - Add bridge configuration
   * - Add environment overrides
   */
  private static async migrateFrom0_3_0(config: any): Promise<any> {
    return {
      ...config,
      metadata: {
        ...config.metadata,
        version: "1.0.0",
      },
      dgm: {
        ...config.dgm,
        bridge: {
          host: "0.0.0.0",
          port: 8080,
          logLevel: "INFO",
          logFile: "dgm_bridge.log",
          dgmPath: config.dgm.dgmPath,
          maxIterations: 100,
          mutationRate: 0.1,
          populationSize: 50,
          maxSubprocesses: 10,
          subprocessTimeout: 300,
          enableCors: true,
          corsOrigins: "*",
        },
      },
      environments: {},
    }
  }

  /**
   * Create a backup of the configuration before migration
   */
  static async backupConfig(configPath: string): Promise<string> {
    const backupDir = path.join(path.dirname(configPath), "backups")
    await fs.mkdir(backupDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const backupPath = path.join(backupDir, `config-backup-${timestamp}.json`)

    const content = await fs.readFile(configPath, "utf-8")
    await fs.writeFile(backupPath, content)

    this.log.info("Configuration backed up", { backupPath })
    return backupPath
  }

  /**
   * Migrate configuration file
   */
  static async migrateFile(
    configPath: string,
    targetVersion: string = "1.0.0",
  ): Promise<void> {
    try {
      // Create backup
      await this.backupConfig(configPath)

      // Read current configuration
      const content = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(content)

      // Migrate configuration
      const migratedConfig = await this.migrate(config, targetVersion)

      // Write migrated configuration
      await fs.writeFile(configPath, JSON.stringify(migratedConfig, null, 2))

      this.log.info("Configuration file migrated successfully", {
        path: configPath,
        version: targetVersion,
      })
    } catch (error) {
      this.log.error("Failed to migrate configuration file", {
        path: configPath,
        error: error instanceof Error ? error.message : "Unknown error",
      })
      throw error
    }
  }

  /**
   * Check if migration is needed
   */
  static needsMigration(config: any, targetVersion: string = "1.0.0"): boolean {
    const currentVersion = config.metadata?.version || "0.1.0"
    return currentVersion !== targetVersion
  }

  /**
   * Get migration info
   */
  static getMigrationInfo(
    config: any,
    targetVersion: string = "1.0.0",
  ): MigrationInfo {
    const currentVersion = config.metadata?.version || "0.1.0"
    const migrationPath = this.getMigrationPath(currentVersion, targetVersion)

    return {
      currentVersion,
      targetVersion,
      migrationPath,
      stepsRequired: migrationPath.length,
      isRequired: currentVersion !== targetVersion,
    }
  }
}

/**
 * Migration function type
 */
type MigrationFunction = (config: any) => Promise<any>

/**
 * Migration info type
 */
export interface MigrationInfo {
  currentVersion: string
  targetVersion: string
  migrationPath: string[]
  stepsRequired: number
  isRequired: boolean
}
