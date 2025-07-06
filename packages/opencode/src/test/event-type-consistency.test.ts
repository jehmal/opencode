import { describe, test, expect } from "bun:test"
import { App } from "../app/app"
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

describe("Event Type Consistency Validation", () => {
  test("Event type strings match between schema and server emission", () => {
    // Verify event type strings are consistent across the system
    expect(TaskStartedEvent.type).toBe("task.started")
    expect(TaskProgressEvent.type).toBe("task.progress")
    expect(TaskCompletedEvent.type).toBe("task.completed")
    expect(TaskFailedEvent.type).toBe("task.failed")
  })

  test("Zod schemas validate emitted data structures", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      const capturedEvents: any[] = []

      // Subscribe to capture events
      const unsubscribes = [
        Bus.subscribe(TaskStartedEvent, (event) => capturedEvents.push(event)),
        Bus.subscribe(TaskProgressEvent, (event) => capturedEvents.push(event)),
        Bus.subscribe(TaskCompletedEvent, (event) =>
          capturedEvents.push(event),
        ),
        Bus.subscribe(TaskFailedEvent, (event) => capturedEvents.push(event)),
      ]

      // Emit all event types with valid data
      const sessionID = "validation-session"
      const taskID = "validation-task"
      const timestamp = Date.now()

      await emitTaskStarted({
        sessionID,
        taskID,
        agentName: "Validation Agent",
        taskDescription: "Testing event consistency",
        timestamp,
      })

      await emitTaskProgress({
        sessionID,
        taskID,
        progress: 50,
        message: "Halfway complete",
        timestamp: timestamp + 1000,
        startTime: timestamp,
      })

      await emitTaskCompleted({
        sessionID,
        taskID,
        duration: 2000,
        success: true,
        summary: "Validation completed",
        timestamp: timestamp + 2000,
      })

      await emitTaskFailed({
        sessionID: "failed-session",
        taskID: "failed-task",
        error: "Validation error",
        recoverable: true,
        timestamp: timestamp + 3000,
      })

      // Verify all events were captured
      expect(capturedEvents.length).toBe(4)

      // Validate each event against its schema
      const startedEvent = capturedEvents.find((e) => e.type === "task.started")
      const progressEvent = capturedEvents.find(
        (e) => e.type === "task.progress",
      )
      const completedEvent = capturedEvents.find(
        (e) => e.type === "task.completed",
      )
      const failedEvent = capturedEvents.find((e) => e.type === "task.failed")

      expect(startedEvent).toBeDefined()
      expect(progressEvent).toBeDefined()
      expect(completedEvent).toBeDefined()
      expect(failedEvent).toBeDefined()

      // Validate schemas
      expect(() =>
        TaskStartedEvent.properties.parse(startedEvent.properties),
      ).not.toThrow()
      expect(() =>
        TaskProgressEvent.properties.parse(progressEvent.properties),
      ).not.toThrow()
      expect(() =>
        TaskCompletedEvent.properties.parse(completedEvent.properties),
      ).not.toThrow()
      expect(() =>
        TaskFailedEvent.properties.parse(failedEvent.properties),
      ).not.toThrow()

      unsubscribes.forEach((unsub) => unsub())
    })
  })

  test("Server emission format matches expected structure", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      const capturedEvents: any[] = []

      const unsubscribe = Bus.subscribe(TaskProgressEvent, (event) => {
        capturedEvents.push(event)
      })

      const testData = {
        sessionID: "format-test",
        taskID: "format-task",
        progress: 75,
        message: "Testing format",
        timestamp: Date.now(),
        startTime: Date.now() - 1000,
      }

      await emitTaskProgress(testData)

      expect(capturedEvents.length).toBe(1)

      const event = capturedEvents[0]

      // Verify the event structure matches what the server expects
      expect(event).toHaveProperty("type", "task.progress")
      expect(event).toHaveProperty("properties")
      expect(event.properties).toEqual(testData)

      // This is the format that would be sent via WebSocket:
      // { type: "task.progress", data: event.properties }
      const webSocketFormat = {
        type: event.type,
        data: event.properties,
      }

      // Verify the WebSocket format data validates against schema
      expect(() =>
        TaskProgressEvent.properties.parse(webSocketFormat.data),
      ).not.toThrow()

      unsubscribe()
    })
  })

  test("Progress value bounds validation", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      // Test valid progress values
      const validProgressValues = [0, 25, 50, 75, 100]

      for (const progress of validProgressValues) {
        const testData = {
          sessionID: "bounds-test",
          taskID: "bounds-task",
          progress,
          timestamp: Date.now(),
        }

        const result = TaskProgressEvent.properties.safeParse(testData)
        expect(result.success).toBe(true)
      }

      // Test invalid progress values
      const invalidProgressValues = [-1, 101, 150, -50]

      for (const progress of invalidProgressValues) {
        const testData = {
          sessionID: "bounds-test",
          taskID: "bounds-task",
          progress,
          timestamp: Date.now(),
        }

        const result = TaskProgressEvent.properties.safeParse(testData)
        expect(result.success).toBe(false)
      }
    })
  })

  test("Optional fields validation", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      // Test TaskProgressEvent with minimal required fields
      const minimalProgress = {
        sessionID: "optional-test",
        taskID: "optional-task",
        progress: 30,
        timestamp: Date.now(),
      }

      const progressResult =
        TaskProgressEvent.properties.safeParse(minimalProgress)
      expect(progressResult.success).toBe(true)

      // Test TaskCompletedEvent with minimal required fields
      const minimalCompleted = {
        sessionID: "optional-test",
        taskID: "optional-task",
        duration: 1500,
        success: true,
        timestamp: Date.now(),
      }

      const completedResult =
        TaskCompletedEvent.properties.safeParse(minimalCompleted)
      expect(completedResult.success).toBe(true)

      // Test with optional fields included
      const fullProgress = {
        ...minimalProgress,
        message: "Optional message",
        startTime: Date.now() - 2000,
      }

      const fullProgressResult =
        TaskProgressEvent.properties.safeParse(fullProgress)
      expect(fullProgressResult.success).toBe(true)

      const fullCompleted = {
        ...minimalCompleted,
        summary: "Optional summary",
      }

      const fullCompletedResult =
        TaskCompletedEvent.properties.safeParse(fullCompleted)
      expect(fullCompletedResult.success).toBe(true)
    })
  })

  test("Bus payload validation includes all task events", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      const payloads = Bus.payloads()

      // Test each event type validates correctly
      const testEvents = [
        {
          type: "task.started",
          properties: {
            sessionID: "payload-test",
            taskID: "payload-task",
            agentName: "Payload Agent",
            taskDescription: "Testing payload validation",
            timestamp: Date.now(),
          },
        },
        {
          type: "task.progress",
          properties: {
            sessionID: "payload-test",
            taskID: "payload-task",
            progress: 60,
            timestamp: Date.now(),
          },
        },
        {
          type: "task.completed",
          properties: {
            sessionID: "payload-test",
            taskID: "payload-task",
            duration: 3000,
            success: true,
            timestamp: Date.now(),
          },
        },
        {
          type: "task.failed",
          properties: {
            sessionID: "payload-test",
            taskID: "payload-task",
            error: "Payload test error",
            recoverable: false,
            timestamp: Date.now(),
          },
        },
      ]

      // All events should validate successfully
      testEvents.forEach((event, index) => {
        const result = payloads.safeParse(event)
        expect(result.success).toBe(true)
      })

      // Invalid event type should fail
      const invalidEvent = {
        type: "invalid.event.type",
        properties: {},
      }

      const invalidResult = payloads.safeParse(invalidEvent)
      expect(invalidResult.success).toBe(false)
    })
  })

  test("Type consistency between emission and reception", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      const receivedEvents: any[] = []

      const unsubscribe = Bus.subscribe(TaskStartedEvent, (event) => {
        receivedEvents.push(event)
      })

      const originalData = {
        sessionID: "type-consistency-test",
        taskID: "type-consistency-task",
        agentName: "Type Consistency Agent",
        taskDescription: "Testing type consistency",
        timestamp: 1672531200000, // Fixed timestamp for comparison
      }

      await emitTaskStarted(originalData)

      expect(receivedEvents.length).toBe(1)

      const receivedEvent = receivedEvents[0]

      // Verify exact data preservation
      expect(receivedEvent.type).toBe("task.started")
      expect(receivedEvent.properties).toEqual(originalData)

      // Verify type preservation
      expect(typeof receivedEvent.properties.sessionID).toBe("string")
      expect(typeof receivedEvent.properties.taskID).toBe("string")
      expect(typeof receivedEvent.properties.agentName).toBe("string")
      expect(typeof receivedEvent.properties.taskDescription).toBe("string")
      expect(typeof receivedEvent.properties.timestamp).toBe("number")

      // Verify exact values
      expect(receivedEvent.properties.timestamp).toBe(1672531200000)

      unsubscribe()
    })
  })

  test("Serialization integrity for WebSocket transmission", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      const testData = {
        sessionID: "serialization-test",
        taskID: "serialization-task",
        duration: 4500,
        success: true,
        summary: "Serialization test completed",
        timestamp: Date.now(),
      }

      // Simulate the server's WebSocket emission format
      const webSocketMessage = {
        type: "task.completed",
        data: testData,
      }

      // Simulate JSON serialization/deserialization
      const serialized = JSON.stringify(webSocketMessage)
      const deserialized = JSON.parse(serialized)

      // Verify structure is preserved
      expect(deserialized.type).toBe("task.completed")
      expect(deserialized.data).toEqual(testData)

      // Verify the deserialized data validates against schema
      const validationResult = TaskCompletedEvent.properties.safeParse(
        deserialized.data,
      )
      expect(validationResult.success).toBe(true)

      // Verify type preservation through serialization
      expect(typeof deserialized.data.duration).toBe("number")
      expect(typeof deserialized.data.success).toBe("boolean")
      expect(typeof deserialized.data.summary).toBe("string")
      expect(typeof deserialized.data.timestamp).toBe("number")
    })
  })
})
