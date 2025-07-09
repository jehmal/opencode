import { ZodError, type ZodSchema } from "zod"
import {
  type UnifiedConfig,
  UnifiedConfigSchema,
  type ConfigValidationResult,
  type ExtendedDgmConfig,
  ExtendedDgmConfigSchema,
  BridgeConfigSchema,
} from "../schemas/unified-config.schema"

import { Log } from "../../../opencode/src/util/log"
import path from "path"
import fs from "fs/promises"

/**
 * Configuration Validator
 * Provides comprehensive validation for configuration objects
 */
export class ConfigValidator {
  private static log = Log.create({ service: "config-validator" })

  /**
   * Validate a unified configuration
   */
  static validateUnifiedConfig(config: unknown): ConfigValidationResult {
    return this.validate(config, UnifiedConfigSchema, "UnifiedConfig")
  }

  /**
   * Validate DGM configuration
   */
  static validateDgmConfig(config: unknown): ConfigValidationResult {
    return this.validate(config, ExtendedDgmConfigSchema, "DgmConfig")
  }

  /**
   * Validate Bridge configuration
   */
  static validateBridgeConfig(config: unknown): ConfigValidationResult {
    return this.validate(config, BridgeConfigSchema, "BridgeConfig")
  }

  /**
   * Generic validation method
   */
  private static validate<T>(
    data: unknown,
    schema: ZodSchema<T>,
    configType: string,
  ): ConfigValidationResult {
    try {
      schema.parse(data)
      return {
        valid: true,
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
          code: err.code,
        }))

        this.log.error(`${configType} validation failed`, { errors })

