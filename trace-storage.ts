#!/usr/bin/env bun
/**
 * Trace the actual SubSession storage implementation
 */

// Import the actual modules from opencode
import { Storage } from "./opencode/packages/opencode/src/storage/storage"
import { App } from "./opencode/packages/opencode/src/app/app"
import path from "path"
import fs from "fs/promises"

console.log("=== Tracing SubSession Storage Implementation ===\n")

async function traceStorage() {
  // We need to initialize App context first
  await App.provide({ cwd: "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode" }, async () => {
    const appInfo = App.info()
    console.log("1. App initialized:")
    console.log("   Data path:", appInfo.path.data)
    console.log("   Root path:", appInfo.path.root)
    console.log("   CWD path:", appInfo.path.cwd)
    
    // Test Storage.writeJSON
    console.log("\n2. Testing Storage.writeJSON:")
    const testKey = "test/debug-write"
    const testData = { test: true, timestamp: Date.now() }
    
    try {
      await Storage.writeJSON(testKey, testData)
      console.log("   ✓ WriteJSON succeeded")
      
      // Check where it was written
      const expectedPath = path.join(appInfo.path.data, "storage", testKey + ".json")
      console.log("   Expected path:", expectedPath)
      
      try {
        const exists = await fs.access(expectedPath)
        console.log("   ✓ File exists at expected location")
      } catch {
        console.log("   ✗ File NOT at expected location")
        
        // Search for it
        console.log("   Searching for file...")
        // This would be too complex, skip for now
      }
      
      // Try to read it back
      const readBack = await Storage.readJSON(testKey)
      console.log("   ✓ Read back:", readBack)
      
      // Clean up
      await Storage.remove(testKey)
      console.log("   ✓ Cleaned up test file")
      
    } catch (e) {
      console.error("   ✗ Error:", e)
    }
    
    // Test the exact path that SubSession would use
    console.log("\n3. Testing SubSession paths:")
    const SUB_SESSION_PATH = "session/sub-sessions/"
    const SUB_SESSION_INDEX_PATH = "session/sub-session-index/"
    
    const testSubId = "ses_debug_test"
    const testParentId = "ses_debug_parent"
    
    // Test writing sub-session
    console.log("   Testing sub-session write...")
    try {
      const subData = {
        id: testSubId,
        parentSessionId: testParentId,
        agentName: "Debug Test",
        taskDescription: "Testing storage",
        status: "completed",
        createdAt: Date.now()
      }
      
      await Storage.writeJSON(SUB_SESSION_PATH + testSubId, subData)
      console.log("   ✓ Sub-session write succeeded")
      
      // Check physical location
      const physicalPath = path.join(appInfo.path.data, "storage", SUB_SESSION_PATH, testSubId + ".json")
      console.log("   Physical path:", physicalPath)
      
      try {
        await fs.access(physicalPath)
        console.log("   ✓ File exists")
      } catch {
        console.log("   ✗ File not found at expected location")
      }
      
    } catch (e) {
      console.error("   ✗ Error writing sub-session:", e)
    }
    
    // Test writing index
    console.log("\n   Testing index write...")
    try {
      const indexData = [testSubId]
      await Storage.writeJSON(SUB_SESSION_INDEX_PATH + testParentId, indexData)
      console.log("   ✓ Index write succeeded")
      
      // Check physical location
      const physicalPath = path.join(appInfo.path.data, "storage", SUB_SESSION_INDEX_PATH, testParentId + ".json")
      console.log("   Physical path:", physicalPath)
      
      try {
        await fs.access(physicalPath)
        console.log("   ✓ Index file exists")
      } catch {
        console.log("   ✗ Index file not found at expected location")
      }
      
      // Clean up
      await Storage.remove(SUB_SESSION_PATH + testSubId)
      await Storage.remove(SUB_SESSION_INDEX_PATH + testParentId)
      console.log("   ✓ Cleaned up")
      
    } catch (e) {
      console.error("   ✗ Error writing index:", e)
    }
    
    // List what's actually in storage
    console.log("\n4. Listing actual storage contents:")
    try {
      console.log("   Sub-sessions:")
      let count = 0
      for await (const file of Storage.list("session/sub-sessions")) {
        count++
        if (count <= 3) {
          console.log("     -", file)
        }
      }
      console.log(`   Total: ${count} files`)
      
      console.log("\n   Indexes:")
      count = 0
      for await (const file of Storage.list("session/sub-session-index")) {
        count++
        if (count <= 3) {
          console.log("     -", file)
        }
      }
      console.log(`   Total: ${count} files`)
      
    } catch (e) {
      console.error("   Error listing:", e)
    }
  })
}

traceStorage().catch(console.error)
