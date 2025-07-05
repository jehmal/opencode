#!/usr/bin/env bun
// Silent script to get the most recent parent session
import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"

await App.provide({ cwd: "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode" }, async () => {
  const sessions = []
  for await (const session of Session.list()) {
    sessions.push(session)
    if (sessions.length >= 20) break
  }
  
  // Find parent sessions with sub-sessions
  for (const session of sessions) {
    const subs = await SubSession.getByParent(session.id)
    if (subs.length > 0 && !session.parentID) {
      console.log(session.id)
      process.exit(0)
    }
  }
  
  // Default to the known session
  console.log("ses_8265d514cffeJtVYlbD526eTCt")
})
