#!/usr/bin/env bun
/**
 * Verify the sub-sessions are being created and check the TUI
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"

console.log("=== VERIFYING SUB-SESSIONS ===\n")

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  // Find the session you just created
  const sessions = []
  for await (const session of Session.list()) {
    sessions.push(session)
  }
  
  // Sort by creation time to get the most recent
  sessions.sort((a, b) => b.time.created - a.time.created)
  
  console.log("1. Most recent sessions:")
  sessions.slice(0, 5).forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.title || 'Untitled'} (${s.id})`)
    console.log(`      Created: ${new Date(s.time.created).toLocaleString()}`)
    console.log(`      Parent: ${s.parentID || 'None (Main session)'}`)
  })
  
  console.log("\n2. Checking for sub-sessions in recent sessions:")
  
  let foundAny = false
  for (const session of sessions.slice(0, 10)) {
    const subSessions = await SubSession.getByParent(session.id)
    if (subSessions.length > 0) {
      foundAny = true
      console.log(`\n   ✓ Session "${session.title}" (${session.id}) has ${subSessions.length} sub-sessions:`)
      subSessions.forEach(sub => {
        console.log(`      - ${sub.agentName}: ${sub.taskDescription} (${sub.status})`)
        console.log(`        ID: ${sub.id}`)
        console.log(`        Created: ${new Date(sub.createdAt).toLocaleString()}`)
      })
    }
  }
  
  if (!foundAny) {
    console.log("   ❌ No sub-sessions found in recent sessions")
  }
  
  // Check the specific session from the log
  const targetSessionId = "ses_8265d514cffeJtVYlbD526eTCt"
  console.log(`\n3. Checking specific session ${targetSessionId}:`)
  
  try {
    const targetSession = await Session.get(targetSessionId)
    console.log(`   Found session: ${targetSession.title}`)
    console.log(`   Parent: ${targetSession.parentID || 'None'}`)
    
    const subSessions = await SubSession.getByParent(targetSessionId)
    console.log(`   Sub-sessions: ${subSessions.length}`)
    
    if (subSessions.length > 0) {
      subSessions.forEach(sub => {
        console.log(`      - ${sub.agentName}: ${sub.taskDescription}`)
      })
    }
  } catch (e) {
    console.log(`   Session not found: ${e}`)
  }
  
  // Check if task tool is creating sessions but not sub-session records
  console.log("\n4. Checking for orphaned child sessions:")
  const childSessions = sessions.filter(s => s.parentID)
  console.log(`   Found ${childSessions.length} sessions with parents`)
  
  for (const child of childSessions.slice(0, 5)) {
    console.log(`\n   Child: ${child.title} (${child.id})`)
    console.log(`   Parent: ${child.parentID}`)
    
    // Check if there's a corresponding sub-session record
    try {
      const parentSubSessions = await SubSession.getByParent(child.parentID)
      const hasRecord = parentSubSessions.some(sub => sub.id === child.id)
      console.log(`   Has sub-session record: ${hasRecord ? '✓' : '✗'}`)
    } catch (e) {
      console.log(`   Error checking: ${e}`)
    }
  }
})
