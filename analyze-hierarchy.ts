#!/usr/bin/env bun
/**
 * Script to understand the session hierarchy
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"

console.log("=== SESSION HIERARCHY ANALYSIS ===\n")

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  // Find the session with sub-sessions
  const targetSessionId = "ses_82a087408ffenwt06rlpalARbW" // The one with 3 sub-sessions
  
  console.log("1. Analyzing session with known sub-sessions:")
  console.log(`   Session ID: ${targetSessionId}`)
  
  const parentSession = await Session.get(targetSessionId)
  console.log(`   Title: ${parentSession.title}`)
  console.log(`   Is this a child session? ${parentSession.parentID ? 'Yes, parent: ' + parentSession.parentID : 'No'}\n`)
  
  // Get its sub-sessions
  const subSessions = await SubSession.getByParent(targetSessionId)
  console.log(`2. Found ${subSessions.length} sub-sessions:`)
  
  for (const sub of subSessions) {
    console.log(`\n   Sub-session: ${sub.id}`)
    console.log(`   Agent: ${sub.agentName}`)
    console.log(`   Task: ${sub.taskDescription}`)
    console.log(`   Status: ${sub.status}`)
    
    // Check if this sub-session ID exists as a regular session
    try {
      const actualSession = await Session.get(sub.id)
      console.log(`   ✓ This sub-session exists as a regular session`)
      console.log(`     - Title: ${actualSession.title}`)
      console.log(`     - Parent: ${actualSession.parentID}`)
      console.log(`     - Created: ${new Date(actualSession.time.created).toLocaleString()}`)
    } catch (e) {
      console.log(`   ✗ This sub-session ID doesn't exist as a regular session`)
    }
  }
  
  console.log("\n3. Understanding the hierarchy:")
  console.log("   When you're in a session and run a task:")
  console.log("   - A new SESSION is created (child of current)")
  console.log("   - A SUB-SESSION record is created linking them")
  console.log("   - The new session runs independently")
  
  console.log("\n4. The TUI issue:")
  console.log("   - If you're IN the parent session, /sub-sessions will show the children")
  console.log("   - If you're IN a child session, /sub-sessions will be empty")
  console.log("   - The TUI needs to check if the current session has a parent and show siblings")
  
  // Let's check recent sessions to see this pattern
  console.log("\n5. Checking recent sessions for parent-child relationships:")
  const sessions = []
  for await (const session of Session.list()) {
    sessions.push(session)
  }
  
  // Find sessions with parents
  const childSessions = sessions.filter(s => s.parentID)
  console.log(`   Found ${childSessions.length} child sessions out of ${sessions.length} total`)
  
  // Show a few examples
  console.log("\n   Examples of child sessions:")
  childSessions.slice(0, 5).forEach(child => {
    console.log(`   - ${child.title || 'Untitled'} (${child.id})`)
    console.log(`     Parent: ${child.parentID}`)
  })
})
