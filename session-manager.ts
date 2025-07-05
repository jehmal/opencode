#!/usr/bin/env bun
/**
 * Switch to a different session or create a new main session
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"
import path from "path"
import fs from "fs/promises"

console.log("=== DGMO Session Manager ===\n")

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  // Get all sessions
  const sessionDir = path.join(App.info().path.data, "storage", "session", "info")
  const files = await fs.readdir(sessionDir)
  
  // Find main sessions with sub-sessions
  const mainSessionsWithSubs = []
  
  for (const file of files) {
    const sessionId = file.replace('.json', '')
    const session = await Session.get(sessionId)
    
    if (!session.parentID) {
      const subSessions = await SubSession.getByParent(sessionId)
      if (subSessions.length > 0) {
        mainSessionsWithSubs.push({
          session,
          subCount: subSessions.length
        })
      }
    }
  }
  
  // Sort by creation date
  mainSessionsWithSubs.sort((a, b) => b.session.time.created - a.session.time.created)
  
  console.log("Main Sessions with Sub-Sessions:")
  console.log("================================\n")
  
  mainSessionsWithSubs.slice(0, 10).forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.session.title}`)
    console.log(`   ID: ${item.session.id}`)
    console.log(`   Created: ${new Date(item.session.time.created).toLocaleString()}`)
    console.log(`   Sub-sessions: ${item.subCount}`)
    console.log("")
  })
  
  console.log("\nTo use one of these sessions:")
  console.log("1. Exit your current DGMO session")
  console.log("2. Set the session ID as an environment variable:")
  console.log("   export DGMO_SESSION_ID=<session-id>")
  console.log("3. Start DGMO with that session")
  console.log("\nExample:")
  console.log(`export DGMO_SESSION_ID=${mainSessionsWithSubs[0]?.session.id || 'ses_xxx'}`)
  console.log("dgmo")
  
  // Also create a new main session option
  console.log("\n\nOr create a fresh main session:")
  console.log("================================")
  const newSession = await Session.create()
  console.log("Created new main session:", newSession.id)
  console.log("\nTo use it:")
  console.log(`export DGMO_SESSION_ID=${newSession.id}`)
  console.log("dgmo")
})
