#!/usr/bin/env bun
/**
 * Find where sub-sessions are actually being created
 */

import path from "path"
import fs from "fs/promises"
import os from "os"

console.log("=== FINDING SUB-SESSIONS ===\n")

const baseDir = path.join(os.homedir(), ".local", "share", "opencode", "project")
const currentSessionId = "ses_8283328fdffe0OCsKzKoBK0u9o" // Your current session

console.log("Looking for sub-sessions of:", currentSessionId)
console.log("Checking all projects...\n")

let foundAny = false

// Check all projects
for (const project of await fs.readdir(baseDir)) {
  console.log(`\nProject: ${project}`)
  
  // Check index files
  const indexPath = path.join(baseDir, project, "storage", "session", "sub-session-index", `${currentSessionId}.json`)
  try {
    const data = JSON.parse(await fs.readFile(indexPath, 'utf-8'))
    console.log(`  ✓ Found index with ${data.length} sub-sessions!`)
    console.log("  Sub-session IDs:", data)
    foundAny = true
    
    // Check if the files exist
    const subDir = path.join(baseDir, project, "storage", "session", "sub-sessions")
    for (const subId of data) {
      const subFile = path.join(subDir, `${subId}.json`)
      try {
        const subData = JSON.parse(await fs.readFile(subFile, 'utf-8'))
        console.log(`\n  Sub-session: ${subId}`)
        console.log(`    Agent: ${subData.agentName}`)
        console.log(`    Status: ${subData.status}`)
        console.log(`    Created: ${new Date(subData.createdAt).toLocaleString()}`)
      } catch {
        console.log(`  ✗ Sub-session file missing: ${subId}`)
      }
    }
  } catch {
    // No index in this project
  }
  
  // Also check for any sub-sessions claiming this parent
  const subDir = path.join(baseDir, project, "storage", "session", "sub-sessions")
  try {
    const files = await fs.readdir(subDir)
    let orphans = 0
    
    for (const file of files) {
      const data = JSON.parse(await fs.readFile(path.join(subDir, file), 'utf-8'))
      if (data.parentSessionId === currentSessionId) {
        if (!foundAny) {
          console.log(`  ✓ Found orphaned sub-session: ${file}`)
          console.log(`    Agent: ${data.agentName}`)
          console.log(`    Status: ${data.status}`)
        }
        orphans++
      }
    }
    
    if (orphans > 0 && !foundAny) {
      console.log(`  Total orphaned sub-sessions: ${orphans}`)
      foundAny = true
    }
  } catch {}
}

if (!foundAny) {
  console.log("\n❌ No sub-sessions found for this session ID anywhere!")
  
  // Let's check the most recent sub-sessions
  console.log("\nChecking most recent sub-sessions across all projects...")
  
  const recentSubs = []
  for (const project of await fs.readdir(baseDir)) {
    const subDir = path.join(baseDir, project, "storage", "session", "sub-sessions")
    try {
      const files = await fs.readdir(subDir)
      for (const file of files) {
        const stat = await fs.stat(path.join(subDir, file))
        if (Date.now() - stat.mtimeMs < 3600000) { // Last hour
          const data = JSON.parse(await fs.readFile(path.join(subDir, file), 'utf-8'))
          recentSubs.push({
            file,
            project,
            data,
            time: stat.mtimeMs
          })
        }
      }
    } catch {}
  }
  
  recentSubs.sort((a, b) => b.time - a.time)
  
  console.log(`\nMost recent sub-sessions (last hour):`)
  recentSubs.slice(0, 5).forEach(sub => {
    console.log(`\n  ${sub.file}`)
    console.log(`    Project: ${sub.project}`)
    console.log(`    Parent: ${sub.data.parentSessionId}`)
    console.log(`    Agent: ${sub.data.agentName}`)
    console.log(`    Time: ${new Date(sub.time).toLocaleString()}`)
  })
}

// Also check if your session exists
console.log("\n\nVerifying your session exists...")
let sessionFound = false
for (const project of await fs.readdir(baseDir)) {
  const sessionFile = path.join(baseDir, project, "storage", "session", "info", `${currentSessionId}.json`)
  try {
    const data = JSON.parse(await fs.readFile(sessionFile, 'utf-8'))
    console.log(`✓ Session found in project: ${project}`)
    console.log(`  Title: ${data.title}`)
    console.log(`  Created: ${new Date(data.time.created).toLocaleString()}`)
    sessionFound = true
  } catch {}
}

if (!sessionFound) {
  console.log("❌ Your session ID wasn't found! This might not be the right ID.")
}
