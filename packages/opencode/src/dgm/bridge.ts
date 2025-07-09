/**
 * DGM Bridge implementation for TypeScript-Python communication
 */

import { spawn, ChildProcess } from "child_process"
import { EventEmitter } from "events"
import { Log } from "../util/log"
import { NamedError } from "../util/error"
import { z } from "zod"
import {
  DGMConfig,
  DGMStatus,
  DGMEvent,
  type DGMHealthCheck,
  type DGMTool,
  type DGMMessage,
  type IDGMBridge,
} from "./types"

// Simple UUID v4 generator to avoid external dependency
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const log = Log.create({ service: "dgm-bridge" })

/**
 * DGM Bridge errors
 */
export const DGMBridgeError = NamedError.create(
  "DGMBridgeError",
  z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
)

export const DGMTimeoutError = NamedError.create(
  "DGMTimeoutError",
  z.object({
    operation: z.string(),
    timeout: z.number(),
  }),
)

/**
 * DGM Bridge implementation
 */
export class DGMBridge extends EventEmitter implements IDGMBridge {
  private config: DGMConfig
  private process: ChildProcess | null = null
  private _status: DGMStatus = DGMStatus.UNINITIALIZED
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void
      reject: (error: any) => void
      timer: NodeJS.Timeout
    }
  >()
  private messageBuffer = ""
  private healthCheckTimer: NodeJS.Timeout | null = null
  private initializePromise: Promise<void> | null = null

  constructor(config: DGMConfig) {
    super()
    this.config = config
  }

  get status(): DGMStatus {
    return this._status
  }

  /**
   * Initialize the bridge connection
   */
  async initialize(): Promise<void> {
    // Prevent multiple initialization attempts
    if (this.initializePromise) {
      return this.initializePromise
    }

    if (this._status === DGMStatus.READY) {
      return
    }

    this.initializePromise = this._initialize()
    try {
      await this.initializePromise
    } finally {
      this.initializePromise = null
    }
  }

  private async _initialize(): Promise<void> {
    log.info("Initializing DGM bridge", { config: this.config })

    if (!this.config.enabled) {
      log.info("DGM integration is disabled")
      return
    }

    this._status = DGMStatus.INITIALIZING
    this.emit(DGMEvent.CONNECTED, { status: this._status })

    try {
      // Spawn Python process - use direct script path for WSL compatibility
      const scriptPath = `${this.config.dgmPath || process.cwd()}/dgm/bridge/stdio_server_simple.py`
      const args = [scriptPath]
      if (this.config.dgmPath) {
        args.push("--path", this.config.dgmPath)
      }

      log.info("Spawning Python process", {
        pythonPath: this.config.pythonPath,
        script: scriptPath,
        args: args,
        cwd: process.cwd(),
        env: { PYTHONUNBUFFERED: "1" },
      })

      this.process = spawn(this.config.pythonPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONPATH: this.config.dgmPath || process.cwd(),
        },
        cwd: this.config.dgmPath || process.cwd(),
      })

      // Set up event handlers
      this.setupProcessHandlers()

      // Give the Python process time to start up
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Wait for initial handshake with better timeout
      log.info("Waiting for Python bridge to be ready...")
      await this.waitForReady()

      // Start health check timer
      this.startHealthCheck()

      this._status = DGMStatus.READY
      this.emit(DGMEvent.CONNECTED, { status: this._status })

      log.info("DGM bridge initialized successfully")
    } catch (error) {
      this._status = DGMStatus.ERROR
      this.emit(DGMEvent.ERROR, { error })

      const errorMessage =
        error instanceof Error ? error.message : String(error)
      log.error("Failed to initialize DGM bridge", {
        error: errorMessage,
        pythonPath: this.config.pythonPath,
        dgmPath: this.config.dgmPath,
        cwd: process.cwd(),
      })

      throw new DGMBridgeError({
        code: "INIT_FAILED",
        message: `Failed to initialize DGM bridge: ${errorMessage}`,
        details: error,
      })
    }
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(): void {
    if (!this.process) return

    // Handle stdout (messages from Python)
    this.process.stdout?.on("data", (data: Buffer) => {
      this.messageBuffer += data.toString()
      this.processMessages()
    })

    // Handle stderr (errors and logs)
    this.process.stderr?.on("data", (data: Buffer) => {
      const message = data.toString().trim()
      if (message) {
        log.info("DGM stderr:", { message })
      }
    })

    // Handle process exit
    this.process.on("exit", (code, signal) => {
      log.warn("DGM process exited", { code, signal })
      this.handleDisconnect()
    })

    // Handle process errors
    this.process.on("error", (error) => {
      log.error("DGM process error", error)
      this.handleDisconnect()
    })
  }

  /**
   * Process buffered messages
   */
  private processMessages(): void {
    const lines = this.messageBuffer.split("\n")
    this.messageBuffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const message: DGMMessage = JSON.parse(line)
        this.handleMessage(message)
      } catch (error) {
        log.error("Failed to parse DGM message", { line, error })
      }
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: DGMMessage): void {
    log.info("Received DGM message", { message })

    if (message.type === "response" || message.type === "error") {
      const pending = this.pendingRequests.get(message.id)
      if (pending) {
        clearTimeout(pending.timer)
        this.pendingRequests.delete(message.id)

        if (message.type === "error") {
          pending.reject(
            new DGMBridgeError({
              code: message.error?.code?.toString() || "UNKNOWN",
              message: message.error?.message || "Unknown error",
              details: message.error?.data,
            }),
          )
        } else {
          pending.resolve(message.result)
        }
      }
    } else if (message.type === "event") {
      this.handleEvent(message)
    }
  }

  /**
   * Handle DGM events
   */
  private handleEvent(message: DGMMessage): void {
    switch (message.method) {
      case "tool.registered":
        this.emit(DGMEvent.TOOL_REGISTERED, message.params)
        break
      case "tool.unregistered":
        this.emit(DGMEvent.TOOL_UNREGISTERED, message.params)
        break
      default:
        log.info("Unhandled DGM event", { message })
    }
  }

  /**
   * Send request to DGM
   */
  private async sendRequest(method: string, params?: any): Promise<any> {
    // Allow handshake during initialization
    if (this._status !== DGMStatus.READY && method !== "handshake") {
      throw new DGMBridgeError({
        code: "NOT_READY",
        message: "DGM bridge is not ready",
      })
    }

    const id = generateId()
    const message: DGMMessage = {
      id,
      type: "request",
      method,
      params,
    }

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(
          new DGMTimeoutError({
            operation: method,
            timeout: this.config.timeout,
          }),
        )
      }, this.config.timeout)

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timer })

      // Send message
      const messageStr = JSON.stringify(message) + "\n"
      this.process?.stdin?.write(messageStr, (error) => {
        if (error) {
          clearTimeout(timer)
          this.pendingRequests.delete(id)
          reject(error)
        }
      })
    })
  }

  /**
   * Wait for bridge to be ready
   */
  private async waitForReady(): Promise<void> {
    const startTime = Date.now()
    const timeout = 15000 // 15 seconds - increased for cold start
    let lastError: any = null
    let attempts = 0

    log.info("Starting handshake with Python bridge...")

    while (Date.now() - startTime < timeout) {
      attempts++
      try {
        log.info(`Handshake attempt ${attempts}...`)
        const result = await this.sendRequest("handshake", { version: "1.0" })
        if (result?.status === "ok") {
          log.info(`Handshake successful after ${attempts} attempts`)
          return
        }
      } catch (error) {
        lastError = error
        log.info(`Handshake attempt ${attempts} failed:`, {
          error: error instanceof Error ? error.message : String(error),
        })
      }

      await new Promise((resolve) => setTimeout(resolve, 500)) // Increased delay between attempts
    }

    throw new DGMBridgeError({
      code: "HANDSHAKE_TIMEOUT",
      message: `Failed to establish handshake with DGM after ${attempts} attempts (${timeout}ms). Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    })
  }

  /**
   * Start health check timer
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.healthCheck()
      } catch (error) {
        log.error("Health check failed", {
          error: error instanceof Error ? error.message : String(error),
        })
        this.handleDisconnect()
      }
    }, this.config.healthCheckInterval)
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this._status = DGMStatus.DISCONNECTED
    this.emit(DGMEvent.DISCONNECTED, { status: this._status })

    // Clear pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(
        new DGMBridgeError({
          code: "DISCONNECTED",
          message: "DGM bridge disconnected",
        }),
      )
    }
    this.pendingRequests.clear()

    // Clear health check timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }

    // Kill process if still running
    if (this.process && !this.process.killed) {
      this.process.kill()
    }
    this.process = null
  }

  /**
   * Shutdown the bridge
   */
  async shutdown(): Promise<void> {
    log.info("Shutting down DGM bridge")

    if (this._status === DGMStatus.UNINITIALIZED) {
      return
    }

    try {
      if (this._status === DGMStatus.READY) {
        await this.sendRequest("shutdown")
      }
    } catch (error) {
      log.error("Error during shutdown", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      this.handleDisconnect()
      this._status = DGMStatus.UNINITIALIZED
    }
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<DGMHealthCheck> {
    if (this._status !== DGMStatus.READY) {
      return {
        status: this._status,
        timestamp: Date.now(),
        error: "Bridge not ready",
      }
    }

    try {
      const result = await this.sendRequest("health")
      return {
        status: DGMStatus.READY,
        timestamp: Date.now(),
        version: result.version,
        capabilities: result.capabilities,
      }
    } catch (error) {
      return {
        status: DGMStatus.ERROR,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Get available tools from DGM
   */
  async getTools(): Promise<DGMTool[]> {
    const result = await this.sendRequest("tools.list")
    return result.tools || []
  }

  /**
   * Execute a DGM tool
   */
  async executeTool(toolId: string, params: any, context: any): Promise<any> {
    return this.sendRequest("tools.execute", {
      toolId,
      params,
      context,
    })
  }

  /**
   * Register event listener
   */
  on(event: DGMEvent, handler: (data: any) => void): this {
    super.on(event, handler)
    return this
  }

  /**
   * Unregister event listener
   */
  off(event: DGMEvent, handler: (data: any) => void): this {
    super.off(event, handler)
    return this
  }
}
