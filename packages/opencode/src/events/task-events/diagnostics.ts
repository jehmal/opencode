import { Bus } from "../bus"
import { Log } from "../util/log"
import {
  TaskStartedEvent,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  emitTaskStarted,
  emitTaskProgress,
  emitTaskCompleted,
} from "./task-events"

const log = Log.create({ service: "task-events-diagnostics" })

export class TaskEventDiagnostics {
  private eventCounts = {
    started: 0,
    progress: 0,
    completed: 0,
    failed: 0,
  }

  private lastEvents = new Map<string, any>()

  constructor() {
    // Subscribe to all task events for diagnostics
    Bus.subscribe(TaskStartedEvent, (event) => {
      this.eventCounts.started++
      this.lastEvents.set("started", event)
      log.info("📊 Task Started Event Captured", {
        count: this.eventCounts.started,
        taskID: event.properties.taskID,
      })
    })

    Bus.subscribe(TaskProgressEvent, (event) => {
      this.eventCounts.progress++
      this.lastEvents.set("progress", event)
      log.info("📊 Task Progress Event Captured", {
        count: this.eventCounts.progress,
        taskID: event.properties.taskID,
        progress: event.properties.progress,
      })
    })

    Bus.subscribe(TaskCompletedEvent, (event) => {
      this.eventCounts.completed++
      this.lastEvents.set("completed", event)
      log.info("📊 Task Completed Event Captured", {
        count: this.eventCounts.completed,
        taskID: event.properties.taskID,
      })
    })

    Bus.subscribe(TaskFailedEvent, (event) => {
      this.eventCounts.failed++
      this.lastEvents.set("failed", event)
      log.info("📊 Task Failed Event Captured", {
        count: this.eventCounts.failed,
        taskID: event.properties.taskID,
      })
    })
  }

  getStats() {
    return {
      eventCounts: this.eventCounts,
      lastEvents: Object.fromEntries(this.lastEvents),
    }
  }

  reset() {
    this.eventCounts = {
      started: 0,
      progress: 0,
      completed: 0,
      failed: 0,
    }
    this.lastEvents.clear()
  }

  // Test event emission
  async testEventFlow(sessionID: string = "test-session") {
    log.info("🧪 Starting event flow test")
    
    const taskID = `test-${Date.now()}`
    const startTime = Date.now()

    // Emit test events
    emitTaskStarted({
      sessionID,
      taskID,
      agentName: "Test Agent",
      taskDescription: "Testing event flow",
      timestamp: startTime,
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    emitTaskProgress({
      sessionID,
      taskID,
      progress: 25,
      message: "First progress update",
      timestamp: Date.now(),
      startTime,
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    emitTaskProgress({
      sessionID,
      taskID,
      progress: 75,
      message: "Second progress update",
      timestamp: Date.now(),
      startTime,
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    emitTaskCompleted({
      sessionID,
      taskID,
      duration: Date.now() - startTime,
      success: true,
      summary: "Test completed successfully",
      timestamp: Date.now(),
    })

    log.info("🧪 Event flow test completed", this.getStats())
  }
}

// Singleton instance
export const taskEventDiagnostics = new TaskEventDiagnostics()