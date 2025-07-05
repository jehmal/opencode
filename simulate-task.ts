#!/usr/bin/env bun
/**
 * Simulate task tool execution
 * This mimics what happens when you create agents in DGMO
 */

import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"
import { App } from "./opencode/packages/opencode/src/app/app"
import { AgentConfig } from "./opencode/packages/opencode/src/config/agent-config"
import path from "path"
import fs from "fs/promises"

console.log("=== Task Tool Simulation ===")
console.log("This simulates what happens when you create agents\n")

async function simulateTaskExecution() {
  await App.provide({ cwd: process.cwd() }, async () => {
    const appInfo = App.info()
    console.log("1. App Context:")
    console.log("   Data path:", appInfo.path.data)
    console.log("   CWD:", process.cwd())
    
    // Find the most recent main session
    const sessionInfoDir = path.join(appInfo.path.data, "storage", "session", "info")
    const files = await fs.readdir(sessionInfoDir)
    const sessions = []
    
    for (const file of files) {
      const sessionId = file.replace('.json', '')
      const sessionData = JSON.parse(
        await fs.readFile(path.join(sessionInfoDir, file), 'utf-8')
      )
      sessions.push({ id: sessionId, ...sessionData })
    }
    
    const mainSession = sessions
      .filter(s => !s.parentID)
      .sort((a, b) => b.time.created - a.time.created)[0]
    
    if (!mainSession) {
      console.log("No main session found!")
      return
    }
    
    console.log("\n2. Using Main Session:", mainSession.id)
    console.log("   Title:", mainSession.title)
    
    // Simulate task tool execution
    console.log("\n3. Simulating Task Tool Execution...")
    
    const params = {
      description: "Test simulation",
      prompt: "Simulated task from debug script"
    }
    
    const ctx = {
      sessionID: mainSession.id,
      messageID: "msg_test_" + Date.now(),
      abort: new AbortController().signal,
      metadata: async (val: any) => {}
    }
    
    console.log("   Context sessionID:", ctx.sessionID)
    console.log("   Creating sub-session with parent:", ctx.sessionID)
    
    // This is what task.ts does:
    console.log("\n4. Creating Sub-Session (like task.ts does)...")
    
    try {
      // Create a sub-session with the current session as parent
      const subSession = await Session.create(ctx.sessionID)
      console.log("   ✓ Sub-session created:", subSession.id)
      console.log("   - Parent ID set to:", subSession.parentID)
      console.log("   - Matches context:", subSession.parentID === ctx.sessionID ? "YES" : "NO")
      
      // Set agent mode
      const mode = "read-only"
      AgentConfig.setSessionAgentMode(subSession.id, mode)
      console.log("   ✓ Agent mode set to:", mode)
      
      // Store sub-session info for navigation
      console.log("\n5. Storing Sub-Session Info...")
      console.log("   Calling SubSession.create with:")
      console.log("   - parentSessionId:", ctx.sessionID)
      console.log("   - sessionId:", subSession.id)
      console.log("   - agentName: Agent Test simulation")
      console.log("   - taskDescription:", params.prompt)
      
      await SubSession.create(
        ctx.sessionID,
        subSession.id,
        `Agent ${params.description}`,
        params.prompt
      )
      console.log("   ✓ SubSession.create completed")
      
      // Verify storage
      console.log("\n6. Verifying Storage...")
      
      // Check if sub-session file exists
      const subPath = path.join(appInfo.path.data, "storage", "session", "sub-sessions", `${subSession.id}.json`)
      try {
        const subData = JSON.parse(await fs.readFile(subPath, 'utf-8'))
        console.log("   ✓ Sub-session file exists:", subPath)
        console.log("   - Content:", JSON.stringify(subData, null, 2))
      } catch (e) {
        console.log("   ✗ Sub-session file NOT found:", subPath)
      }
      
      // Check if index was updated
      const indexPath = path.join(appInfo.path.data, "storage", "session", "sub-session-index", `${ctx.sessionID}.json`)
      try {
        const indexData = JSON.parse(await fs.readFile(indexPath, 'utf-8'))
        console.log("   ✓ Index file exists:", indexPath)
        console.log("   - Contains", indexData.length, "entries")
        console.log("   - Includes our sub-session:", indexData.includes(subSession.id) ? "YES" : "NO")
      } catch (e) {
        console.log("   ✗ Index file NOT found:", indexPath)
      }
      
      // Test retrieval (what TUI does)
      console.log("\n7. Testing Retrieval (like TUI)...")
      const retrieved = await SubSession.getByParent(ctx.sessionID)
      console.log("   SubSession.getByParent returned:", retrieved.length, "sub-sessions")
      
      const found = retrieved.find(s => s.id === subSession.id)
      if (found) {
        console.log("   ✓ Our sub-session was found!")
      } else {
        console.log("   ✗ Our sub-session was NOT found!")
        
        // Debug why
        console.log("\n8. Debugging Why Not Found...")
        console.log("   Checking Storage.list('session/sub-sessions')...")
        let allFiles = []
        for await (const file of Storage.list("session/sub-sessions")) {
          allFiles.push(file)
        }
        console.log("   - Total files:", allFiles.length)
        console.log("   - Our file in list:", allFiles.includes(`session/sub-sessions/${subSession.id}`) ? "YES" : "NO")
      }
      
      // Clean up
      console.log("\n9. Cleaning up test sub-session...")
      await SubSession.remove(subSession.id)
      await Session.remove(subSession.id)
      console.log("   ✓ Cleaned up")
      
    } catch (error) {
      console.error("   ✗ Error:", error)
    }
    
    console.log("\n=== END OF SIMULATION ===")
  })
}

simulateTaskExecution().catch(console.error)
