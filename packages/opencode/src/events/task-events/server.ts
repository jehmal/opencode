import { WebSocketServer } from "ws"
import { Bus } from "../../bus"
import { Log } from "../../util/log"
import {
  TaskStartedEvent,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
} from "../task-events"

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

    this.wss.on("connection", (ws) => {
      log.info("New WebSocket client connected")
      this.clients.add(ws)

      // Send heartbeat
      const heartbeat = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "heartbeat", timestamp: Date.now() }))
        }
      }, 30000)

      ws.on("close", () => {
        log.info("WebSocket client disconnected")
        this.clients.delete(ws)
        clearInterval(heartbeat)
      })

      ws.on("error", (error) => {
        log.error("WebSocket error", error)
        this.clients.delete(ws)
        clearInterval(heartbeat)
      })
    })

    // Subscribe to task events
    Bus.subscribe(TaskStartedEvent, (event) => {
      this.broadcast({
        type: "task.started",
        data: event.properties,
      })
    })

    Bus.subscribe(TaskProgressEvent, (event) => {
      this.broadcast({
        type: "task.progress",
        data: event.properties,
      })
    })

    Bus.subscribe(TaskCompletedEvent, (event) => {
      this.broadcast({
        type: "task.completed",
        data: event.properties,
      })
    })

    Bus.subscribe(TaskFailedEvent, (event) => {
      this.broadcast({
        type: "task.failed",
        data: event.properties,
      })
    })

    log.info(`Task event server started on port ${this.port}`)
  }

  private broadcast(message: any) {
    const data = JSON.stringify(message)
    this.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(data)
      }
    })
  }

  async stop() {
    if (this.wss) {
      this.wss.close()
      this.wss = null
      this.clients.clear()
      log.info("Task event server stopped")
    }
  }
}

// Singleton instance
export const taskEventServer = new TaskEventServer()
