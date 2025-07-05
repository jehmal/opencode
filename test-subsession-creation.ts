#!/usr/bin/env bun

import { SubSession } from "./packages/opencode/src/session/sub-session"
import { Session } from "./packages/opencode/src/session"

async function testSubSessionCreation() {
  console.log("Testing sub-session creation...")

  // Get the most recent session
  const sessions = []
  for await (const session of Session.list()) {
    sessions.push(session)
  }

  if (sessions.length === 0) {
    console.log("No sessions found!")
    return
  }

  // Sort by creation time (assuming newer sessions have higher timestamps in their IDs)
  sessions.sort((a, b) => b.id.localeCompare(a.id))
  const latestSession = sessions[0]

  console.log("Latest session:", latestSession.id)
  console.log("Session title:", latestSession.title)

  // Check sub-sessions for this session
  const subSessions = await SubSession.getByParent(latestSession.id)
  console.log("Found", subSessions.length, "sub-sessions for this session")

  if (subSessions.length > 0) {
    console.log("\nSub-sessions:")
    subSessions.forEach((sub) => {
      console.log(
        `- ${sub.agentName}: ${sub.taskDescription.substring(0, 50)}... (${sub.status})`,
      )
    })
  }

  // Test creating a new sub-session
  console.log("\nTesting manual sub-session creation...")
  const testSubSession = await Session.create(latestSession.id)

  await SubSession.create(
    latestSession.id,
    testSubSession.id,
    "Test Agent",
    "This is a test sub-session",
  )

  console.log("Created test sub-session:", testSubSession.id)

  // Verify it was created
  const updatedSubSessions = await SubSession.getByParent(latestSession.id)
  console.log("Now have", updatedSubSessions.length, "sub-sessions")
}

testSubSessionCreation().catch(console.error)
