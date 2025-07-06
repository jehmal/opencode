#!/usr/bin/env bun

/**
 * Event Emission Test Script for Continuation Prompt Endpoint
 *
 * This script tests the event emission flow in the /session/:id/continuation-prompt endpoint
 * to verify that all events are properly structured and published to the Bus system.
 */

import { Bus } from "./src/bus"
import {
  TaskStartedEvent,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
} from "./src/events/task-events"

// Event collection for verification
const collectedEvents: Array<{
  type: string
  properties: any
  timestamp: number
}> = []

// Subscribe to all task events
console.log("🔍 Setting up event listeners...")

const unsubscribeStarted = Bus.subscribe(TaskStartedEvent, (event) => {
  console.log("✅ TaskStarted event received:", event)
  collectedEvents.push({
    type: event.type,
    properties: event.properties,
    timestamp: Date.now(),
  })
})

const unsubscribeProgress = Bus.subscribe(TaskProgressEvent, (event) => {
  console.log("📈 TaskProgress event received:", event)
  collectedEvents.push({
    type: event.type,
    properties: event.properties,
    timestamp: Date.now(),
  })
})

const unsubscribeCompleted = Bus.subscribe(TaskCompletedEvent, (event) => {
  console.log("🎉 TaskCompleted event received:", event)
  collectedEvents.push({
    type: event.type,
    properties: event.properties,
    timestamp: Date.now(),
  })
})

const unsubscribeFailed = Bus.subscribe(TaskFailedEvent, (event) => {
  console.log("❌ TaskFailed event received:", event)
  collectedEvents.push({
    type: event.type,
    properties: event.properties,
    timestamp: Date.now(),
  })
})

// Also subscribe to all events for debugging
const unsubscribeAll = Bus.subscribeAll((event) => {
  console.log("🔄 All events listener:", event.type)
})

async function testContinuationPromptEndpoint() {
  console.log("🚀 Starting continuation prompt endpoint test...")

  const testSessionID = "test-session-" + Date.now()
  const serverURL = "http://localhost:3000" // Adjust if different

  try {
    // Test payload
    const testPayload = {
      projectName: "Test Project",
      projectGoal: "Testing event emission",
      completionPercentage: 50,
      workingDirectory: "/test/path",
      completedComponents: [
        {
          name: "Test Component",
          description: "A test component",
          filePath: "test.ts",
        },
      ],
      remainingTasks: [
        {
          name: "Test Task",
          description: "A test task",
          priority: "high" as const,
        },
      ],
    }

    console.log(
      `📡 Making request to: ${serverURL}/session/${testSessionID}/continuation-prompt`,
    )

    const response = await fetch(
      `${serverURL}/session/${testSessionID}/continuation-prompt`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayload),
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    console.log("✅ Endpoint response received")
    console.log("📄 Response length:", result.prompt?.length || 0, "characters")

    // Wait a bit for events to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Analyze collected events
    console.log("\n📊 Event Analysis:")
    console.log("Total events collected:", collectedEvents.length)

    const eventsByType = collectedEvents.reduce(
      (acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    console.log("Events by type:", eventsByType)

    // Verify expected event sequence
    const expectedSequence = [
      "task.started",
      "task.progress",
      "task.progress",
      "task.completed",
    ]
    const actualSequence = collectedEvents.map((e) => e.type)

    console.log("\n🔍 Event Sequence Verification:")
    console.log("Expected:", expectedSequence)
    console.log("Actual:  ", actualSequence)

    const sequenceMatch =
      JSON.stringify(expectedSequence) === JSON.stringify(actualSequence)
    console.log("Sequence match:", sequenceMatch ? "✅ PASS" : "❌ FAIL")

    // Verify event structure
    console.log("\n🔍 Event Structure Verification:")
    for (const event of collectedEvents) {
      console.log(`\n${event.type}:`)
      console.log("  sessionID:", event.properties.sessionID)
      console.log("  taskID:", event.properties.taskID)
      console.log("  timestamp:", event.properties.timestamp)

      if (event.type === "task.started") {
        console.log("  agentName:", event.properties.agentName)
        console.log("  taskDescription:", event.properties.taskDescription)
      }

      if (event.type === "task.progress") {
        console.log("  progress:", event.properties.progress)
        console.log("  message:", event.properties.message)
        console.log("  startTime:", event.properties.startTime)
      }

      if (event.type === "task.completed") {
        console.log("  duration:", event.properties.duration)
        console.log("  success:", event.properties.success)
        console.log("  summary:", event.properties.summary)
      }
    }

    return {
      success: true,
      eventsCollected: collectedEvents.length,
      sequenceMatch,
      events: collectedEvents,
    }
  } catch (error) {
    console.error("❌ Test failed:", error)

    // Check if we got a failure event
    const failureEvents = collectedEvents.filter(
      (e) => e.type === "task.failed",
    )
    if (failureEvents.length > 0) {
      console.log("🔍 Failure events detected:", failureEvents)
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      eventsCollected: collectedEvents.length,
      events: collectedEvents,
    }
  }
}

async function testEventEmissionDirectly() {
  console.log("\n🧪 Testing direct event emission...")

  const testData = {
    sessionID: "direct-test-session",
    taskID: "direct-test-task",
    agentName: "Test Agent",
    taskDescription: "Direct emission test",
    timestamp: Date.now(),
  }

  // Clear previous events
  collectedEvents.length = 0

  // Import and test direct emission
  const { emitTaskStarted } = await import("./src/events/task-events")

  console.log("📡 Emitting test event...")
  emitTaskStarted(testData)

  // Wait for event processing
  await new Promise((resolve) => setTimeout(resolve, 100))

  console.log("Events after direct emission:", collectedEvents.length)
  if (collectedEvents.length > 0) {
    console.log("✅ Direct emission working")
    console.log("Event data:", collectedEvents[0])
  } else {
    console.log("❌ Direct emission failed")
  }
}

// Main test execution
async function main() {
  console.log("🔬 Event Emission Verification Test")
  console.log("===================================\n")

  // Test 1: Direct event emission
  await testEventEmissionDirectly()

  // Test 2: Endpoint event emission (requires server to be running)
  console.log("\n" + "=".repeat(50))
  const endpointResult = await testContinuationPromptEndpoint()

  // Cleanup
  unsubscribeStarted()
  unsubscribeProgress()
  unsubscribeCompleted()
  unsubscribeFailed()
  unsubscribeAll()

  // Final report
  console.log("\n📋 Final Test Report:")
  console.log("===================")
  console.log(
    "Endpoint test success:",
    endpointResult.success ? "✅ PASS" : "❌ FAIL",
  )
  console.log("Total events collected:", endpointResult.eventsCollected)

  if (!endpointResult.success && endpointResult.error) {
    console.log("Error details:", endpointResult.error)
  }

  process.exit(endpointResult.success ? 0 : 1)
}

// Handle cleanup on exit
process.on("SIGINT", () => {
  console.log("\n🛑 Test interrupted, cleaning up...")
  process.exit(1)
})

// Run the test
main().catch(console.error)
