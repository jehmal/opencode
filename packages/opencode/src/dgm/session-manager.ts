/**
 * DGM Session Manager - Integrates DGM bridge with session management
 */

import { App } from "../app/app"
import { Log } from "../util/log"
import { Config } from "../config/config"
import { DGMBridge } from "./bridge"
import { DGMConfig, DGMStatus, DGMEvent, type DGMTool } from "./types"
import type { Tool } from "../tool/tool"
import { z } from "zod"

const log = Log.create({ service: "dgm-session-manager" })

export namespace DGMSessionManager {
  let bridge: DGMBridge | null = null
  let isInitialized = false
  let initPromise: Promise<void> | null = null

  /**
   * Initialize DGM integration
   */
  export async function initialize(): Promise<void> {
    if (initPromise) {
      return initPromise
    }

    if (isInitialized) {
      return
    }

    initPromise = _initialize()
    try {
      await initPromise
    } finally {
      initPromise = null
    }
  }

  async function _initialize(): Promise<void> {
    log.info("Initializing DGM session manager")

    const config = await Config.get()

    // Check if DGM is configured
    const dgmConfig: DGMConfig = {
      enabled: config.dgm?.enabled ?? false,
      pythonPath: config.dgm?.pythonPath ?? "python3",
      dgmPath: config.dgm?.dgmPath,
      timeout: config.dgm?.timeout ?? 30000,
      maxRetries: config.dgm?.maxRetries ?? 3,
      healthCheckInterval: config.dgm?.healthCheckInterval ?? 60000,
    }

    if (!dgmConfig.enabled) {
      log.info("DGM integration is disabled")
      return
    }

    try {
      // Create and initialize bridge
      bridge = new DGMBridge(dgmConfig)

      // Set up event handlers
      bridge.on(DGMEvent.CONNECTED, handleConnected)
      bridge.on(DGMEvent.DISCONNECTED, handleDisconnected)
      bridge.on(DGMEvent.ERROR, handleError)
      bridge.on(DGMEvent.TOOL_REGISTERED, handleToolRegistered)
      bridge.on(DGMEvent.TOOL_UNREGISTERED, handleToolUnregistered)

      // Initialize the bridge
      await bridge.initialize()

      isInitialized = true
      log.info("DGM session manager initialized successfully")
    } catch (error) {
      log.error("Failed to initialize DGM session manager", {
        error: error instanceof Error ? error.message : String(error),
      })
      // Don't throw - gracefully degrade to CLI-only mode
      bridge = null
    }
  }

  /**
   * Shutdown DGM integration
   */
  export async function shutdown(): Promise<void> {
    log.info("Shutting down DGM session manager")

    if (bridge) {
      try {
        await bridge.shutdown()
      } catch (error) {
        log.error("Error during DGM shutdown", {
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        bridge = null
        isInitialized = false
      }
    }
  }

  /**
   * Get DGM status
   */
  export function getStatus(): DGMStatus {
    return bridge?.status ?? DGMStatus.UNINITIALIZED
  }

  /**
   * Check if DGM is available
   */
  export function isAvailable(): boolean {
    return bridge?.status === DGMStatus.READY
  }

  /**
   * Get DGM tools
   */
  export async function getTools(): Promise<Tool.Info[]> {
    if (!bridge || bridge.status !== DGMStatus.READY) {
      return []
    }

    try {
      const dgmTools = await bridge.getTools()
      return dgmTools.map(convertDGMTool)
    } catch (error) {
      log.error("Failed to get DGM tools", {
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Convert DGM tool to standard tool format
   */
  function convertDGMTool(dgmTool: DGMTool): Tool.Info {
    return {
      id: `dgm.${dgmTool.id}`,
      description: dgmTool.description,
      parameters: z.object(dgmTool.parameters || {}),
      async execute(args, ctx) {
        if (!bridge || bridge.status !== DGMStatus.READY) {
          throw new Error("DGM bridge is not available")
        }

        const startTime = Date.now()

        try {
          const result = await bridge.executeTool(dgmTool.id, args, {
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
          })

          return {
            metadata: {
              title: `DGM: ${dgmTool.name}`,
              duration: Date.now() - startTime,
              ...result.metadata,
            },
            output: result.output || "",
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          return {
            metadata: {
              title: `DGM: ${dgmTool.name}`,
              duration: Date.now() - startTime,
              error: true,
              message: errorMessage,
            },
            output: `Error executing DGM tool: ${errorMessage}`,
          }
        }
      },
    }
  }

  /**
   * Event handlers
   */
  function handleConnected(data: any): void {
    log.info("DGM bridge connected", data)
  }

  function handleDisconnected(data: any): void {
    log.warn("DGM bridge disconnected", data)
  }

  function handleError(data: any): void {
    log.error("DGM bridge error", data)
  }

  function handleToolRegistered(data: any): void {
    log.info("DGM tool registered", data)
  }

  function handleToolUnregistered(data: any): void {
    log.info("DGM tool unregistered", data)
  }

  /**
   * Register with app lifecycle
   */
  App.state(
    "dgm-session-manager",
    async () => {
      await initialize()
      return { initialized: true }
    },
    async () => {
      await shutdown()
    },
  )
}
