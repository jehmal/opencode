#!/usr/bin/env bun
/**
 * Workaround - Find and display all parent-child relationships
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"

console.log("=== SESSION HIERARCHY VIEWER ===\n")

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  // Get all sessions
  const sessions = []
  for await (const session of Session.list()) {
    sessions.push(session)
  }
  
  // Build parent-child relationships
  const parents = new Map()
  
  sessions.forEach(session => {
    if (session.parentID) {
      if (!parents.has(session.parentID)) {
        parents.set(session.parentID, [])
      }
      parents.get(session.parentID).push(session)
    }
  })
  
  // Sort sessions by date
  sessions.sort((a, b) => b.time.created - a.time.created)
  
  console.log("Recent sessions with children:\n")
  
  let count = 0
  for (const session of sessions) {
    if (parents.has(session.id)) {
      count++
      const children = parents.get(session.id)
      
      console.log(`📁 ${session.title || 'Untitled Session'}`)
      console.log(`   ID: ${session.id}`)
      console.log(`   Created: ${new Date(session.time.created).toLocaleString()}`)
      console.log(`   Children (${children.length}):`)
      
      children.forEach(child => {
        console.log(`   └─ ${child.title || 'Untitled'} (${child.id})`)
        console.log(`      Created: ${new Date(child.time.created).toLocaleString()}`)
        
        // Check if it has a SubSession record
        SubSession.get(child.id).then(
          () => console.log(`      ✓ Has SubSession record`),
          () => console.log(`      ✗ No SubSession record`)
        )
      })
      console.log("")
      
      if (count >= 10) break
    }
  }
  
  if (count === 0) {
    console.log("No parent sessions with children found\n")
  }
  
  // Now find your specific session
  console.log("\n=== YOUR SESSION ===")
  const targetId = "ses_8265d514cffeJtVYlbD526eTCt"
  
  const targetSession = sessions.find(s => s.id === targetId)
  if (targetSession) {
    console.log(`Found: ${targetSession.title}`)
    console.log(`Created: ${new Date(targetSession.time.created).toLocaleString()}`)
    
    if (targetSession.parentID) {
      console.log(`This is a CHILD session of: ${targetSession.parentID}`)
      console.log("\n💡 TIP: To see sub-sessions, you need to be in the PARENT session")
      console.log(`   Run: export DGMO_SESSION_ID=${targetSession.parentID}`)
      console.log(`   Then: dgmo`)
    } else if (parents.has(targetId)) {
      console.log(`This is a PARENT session with ${parents.get(targetId).length} children`)
      console.log("\nChildren:")
      parents.get(targetId).forEach(child => {
        console.log(`- ${child.title} (${child.id})`)
      })
    } else {
      console.log("This session has no parent and no children")
    }
  }
  
  // Quick summary
  console.log("\n=== SUMMARY ===")
  console.log(`Total sessions: ${sessions.length}`)
  console.log(`Parent sessions: ${parents.size}`)
  console.log(`Child sessions: ${sessions.filter(s => s.parentID).length}`)
  
  // Check SubSession storage
  let subSessionCount = 0
  for (const [parentId, children] of parents) {
    const subs = await SubSession.getByParent(parentId)
    subSessionCount += subs.length
  }
  console.log(`SubSession records: ${subSessionCount}`)
  
  if (sessions.filter(s => s.parentID).length > subSessionCount) {
    console.log("\n⚠️  WARNING: There are more child sessions than SubSession records!")
    console.log("This means the task tool is creating sessions but not SubSession tracking")
  }
})
