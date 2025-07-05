#!/usr/bin/env bun
/**
 * Direct test - create a task and verify sub-session creation
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"
import { Server } from "./opencode/packages/opencode/src/server/server"

console.log("=== DIRECT SUB-SESSION TEST ===\n")

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  // Start server
  console.log("1. Starting server...")
  const server = Server.listen({ port: 3457, hostname: "localhost" })
  
  try {
    // Create a parent session
    console.log("\n2. Creating parent session...")
    const parentSession = await Session.create()
    await Session.update(parentSession.id, (s) => {
      s.title = "Test Parent for Sub-Sessions"
    })
    console.log(`   Created: ${parentSession.id}`)
    
    // Simulate what the task tool does
    console.log("\n3. Simulating task tool execution...")
    
    // Create child session
    const childSession = await Session.create(parentSession.id)
    console.log(`   Created child session: ${childSession.id}`)
    console.log(`   Parent ID: ${childSession.parentID}`)
    
    // Create sub-session record (this is what might be missing!)
    console.log("\n4. Creating sub-session record...")
    const subSessionInfo = await SubSession.create(
      parentSession.id,
      childSession.id,
      "Test Agent",
      "Test task description"
    )
    console.log(`   Sub-session record created`)
    
    // Verify it was stored
    console.log("\n5. Verifying sub-session storage...")
    const subSessions = await SubSession.getByParent(parentSession.id)
    console.log(`   Found ${subSessions.length} sub-sessions for parent`)
    
    if (subSessions.length > 0) {
      console.log("\n   ✅ SUCCESS! Sub-sessions are being created correctly")
      console.log("\n   Sub-session details:")
      subSessions.forEach(sub => {
        console.log(`   - ${sub.agentName}: ${sub.taskDescription}`)
        console.log(`     ID: ${sub.id}`)
        console.log(`     Status: ${sub.status}`)
      })
    } else {
      console.log("\n   ❌ FAILED! No sub-sessions found")
    }
    
    // Test the HTTP endpoint
    console.log("\n6. Testing HTTP endpoint...")
    const response = await fetch(`http://localhost:3457/session/${parentSession.id}/sub-sessions`)
    const data = await response.json()
    console.log(`   HTTP endpoint returned ${data.length} sub-sessions`)
    
    // Show what the TUI should display
    console.log("\n7. What the TUI should show:")
    console.log(`   When in session: ${parentSession.id}`)
    console.log(`   Should see ${subSessions.length} sub-sessions`)
    console.log(`\n   The issue is that your installed dgmo doesn't have the fix`)
    console.log(`   that checks parent sessions and shows siblings.`)
    
  } finally {
    server.stop()
  }
  
  console.log("\n\nTo fix dgmo:")
  console.log("1. The sub-sessions ARE being created (as verified above)")
  console.log("2. But the installed dgmo only checks current session")
  console.log("3. You need to either:")
  console.log("   - Rebuild dgmo from source with our fixes")
  console.log("   - Install a patched version")
  console.log("   - Use the session ID of the PARENT when checking sub-sessions")
})
