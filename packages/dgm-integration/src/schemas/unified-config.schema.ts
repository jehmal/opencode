import { z } from "zod"
import { DgmConfigSchema } from "./dgm.schema"

/**
 * Unified Configuration Schema for DGMO-DGM Integration
 * This schema merges configurations from both DGMO and DGM systems
 * to provide a single source of truth for configuration management.
 */

/**
 * Bridge Configuration Schema
 * Maps to Python BridgeConfig for seamless integration
 */
export const BridgeConfigSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.number().positive().default(8080),
  logLevel: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("INFO"),
  logFile: z.string().default("dgm_bridge.log"),
  dgmPath: z.string().default("/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm"),
  maxIterations: z.number().positive().default(100),
  mutationRate: z.number().min(0).max(1).default(0.1),
  populationSize: z.number().positive().default(50),
  maxSubprocesses: z.number().positive().default(10),
  subprocessTimeout: z.number().positive().default(300),
  enableCors: z.boolean().default(true),
  corsOrigins: z.string().default("*"),
})

/**
 * Extended DGM Configuration with additional fields
 */
export const ExtendedDgmConfigSchema = DgmConfigSchema.extend({
  bridge: BridgeConfigSchema.optional(),
  healthCheckInterval: z.number().positive().default(60000),
  autoReconnect: z.boolean().default(true),
  reconnectDelay: z.number().positive().default(5000),
  maxReconnectAttempts: z.number().positive().default(10),
})

/**
 * Configuration Source Schema
 * Tracks where configuration values come from
 */
export const ConfigSourceSchema = z.object({
  file: z.string().optional(),
  environment: z.boolean().default(false),
  default: z.boolean().default(false),
  override: z.boolean().default(false),
  timestamp: z.string().datetime(),
})

/**
 * Configuration Metadata Schema
 * Provides metadata about the configuration
 */
export const ConfigMetadataSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  lastModified: z.string().datetime(),
  sources: z.array(ConfigSourceSchema).optional(),
  checksum: z.string().optional(),
})

/**
 * Unified Configuration Schema
 * Combines all configuration aspects into a single schema
 */
export const UnifiedConfigSchema = z.object({
  // Metadata
  metadata: ConfigMetadataSchema,

  // DGM Configuration (extended)
  dgm: ExtendedDgmConfigSchema,

  // Environment-specific overrides
  environments: z
    .record(
      z.string(),
      z.object({
        dgm: ExtendedDgmConfigSchema.partial().optional(),
        features: z.record(z.string(), z.boolean()).optional(),
      }),
    )
    .optional(),

  // Feature flags
  features: z
    .object({
      enableDgm: z.boolean().default(true),
      enableMetrics: z.boolean().default(true),
      enableHealthChecks: z.boolean().default(true),
      enableAutoSync: z.boolean().default(true),
      enableHotReload: z.boolean().default(true),
      debugMode: z.boolean().default(false),
    })
    .default({}),

  // Synchronization settings
  sync: z
    .object({
      interval: z.number().positive().default(30000), // 30 seconds
      retryAttempts: z.number().positive().default(3),
      retryDelay: z.number().positive().default(1000),
      conflictResolution: z
        .enum(["local", "remote", "merge", "manual"])
        .default("merge"),
    })
    .default({}),
})

/**
 * Configuration Change Event Schema
 */
export const ConfigChangeEventSchema = z.object({
  timestamp: z.string().datetime(),
  type: z.enum(["create", "update", "delete", "sync"]),
  path: z.string(),
  oldValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  source: ConfigSourceSchema,
})

/**
 * Configuration Validation Result Schema
 */
export const ConfigValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z
    .array(
      z.object({
        path: z.string(),
        message: z.string(),
        code: z.string().optional(),
      }),
    )
    .optional(),
  warnings: z
    .array(
      z.object({
        path: z.string(),
        message: z.string(),
        code: z.string().optional(),
      }),
    )
    .optional(),
})

// Type exports
export type BridgeConfig = z.infer<typeof BridgeConfigSchema>
export type ExtendedDgmConfig = z.infer<typeof ExtendedDgmConfigSchema>
export type ConfigSource = z.infer<typeof ConfigSourceSchema>
export type ConfigMetadata = z.infer<typeof ConfigMetadataSchema>
export type UnifiedConfig = z.infer<typeof UnifiedConfigSchema>
export type ConfigChangeEvent = z.infer<typeof ConfigChangeEventSchema>
export type ConfigValidationResult = z.infer<
  typeof ConfigValidationResultSchema
>

/**
 * Default configuration factory
 */
export function createDefaultConfig(): UnifiedConfig {
  return {
    metadata: {
      version: "1.0.0",
      lastModified: new Date().toISOString(),
      sources: [
        {
          default: true,
          environment: false,
          override: false,
          timestamp: new Date().toISOString(),
        },
      ],
    },
    dgm: {
      pythonPath: "python3",
      dgmPath: "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm",
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      logLevel: "info",
      enableMetrics: true,
      healthCheckInterval: 60000,
      autoReconnect: true,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
    },
    features: {
      enableDgm: true,
      enableMetrics: true,
      enableHealthChecks: true,
      enableAutoSync: true,
      enableHotReload: true,
      debugMode: false,
    },
    sync: {
      interval: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      conflictResolution: "merge",
    },
  }
}
