#!/usr/bin/env bun
/**
 * Comprehensive sub-session testing script
 * This script tests the entire flow of sub-session creation and retrieval
 * to diagnose why sub-sessions aren't showing in the TUI
 */

import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"
import { Storage } from "./opencode/packages/opencode/src/storage/storage"
import { App } from "./opencode/packages/opencode/src/app/app"
import { Provider } from "./opencode/packages/opencode/src/provider/provider"
import { Config } from "./opencode/packages/opencode/src/config/config"
import path from "path"
import fs from "fs/promises"

console.log("=== DGMO Sub-Session Debug Script ===")
console.log("This script will test sub-session creation and retrieval\n")

// Initialize the app context
async function initializeApp() {
  console.log("1. Initializing App...")
  await App.provide({ cwd: process.cwd() }, async () => {
    const appInfo = App.info()
    console.log("   App initialized:")
    console.log("   - Data path:", appInfo.path.data)
    console.log("   - Root path:", appInfo.path.root)
    console.log("   - CWD path:", appInfo.path.cwd)
    console.log("   - Config path:", appInfo.path.config)
    console.log("   - State path:", appInfo.path.state)
    
    // Get storage directory
    const storageDir = path.join(appInfo.path.data, "storage")
    console.log("\n2. Storage Directory:", storageDir)
    
    // Check if storage directory exists
    try {
      await fs.access(storageDir)
      console.log("   ✓ Storage directory exists")
    } catch {
      console.log("   ✗ Storage directory does not exist!")
      return
    }
    
    // List all session info files to find active sessions
    console.log("\n3. Finding Active Sessions...")
    const sessionInfoDir = path.join(storageDir, "session", "info")
    let sessions = []
    
    try {
      const files = await fs.readdir(sessionInfoDir)
      console.log(`   Found ${files.length} session files`)
      
      // Get details of each session
      for (const file of files.slice(-5)) { // Last 5 sessions
        const sessionId = file.replace('.json', '')
        const sessionData = JSON.parse(
          await fs.readFile(path.join(sessionInfoDir, file), 'utf-8')
        )
        sessions.push({ id: sessionId, ...sessionData })
        console.log(`   - ${sessionId}: ${sessionData.title || 'No title'}`)
        console.log(`     Created: ${new Date(sessionData.time.created).toLocaleString()}`)
        console.log(`     Parent: ${sessionData.parentID || 'None (main session)'}`)
      }
    } catch (e) {
      console.error("   Error reading sessions:", e.message)
    }
    
    // Find the most recent main session (no parent)
    const mainSession = sessions
      .filter(s => !s.parentID)
      .sort((a, b) => b.time.created - a.time.created)[0]
    
    if (!mainSession) {
      console.log("\n❌ No main session found!")
      return
    }
    
    console.log("\n4. Using Main Session:", mainSession.id)
    
    // Test 1: Check sub-sessions using SubSession.getByParent (what TUI uses)
    console.log("\n5. Testing SubSession.getByParent()...")
    try {
      const subSessions = await SubSession.getByParent(mainSession.id)
      console.log(`   Result: Found ${subSessions.length} sub-sessions`)
      
      if (subSessions.length > 0) {
        subSessions.forEach((sub, idx) => {
          console.log(`\n   Sub-session ${idx + 1}:`)
          console.log(`   - ID: ${sub.id}`)
          console.log(`   - Parent: ${sub.parentSessionId}`)
          console.log(`   - Agent: ${sub.agentName}`)
          console.log(`   - Task: ${sub.taskDescription}`)
          console.log(`   - Status: ${sub.status}`)
          console.log(`   - Created: ${new Date(sub.createdAt).toLocaleString()}`)
        })
      }
    } catch (e) {
      console.error("   Error getting sub-sessions:", e)
    }
    
    // Test 2: Check the index file directly
    console.log("\n6. Checking Index File Directly...")
    const indexPath = path.join(storageDir, "session", "sub-session-index", `${mainSession.id}.json`)
    console.log("   Index path:", indexPath)
    
    try {
      const indexData = JSON.parse(await fs.readFile(indexPath, 'utf-8'))
      console.log(`   ✓ Index file exists with ${indexData.length} entries`)
      console.log("   Sub-session IDs in index:", indexData)
    } catch (e) {
      console.log("   ✗ No index file found for this session")
    }
    
    // Test 3: List ALL sub-session files
    console.log("\n7. Listing ALL Sub-Session Files...")
    const subSessionDir = path.join(storageDir, "session", "sub-sessions")
    
    try {
      const subFiles = await fs.readdir(subSessionDir)
      console.log(`   Total sub-session files: ${subFiles.length}`)
      
      // Check last 5 sub-sessions
      const recentSubs = subFiles.slice(-5)
      for (const file of recentSubs) {
        const subData = JSON.parse(
          await fs.readFile(path.join(subSessionDir, file), 'utf-8')
        )
        console.log(`\n   ${file}:`)
        console.log(`   - Parent: ${subData.parentSessionId}`)
        console.log(`   - Matches current session: ${subData.parentSessionId === mainSession.id ? 'YES' : 'NO'}`)
        console.log(`   - Status: ${subData.status}`)
        console.log(`   - Created: ${new Date(subData.createdAt).toLocaleString()}`)
      }
    } catch (e) {
      console.error("   Error listing sub-sessions:", e.message)
    }
    
    // Test 4: Create a test sub-session
    console.log("\n8. Creating Test Sub-Session...")
    try {
      const testSessionId = `ses_test_${Date.now()}`
      const testSubSession = await SubSession.create(
        mainSession.id,
        testSessionId,
        "Test Agent",
        "Test task from debug script"
      )
      console.log("   ✓ Test sub-session created:", testSessionId)
      
      // Verify it was stored
      await new Promise(resolve => setTimeout(resolve, 100)) // Brief delay
      
      const verifySubSessions = await SubSession.getByParent(mainSession.id)
      const found = verifySubSessions.find(s => s.id === testSessionId)
      
      if (found) {
        console.log("   ✓ Test sub-session verified in storage!")
      } else {
        console.log("   ✗ Test sub-session NOT found after creation!")
      }
      
      // Clean up test sub-session
      await SubSession.remove(testSessionId)
      console.log("   ✓ Test sub-session cleaned up")
      
    } catch (e) {
      console.error("   Error creating test sub-session:", e)
    }
    
    // Test 5: Simulate TUI's exact request
    console.log("\n9. Simulating TUI Request...")
    console.log("   The TUI makes a GET request to: /session/" + mainSession.id + "/sub-sessions")
    console.log("   This calls SubSession.getByParent('" + mainSession.id + "')")
    
    // Check what Storage.list returns
    console.log("\n10. Testing Storage.list()...")
    try {
      let count = 0
      for await (const file of Storage.list("session/sub-sessions")) {
        count++
        if (count <= 3) {
          console.log("   - Found:", file)
        }
      }
      console.log(`   Total files from Storage.list: ${count}`)
    } catch (e) {
      console.error("   Error with Storage.list:", e)
    }
    
    // Final diagnosis
    console.log("\n=== DIAGNOSIS ===")
    const subSessions = await SubSession.getByParent(mainSession.id)
    if (subSessions.length === 0) {
      console.log("❌ No sub-sessions found for current session")
      console.log("\nPossible causes:")
      console.log("1. Sub-sessions are being created with wrong parent ID")
      console.log("2. Index file is not being created/updated")
      console.log("3. Storage path mismatch between creation and retrieval")
      console.log("4. Session context is different when creating agents")
      
      // Additional check: Look for orphaned sub-sessions
      console.log("\n11. Checking for Orphaned Sub-Sessions...")
      const allIndexFiles = await fs.readdir(path.join(storageDir, "session", "sub-session-index"))
      console.log(`   Found ${allIndexFiles.length} index files total`)
      
      // Check if any sub-sessions reference the current session
      const allSubFiles = await fs.readdir(path.join(storageDir, "session", "sub-sessions"))
      let orphanedCount = 0
      for (const file of allSubFiles) {
        const subData = JSON.parse(
          await fs.readFile(path.join(subSessionDir, file), 'utf-8')
        )
        if (subData.parentSessionId === mainSession.id) {
          orphanedCount++
          console.log(`   Found orphaned sub-session: ${file}`)
        }
      }
      
      if (orphanedCount > 0) {
        console.log(`\n⚠️  Found ${orphanedCount} sub-sessions that claim ${mainSession.id} as parent`)
        console.log("   but they're not in the index!")
      }
      
    } else {
      console.log(`✅ Found ${subSessions.length} sub-sessions for current session`)
    }
    
    console.log("\n=== END OF DEBUG SCRIPT ===")
  })
}

// Run the script
initializeApp().catch(console.error)
