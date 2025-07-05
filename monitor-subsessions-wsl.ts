#!/usr/bin/env bun
/**
 * Real-time sub-session monitor for WSL
 * Run this while creating agents in DGMO to see what happens
 */

import path from "path"
import fs from "fs/promises"
import { watch } from "fs"
import os from "os"

console.log("=== DGMO Sub-Session Real-Time Monitor (WSL) ===")
console.log("This will monitor storage changes in real-time\n")

async function getStoragePath() {
  const homeDir = os.homedir()
  return path.join(homeDir, ".local", "share", "opencode")
}

async function findActiveProject() {
  const opencodeBase = await getStoragePath()
  const projectDir = path.join(opencodeBase, "project")
  
  // Find the most recently modified project
  const dirs = await fs.readdir(projectDir)
  let mostRecent = null
  let mostRecentTime = 0
  
  for (const dir of dirs) {
    const projectPath = path.join(projectDir, dir)
    const stat = await fs.stat(projectPath)
    if (stat.isDirectory() && stat.mtimeMs > mostRecentTime) {
      mostRecentTime = stat.mtimeMs
      mostRecent = { name: dir, path: projectPath }
    }
  }
  
  return mostRecent
}

async function monitorStorage() {
  const project = await findActiveProject()
  if (!project) {
    console.log("No active project found!")
    return
  }
  
  console.log("Monitoring project:", project.name)
  const storagePath = path.join(project.path, "storage")
  
  // Find the most recent main session
  const sessionInfoDir = path.join(storagePath, "session", "info")
  const files = await fs.readdir(sessionInfoDir)
  let mainSession = null
  
  for (const file of files) {
    const sessionId = file.replace('.json', '')
    const data = JSON.parse(await fs.readFile(path.join(sessionInfoDir, file), 'utf-8'))
    if (!data.parentID) {
      if (!mainSession || data.time.created > mainSession.time.created) {
        mainSession = { id: sessionId, ...data }
      }
    }
  }
  
  if (!mainSession) {
    console.log("No main session found!")
    return
  }
  
  console.log("Active session:", mainSession.id)
  console.log("Session title:", mainSession.title)
  console.log("\nWatching for changes... (Press Ctrl+C to stop)")
  console.log("Create agents in DGMO and watch what happens!\n")
  
  // Watch directories
  const subSessionDir = path.join(storagePath, "session", "sub-sessions")
  const indexDir = path.join(storagePath, "session", "sub-session-index")
  
  // Create directories if they don't exist
  await fs.mkdir(subSessionDir, { recursive: true }).catch(() => {})
  await fs.mkdir(indexDir, { recursive: true }).catch(() => {})
  
  // Initial state
  console.log("Initial state:")
  const indexPath = path.join(indexDir, `${mainSession.id}.json`)
  try {
    const indexData = JSON.parse(await fs.readFile(indexPath, 'utf-8'))
    console.log(`- Index has ${indexData.length} sub-sessions`)
  } catch {
    console.log("- No index file yet")
  }
  
  const subFiles = await fs.readdir(subSessionDir)
  console.log(`- ${subFiles.length} total sub-session files\n`)
  
  // Watch for changes
  console.log("Monitoring changes...\n")
  
  // Watch sub-sessions directory
  watch(subSessionDir, async (event, filename) => {
    if (filename?.endsWith('.json')) {
      console.log(`📁 SUB-SESSION ${event.toUpperCase()}: ${filename}`)
      
      if (event === 'rename') {
        // Could be create or delete
        const filePath = path.join(subSessionDir, filename)
        try {
          const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
          console.log("  ✓ New sub-session created!")
          console.log("  - ID:", filename.replace('.json', ''))
          console.log("  - Parent:", data.parentSessionId)
          console.log("  - Matches active session:", data.parentSessionId === mainSession.id ? "YES ✓" : "NO ✗")
          console.log("  - Agent:", data.agentName)
          console.log("  - Task:", data.taskDescription)
          console.log("  - Time:", new Date().toLocaleTimeString())
        } catch {
          console.log("  ✗ File deleted or not accessible")
        }
      }
    }
  })
  
  // Watch index directory
  watch(indexDir, async (event, filename) => {
    if (filename?.endsWith('.json')) {
      console.log(`\n📋 INDEX ${event.toUpperCase()}: ${filename}`)
      
      if (filename === `${mainSession.id}.json`) {
        console.log("  ✓ Index for active session updated!")
        try {
          const data = JSON.parse(await fs.readFile(path.join(indexDir, filename), 'utf-8'))
          console.log("  - Now contains:", data.length, "sub-sessions")
          console.log("  - IDs:", data)
          console.log("  - Time:", new Date().toLocaleTimeString())
        } catch {
          console.log("  ✗ Could not read index")
        }
      } else {
        console.log("  - Different session:", filename.replace('.json', ''))
      }
    }
  })
  
  // Also watch session info for new sessions
  watch(sessionInfoDir, async (event, filename) => {
    if (filename?.endsWith('.json') && event === 'rename') {
      const sessionId = filename.replace('.json', '')
      try {
        const filePath = path.join(sessionInfoDir, filename)
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
        if (data.parentID === mainSession.id) {
          console.log(`\n🆕 NEW SUB-SESSION CREATED: ${sessionId}`)
          console.log("  - This is a child of the active session!")
          console.log("  - Time:", new Date().toLocaleTimeString())
        }
      } catch {
        // File might have been deleted
      }
    }
  })
  
  // Keep running
  await new Promise(() => {})
}

monitorStorage().catch(console.error)
