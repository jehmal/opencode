import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { Bus } from "../bus"
import {
  TaskStartedEvent,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  emitTaskStarted,
  emitTaskProgress,
  emitTaskCompleted,
  emitTaskFailed,
} from "../events/task-events"
import { TaskEventServer } from "../events/task-events/server"
import WebSocket from "ws"

describe("Event Type Validation", () => {
  let server: TaskEventServer
  let receivedEvents: any[] = []
  let ws: WebSocket

  beforeAll(async () => {
    // Start the task event server
    server = new TaskEventServer()
    await server.start()

    // Connect WebSocket client to capture events
    ws = new WebSocket("ws://localhost:5747")

    await new Promise((resolve) => {
      ws.on("open", resolve)
    })

    ws.on("message", (data) => {
      try {
        const event = JSON.parse(data.toString())
        if (event.type !== "heartbeat") {
          receivedEvents.push(event)
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error)
      }
    })
  })

  afterAll(async () => {
    ws?.close()
    await server?.stop()
  })

  test("Event type strings match between schema and server", () => {
    // Verify event type strings are consistent
    expect(TaskStartedEvent.type).toBe("task.started")
    expect(TaskProgressEvent.type).toBe("task.progress")
    expect(TaskCompletedEvent.type).toBe("task.completed")
    expect(TaskFailedEvent.type).toBe("task.failed")
  })

  test("Zod schemas validate correctly", () => {
    // Test TaskStartedEvent schema
    const validStartedData = {
      sessionID: "test-session",
      taskID: "test-task",
      agentName: "Test Agent",
      taskDescription: "Test task description",
      timestamp: Date.now(),
    }

    expect(() =>
      TaskStartedEvent.properties.parse(validStartedData),
    ).not.toThrow()

    // Test TaskProgressEvent schema
    const validProgressData = {
      sessionID: "test-session",
      taskID: "test-task",
      progress: 50,
      message: "Test progress message",
      timestamp: Date.now(),
      startTime: Date.now() - 1000,
    }

    expect(() =>
      TaskProgressEvent.properties.parse(validProgressData),
    ).not.toThrow()

    // Test TaskCompletedEvent schema
    const validCompletedData = {
      sessionID: "test-session",
      taskID: "test-task",
      duration: 5000,
      success: true,
      summary: "Task completed successfully",
      timestamp: Date.now(),
    }

    expect(() =>
      TaskCompletedEvent.properties.parse(validCompletedData),
    ).not.toThrow()

    // Test TaskFailedEvent schema
    const validFailedData = {
      sessionID: "test-session",
      taskID: "test-task",
      error: "Test error message",
      recoverable: true,
      timestamp: Date.now(),
    }

    expect(() =>
      TaskFailedEvent.properties.parse(validFailedData),
    ).not.toThrow()
  })

  test("Schema validation catches invalid data", () => {
    // Test invalid progress value (outside 0-100 range)
    const invalidProgressData = {
      sessionID: "test-session",
      taskID: "test-task",
      progress: 150, // Invalid: > 100
      timestamp: Date.now(),
    }

    expect(() =>
      TaskProgressEvent.properties.parse(invalidProgressData),
    ).toThrow()

    // Test missing required fields
    const incompleteStartedData = {
      sessionID: "test-session",
      // Missing taskID, agentName, taskDescription, timestamp
    }

    expect(() =>
      TaskStartedEvent.properties.parse(incompleteStartedData),
    ).toThrow()
  })

  test("Bus event registry includes all task events", () => {
    const payloads = Bus.payloads()

    // Verify the discriminated union includes all our event types
    const schema = payloads._def
    expect(schema.discriminator).toBe("type")

    const eventTypes = schema.options.map(
      (option: any) => option._def.shape.type._def.value,
    )

    expect(eventTypes).toContain("task.started")
    expect(eventTypes).toContain("task.progress")
    expect(eventTypes).toContain("task.completed")
    expect(eventTypes).toContain("task.failed")
  })

  test("Event emission and WebSocket transmission", async () => {
    receivedEvents.length = 0 // Clear previous events

    const testData = {
      sessionID: "validation-test",
      taskID: "validation-task",
      agentName: "Validation Agent",
      taskDescription: "Testing event validation",
      timestamp: Date.now(),
    }

    // Emit a task started event
    emitTaskStarted(testData)

    // Wait for WebSocket transmission
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Verify event was received via WebSocket
    expect(receivedEvents.length).toBeGreaterThan(0)

    const receivedEvent = receivedEvents.find((e) => e.type === "task.started")
    expect(receivedEvent).toBeDefined()
    expect(receivedEvent.type).toBe("task.started")
    expect(receivedEvent.data).toEqual(testData)
  })

  test("Event payload structure consistency", async () => {
    receivedEvents.length = 0

    const progressData = {
      sessionID: "structure-test",
      taskID: "structure-task",
      progress: 75,
      message: "Testing structure",
      timestamp: Date.now(),
      startTime: Date.now() - 2000,
    }

    emitTaskProgress(progressData)

    await new Promise((resolve) => setTimeout(resolve, 100))

    const receivedEvent = receivedEvents.find((e) => e.type === "task.progress")
    expect(receivedEvent).toBeDefined()

    // Verify the structure matches what the server emits
    expect(receivedEvent).toHaveProperty("type", "task.progress")
    expect(receivedEvent).toHaveProperty("data")
    expect(receivedEvent.data).toEqual(progressData)

    // Verify the data validates against the schema
    expect(() =>
      TaskProgressEvent.properties.parse(receivedEvent.data),
    ).not.toThrow()
  })

  test("Serialization/deserialization integrity", async () => {
    receivedEvents.length = 0

    const completedData = {
      sessionID: "serialization-test",
      taskID: "serialization-task",
      duration: 3500,
      success: true,
      summary: "Serialization test completed",
      timestamp: Date.now(),
    }

    emitTaskCompleted(completedData)

    await new Promise((resolve) => setTimeout(resolve, 100))

    const receivedEvent = receivedEvents.find(
      (e) => e.type === "task.completed",
    )
    expect(receivedEvent).toBeDefined()

    // Verify all data types are preserved through JSON serialization
    expect(typeof receivedEvent.data.sessionID).toBe("string")
    expect(typeof receivedEvent.data.taskID).toBe("string")
    expect(typeof receivedEvent.data.duration).toBe("number")
    expect(typeof receivedEvent.data.success).toBe("boolean")
    expect(typeof receivedEvent.data.summary).toBe("string")
    expect(typeof receivedEvent.data.timestamp).toBe("number")

    // Verify exact value preservation
    expect(receivedEvent.data.duration).toBe(completedData.duration)
    expect(receivedEvent.data.success).toBe(completedData.success)
  })

  test("Optional fields handling", async () => {
    receivedEvents.length = 0

    // Test progress event without optional fields
    const minimalProgressData = {
      sessionID: "optional-test",
      taskID: "optional-task",
      progress: 25,
      timestamp: Date.now(),
    }

    emitTaskProgress(minimalProgressData)

    await new Promise((resolve) => setTimeout(resolve, 100))

    const receivedEvent = receivedEvents.find(
      (e) => e.data.sessionID === "optional-test",
    )
    expect(receivedEvent).toBeDefined()

    // Verify schema validation passes without optional fields
    expect(() =>
      TaskProgressEvent.properties.parse(receivedEvent.data),
    ).not.toThrow()

    // Verify optional fields are undefined when not provided
    expect(receivedEvent.data.message).toBeUndefined()
    expect(receivedEvent.data.startTime).toBeUndefined()
  })

  test("Error event validation", async () => {
    receivedEvents.length = 0

    const failedData = {
      sessionID: "error-test",
      taskID: "error-task",
      error: "Validation test error",
      recoverable: false,
      timestamp: Date.now(),
    }

    emitTaskFailed(failedData)

    await new Promise((resolve) => setTimeout(resolve, 100))

    const receivedEvent = receivedEvents.find((e) => e.type === "task.failed")
    expect(receivedEvent).toBeDefined()

    // Verify error data structure
    expect(receivedEvent.data.error).toBe(failedData.error)
    expect(receivedEvent.data.recoverable).toBe(failedData.recoverable)

    // Verify schema validation
    expect(() =>
      TaskFailedEvent.properties.parse(receivedEvent.data),
    ).not.toThrow()
  })

  test("Bus payload validation function", () => {
    const payloads = Bus.payloads()

    // Test valid event payload
    const validPayload = {
      type: "task.started",
      properties: {
        sessionID: "test-session",
        taskID: "test-task",
        agentName: "Test Agent",
        taskDescription: "Test description",
        timestamp: Date.now(),
      },
    }

    expect(() => payloads.parse(validPayload)).not.toThrow()

    // Test invalid event type
    const invalidTypePayload = {
      type: "invalid.event",
      properties: {},
    }

    expect(() => payloads.parse(invalidTypePayload)).toThrow()
  })
})
