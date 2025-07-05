#!/usr/bin/env bun
/**
 * Verify session context and project directory mismatch
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"
import path from "path"
import fs from "fs/promises"

console.log("=== Session Context Verification ===\n")

// Test 1: Check project directory from current location
console.log("1. Testing from current directory:")
console.log("   CWD:", process.cwd())

await App.provide({ cwd: process.cwd() }, async () => {
  const info = App.info()
  console.log("   Project directory:", path.basename(info.path.data))
  console.log("   Full data path:", info.path.data)
  
  // Check for sessions in THIS project
  const sessionDir = path.join(info.path.data, "storage", "session", "info")
  try {
    const files = await fs.readdir(sessionDir)
    console.log(`   Sessions in THIS project: ${files.length}`)
    
    // Get most recent
    if (files.length > 0) {
      const recent = files.slice(-1)[0]
      const sessionId = recent.replace('.json', '')
      console.log(`   Most recent session: ${sessionId}`)
      
      // Check for sub-sessions
      const subs = await SubSession.getByParent(sessionId)
      console.log(`   Sub-sessions for this session: ${subs.length}`)
    }
  } catch (e) {
    console.log("   No sessions found in this project")
  }
})

// Test 2: Check from opencode subdirectory
console.log("\n2. Testing from opencode subdirectory:")
const opencodePath = path.join(process.cwd(), "opencode")
console.log("   CWD:", opencodePath)

await App.provide({ cwd: opencodePath }, async () => {
  const info = App.info()
  console.log("   Project directory:", path.basename(info.path.data))
  console.log("   Full data path:", info.path.data)
  
  // Check for sessions
  const sessionDir = path.join(info.path.data, "storage", "session", "info")
  try {
    const files = await fs.readdir(sessionDir)
    console.log(`   Sessions in THIS project: ${files.length}`)
    
    // Show some recent sessions
    const recent = files.slice(-3).map(f => f.replace('.json', ''))
    console.log("   Recent sessions:", recent)
  } catch (e) {
    console.log("   Error:", e.message)
  }
})

// Test 3: Direct comparison
console.log("\n3. Project Directory Analysis:")
console.log("   When run from DGMSTT: mnt-c-Users-jehma-Desktop-AI-DGMSTT")
console.log("   When run from opencode: mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode")
console.log("   These are DIFFERENT projects in storage!")

console.log("\n=== SOLUTION ===")
console.log("You need to run DGMO from the same directory where sub-sessions were created:")
console.log("1. cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode")
console.log("2. dgmo")
console.log("3. /sub-session (should now show all 44 sub-sessions)")
console.log("\nOR move the sub-sessions to the current project")
