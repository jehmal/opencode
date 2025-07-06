import { Bus } from "../bus"
import { Log } from "../util/log"
import { z } from "zod"

const log = Log.create({ service: "connection-status" })

export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

export interface ConnectionStatusProperties {
  state: ConnectionState
  timestamp: number
  clientCount: number
  lastHeartbeat?: number
  error?: string
  retryCount?: number
}

export const ConnectionStatusEvent = Bus.event(
  "connection.status",
  z.object({
    state: z.nativeEnum(ConnectionState),
    timestamp: z.number(),
    clientCount: z.number(),
    lastHeartbeat: z.number().optional(),
    error: z.string().optional(),
    retryCount: z.number().optional(),
  }),
)

export class ConnectionHealthMonitor {
  private state: ConnectionState = ConnectionState.DISCONNECTED
  private clientCount = 0
  private lastHeartbeat?: number
  private retryCount = 0
  private healthCheckInterval?: Timer
  private readonly HEARTBEAT_TIMEOUT = 45000 // 45 seconds (heartbeat is 30s)
  private readonly MAX_RETRIES = 5

  start() {
    log.info("Starting connection health monitor")
    this.setState(ConnectionState.CONNECTING)

    // Start health check interval
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth()
    }, 10000) // Check every 10 seconds
  }

  stop() {
    log.info("Stopping connection health monitor")
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
    this.setState(ConnectionState.DISCONNECTED)
  }

  onClientConnected() {
    this.clientCount++
    this.retryCount = 0
    this.setState(ConnectionState.CONNECTED)
    log.info(`Client connected. Total clients: ${this.clientCount}`)
  }

  onClientDisconnected() {
    this.clientCount = Math.max(0, this.clientCount - 1)
    log.info(`Client disconnected. Total clients: ${this.clientCount}`)

    if (this.clientCount === 0) {
      this.setState(ConnectionState.DISCONNECTED)
    }
  }

  onHeartbeat() {
    this.lastHeartbeat = Date.now()
    if (this.state !== ConnectionState.CONNECTED && this.clientCount > 0) {
      this.setState(ConnectionState.CONNECTED)
    }
  }

  onError(error: string) {
    log.error("Connection error", { error })
    this.setState(ConnectionState.ERROR, error)

    if (this.retryCount < this.MAX_RETRIES) {
      this.retryCount++
      this.setState(ConnectionState.RECONNECTING)
    }
  }

  private checkHealth() {
    if (this.clientCount === 0) {
      if (this.state !== ConnectionState.DISCONNECTED) {
        this.setState(ConnectionState.DISCONNECTED)
      }
      return
    }

    // Check if heartbeat is stale
    if (this.lastHeartbeat) {
      const timeSinceHeartbeat = Date.now() - this.lastHeartbeat
      if (timeSinceHeartbeat > this.HEARTBEAT_TIMEOUT) {
        log.warn(
          `Heartbeat timeout: ${timeSinceHeartbeat}ms since last heartbeat`,
        )
        this.onError("Heartbeat timeout")
      }
    }
  }

  private setState(state: ConnectionState, error?: string) {
    if (this.state === state && !error) return

    this.state = state

    const eventProperties = {
      state,
      timestamp: Date.now(),
      clientCount: this.clientCount,
      lastHeartbeat: this.lastHeartbeat,
      error,
      retryCount: this.retryCount,
    }

    Bus.publish(ConnectionStatusEvent, eventProperties)
    log.info(`Connection state changed to: ${state}`, {
      clientCount: this.clientCount,
      retryCount: this.retryCount,
      error,
    })
  }

  getStatus(): ConnectionStatusProperties {
    return {
      state: this.state,
      timestamp: Date.now(),
      clientCount: this.clientCount,
      lastHeartbeat: this.lastHeartbeat,
      retryCount: this.retryCount,
    }
  }
}

// Singleton instance
export const connectionHealthMonitor = new ConnectionHealthMonitor()
