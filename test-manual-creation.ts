#!/usr/bin/env bun
/**
 * Test if we can manually create a sub-session
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"
import os from "os"
import path from "path"
import fs from "fs/promises"

console.log("=== MANUAL SUB-SESSION CREATION TEST ===\n")

// Get the latest main session
const baseDir = path.join(os.homedir(), ".local", "share", "opencode", "project")
let latestMain = null

for (const project of await fs.readdir(baseDir)) {
  const infoDir = path.join(baseDir, project, "storage", "session", "info")
  try {
    for (const file of await fs.readdir(infoDir)) {
      const data = JSON.parse(await fs.readFile(path.join(infoDir, file), 'utf-8'))
      if (!data.parentID) {
        if (!latestMain || data.time.created > latestMain.time.created) {
          latestMain = { ...data, id: file.replace('.json', ''), project }
        }
      }
    }
  } catch {}
}

if (!latestMain) {
  console.log("No main session found!")
  process.exit(1)
}

console.log("Using main session:", latestMain.id)
console.log("Title:", latestMain.title)
console.log("Project:", latestMain.project)

// Set up app context
const projectPath = latestMain.project.startsWith('mnt-') 
  ? '/' + latestMain.project.replace(/-/g, '/').replace('mnt/', 'mnt/')
  : process.cwd()

await App.provide({ cwd: projectPath }, async () => {
  console.log("\nCreating test sub-session...")
  
  // Create a child session
  const childSession = await Session.create(latestMain.id)
  console.log("✓ Child session created:", childSession.id)
  console.log("  Parent ID:", childSession.parentID)
  
  // Register it as a sub-session
  await SubSession.create(
    latestMain.id,
    childSession.id,
    "Test Agent Manual",
    "Manual test to verify sub-session creation"
  )
  console.log("✓ Sub-session registered")
  
  // Verify it was created
  const subs = await SubSession.getByParent(latestMain.id)
  console.log(`\n✓ Parent now has ${subs.length} sub-sessions`)
  
  const found = subs.find(s => s.id === childSession.id)
  if (found) {
    console.log("✓ Our test sub-session is in the list!")
    console.log("\nNow check /sub-session in DGMO - you should see 'Test Agent Manual'")
  } else {
    console.log("✗ Test sub-session NOT found in list!")
  }
})
