import { describe, test, expect } from "bun:test"
import { Bus } from "../bus"
import {
  TaskStartedEvent,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
} from "../events/task-events"

describe("Event Schema Validation", () => {
  test("Event type strings are consistent", () => {
    // Verify event type strings match expected values
    expect(TaskStartedEvent.type).toBe("task.started")
    expect(TaskProgressEvent.type).toBe("task.progress")
    expect(TaskCompletedEvent.type).toBe("task.completed")
    expect(TaskFailedEvent.type).toBe("task.failed")
  })

  test("TaskStartedEvent schema validation", () => {
    const validData = {
      sessionID: "test-session-123",
      taskID: "task-456",
      agentName: "Test Agent",
      taskDescription: "Testing task started event",
      timestamp: 1672531200000,
    }

    // Should validate successfully
    const result = TaskStartedEvent.properties.safeParse(validData)
    expect(result.success).toBe(true)

    // Test missing required field
    const invalidData = {
      sessionID: "test-session-123",
      // Missing taskID, agentName, taskDescription, timestamp
    }

    const invalidResult = TaskStartedEvent.properties.safeParse(invalidData)
    expect(invalidResult.success).toBe(false)
  })

  test("TaskProgressEvent schema validation", () => {
    const validData = {
      sessionID: "test-session-123",
      taskID: "task-456",
      progress: 50,
      message: "Halfway complete",
      timestamp: 1672531200000,
      startTime: 1672531100000,
    }

    const result = TaskProgressEvent.properties.safeParse(validData)
    expect(result.success).toBe(true)

    // Test progress bounds validation
    const invalidProgress = {
      ...validData,
      progress: 150, // Invalid: > 100
    }

    const invalidResult =
      TaskProgressEvent.properties.safeParse(invalidProgress)
    expect(invalidResult.success).toBe(false)

    // Test negative progress
    const negativeProgress = {
      ...validData,
      progress: -10, // Invalid: < 0
    }

    const negativeResult =
      TaskProgressEvent.properties.safeParse(negativeProgress)
    expect(negativeResult.success).toBe(false)

    // Test optional fields
    const minimalData = {
      sessionID: "test-session-123",
      taskID: "task-456",
      progress: 25,
      timestamp: 1672531200000,
    }

    const minimalResult = TaskProgressEvent.properties.safeParse(minimalData)
    expect(minimalResult.success).toBe(true)
  })

  test("TaskCompletedEvent schema validation", () => {
    const validData = {
      sessionID: "test-session-123",
      taskID: "task-456",
      duration: 5000,
      success: true,
      summary: "Task completed successfully",
      timestamp: 1672531200000,
    }

    const result = TaskCompletedEvent.properties.safeParse(validData)
    expect(result.success).toBe(true)

    // Test with optional summary missing
    const withoutSummary = {
      sessionID: "test-session-123",
      taskID: "task-456",
      duration: 3000,
      success: false,
      timestamp: 1672531200000,
    }

    const resultWithoutSummary =
      TaskCompletedEvent.properties.safeParse(withoutSummary)
    expect(resultWithoutSummary.success).toBe(true)

    // Test invalid duration (should be number)
    const invalidDuration = {
      ...validData,
      duration: "5000", // Invalid: string instead of number
    }

    const invalidResult =
      TaskCompletedEvent.properties.safeParse(invalidDuration)
    expect(invalidResult.success).toBe(false)
  })

  test("TaskFailedEvent schema validation", () => {
    const validData = {
      sessionID: "test-session-123",
      taskID: "task-456",
      error: "Something went wrong",
      recoverable: true,
      timestamp: 1672531200000,
    }

    const result = TaskFailedEvent.properties.safeParse(validData)
    expect(result.success).toBe(true)

    // Test with recoverable as false
    const nonRecoverable = {
      ...validData,
      recoverable: false,
    }

    const nonRecoverableResult =
      TaskFailedEvent.properties.safeParse(nonRecoverable)
    expect(nonRecoverableResult.success).toBe(true)

    // Test missing error field
    const missingError = {
      sessionID: "test-session-123",
      taskID: "task-456",
      recoverable: true,
      timestamp: 1672531200000,
      // Missing error field
    }

    const missingErrorResult =
      TaskFailedEvent.properties.safeParse(missingError)
    expect(missingErrorResult.success).toBe(false)
  })

  test("Bus event registry contains all task events", () => {
    const payloads = Bus.payloads()

    // Test that the discriminated union includes our event types
    const testEvents = [
      {
        type: "task.started",
        properties: {
          sessionID: "test",
          taskID: "test",
          agentName: "test",
          taskDescription: "test",
          timestamp: Date.now(),
        },
      },
      {
        type: "task.progress",
        properties: {
          sessionID: "test",
          taskID: "test",
          progress: 50,
          timestamp: Date.now(),
        },
      },
      {
        type: "task.completed",
        properties: {
          sessionID: "test",
          taskID: "test",
          duration: 1000,
          success: true,
          timestamp: Date.now(),
        },
      },
      {
        type: "task.failed",
        properties: {
          sessionID: "test",
          taskID: "test",
          error: "test error",
          recoverable: false,
          timestamp: Date.now(),
        },
      },
    ]

    // All test events should validate successfully
    testEvents.forEach((event) => {
      const result = payloads.safeParse(event)
      expect(result.success).toBe(true)
    })

    // Invalid event type should fail
    const invalidEvent = {
      type: "invalid.event",
      properties: {},
    }

    const invalidResult = payloads.safeParse(invalidEvent)
    expect(invalidResult.success).toBe(false)
  })

  test("Event property types are correctly inferred", () => {
    // Test that TypeScript types are correctly inferred from Zod schemas
    type TaskStartedProps = typeof TaskStartedEvent.properties._output
    type TaskProgressProps = typeof TaskProgressEvent.properties._output
    type TaskCompletedProps = typeof TaskCompletedEvent.properties._output
    type TaskFailedProps = typeof TaskFailedEvent.properties._output

    // These should compile without errors if types are correct
    const startedProps: TaskStartedProps = {
      sessionID: "test",
      taskID: "test",
      agentName: "test",
      taskDescription: "test",
      timestamp: 123456789,
    }

    const progressProps: TaskProgressProps = {
      sessionID: "test",
      taskID: "test",
      progress: 50,
      timestamp: 123456789,
      message: "optional message",
      startTime: 123456700,
    }

    const completedProps: TaskCompletedProps = {
      sessionID: "test",
      taskID: "test",
      duration: 1000,
      success: true,
      timestamp: 123456789,
      summary: "optional summary",
    }

    const failedProps: TaskFailedProps = {
      sessionID: "test",
      taskID: "test",
      error: "error message",
      recoverable: true,
      timestamp: 123456789,
    }

    // Verify the objects are properly typed
    expect(typeof startedProps.sessionID).toBe("string")
    expect(typeof progressProps.progress).toBe("number")
    expect(typeof completedProps.success).toBe("boolean")
    expect(typeof failedProps.recoverable).toBe("boolean")
  })

  test("Event data structure matches server emission format", () => {
    // Test that the event structure matches what the server emits
    // Server emits: { type: "event.type", data: eventProperties }

    const taskStartedData = {
      sessionID: "server-test",
      taskID: "server-task",
      agentName: "Server Agent",
      taskDescription: "Server task description",
      timestamp: Date.now(),
    }

    // Simulate server emission structure
    const serverEmittedEvent = {
      type: "task.started",
      data: taskStartedData,
    }

    // Verify the data part validates against our schema
    const dataValidation = TaskStartedEvent.properties.safeParse(
      serverEmittedEvent.data,
    )
    expect(dataValidation.success).toBe(true)

    // Verify the type matches our event definition
    expect(serverEmittedEvent.type).toBe(TaskStartedEvent.type)
  })
})
