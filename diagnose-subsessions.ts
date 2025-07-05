#!/usr/bin/env bun
/**
 * Comprehensive sub-session diagnostic tool
 * This script will help identify why sub-sessions aren't showing up
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"
import { Storage } from "./opencode/packages/opencode/src/storage/storage"
import path from "path"
import fs from "fs/promises"

console.log("=== SUB-SESSION DIAGNOSTIC TOOL ===\n")

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  const appInfo = App.info()
  console.log("1. App Information:")
  console.log("   Data path:", appInfo.path.data)
  console.log("   Root path:", appInfo.path.root)
  console.log("   CWD path:", appInfo.path.cwd)
  console.log("")

  // Check storage paths
  console.log("2. Storage paths:")
  const storagePath = appInfo.path.data
  console.log("   Base storage path:", storagePath)
  console.log("   Session storage:", path.join(storagePath, "storage", "session"))
  console.log("   Sub-session storage:", path.join(storagePath, "storage", "session", "sub-sessions"))
  console.log("   Sub-session index:", path.join(storagePath, "storage", "session", "sub-session-index"))
  console.log("")

  // List all storage directories
  console.log("3. Checking storage directories:")
  const storageDir = path.join(storagePath, "storage")
  try {
    const dirs = await fs.readdir(storageDir, { recursive: true })
    const sessionDirs = dirs.filter(d => d.includes("session"))
    console.log("   Found session-related directories:")
    sessionDirs.forEach(d => console.log(`     - ${d}`))
  } catch (e) {
    console.log("   Error reading storage directory:", e)
  }
  console.log("")

  // Get all sessions
  console.log("4. Analyzing sessions:")
  const sessions = []
  for await (const session of Session.list()) {
    sessions.push(session)
  }
  console.log(`   Total sessions: ${sessions.length}`)
  console.log("")

  // Check each session for sub-sessions
  console.log("5. Checking sub-sessions for each session:")
  let totalSubSessions = 0
  
  for (const session of sessions.slice(0, 5)) { // Check first 5 sessions
    console.log(`\n   Session: ${session.title || 'Untitled'} (${session.id})`)
    console.log(`   Created: ${new Date(session.time.created).toLocaleString()}`)
    
    // Check sub-sessions using the SubSession module
    try {
      const subSessions = await SubSession.getByParent(session.id)
      console.log(`   Sub-sessions found: ${subSessions.length}`)
      
      if (subSessions.length > 0) {
        subSessions.forEach(sub => {
          console.log(`     - ${sub.agentName}: ${sub.taskDescription} (${sub.status})`)
          totalSubSessions++
        })
      }
    } catch (e) {
      console.log(`   Error getting sub-sessions:`, e)
    }
    
    // Also check the raw storage
    try {
      const indexPath = `session/sub-session-index/${session.id}`
      const index = await Storage.readJSON<string[]>(indexPath)
      console.log(`   Raw index check: ${index.length} entries`)
    } catch (e) {
      // No index file
    }
  }
  
  console.log(`\n   Total sub-sessions found: ${totalSubSessions}`)
  console.log("")

  // List all sub-session files directly
  console.log("6. Direct storage inspection:")
  try {
    const subSessionFiles = []
    for await (const file of Storage.list("session/sub-sessions")) {
      subSessionFiles.push(file)
    }
    console.log(`   Sub-session files in storage: ${subSessionFiles.length}`)
    if (subSessionFiles.length > 0) {
      console.log("   First 5 files:")
      subSessionFiles.slice(0, 5).forEach(f => console.log(`     - ${f}`))
    }
  } catch (e) {
    console.log("   Error listing sub-session files:", e)
  }
  
  // List all index files
  try {
    const indexFiles = []
    for await (const file of Storage.list("session/sub-session-index")) {
      indexFiles.push(file)
    }
    console.log(`\n   Sub-session index files: ${indexFiles.length}`)
    if (indexFiles.length > 0) {
      console.log("   First 5 index files:")
      indexFiles.slice(0, 5).forEach(f => console.log(`     - ${f}`))
    }
  } catch (e) {
    console.log("   Error listing index files:", e)
  }
  console.log("")

  // Test sub-session creation
  console.log("7. Testing sub-session creation:")
  try {
    // Get or create a test session
    let testSession = sessions.find(s => s.title === "Sub-session Test")
    if (!testSession) {
      console.log("   Creating test parent session...")
      testSession = await Session.create()
      await Session.update(testSession.id, { title: "Sub-session Test" })
    }
    
    console.log(`   Parent session ID: ${testSession.id}`)
    
    // Create a test sub-session
    const testSubSession = await Session.create(testSession.id)
    console.log(`   Created child session: ${testSubSession.id}`)
    
    // Store sub-session info
    const subInfo = await SubSession.create(
      testSession.id,
      testSubSession.id,
      "Test Agent",
      "This is a test sub-session"
    )
    console.log("   Stored sub-session info:", subInfo.id)
    
    // Verify it was stored
    const verifySubSessions = await SubSession.getByParent(testSession.id)
    console.log(`   Verification: Found ${verifySubSessions.length} sub-sessions for test session`)
    
    // Check raw storage
    const indexPath = `session/sub-session-index/${testSession.id}`
    const index = await Storage.readJSON<string[]>(indexPath)
    console.log(`   Raw index verification: ${index.length} entries`)
    
  } catch (e) {
    console.log("   Error in test:", e)
  }
  console.log("")

  // Final recommendations
  console.log("8. Recommendations:")
  console.log("   - Ensure task tool is properly creating sub-sessions")
  console.log("   - Check that Storage.writeJSON is working correctly")
  console.log("   - Verify the TUI is calling the correct endpoint")
  console.log("   - Make sure the session ID in TUI matches stored sessions")
  
  // Export diagnostic data
  const diagnosticData = {
    timestamp: new Date().toISOString(),
    appInfo,
    sessionCount: sessions.length,
    totalSubSessions,
    testResults: {
      storagePathExists: await fs.access(storagePath).then(() => true).catch(() => false),
      sessionPathExists: await fs.access(path.join(storagePath, "storage", "session")).then(() => true).catch(() => false),
    }
  }
  
  await fs.writeFile(
    path.join(projectPath, "..", "sub-session-diagnostic.json"),
    JSON.stringify(diagnosticData, null, 2)
  )
  console.log("\n   Diagnostic data saved to: sub-session-diagnostic.json")
})