        return {
          valid: false,
          errors,
        }
      }

      // Unexpected error
      return {
        valid: false,
        errors: [
          {
            path: "",
            message:
              error instanceof Error
                ? error.message
                : "Unknown validation error",
            code: "UNKNOWN_ERROR",
          },
        ],
      }
    }
  }

  /**
   * Validate configuration file
   */
  static async validateConfigFile(
    filePath: string,
  ): Promise<ConfigValidationResult> {
    try {
      const content = await fs.readFile(filePath, "utf-8")
      const data = JSON.parse(content)
      return this.validateUnifiedConfig(data)
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            path: "",
            message: `Failed to read or parse config file: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "FILE_ERROR",
          },
        ],
      }
    }
  }

  /**
   * Validate partial configuration (for updates)
   */
  static validatePartialConfig(
    partial: unknown,
    schema: ZodSchema,
  ): ConfigValidationResult {
    try {
      // For partial validation, we'll validate against the full schema
      // but only check the fields that are present
      schema.parse(partial)
      return { valid: true }
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          errors: error.errors.map((err) => ({
            path: err.path.join("."),
            message: err.message,
            code: err.code,
          })),
        }
      }
      return {
        valid: false,
        errors: [
          {
            path: "",
            message: "Unknown validation error",
            code: "UNKNOWN_ERROR",
          },
        ],
      }
    }
  }

  /**
   * Check compatibility between DGMO and DGM configs
   */
  static checkCompatibility(
    dgmoConfig: any,
    dgmConfig: ExtendedDgmConfig,
  ): ConfigValidationResult {
    const warnings: Array<{ path: string; message: string }> = []

    // Check Python path compatibility
    if (dgmoConfig.dgm?.pythonPath && dgmConfig.pythonPath) {
      if (dgmoConfig.dgm.pythonPath !== dgmConfig.pythonPath) {
        warnings.push({
          path: "pythonPath",
          message: `Python path mismatch: DGMO uses '${dgmoConfig.dgm.pythonPath}', DGM uses '${dgmConfig.pythonPath}'`,
        })
      }
    }

    // Check timeout compatibility
    if (dgmoConfig.dgm?.timeout && dgmConfig.timeout) {
      if (Math.abs(dgmoConfig.dgm.timeout - dgmConfig.timeout) > 1000) {
        warnings.push({
          path: "timeout",
          message: `Significant timeout difference: DGMO ${dgmoConfig.dgm.timeout}ms, DGM ${dgmConfig.timeout}ms`,
        })
      }
    }

    // Check log level compatibility
    if (dgmoConfig.dgm?.logLevel && dgmConfig.logLevel) {
      const dgmoLevel = dgmoConfig.dgm.logLevel.toLowerCase()
      const dgmLevel = dgmConfig.logLevel.toLowerCase()
      if (dgmoLevel !== dgmLevel) {
        warnings.push({
          path: "logLevel",
          message: `Log level mismatch: DGMO '${dgmoLevel}', DGM '${dgmLevel}'`,
        })
      }
    }

    return {
      valid: warnings.length === 0,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  /**
   * Validate environment variables
   */
  static validateEnvironmentConfig(): ConfigValidationResult {
    const errors: Array<{ path: string; message: string }> = []
    const warnings: Array<{ path: string; message: string }> = []

    // Check for required environment variables
    const requiredVars = [
      { name: "DGM_PATH", default: "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm" },
      { name: "BRIDGE_PORT", default: "8080" },
    ]

    for (const { name, default: defaultValue } of requiredVars) {
      if (!process.env[name]) {
        warnings.push({
          path: `env.${name}`,
          message: `Environment variable ${name} not set, using default: ${defaultValue}`,
        })
      }
    }

    // Validate numeric environment variables
    const numericVars = [
      { name: "BRIDGE_PORT", min: 1, max: 65535 },
      { name: "DGM_MAX_ITERATIONS", min: 1, max: 10000 },
      { name: "DGM_POPULATION_SIZE", min: 1, max: 1000 },
      { name: "SUBPROCESS_TIMEOUT", min: 1, max: 3600 },
    ]

    for (const { name, min, max } of numericVars) {
      const value = process.env[name]
      if (value) {
        const num = parseInt(value, 10)
        if (isNaN(num) || num < min || num > max) {
          errors.push({
            path: `env.${name}`,
            message: `Invalid value for ${name}: must be a number between ${min} and ${max}`,
          })
        }
      }
    }

    // Validate float environment variables
    const floatVars = [{ name: "DGM_MUTATION_RATE", min: 0, max: 1 }]

    for (const { name, min, max } of floatVars) {
      const value = process.env[name]
      if (value) {
        const num = parseFloat(value)
        if (isNaN(num) || num < min || num > max) {
          errors.push({
            path: `env.${name}`,
            message: `Invalid value for ${name}: must be a number between ${min} and ${max}`,
          })
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  /**
   * Deep validate nested configuration
   */
  static deepValidate(config: UnifiedConfig): ConfigValidationResult {
    const errors: Array<{ path: string; message: string; code?: string }> = []
    const warnings: Array<{ path: string; message: string; code?: string }> = []

    // Validate file paths exist
    if (config.dgm.dgmPath) {
      const dgmPath = path.resolve(config.dgm.dgmPath)
      fs.access(dgmPath).catch(() => {
        warnings.push({
          path: "dgm.dgmPath",
          message: `DGM path does not exist: ${dgmPath}`,
          code: "PATH_NOT_FOUND",
        })
      })
    }

    // Validate Python executable
    if (config.dgm.pythonPath) {
      // This would need actual execution check in production
      warnings.push({
        path: "dgm.pythonPath",
        message: `Python path should be verified: ${config.dgm.pythonPath}`,
        code: "PYTHON_NOT_VERIFIED",
      })
    }

    // Validate port availability
    if (config.dgm.bridge?.port) {
      const port = config.dgm.bridge.port
      if (port < 1024) {
        warnings.push({
          path: "dgm.bridge.port",
          message: `Port ${port} requires elevated privileges`,
          code: "PRIVILEGED_PORT",
        })
      }
    }

    // Validate feature consistency
    if (!config.features.enableDgm && config.features.enableAutoSync) {
      errors.push({
        path: "features",
        message: "Cannot enable auto-sync when DGM is disabled",
        code: "FEATURE_CONFLICT",
      })
    }

    // Validate sync settings
    if (config.sync.retryDelay > config.sync.interval) {
      warnings.push({
        path: "sync",
        message: "Retry delay is longer than sync interval",
        code: "TIMING_ISSUE",
      })
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }
}
