#!/usr/bin/env bun

// Simple test script to diagnose sub-agent errors
import { randomUUID } from "crypto"

console.log("\n🧪 Testing Sub-Agent Functionality\n")
console.log("=".repeat(60))

async function testSubAgents() {
  try {
    // Make a direct HTTP request to test the sub-agent endpoint
    console.log("\n1️⃣ Testing via HTTP API...")

    const baseUrl = "http://localhost:5747"

    // First, check if server is running
    try {
      const healthResponse = await fetch(`${baseUrl}/health`)
      if (!healthResponse.ok) {
        console.error("❌ Server health check failed:", healthResponse.status)
        return
      }
      console.log("✅ Server is running")
    } catch (e) {
      console.error("❌ Cannot connect to server at", baseUrl)
      console.error("Make sure DGMO is running!")
      return
    }

    // Get current sessions
    console.log("\n2️⃣ Getting current sessions...")
    const sessionsResponse = await fetch(`${baseUrl}/session`)
    const sessions = await sessionsResponse.json()
    console.log("Found sessions:", sessions.length)

    if (sessions.length === 0) {
      console.error("❌ No active sessions found. Please start DGMO first.")
      return
    }

    // Use the first session
    const sessionID = sessions[0].id
    console.log("Using session:", sessionID)

    // Get session messages
    console.log("\n3️⃣ Getting session messages...")
    const messagesResponse = await fetch(
      `${baseUrl}/session/${sessionID}/message`,
    )
    const messages = await messagesResponse.json()
    console.log("Found messages:", messages.length)

    // Find the last assistant message
    const assistantMessages = messages.filter(
      (m: any) => m.role === "assistant",
    )
    if (assistantMessages.length === 0) {
      console.error("❌ No assistant messages found in session")
      return
    }

    const lastMessage = assistantMessages[assistantMessages.length - 1]
    console.log("Using message:", lastMessage.id)
    console.log(
      "Message metadata:",
      JSON.stringify(lastMessage.metadata, null, 2),
    )

    // Create a test task
    console.log("\n4️⃣ Creating sub-agent task...")
    const taskPayload = {
      tool: "task",
      arguments: {
        description: "Test task",
        prompt: "Say 'Hello from sub-agent!' and nothing else.",
        agentMode: "read-only",
        autoDebug: false,
        maxRetries: 0,
        techniqueIds: [],
        autoSelectTechniques: false,
        techniqueStrategy: "balanced",
      },
    }

    console.log("Task payload:", JSON.stringify(taskPayload, null, 2))

    // Execute the task
    const taskResponse = await fetch(
      `${baseUrl}/session/${sessionID}/message/${lastMessage.id}/tool`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(taskPayload),
      },
    )

    if (!taskResponse.ok) {
      const errorText = await taskResponse.text()
      console.error("❌ Task execution failed:", taskResponse.status)
      console.error("Error response:", errorText)

      // Try to parse error details
      try {
        const errorJson = JSON.parse(errorText)
        console.error("\nError details:")
        console.error("Type:", errorJson.error?.type || "Unknown")
        console.error(
          "Message:",
          errorJson.error?.message || errorJson.message || "No message",
        )
        console.error("Stack:", errorJson.error?.stack || "No stack trace")
      } catch (e) {
        // Not JSON, just show the text
      }
    } else {
      const result = await taskResponse.json()
      console.log("✅ Task completed successfully!")
      console.log("Result:", JSON.stringify(result, null, 2))
    }

    // Check for sub-sessions
    console.log("\n5️⃣ Checking for sub-sessions...")
    const allSessionsResponse = await fetch(`${baseUrl}/session`)
    const allSessions = await allSessionsResponse.json()
    const subSessions = allSessions.filter((s: any) => s.parentID === sessionID)
    console.log("Found sub-sessions:", subSessions.length)
    subSessions.forEach((s: any) => {
      console.log(
        `  - ${s.id} (created: ${new Date(s.time.created).toLocaleString()})`,
      )
    })
  } catch (error: any) {
    console.error("\n💥 Test failed!")
    console.error("Error:", error.message)
    console.error("Stack:", error.stack)
  }
}

// Run the test
console.log("\n📌 Make sure DGMO is running before running this test!")
console.log(
  "📌 You should have at least one active session with some messages.\n",
)

testSubAgents().catch(console.error)
