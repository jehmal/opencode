#!/usr/bin/env bun
/**
 * Test the sub-session HTTP endpoints directly
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Server } from "./opencode/packages/opencode/src/server/server"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"

console.log("=== SUB-SESSION HTTP ENDPOINT TEST ===\n")

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  // Start the server
  console.log("1. Starting server on localhost:3456...")
  const server = Server.listen({ port: 3456, hostname: "localhost" })
  console.log("   Server started successfully")
  console.log("")

  // Create a test session
  console.log("2. Creating test session...")
  const parentSession = await Session.create()
  await Session.update(parentSession.id, { title: "HTTP Test Parent" })
  console.log(`   Created parent session: ${parentSession.id}`)
  console.log("")

  // Create sub-sessions via the SubSession module
  console.log("3. Creating sub-sessions...")
  const subSession1 = await Session.create(parentSession.id)
  await SubSession.create(
    parentSession.id,
    subSession1.id,
    "Test Agent 1",
    "Testing HTTP endpoint"
  )
  console.log(`   Created sub-session 1: ${subSession1.id}`)

  const subSession2 = await Session.create(parentSession.id)
  await SubSession.create(
    parentSession.id,
    subSession2.id,
    "Test Agent 2",
    "Another test task"
  )
  console.log(`   Created sub-session 2: ${subSession2.id}`)
  console.log("")

  // Test the HTTP endpoints
  console.log("4. Testing HTTP endpoints...")
  
  // Test 1: Get sub-sessions for parent
  console.log("\n   Test 1: GET /session/:id/sub-sessions")
  try {
    const response = await fetch(`http://localhost:3456/session/${parentSession.id}/sub-sessions`)
    const data = await response.json()
    console.log(`   Status: ${response.status}`)
    console.log(`   Found ${data.length} sub-sessions`)
    if (data.length > 0) {
      console.log("   Sub-sessions:")
      data.forEach((sub: any) => {
        console.log(`     - ${sub.agentName}: ${sub.taskDescription} (${sub.status})`)
      })
    }
  } catch (e) {
    console.error("   Error:", e)
  }

  // Test 2: Get all sub-sessions
  console.log("\n   Test 2: GET /sub-sessions")
  try {
    const response = await fetch(`http://localhost:3456/sub-sessions`)
    const data = await response.json()
    console.log(`   Status: ${response.status}`)
    console.log(`   Total sub-sessions in system: ${data.length}`)
  } catch (e) {
    console.error("   Error:", e)
  }

  // Test 3: Get specific sub-session
  console.log("\n   Test 3: GET /sub-session/:id")
  try {
    const response = await fetch(`http://localhost:3456/sub-session/${subSession1.id}`)
    const data = await response.json()
    console.log(`   Status: ${response.status}`)
    console.log(`   Sub-session details:`, data)
  } catch (e) {
    console.error("   Error:", e)
  }

  // Test 4: Search sub-sessions
  console.log("\n   Test 4: GET /sub-sessions/search?q=test")
  try {
    const response = await fetch(`http://localhost:3456/sub-sessions/search?q=test`)
    const data = await response.json()
    console.log(`   Status: ${response.status}`)
    console.log(`   Search results: ${data.length} matches`)
  } catch (e) {
    console.error("   Error:", e)
  }

  console.log("\n5. Cleanup...")
  server.stop()
  console.log("   Server stopped")
  
  console.log("\n=== TEST COMPLETE ===")
  console.log("\nIf the HTTP endpoints are working correctly, the issue is likely in:")
  console.log("- The TUI client not calling the correct endpoint")
  console.log("- The session ID being passed incorrectly")
  console.log("- The SDK client configuration")
})
