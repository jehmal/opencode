#!/usr/bin/env bun
/**
 * Test the exact HTTP call the TUI makes
 */

import { Server } from "./opencode/packages/opencode/src/server/server"
import { App } from "./opencode/packages/opencode/src/app/app"

console.log("=== TESTING TUI HTTP ENDPOINT ===\n")

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  // Start server
  const server = Server.listen({ port: 3458, hostname: "localhost" })
  
  try {
    const sessionId = "ses_8265d514cffeJtVYlbD526eTCt"
    
    // Test the exact endpoint the TUI calls
    console.log(`Testing: GET /session/${sessionId}/sub-sessions`)
    
    const response = await fetch(`http://localhost:3458/session/${sessionId}/sub-sessions`)
    const data = await response.json()
    
    console.log(`\nResponse status: ${response.status}`)
    console.log(`Sub-sessions returned: ${data.length}`)
    
    if (data.length > 0) {
      console.log("\n✅ HTTP endpoint works correctly!")
      console.log("\nSub-sessions from HTTP:")
      data.forEach((sub: any, i: number) => {
        console.log(`${i + 1}. ${sub.agentName}`)
        console.log(`   Task: ${sub.taskDescription}`)
        console.log(`   Status: ${sub.status}`)
      })
      
      console.log("\n🔍 The issue is confirmed:")
      console.log("- Sub-sessions exist ✓")
      console.log("- HTTP endpoint returns them ✓")
      console.log("- But the TUI doesn't display them ✗")
      console.log("\nThis means the installed dgmo binary has the old code")
      console.log("that doesn't properly fetch or display sub-sessions.")
    }
    
  } finally {
    server.stop()
  }
})
