import { WebSocketServer } from "ws"
import { Bus } from "../../bus"
import { Log } from "../../util/log"
import {
  TaskStartedEvent,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
} from "../task-events"
import {
  MCPCallStartedEvent,
  MCPCallProgressEvent,
  MCPCallCompletedEvent,
  MCPCallFailedEvent,
} from "../mcp-events"
import { connectionHealthMonitor } from "../connection-status"

const log = Log.create({ service: "task-events-server" })

export class TaskEventServer {
  private wss: WebSocketServer | null = null
  private port = 5747
  private clients = new Set<any>()

  async start() {
    if (this.wss) {
      log.info("Task event server already running")
      return
    }

    this.wss = new WebSocketServer({ port: this.port })

    // Start connection health monitoring
    connectionHealthMonitor.start()

    this.wss.on("connection", (ws) => {
      log.info("New WebSocket client connected")
      this.clients.add(ws)
      connectionHealthMonitor.onClientConnected()

      // Send heartbeat
      const heartbeat = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "heartbeat", timestamp: Date.now() }))
          connectionHealthMonitor.onHeartbeat()
        }
      }, 30000)

      ws.on("close", () => {
        log.info("WebSocket client disconnected")
        this.clients.delete(ws)
        connectionHealthMonitor.onClientDisconnected()
        clearInterval(heartbeat)
      })

      ws.on("error", (error) => {
        log.error("WebSocket error", error)
        this.clients.delete(ws)
        connectionHealthMonitor.onError(
          error.message || "Unknown WebSocket error",
        )
        clearInterval(heartbeat)
      })
    })

    // Subscribe to task events
    Bus.subscribe(TaskStartedEvent, (event) => {
      log.info(`Task started event received: ${event.properties.taskID}`, {
        sessionID: event.properties.sessionID,
        agentName: event.properties.agentName,
      })
      this.broadcast({
        type: "task.started",
        data: event.properties,
      })
    })

    Bus.subscribe(TaskProgressEvent, (event) => {
      log.info(
        `Broadcasting task progress: ${event.properties.taskID} - ${event.properties.progress}%`,
        {
          sessionID: event.properties.sessionID,
          message: event.properties.message,
        },
      )
      this.broadcast({
        type: "task.progress",
        data: event.properties,
      })
    })

    Bus.subscribe(TaskCompletedEvent, (event) => {
      log.info(`Task completed event received: ${event.properties.taskID}`, {
        sessionID: event.properties.sessionID,
        duration: event.properties.duration,
        success: event.properties.success,
      })
      this.broadcast({
        type: "task.completed",
        data: event.properties,
      })
    })

    Bus.subscribe(TaskFailedEvent, (event) => {
      log.info(`Task failed event received: ${event.properties.taskID}`, {
        sessionID: event.properties.sessionID,
        error: event.properties.error,
      })
      this.broadcast({
        type: "task.failed",
        data: event.properties,
      })
    })

    // Subscribe to MCP events
    Bus.subscribe(MCPCallStartedEvent, (event) => {
      log.info(`MCP call started: ${event.properties.id}`, {
        server: event.properties.server,
        method: event.properties.method,
        sessionID: event.properties.sessionID,
      })
      this.broadcast({
        type: "mcp.call.started",
        data: event.properties,
      })
    })

    Bus.subscribe(MCPCallProgressEvent, (event) => {
      log.info(`MCP call progress: ${event.properties.id}`, {
        message: event.properties.message,
      })
      this.broadcast({
        type: "mcp.call.progress",
        data: event.properties,
      })
    })

    Bus.subscribe(MCPCallCompletedEvent, (event) => {
      log.info(`MCP call completed: ${event.properties.id}`, {
        duration: event.properties.duration,
      })
      this.broadcast({
        type: "mcp.call.completed",
        data: event.properties,
      })
    })

    Bus.subscribe(MCPCallFailedEvent, (event) => {
      log.info(`MCP call failed: ${event.properties.id}`, {
        error: event.properties.error,
        duration: event.properties.duration,
      })
      this.broadcast({
        type: "mcp.call.failed",
        data: event.properties,
      })
    })

    log.info(`Task event server started on port ${this.port}`)
  }

  private broadcast(message: any) {
    const data = JSON.stringify(message)
    const activeClients = Array.from(this.clients).filter(
      (client) => client.readyState === client.OPEN,
    )

    log.info(`Broadcasting to ${activeClients.length} active clients`, {
      type: message.type,
      totalClients: this.clients.size,
    })

    activeClients.forEach((client) => {
      try {
        client.send(data)
      } catch (error) {
        log.error("Failed to send to client", {
          error: error.message,
          type: message.type,
        })
      }
    })
  }

  async stop() {
    if (this.wss) {
      this.wss.close()
      this.wss = null
      this.clients.clear()
      connectionHealthMonitor.stop()
      log.info("Task event server stopped")
    }
  }
}

// Singleton instance
export const taskEventServer = new TaskEventServer()
