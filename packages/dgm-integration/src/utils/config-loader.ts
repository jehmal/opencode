import {
  type UnifiedConfig,
  createDefaultConfig,
} from "../schemas/unified-config.schema"
import { ConfigValidator } from "./config-validator"
import { ConfigMigrator } from "./config-migrator"
import { Log } from "../../../opencode/src/util/log"
import fs from "fs/promises"
import path from "path"
import { mergeDeep } from "remeda"

/**
 * Configuration Loader
 * Handles loading configuration from files and environment variables
 */
export class ConfigLoader {
  private static log = Log.create({ service: "config-loader" })

  /**
   * Load configuration from all sources
   */
  static async load(options: LoadOptions = {}): Promise<UnifiedConfig> {
    const {
      configPath,
      environment = process.env.NODE_ENV || "development",
      includeEnv = true,
      migrate = true,
    } = options

    this.log.info("Loading configuration", { environment, configPath })

    // Start with default configuration
    let config = createDefaultConfig()

    // Load from file if path provided
    if (configPath) {
      const fileConfig = await this.loadFromFile(configPath)
      if (fileConfig) {
        config = mergeDeep(config, fileConfig) as UnifiedConfig
      }
    }

    // Load environment-specific overrides
    if (config.environments && config.environments[environment]) {
      this.log.info(`Applying environment overrides for ${environment}`)
      const envOverrides = config.environments[environment]

      if (envOverrides.dgm) {
        config.dgm = mergeDeep(config.dgm, envOverrides.dgm) as any
      }

      if (envOverrides.features) {
        config.features = { ...config.features, ...envOverrides.features }
      }
    }

    // Apply environment variables
    if (includeEnv) {
      const envConfig = this.loadFromEnvironment()
      config = mergeDeep(config, envConfig) as UnifiedConfig
    }

    // Migrate if needed
    if (migrate && ConfigMigrator.needsMigration(config)) {
      config = await ConfigMigrator.migrate(config)
    }

    // Validate final configuration
    const validation = ConfigValidator.validateUnifiedConfig(config)
    if (!validation.valid) {
      throw new Error(
        `Invalid configuration: ${JSON.stringify(validation.errors)}`,
      )
    }

    // Deep validate
    const deepValidation = ConfigValidator.deepValidate(config)
    if (deepValidation.warnings) {
      deepValidation.warnings.forEach((warning) => {
        this.log.warn(`Configuration warning: ${warning.message}`, {
          path: warning.path,
        })
      })
    }

    this.log.info("Configuration loaded successfully")
    return config
  }

