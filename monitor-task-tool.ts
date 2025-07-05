#!/usr/bin/env bun
/**
 * Monitor task tool execution in real-time
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Bus } from "./opencode/packages/opencode/src/bus"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"

console.log("=== TASK TOOL MONITOR ===\n")
console.log("Monitoring for task tool executions and sub-session creation...")
console.log("Run your task command in dgmo and watch the output here\n")

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  // Subscribe to all bus events
  const unsubscribe = Bus.subscribeAll(async (event) => {
    // Filter for relevant events
    if (event.type.includes("session") || 
        event.type.includes("task") || 
        event.type.includes("agent") ||
        event.type.includes("storage.write")) {
      
      console.log(`\n[EVENT] ${event.type}`)
      
      // Show details for session-related events
      if (event.type === "session.created" || event.type === "session.updated") {
        console.log(`  Session ID: ${event.properties?.id}`)
        console.log(`  Parent ID: ${event.properties?.parentID || 'None'}`)
        console.log(`  Title: ${event.properties?.title || 'Untitled'}`)
      }
      
      // Show storage writes that might be sub-sessions
      if (event.type === "storage.write" && event.properties?.key?.includes("sub-session")) {
        console.log(`  📝 Writing sub-session data:`)
        console.log(`  Key: ${event.properties.key}`)
      }
      
      // Custom events from task tool
      if (event.type === "subsession.created") {
        console.log(`  ✅ SUB-SESSION CREATED!`)
        console.log(`  Parent: ${event.properties?.parentId}`)
        console.log(`  Sub-session: ${event.properties?.subSessionId}`)
        console.log(`  Verified: ${event.properties?.verified}`)
      }
    }
  })
  
  // Also poll for changes every 2 seconds
  setInterval(async () => {
    // Get the most recent session
    const sessions = []
    for await (const session of Session.list()) {
      sessions.push(session)
      if (sessions.length >= 5) break
    }
    
    for (const session of sessions) {
      const subSessions = await SubSession.getByParent(session.id)
      if (subSessions.length > 0) {
        console.log(`\n[POLL] Session "${session.title}" has ${subSessions.length} sub-sessions`)
      }
    }
  }, 5000)
  
  console.log("Press Ctrl+C to stop monitoring\n")
  
  // Keep the process running
  await new Promise(() => {})
})
