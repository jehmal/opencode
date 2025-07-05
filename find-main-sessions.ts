#!/usr/bin/env bun
/**
 * Find the main session with sub-sessions
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"
import path from "path"
import fs from "fs/promises"
import os from "os"

console.log("=== FINDING MAIN SESSIONS WITH SUB-SESSIONS ===\n")

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  // Find all sessions
  const sessionDir = path.join(App.info().path.data, "storage", "session", "info")
  const files = await fs.readdir(sessionDir)
  
  console.log(`Found ${files.length} total sessions\n`)
  
  // Categorize sessions
  const mainSessions = []
  const childSessions = []
  
  for (const file of files) {
    const sessionId = file.replace('.json', '')
    const session = await Session.get(sessionId)
    
    if (session.parentID) {
      childSessions.push(session)
    } else {
      mainSessions.push(session)
    }
  }
  
  console.log(`Main sessions: ${mainSessions.length}`)
  console.log(`Child sessions: ${childSessions.length}\n`)
  
  // Check which main sessions have sub-sessions
  console.log("Main Sessions with Sub-Sessions:")
  console.log("================================")
  
  for (const session of mainSessions.slice(-10)) { // Last 10 main sessions
    const subSessions = await SubSession.getByParent(session.id)
    
    if (subSessions.length > 0) {
      console.log(`\n✓ ${session.id}`)
      console.log(`  Title: ${session.title}`)
      console.log(`  Created: ${new Date(session.time.created).toLocaleString()}`)
      console.log(`  Sub-sessions: ${subSessions.length}`)
      
      // Show first few sub-sessions
      subSessions.slice(0, 3).forEach(sub => {
        console.log(`    - ${sub.agentName}: ${sub.taskDescription.substring(0, 50)}...`)
      })
    }
  }
  
  // Find your current session's parent
  console.log("\n\nYour Current Session Chain:")
  console.log("===========================")
  console.log("Current: ses_8283a7cffffeSnY7yaS2a9FSu8 (CHILD SESSION)")
  console.log("Parent: ses_8283ae7e1ffeOgGhnu8M8v1V2V")
  
  // Check if the parent has sub-sessions
  try {
    const parentSession = await Session.get("ses_8283ae7e1ffeOgGhnu8M8v1V2V")
    console.log(`Parent Title: ${parentSession.title}`)
    console.log(`Parent Created: ${new Date(parentSession.time.created).toLocaleString()}`)
    
    const parentSubs = await SubSession.getByParent("ses_8283ae7e1ffeOgGhnu8M8v1V2V")
    console.log(`Parent's sub-sessions: ${parentSubs.length}`)
    
    if (parentSubs.length > 0) {
      console.log("\nYour session is one of these sub-sessions:")
      parentSubs.forEach(sub => {
        const isCurrent = sub.id === "ses_8283a7cffffeSnY7yaS2a9FSu8"
        console.log(`  ${isCurrent ? '→' : ' '} ${sub.id}: ${sub.agentName}`)
      })
    }
  } catch (e) {
    console.log("Could not find parent session")
  }
})

console.log("\n\n=== SOLUTION ===")
console.log("You are currently in a SUB-SESSION, not a main session!")
console.log("Sub-sessions cannot have their own sub-sessions.")
console.log("\nTo see sub-sessions:")
console.log("1. Exit this session and start a new main DGMO session")
console.log("2. Or switch to your parent session: ses_8283ae7e1ffeOgGhnu8M8v1V2V")
console.log("3. Then /sub-session will show the sub-sessions")
