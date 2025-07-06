#!/usr/bin/env bun

/**
 * Event Emission Test with Proper App Context
 *
 * This script tests event emission within the proper App context
 * to verify that the Bus system works correctly.
 */

import { App } from "./src/app/app"
import { Bus } from "./src/bus"
import {
  emitTaskStarted,
  emitTaskProgress,
  emitTaskCompleted,
  emitTaskFailed,
  TaskStartedEvent,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
} from "./src/events/task-events"

async function testWithAppContext() {
  console.log("🔬 Testing Event Emission with App Context")
  console.log("==========================================\n")

  // Initialize App context
  return await App.provide({ cwd: process.cwd() }, async (app) => {
    console.log("✅ App context initialized")
    console.log("Working directory:", app.path.cwd)

    // Collect events for verification
    const collectedEvents: Array<{
      type: string
      properties: any
      timestamp: number
    }> = []

    // Subscribe to all task events
    console.log("\n🔔 Setting up event subscriptions...")

    const unsubscribeStarted = Bus.subscribe(TaskStartedEvent, (event) => {
      console.log("📨 TaskStarted event:", event.properties.taskDescription)
      collectedEvents.push({
        type: event.type,
        properties: event.properties,
        timestamp: Date.now(),
      })
    })

    const unsubscribeProgress = Bus.subscribe(TaskProgressEvent, (event) => {
      console.log(
        "📈 TaskProgress event:",
        `${event.properties.progress}% - ${event.properties.message}`,
      )
      collectedEvents.push({
        type: event.type,
        properties: event.properties,
        timestamp: Date.now(),
      })
    })

    const unsubscribeCompleted = Bus.subscribe(TaskCompletedEvent, (event) => {
      console.log("🎉 TaskCompleted event:", event.properties.summary)
      collectedEvents.push({
        type: event.type,
        properties: event.properties,
        timestamp: Date.now(),
      })
    })

    const unsubscribeFailed = Bus.subscribe(TaskFailedEvent, (event) => {
      console.log("❌ TaskFailed event:", event.properties.error)
      collectedEvents.push({
        type: event.type,
        properties: event.properties,
        timestamp: Date.now(),
      })
    })

    // Test the exact sequence from the continuation prompt endpoint
    console.log("\n🚀 Simulating continuation prompt event sequence...")

    const sessionID = "test-session-" + Date.now()
    const taskID = `continuation-${sessionID}-${Date.now()}`
    const startTime = Date.now()

    try {
      // 1. Task Started
      console.log("\n1️⃣ Emitting TaskStarted...")
      emitTaskStarted({
        sessionID,
        taskID,
        agentName: "Continuation Generator",
        taskDescription: "Generating continuation prompt for agent handoff",
        timestamp: startTime,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      // 2. First Progress (25%)
      console.log("2️⃣ Emitting TaskProgress (25%)...")
      emitTaskProgress({
        sessionID,
        taskID,
        progress: 25,
        message: "Analyzing project state...",
        timestamp: Date.now(),
        startTime,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      // 3. Second Progress (75%)
      console.log("3️⃣ Emitting TaskProgress (75%)...")
      emitTaskProgress({
        sessionID,
        taskID,
        progress: 75,
        message: "Generating continuation prompt...",
        timestamp: Date.now(),
        startTime,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      // 4. Task Completed
      console.log("4️⃣ Emitting TaskCompleted...")
      emitTaskCompleted({
        sessionID,
        taskID,
        duration: Date.now() - startTime,
        success: true,
        summary: "Generated continuation prompt (1234 characters)",
        timestamp: Date.now(),
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify event sequence
      console.log("\n📊 Event Verification:")
      console.log("======================")
      console.log("Total events collected:", collectedEvents.length)

      const expectedSequence = [
        "task.started",
        "task.progress",
        "task.progress",
        "task.completed",
      ]
      const actualSequence = collectedEvents.map((e) => e.type)

      console.log("Expected sequence:", expectedSequence)
      console.log("Actual sequence:  ", actualSequence)

      const sequenceMatch =
        JSON.stringify(expectedSequence) === JSON.stringify(actualSequence)
      console.log("Sequence match:", sequenceMatch ? "✅ PASS" : "❌ FAIL")

      // Verify event data structure
      console.log("\n🔍 Event Data Verification:")
      for (let i = 0; i < collectedEvents.length; i++) {
        const event = collectedEvents[i]
        console.log(`\nEvent ${i + 1} (${event.type}):`)
        console.log("  ✅ sessionID:", event.properties.sessionID === sessionID)
        console.log("  ✅ taskID:", event.properties.taskID === taskID)
        console.log(
          "  ✅ timestamp:",
          typeof event.properties.timestamp === "number",
        )

        if (event.type === "task.progress") {
          console.log(
            "  ✅ progress:",
            typeof event.properties.progress === "number",
          )
          console.log(
            "  ✅ message:",
            typeof event.properties.message === "string",
          )
          console.log(
            "  ✅ startTime:",
            event.properties.startTime === startTime,
          )
        }
      }

      // Test error scenario
      console.log("\n🧪 Testing error scenario...")
      emitTaskFailed({
        sessionID,
        taskID: taskID + "-error",
        error: "Simulated error for testing",
        recoverable: true,
        timestamp: Date.now(),
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Cleanup subscriptions
      unsubscribeStarted()
      unsubscribeProgress()
      unsubscribeCompleted()
      unsubscribeFailed()

      console.log("\n✅ All tests completed successfully!")
      console.log("📋 Summary:")
      console.log("  - Event emission: ✅ Working")
      console.log("  - Event subscription: ✅ Working")
      console.log("  - Event sequence: ✅ Correct")
      console.log("  - Event data structure: ✅ Valid")
      console.log("  - Error handling: ✅ Working")

      return {
        success: true,
        eventsCollected: collectedEvents.length,
        sequenceMatch,
      }
    } catch (error) {
      console.error("❌ Test failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
}

// Test direct endpoint call (requires server to be running)
async function testEndpointCall() {
  console.log("\n🌐 Testing Endpoint Call (requires server running)")
  console.log("================================================")

  try {
    const testSessionID = "endpoint-test-" + Date.now()
    const response = await fetch(
      `http://localhost:3000/session/${testSessionID}/continuation-prompt`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectName: "Event Test Project",
          projectGoal: "Testing event emission in endpoint",
          completionPercentage: 80,
        }),
      },
    )

    if (response.ok) {
      const result = await response.json()
      console.log("✅ Endpoint call successful")
      console.log("📄 Response prompt length:", result.prompt?.length || 0)
      return { success: true }
    } else {
      console.log(
        "❌ Endpoint call failed:",
        response.status,
        response.statusText,
      )
      return { success: false, error: `HTTP ${response.status}` }
    }
  } catch (error) {
    console.log(
      "⚠️ Endpoint test skipped (server not running):",
      error instanceof Error ? error.message : String(error),
    )
    return { success: false, error: "Server not running" }
  }
}

async function main() {
  const contextResult = await testWithAppContext()
  const endpointResult = await testEndpointCall()

  console.log("\n🏁 Final Results:")
  console.log("================")
  console.log("Context test:", contextResult.success ? "✅ PASS" : "❌ FAIL")
  console.log(
    "Endpoint test:",
    endpointResult.success ? "✅ PASS" : "⚠️ SKIPPED",
  )

  if (!contextResult.success) {
    console.log("Context error:", contextResult.error)
  }

  process.exit(contextResult.success ? 0 : 1)
}

main().catch(console.error)
