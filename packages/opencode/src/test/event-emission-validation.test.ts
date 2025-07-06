import { describe, test, expect, beforeEach } from "bun:test"
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

describe("Event Emission Validation", () => {
  let capturedEvents: any[] = []

  beforeEach(() => {
    capturedEvents = []
  })

  test("emitTaskStarted publishes correct event structure", async () => {
    // Subscribe to capture the event
    const unsubscribe = Bus.subscribe(TaskStartedEvent, (event) => {
      capturedEvents.push(event)
    })

    const testData = {
      sessionID: "emit-test-session",
      taskID: "emit-test-task",
      agentName: "Emit Test Agent",
      taskDescription: "Testing event emission",
      timestamp: Date.now(),
    }

    // Emit the event
    await emitTaskStarted(testData)

    // Verify event was captured
    expect(capturedEvents.length).toBe(1)

    const capturedEvent = capturedEvents[0]
    expect(capturedEvent.type).toBe("task.started")
    expect(capturedEvent.properties).toEqual(testData)

    unsubscribe()
  })

  test("emitTaskProgress publishes correct event structure", async () => {
    const unsubscribe = Bus.subscribe(TaskProgressEvent, (event) => {
      capturedEvents.push(event)
    })

    const testData = {
      sessionID: "progress-test-session",
      taskID: "progress-test-task",
      progress: 75,
      message: "Three quarters complete",
      timestamp: Date.now(),
      startTime: Date.now() - 5000,
    }

    await emitTaskProgress(testData)

    expect(capturedEvents.length).toBe(1)

    const capturedEvent = capturedEvents[0]
    expect(capturedEvent.type).toBe("task.progress")
    expect(capturedEvent.properties).toEqual(testData)

    // Verify progress bounds are respected
    expect(capturedEvent.properties.progress).toBeGreaterThanOrEqual(0)
    expect(capturedEvent.properties.progress).toBeLessThanOrEqual(100)

    unsubscribe()
  })

  test("emitTaskCompleted publishes correct event structure", async () => {
    const unsubscribe = Bus.subscribe(TaskCompletedEvent, (event) => {
      capturedEvents.push(event)
    })

    const testData = {
      sessionID: "completed-test-session",
      taskID: "completed-test-task",
      duration: 3500,
      success: true,
      summary: "Task completed successfully",
      timestamp: Date.now(),
    }

    await emitTaskCompleted(testData)

    expect(capturedEvents.length).toBe(1)

    const capturedEvent = capturedEvents[0]
    expect(capturedEvent.type).toBe("task.completed")
    expect(capturedEvent.properties).toEqual(testData)

    unsubscribe()
  })

  test("emitTaskFailed publishes correct event structure", async () => {
    const unsubscribe = Bus.subscribe(TaskFailedEvent, (event) => {
      capturedEvents.push(event)
    })

    const testData = {
      sessionID: "failed-test-session",
      taskID: "failed-test-task",
      error: "Test error message",
      recoverable: true,
      timestamp: Date.now(),
    }

    await emitTaskFailed(testData)

    expect(capturedEvents.length).toBe(1)

    const capturedEvent = capturedEvents[0]
    expect(capturedEvent.type).toBe("task.failed")
    expect(capturedEvent.properties).toEqual(testData)

    unsubscribe()
  })

  test("Event emission validates data against schema", async () => {
    // This test verifies that the emit functions use the correct schema validation
    const unsubscribe = Bus.subscribe(TaskProgressEvent, (event) => {
      capturedEvents.push(event)
    })

    // Valid data should work
    const validData = {
      sessionID: "validation-test",
      taskID: "validation-task",
      progress: 50,
      timestamp: Date.now(),
    }

    await emitTaskProgress(validData)
    expect(capturedEvents.length).toBe(1)

    // The emitted event should validate against the schema
    const emittedEvent = capturedEvents[0]
    const validationResult = TaskProgressEvent.properties.safeParse(
      emittedEvent.properties,
    )
    expect(validationResult.success).toBe(true)

    unsubscribe()
  })

  test("Multiple event types can be emitted in sequence", async () => {
    const allEvents: any[] = []

    // Subscribe to all event types
    const unsubscribes = [
      Bus.subscribe(TaskStartedEvent, (event) => allEvents.push(event)),
      Bus.subscribe(TaskProgressEvent, (event) => allEvents.push(event)),
      Bus.subscribe(TaskCompletedEvent, (event) => allEvents.push(event)),
    ]

    const sessionID = "sequence-test"
    const taskID = "sequence-task"
    const timestamp = Date.now()

    // Emit a sequence of events
    await emitTaskStarted({
      sessionID,
      taskID,
      agentName: "Sequence Agent",
      taskDescription: "Testing event sequence",
      timestamp,
    })

    await emitTaskProgress({
      sessionID,
      taskID,
      progress: 50,
      message: "Halfway done",
      timestamp: timestamp + 1000,
    })

    await emitTaskCompleted({
      sessionID,
      taskID,
      duration: 2000,
      success: true,
      summary: "Sequence completed",
      timestamp: timestamp + 2000,
    })

    // Verify all events were captured
    expect(allEvents.length).toBe(3)

    // Verify event order and types
    expect(allEvents[0].type).toBe("task.started")
    expect(allEvents[1].type).toBe("task.progress")
    expect(allEvents[2].type).toBe("task.completed")

    // Verify all events have the same sessionID and taskID
    allEvents.forEach((event) => {
      expect(event.properties.sessionID).toBe(sessionID)
      expect(event.properties.taskID).toBe(taskID)
    })

    unsubscribes.forEach((unsub) => unsub())
  })

  test("Event properties maintain type integrity", async () => {
    const unsubscribe = Bus.subscribe(TaskProgressEvent, (event) => {
      capturedEvents.push(event)
    })

    const testData = {
      sessionID: "type-test",
      taskID: "type-task",
      progress: 42,
      message: "Type testing",
      timestamp: 1672531200000,
      startTime: 1672531100000,
    }

    await emitTaskProgress(testData)

    const capturedEvent = capturedEvents[0]
    const props = capturedEvent.properties

    // Verify types are preserved
    expect(typeof props.sessionID).toBe("string")
    expect(typeof props.taskID).toBe("string")
    expect(typeof props.progress).toBe("number")
    expect(typeof props.message).toBe("string")
    expect(typeof props.timestamp).toBe("number")
    expect(typeof props.startTime).toBe("number")

    // Verify exact values
    expect(props.progress).toBe(42)
    expect(props.timestamp).toBe(1672531200000)
    expect(props.startTime).toBe(1672531100000)

    unsubscribe()
  })

  test("Optional fields are handled correctly", async () => {
    const progressEvents: any[] = []
    const completedEvents: any[] = []

    const unsubscribes = [
      Bus.subscribe(TaskProgressEvent, (event) => progressEvents.push(event)),
      Bus.subscribe(TaskCompletedEvent, (event) => completedEvents.push(event)),
    ]

    // Test progress event without optional fields
    await emitTaskProgress({
      sessionID: "optional-test",
      taskID: "optional-task",
      progress: 25,
      timestamp: Date.now(),
    })

    // Test completed event without optional summary
    await emitTaskCompleted({
      sessionID: "optional-test",
      taskID: "optional-task",
      duration: 1000,
      success: true,
      timestamp: Date.now(),
    })

    // Verify events were emitted
    expect(progressEvents.length).toBe(1)
    expect(completedEvents.length).toBe(1)

    // Verify optional fields are undefined when not provided
    expect(progressEvents[0].properties.message).toBeUndefined()
    expect(progressEvents[0].properties.startTime).toBeUndefined()
    expect(completedEvents[0].properties.summary).toBeUndefined()

    unsubscribes.forEach((unsub) => unsub())
  })
})
