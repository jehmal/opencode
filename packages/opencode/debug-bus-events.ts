#!/usr/bin/env bun

/**
 * Debug Bus Event Integration
 *
 * This script adds debug logging to verify Bus.publish is receiving events correctly
 */

import { Bus } from "./src/bus"
import {
  emitTaskStarted,
  emitTaskProgress,
  emitTaskCompleted,
  emitTaskFailed,
} from "./src/events/task-events"

// Patch Bus.publish to add debug logging
const originalPublish = Bus.publish
Bus.publish = async function (def, properties) {
  console.log("🔍 [DEBUG] Bus.publish called:")
  console.log("  Event type:", def.type)
  console.log("  Properties:", JSON.stringify(properties, null, 2))
  console.log("  Timestamp:", new Date().toISOString())

  try {
    const result = await originalPublish.call(this, def, properties)
    console.log("  ✅ Published successfully")
    return result
  } catch (error) {
    console.log("  ❌ Publish failed:", error)
    throw error
  }
}

// Test each emit function
async function testEmitFunctions() {
  console.log("🧪 Testing emit functions with debug logging...\n")

  const testSessionID = "debug-test-session"
  const testTaskID = "debug-test-task"
  const startTime = Date.now()

  console.log("1️⃣ Testing emitTaskStarted...")
  emitTaskStarted({
    sessionID: testSessionID,
    taskID: testTaskID,
    agentName: "Debug Test Agent",
    taskDescription: "Testing event emission with debug logging",
    timestamp: startTime,
  })

  await new Promise((resolve) => setTimeout(resolve, 100))

  console.log("\n2️⃣ Testing emitTaskProgress...")
  emitTaskProgress({
    sessionID: testSessionID,
    taskID: testTaskID,
    progress: 50,
    message: "Debug test in progress",
    timestamp: Date.now(),
    startTime,
  })

  await new Promise((resolve) => setTimeout(resolve, 100))

  console.log("\n3️⃣ Testing emitTaskCompleted...")
  emitTaskCompleted({
    sessionID: testSessionID,
    taskID: testTaskID,
    duration: Date.now() - startTime,
    success: true,
    summary: "Debug test completed successfully",
    timestamp: Date.now(),
  })

  await new Promise((resolve) => setTimeout(resolve, 100))

  console.log("\n4️⃣ Testing emitTaskFailed...")
  emitTaskFailed({
    sessionID: testSessionID,
    taskID: testTaskID + "-fail",
    error: "Simulated error for testing",
    recoverable: true,
    timestamp: Date.now(),
  })

  console.log("\n✅ All emit function tests completed")
}

// Test subscription to verify events are received
async function testSubscription() {
  console.log("\n🔔 Testing event subscription...")

  let eventsReceived = 0

  const unsubscribe = Bus.subscribeAll((event) => {
    eventsReceived++
    console.log(`📨 [SUBSCRIPTION] Event ${eventsReceived} received:`)
    console.log("  Type:", event.type)
    console.log("  SessionID:", event.properties?.sessionID)
    console.log("  TaskID:", event.properties?.taskID)
  })

  // Emit a test event
  console.log("\n📡 Emitting test event for subscription...")
  emitTaskStarted({
    sessionID: "subscription-test",
    taskID: "subscription-task",
    agentName: "Subscription Test",
    taskDescription: "Testing subscription mechanism",
    timestamp: Date.now(),
  })

  await new Promise((resolve) => setTimeout(resolve, 200))

  unsubscribe()
  console.log(
    `\n📊 Subscription test result: ${eventsReceived} events received`,
  )

  return eventsReceived > 0
}

async function main() {
  console.log("🔬 Bus Event Debug Session")
  console.log("=========================\n")

  try {
    await testEmitFunctions()
    const subscriptionWorking = await testSubscription()

    console.log("\n📋 Debug Summary:")
    console.log("================")
    console.log("Event emission: ✅ Tested (check logs above)")
    console.log(
      "Subscription:",
      subscriptionWorking ? "✅ Working" : "❌ Failed",
    )
    console.log("Bus.publish:", "✅ Instrumented with debug logging")

    console.log("\n💡 Next steps:")
    console.log("- Run the server and check if events appear in logs")
    console.log("- Test the /continuation-prompt endpoint")
    console.log("- Verify WebSocket event streaming if implemented")
  } catch (error) {
    console.error("❌ Debug session failed:", error)
    process.exit(1)
  }
}

main().catch(console.error)