  /**
   * Load configuration from file
   */
  private static async loadFromFile(
    filePath: string,
  ): Promise<Partial<UnifiedConfig> | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8")
      const data = JSON.parse(content)
      this.log.info("Loaded configuration from file", { path: filePath })
      return data
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        this.log.warn("Configuration file not found", { path: filePath })
        return null
      }
      throw error
    }
  }

  /**
   * Load configuration from environment variables
   */
  private static loadFromEnvironment(): Partial<UnifiedConfig> {
    const env = process.env
    const config: any = {}

    // DGM configuration from environment
    if (env["DGM_ENABLED"] !== undefined) {
      config.features = config.features || {}
      config.features.enableDgm = env["DGM_ENABLED"] === "true"
    }

    if (env["DGM_PYTHON_PATH"]) {
      config.dgm = config.dgm || {}
      config.dgm.pythonPath = env["DGM_PYTHON_PATH"]
    }

    if (env["DGM_PATH"]) {
      config.dgm = config.dgm || {}
      config.dgm.dgmPath = env["DGM_PATH"]
    }

    if (env["DGM_TIMEOUT"]) {
      config.dgm = config.dgm || {}
      config.dgm.timeout = parseInt(env["DGM_TIMEOUT"], 10)
    }

    if (env["DGM_MAX_RETRIES"]) {
      config.dgm = config.dgm || {}
      config.dgm.maxRetries = parseInt(env["DGM_MAX_RETRIES"], 10)
    }

    if (env["DGM_LOG_LEVEL"]) {
      config.dgm = config.dgm || {}
      config.dgm.logLevel = env["DGM_LOG_LEVEL"].toLowerCase() as any
    }

    // Bridge configuration from environment
    if (env["BRIDGE_HOST"]) {
      config.dgm = config.dgm || {}
      config.dgm.bridge = config.dgm.bridge || {}
      config.dgm.bridge.host = env["BRIDGE_HOST"]
    }

    if (env["BRIDGE_PORT"]) {
      config.dgm = config.dgm || {}
      config.dgm.bridge = config.dgm.bridge || {}
      config.dgm.bridge.port = parseInt(env["BRIDGE_PORT"], 10)
    }

    if (env["BRIDGE_LOG_LEVEL"]) {
      config.dgm = config.dgm || {}
      config.dgm.bridge = config.dgm.bridge || {}
      config.dgm.bridge.logLevel = env["BRIDGE_LOG_LEVEL"]
    }

    if (env["DGM_MAX_ITERATIONS"]) {
      config.dgm = config.dgm || {}
      config.dgm.bridge = config.dgm.bridge || {}
      config.dgm.bridge.maxIterations = parseInt(env["DGM_MAX_ITERATIONS"], 10)
    }

    if (env["DGM_MUTATION_RATE"]) {
      config.dgm = config.dgm || {}
      config.dgm.bridge = config.dgm.bridge || {}
      config.dgm.bridge.mutationRate = parseFloat(env["DGM_MUTATION_RATE"])
    }

    if (env["DGM_POPULATION_SIZE"]) {
      config.dgm = config.dgm || {}
      config.dgm.bridge = config.dgm.bridge || {}
      config.dgm.bridge.populationSize = parseInt(
        env["DGM_POPULATION_SIZE"],
        10,
      )
    }

    // Feature flags from environment
    if (env["ENABLE_METRICS"] !== undefined) {
      config.features = config.features || {}
      config.features.enableMetrics = env["ENABLE_METRICS"] === "true"
    }

    if (env["ENABLE_HEALTH_CHECKS"] !== undefined) {
      config.features = config.features || {}
      config.features.enableHealthChecks =
        env["ENABLE_HEALTH_CHECKS"] === "true"
    }

    if (env["ENABLE_AUTO_SYNC"] !== undefined) {
      config.features = config.features || {}
      config.features.enableAutoSync = env["ENABLE_AUTO_SYNC"] === "true"
    }

    if (env["ENABLE_HOT_RELOAD"] !== undefined) {
      config.features = config.features || {}
      config.features.enableHotReload = env["ENABLE_HOT_RELOAD"] === "true"
    }

    if (env["DEBUG_MODE"] !== undefined) {
      config.features = config.features || {}
      config.features.debugMode = env["DEBUG_MODE"] === "true"
    }

    // Sync configuration from environment
    if (env["SYNC_INTERVAL"]) {
      config.sync = config.sync || {}
      config.sync.interval = parseInt(env["SYNC_INTERVAL"], 10)
    }

    if (env["SYNC_RETRY_ATTEMPTS"]) {
      config.sync = config.sync || {}
      config.sync.retryAttempts = parseInt(env["SYNC_RETRY_ATTEMPTS"], 10)
    }

    if (env["SYNC_CONFLICT_RESOLUTION"]) {
      config.sync = config.sync || {}
      config.sync.conflictResolution = env["SYNC_CONFLICT_RESOLUTION"] as any
    }

    if (Object.keys(config).length > 0) {
      this.log.info("Loaded configuration from environment variables", {
        keys: Object.keys(config),
      })
    }

    return config
  }

  /**
   * Find configuration file
   */
  static async findConfigFile(
    startPath: string = process.cwd(),
  ): Promise<string | null> {
    const configNames = ["dgmo-dgm.json", "dgmo.json", "config.json"]

    let currentPath = startPath
    while (currentPath !== path.dirname(currentPath)) {
      for (const configName of configNames) {
        const configPath = path.join(currentPath, configName)
        try {
          await fs.access(configPath)
          this.log.info("Found configuration file", { path: configPath })
          return configPath
        } catch {
          // Continue searching
        }
      }
      currentPath = path.dirname(currentPath)
    }

    return null
  }

  /**
   * Save configuration to file
   */
  static async save(config: UnifiedConfig, filePath: string): Promise<void> {
    // Update metadata
    config.metadata.lastModified = new Date().toISOString()

    // Validate before saving
    const validation = ConfigValidator.validateUnifiedConfig(config)
    if (!validation.valid) {
      throw new Error(
        `Cannot save invalid configuration: ${JSON.stringify(validation.errors)}`,
      )
    }

    // Create directory if needed
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // Write configuration
    await fs.writeFile(filePath, JSON.stringify(config, null, 2))

    this.log.info("Configuration saved", { path: filePath })
  }

  /**
   * Create environment template
   */
  static generateEnvTemplate(): string {
    return `# DGMO-DGM Configuration Environment Variables

# DGM Configuration
DGM_ENABLED=true
DGM_PYTHON_PATH=python3
DGM_PATH=/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm
DGM_TIMEOUT=30000
DGM_MAX_RETRIES=3
DGM_LOG_LEVEL=info

# Bridge Configuration
BRIDGE_HOST=0.0.0.0
BRIDGE_PORT=8080
BRIDGE_LOG_LEVEL=INFO
DGM_MAX_ITERATIONS=100
DGM_MUTATION_RATE=0.1
DGM_POPULATION_SIZE=50

# Feature Flags
ENABLE_METRICS=true
ENABLE_HEALTH_CHECKS=true
ENABLE_AUTO_SYNC=true
ENABLE_HOT_RELOAD=true
DEBUG_MODE=false

# Sync Configuration
SYNC_INTERVAL=30000
SYNC_RETRY_ATTEMPTS=3
SYNC_CONFLICT_RESOLUTION=merge
`
  }
}

/**
 * Configuration load options
 */
export interface LoadOptions {
  configPath?: string
  environment?: string
  includeEnv?: boolean
  migrate?: boolean
}
