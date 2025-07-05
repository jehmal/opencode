#!/usr/bin/env bun
/**
 * Deep debug of sub-session display issue
 * This will trace the exact flow from TUI to storage
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"
import { Storage } from "./opencode/packages/opencode/src/storage/storage"
import path from "path"
import fs from "fs/promises"
import os from "os"

console.log("=== DEEP SUB-SESSION DEBUG ===\n")

// First, let's find the ACTUAL current session that DGMO is using
async function findCurrentSession() {
  // Look for the most recently modified session across ALL projects
  const baseDir = path.join(os.homedir(), ".local", "share", "opencode", "project")
  const projects = await fs.readdir(baseDir)
  
  let mostRecentSession = null
  let mostRecentTime = 0
  let mostRecentProject = ""
  
  for (const project of projects) {
    const sessionDir = path.join(baseDir, project, "storage", "session", "info")
    try {
      const files = await fs.readdir(sessionDir)
      for (const file of files) {
        const filePath = path.join(sessionDir, file)
        const stat = await fs.stat(filePath)
        if (stat.mtimeMs > mostRecentTime) {
          mostRecentTime = stat.mtimeMs
          mostRecentSession = file.replace('.json', '')
          mostRecentProject = project
        }
      }
    } catch {
      // Skip if no session directory
    }
  }
  
  return { sessionId: mostRecentSession, project: mostRecentProject, time: new Date(mostRecentTime) }
}

// Start debugging
const current = await findCurrentSession()
console.log("1. Most Recent Session (likely your current DGMO session):")
console.log("   Session ID:", current.sessionId)
console.log("   Project:", current.project)
console.log("   Last modified:", current.time.toLocaleString())

// Now test from that project's context
const projectPath = current.project.startsWith('mnt-') 
  ? '/' + current.project.replace(/-/g, '/').replace('mnt/', 'mnt/')
  : process.cwd()

console.log("\n2. Testing SubSession retrieval for this session:")
console.log("   Using project path:", projectPath)

await App.provide({ cwd: projectPath }, async () => {
  const info = App.info()
  console.log("   App data path:", info.path.data)
  console.log("   Expected project:", path.basename(info.path.data))
  
  // Get the session
  try {
    const session = await Session.get(current.sessionId)
    console.log("\n3. Session Details:")
    console.log("   ID:", session.id)
    console.log("   Title:", session.title)
    console.log("   Parent ID:", session.parentID || "None (main session)")
    
    // Check for sub-sessions using the EXACT same method as the server
    console.log("\n4. Testing SubSession.getByParent():")
    const subSessions = await SubSession.getByParent(current.sessionId)
    console.log("   Result:", subSessions.length, "sub-sessions")
    
    if (subSessions.length > 0) {
      console.log("   Sub-sessions found:")
      subSessions.slice(0, 3).forEach(sub => {
        console.log(`   - ${sub.id}: ${sub.agentName} (${sub.status})`)
      })
    }
    
    // Check the index file directly
    console.log("\n5. Checking Index File Directly:")
    const indexPath = `session/sub-session-index/${current.sessionId}`
    try {
      const indexData = await Storage.readJSON(indexPath)
      console.log("   Index exists with", Array.isArray(indexData) ? indexData.length : 0, "entries")
      if (Array.isArray(indexData) && indexData.length > 0) {
        console.log("   Sub-session IDs:", indexData.slice(0, 3), "...")
      }
    } catch (e) {
      console.log("   No index file found")
      console.log("   Expected at:", path.join(info.path.data, "storage", indexPath + ".json"))
    }
    
    // List ALL index files to see what's there
    console.log("\n6. ALL Index Files in Project:")
    const indexDir = path.join(info.path.data, "storage", "session", "sub-session-index")
    try {
      const indexFiles = await fs.readdir(indexDir)
      console.log("   Total index files:", indexFiles.length)
      indexFiles.slice(0, 5).forEach(file => {
        console.log(`   - ${file}`)
      })
    } catch (e) {
      console.log("   Error reading index directory:", e.message)
    }
    
    // Check if this session has sub-sessions in a different project
    console.log("\n7. Checking Other Projects for Sub-Sessions:")
    const baseDir = path.join(os.homedir(), ".local", "share", "opencode", "project")
    const projects = await fs.readdir(baseDir)
    
    for (const proj of projects) {
      if (proj === current.project) continue
      
      const indexFile = path.join(baseDir, proj, "storage", "session", "sub-session-index", `${current.sessionId}.json`)
      try {
        const data = await fs.readFile(indexFile, 'utf-8')
        const subs = JSON.parse(data)
        if (subs.length > 0) {
          console.log(`   ⚠️  Found ${subs.length} sub-sessions in DIFFERENT project: ${proj}`)
        }
      } catch {
        // No index in this project
      }
    }
    
  } catch (e) {
    console.error("   Error getting session:", e)
  }
})

// Final analysis
console.log("\n=== ANALYSIS ===")
console.log("If sub-sessions aren't showing, possible causes:")
console.log("1. Session mismatch - DGMO is using a different session than expected")
console.log("2. The current session genuinely has no sub-sessions")
console.log("3. Sub-sessions were created for a different session")
console.log("4. TUI is not properly calling the API or displaying results")

console.log("\nTo fix, we need to:")
console.log("1. Identify which session DGMO is actually using")
console.log("2. Check if that specific session has sub-sessions")
console.log("3. If not, create new sub-sessions for the current session")
