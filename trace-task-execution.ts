#!/usr/bin/env bun
/**
 * Live trace of task execution and sub-session creation
 * This will show exactly what happens when you create agents
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"
import { Storage } from "./opencode/packages/opencode/src/storage/storage"
import path from "path"
import fs from "fs/promises"
import os from "os"

console.log("=== LIVE TASK EXECUTION TRACE ===\n")

// First, let's monitor what happens in real-time
const baseDir = path.join(os.homedir(), ".local", "share", "opencode", "project")

// Get the absolute latest session across all projects
async function getLatestSession() {
  let latest = { id: "", project: "", time: 0, isMain: false }
  
  for (const project of await fs.readdir(baseDir)) {
    const infoDir = path.join(baseDir, project, "storage", "session", "info")
    try {
      for (const file of await fs.readdir(infoDir)) {
        const stat = await fs.stat(path.join(infoDir, file))
        if (stat.mtimeMs > latest.time) {
          const sessionData = JSON.parse(await fs.readFile(path.join(infoDir, file), 'utf-8'))
          latest = {
            id: file.replace('.json', ''),
            project,
            time: stat.mtimeMs,
            isMain: !sessionData.parentID
          }
        }
      }
    } catch {}
  }
  
  return latest
}

// Check current state
console.log("1. Current State Check:")
const current = await getLatestSession()
console.log(`   Latest session: ${current.id}`)
console.log(`   Project: ${current.project}`)
console.log(`   Type: ${current.isMain ? 'MAIN' : 'SUB'} session`)
console.log(`   Modified: ${new Date(current.time).toLocaleString()}`)

// Now check what's in this session
const projectPath = current.project.startsWith('mnt-') 
  ? '/' + current.project.replace(/-/g, '/').replace('mnt/', 'mnt/')
  : process.cwd()

await App.provide({ cwd: projectPath }, async () => {
  const session = await Session.get(current.id)
  console.log(`\n2. Session Details:`)
  console.log(`   Title: ${session.title}`)
  console.log(`   Parent: ${session.parentID || 'None (MAIN SESSION)'}`)
  
  // Check current sub-sessions
  const subs = await SubSession.getByParent(current.id)
  console.log(`   Current sub-sessions: ${subs.length}`)
  
  // Check the task tool behavior
  console.log(`\n3. Task Tool Analysis:`)
  console.log(`   When you create agents, the task tool should:`)
  console.log(`   - Use ctx.sessionID as parent (${current.id})`)
  console.log(`   - Create new child sessions`)
  console.log(`   - Call SubSession.create() to register them`)
  
  // Check if task tool is creating sessions elsewhere
  console.log(`\n4. Checking All Projects for Recent Sub-Sessions:`)
  const recentCutoff = Date.now() - (30 * 60 * 1000) // Last 30 minutes
  
  for (const project of await fs.readdir(baseDir)) {
    const subDir = path.join(baseDir, project, "storage", "session", "sub-sessions")
    try {
      const files = await fs.readdir(subDir)
      for (const file of files) {
        const stat = await fs.stat(path.join(subDir, file))
        if (stat.mtimeMs > recentCutoff) {
          const data = JSON.parse(await fs.readFile(path.join(subDir, file), 'utf-8'))
          console.log(`\n   Found recent sub-session in ${project}:`)
          console.log(`   - ID: ${file.replace('.json', '')}`)
          console.log(`   - Parent: ${data.parentSessionId}`)
          console.log(`   - Created: ${new Date(data.createdAt).toLocaleString()}`)
          console.log(`   - Agent: ${data.agentName}`)
          
          // Check if this parent matches our current session
          if (data.parentSessionId === current.id) {
            console.log(`   ✓ This IS a child of current session!`)
          } else {
            console.log(`   ✗ Different parent`)
          }
        }
      }
    } catch {}
  }
  
  // Test the exact storage paths
  console.log(`\n5. Storage Path Test:`)
  const testKey = `session/sub-sessions/test-${Date.now()}`
  const testData = { test: true }
  
  try {
    await Storage.writeJSON(testKey, testData)
    console.log(`   ✓ Can write to storage`)
    
    const physicalPath = path.join(App.info().path.data, "storage", testKey + ".json")
    console.log(`   Physical path: ${physicalPath}`)
    
    const exists = await fs.access(physicalPath).then(() => true).catch(() => false)
    console.log(`   File exists: ${exists}`)
    
    await Storage.remove(testKey)
    console.log(`   ✓ Cleanup successful`)
  } catch (e) {
    console.log(`   ✗ Storage test failed:`, e)
  }
  
  // Check for permission issues
  console.log(`\n6. Permission Check:`)
  const storageDir = path.join(App.info().path.data, "storage")
  const stat = await fs.stat(storageDir)
  console.log(`   Storage dir permissions: ${stat.mode.toString(8)}`)
  console.log(`   Owned by UID: ${stat.uid} (you are ${process.getuid()})`)
})

console.log(`\n\n=== RECOMMENDATIONS ===`)
console.log(`1. When you create agents, watch for console output from [TASK] and [SUB-SESSION]`)
console.log(`2. Check if the parent session ID in logs matches: ${current.id}`)
console.log(`3. Look for any error messages during SubSession.create()`)
console.log(`4. Try creating a test agent right now and see what happens`)
