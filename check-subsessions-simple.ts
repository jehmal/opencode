#!/usr/bin/env bun
/**
 * Fix config and test sub-sessions
 */

import fs from 'fs'
import path from 'path'

console.log("=== FIXING CONFIG AND TESTING ===\n")

// First, let's create a minimal valid config
const configPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/opencode.json"

// Remove the existing config that's causing issues
console.log("1. Removing problematic config...")
try {
  fs.unlinkSync(configPath)
  console.log("   Removed opencode.json")
} catch (e) {
  console.log("   No config to remove")
}

// Now run our test without the config file
console.log("\n2. Running test without config file...\n")

// Import and run the test
import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  try {
    // Get most recent sessions
    console.log("3. Checking recent sessions for sub-sessions:\n")
    
    const sessions = []
    for await (const session of Session.list()) {
      sessions.push(session)
      if (sessions.length >= 20) break
    }
    
    let foundAny = false
    
    for (const session of sessions) {
      const subSessions = await SubSession.getByParent(session.id)
      if (subSessions.length > 0) {
        foundAny = true
        console.log(`✅ Session: ${session.title || 'Untitled'}`)
        console.log(`   ID: ${session.id}`)
        console.log(`   Has ${subSessions.length} sub-sessions:`)
        
        subSessions.forEach(sub => {
          console.log(`   - ${sub.agentName}: ${sub.taskDescription} (${sub.status})`)
        })
        console.log("")
      }
    }
    
    if (!foundAny) {
      console.log("❌ No sub-sessions found in recent sessions\n")
      
      // Check if there are child sessions without sub-session records
      const childSessions = sessions.filter(s => s.parentID)
      console.log(`Found ${childSessions.length} child sessions (sessions with parents)`)
      
      if (childSessions.length > 0) {
        console.log("\n⚠️  There are child sessions but no sub-session records!")
        console.log("This suggests the task tool is creating sessions but not sub-session tracking\n")
        
        childSessions.slice(0, 5).forEach(child => {
          console.log(`Child: ${child.title} (${child.id})`)
          console.log(`Parent: ${child.parentID}`)
        })
      }
    }
    
    // Specific check for the session from your logs
    console.log("\n4. Checking your specific session:")
    const targetId = "ses_8265d514cffeJtVYlbD526eTCt"
    
    try {
      const targetSession = await Session.get(targetId)
      console.log(`Found session: ${targetSession.title}`)
      
      const subs = await SubSession.getByParent(targetId)
      console.log(`Sub-sessions: ${subs.length}`)
      
      // Check if any sessions claim this as parent
      const children = sessions.filter(s => s.parentID === targetId)
      console.log(`Child sessions: ${children.length}`)
      
      if (children.length > 0 && subs.length === 0) {
        console.log("\n⚠️  Child sessions exist but no sub-session records!")
        console.log("The issue is that task tool creates sessions but doesn't call SubSession.create()")
      }
      
    } catch (e) {
      console.log(`Session ${targetId} not found`)
    }
    
  } catch (e) {
    console.log("Error:", e.message)
  }
})
