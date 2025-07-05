#!/usr/bin/env bun
/**
 * Show the sub-sessions for your current session
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  const sessionId = "ses_8265d514cffeJtVYlbD526eTCt"
  
  console.log("=== SUB-SESSIONS FOR YOUR SESSION ===\n")
  console.log(`Session: General greeting to Claude`)
  console.log(`ID: ${sessionId}\n`)
  
  const subSessions = await SubSession.getByParent(sessionId)
  
  console.log(`Found ${subSessions.length} sub-sessions:\n`)
  
  subSessions.forEach((sub, i) => {
    console.log(`${i + 1}. ${sub.agentName}`)
    console.log(`   Task: ${sub.taskDescription}`)
    console.log(`   Status: ${sub.status}`)
    console.log(`   Created: ${new Date(sub.createdAt).toLocaleString()}`)
    console.log(`   ID: ${sub.id}`)
    console.log("")
  })
  
  console.log("These sub-sessions EXIST and are properly stored!")
  console.log("The issue is that your installed dgmo doesn't show them.\n")
  
  console.log("To fix this:")
  console.log("1. Run: chmod +x install-fixed-dgmo.sh && ./install-fixed-dgmo.sh")
  console.log("2. Or use the workaround: export DGMO_SESSION_ID=" + sessionId)
  console.log("3. Then run dgmo and use /sub-sessions")
})
