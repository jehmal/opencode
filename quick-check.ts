#!/usr/bin/env bun
/**
 * Quick check for the most recent session and its sub-sessions
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"
import { Storage } from "./opencode/packages/opencode/src/storage/storage"

console.log("=== QUICK SUB-SESSION CHECK ===\n")

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  // Get the session mentioned in the logs
  const targetId = "ses_8265d514cffeJtVYlbD526eTCt"
  
  console.log(`1. Checking session ${targetId}:`)
  try {
    const session = await Session.get(targetId)
    console.log(`   ✓ Found: ${session.title}`)
    console.log(`   Parent: ${session.parentID || 'None (main session)'}`)
    
    // Check for sub-sessions
    const subs = await SubSession.getByParent(targetId)
    console.log(`   Sub-sessions: ${subs.length}`)
    
    // Also check if any sessions have this as parent
    const children = []
    for await (const s of Session.list()) {
      if (s.parentID === targetId) {
        children.push(s)
      }
    }
    console.log(`   Child sessions: ${children.length}`)
    
    if (children.length > 0) {
      console.log("\n   Child sessions found:")
      children.forEach(c => {
        console.log(`   - ${c.title} (${c.id})`)
      })
      
      console.log("\n   ⚠️  Child sessions exist but may not have sub-session records!")
      console.log("   This means the task tool created sessions but didn't create sub-session tracking")
    }
    
  } catch (e) {
    console.log(`   Error: ${e}`)
  }
  
  // List all sub-session index files
  console.log("\n2. All sub-session indexes:")
  const indexes = []
  for await (const file of Storage.list("session/sub-session-index")) {
    indexes.push(file)
  }
  console.log(`   Found ${indexes.length} parent sessions with sub-sessions`)
  
  // Check the raw storage
  console.log("\n3. Raw check - looking for any recent task executions:")
  const recentSessions = []
  for await (const session of Session.list()) {
    recentSessions.push(session)
    if (recentSessions.length >= 10) break
  }
  
  const tasksFound = recentSessions.filter(s => 
    s.title?.toLowerCase().includes('agent') || 
    s.title?.toLowerCase().includes('poem') ||
    s.title?.toLowerCase().includes('task')
  )
  
  console.log(`   Found ${tasksFound.length} sessions that look like task executions:`)
  tasksFound.forEach(t => {
    console.log(`   - ${t.title} (${t.id})`)
    console.log(`     Parent: ${t.parentID || 'None'}`)
  })
})
