#!/usr/bin/env bun
/**
 * Force creation of a new main session for DGMO
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import path from "path"
import fs from "fs/promises"

console.log("=== Creating New Main Session ===\n")

const projectPath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

await App.provide({ cwd: projectPath }, async () => {
  // Create a new main session (no parent)
  const newSession = await Session.create()
  
  console.log("✓ New main session created!")
  console.log("  ID:", newSession.id)
  console.log("  Title:", newSession.title)
  console.log("  Type: MAIN (no parent)")
  console.log("  Created:", new Date(newSession.time.created).toLocaleString())
  
  // Write a marker file so DGMO uses this session
  const markerPath = path.join(process.env.HOME!, ".dgmo-session")
  await fs.writeFile(markerPath, newSession.id)
  
  console.log("\n✓ Session marker created")
  console.log("\nTo use this session:")
  console.log("1. Start DGMO: dgmo")
  console.log("2. You should be in the new main session")
  console.log("3. Create agents and /sub-session will work!")
  
  console.log("\nAlternatively, set environment variable:")
  console.log(`export OPENCODE_SESSION_ID=${newSession.id}`)
  console.log("dgmo")
})
