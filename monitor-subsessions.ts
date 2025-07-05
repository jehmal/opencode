#!/usr/bin/env bun
/**
 * Real-time sub-session monitor
 * Run this while creating agents in DGMO to see what happens
 */

import { App } from "./opencode/packages/opencode/src/app/app"
import path from "path"
import fs from "fs/promises"
import { watch } from "fs"

console.log("=== DGMO Sub-Session Real-Time Monitor ===")
console.log("This will monitor storage changes in real-time\n")

let appInfo: any = null

async function getLatestSessionId() {
  const sessionInfoDir = path.join(appInfo.path.data, "storage", "session", "info")
  const files = await fs.readdir(sessionInfoDir)
  const sessions = []
  
  for (const file of files) {
    const sessionId = file.replace('.json', '')
    const sessionData = JSON.parse(
      await fs.readFile(path.join(sessionInfoDir, file), 'utf-8')
    )
    sessions.push({ id: sessionId, ...sessionData })
  }
  
  // Get most recent main session
  return sessions
    .filter(s => !s.parentID)
    .sort((a, b) => b.time.created - a.time.created)[0]?.id
}

async function checkSubSessions(sessionId: string) {
  const indexPath = path.join(appInfo.path.data, "storage", "session", "sub-session-index", `${sessionId}.json`)
  const subSessionDir = path.join(appInfo.path.data, "storage", "session", "sub-sessions")
  
  console.log(`\n[${new Date().toLocaleTimeString()}] Checking session: ${sessionId}`)
  
  // Check index
  try {
    const indexData = JSON.parse(await fs.readFile(indexPath, 'utf-8'))
    console.log(`  Index: ${indexData.length} sub-sessions`)
    
    // Check each sub-session
    for (const subId of indexData) {
      try {
        const subPath = path.join(subSessionDir, `${subId}.json`)
        const subData = JSON.parse(await fs.readFile(subPath, 'utf-8'))
        console.log(`  - ${subId}: ${subData.agentName} (${subData.status})`)
      } catch (e) {
        console.log(`  - ${subId}: ERROR reading file`)
      }
    }
  } catch {
    console.log("  No index file found")
  }
}

async function monitorStorage() {
  await App.provide({ cwd: process.cwd() }, async () => {
    appInfo = App.info()
    console.log("Storage path:", appInfo.path.data)
    
    const currentSessionId = await getLatestSessionId()
    if (!currentSessionId) {
      console.log("No active session found!")
      return
    }
    
    console.log("Monitoring session:", currentSessionId)
    console.log("\nWatching for changes... (Press Ctrl+C to stop)")
    console.log("Create agents in DGMO and watch what happens!\n")
    
    // Initial check
    await checkSubSessions(currentSessionId)
    
    // Watch directories
    const subSessionDir = path.join(appInfo.path.data, "storage", "session", "sub-sessions")
    const indexDir = path.join(appInfo.path.data, "storage", "session", "sub-session-index")
    
    // Watch sub-sessions directory
    const watcher1 = watch(subSessionDir, async (event, filename) => {
      if (filename?.endsWith('.json')) {
        console.log(`\n📁 SUB-SESSION CHANGE: ${event} - ${filename}`)
        
        if (event === 'rename') {
          // New file created
          try {
            const filePath = path.join(subSessionDir, filename)
            const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
            console.log("  New sub-session created:")
            console.log("  - ID:", filename.replace('.json', ''))
            console.log("  - Parent:", data.parentSessionId)
            console.log("  - Is our session:", data.parentSessionId === currentSessionId ? "YES ✓" : "NO ✗")
            console.log("  - Agent:", data.agentName)
            console.log("  - Task:", data.taskDescription)
          } catch (e) {
            console.log("  Error reading new file:", e.message)
          }
        }
      }
    })
    
    // Watch index directory
    const watcher2 = watch(indexDir, async (event, filename) => {
      if (filename?.endsWith('.json')) {
        console.log(`\n📋 INDEX CHANGE: ${event} - ${filename}`)
        
        if (filename === `${currentSessionId}.json`) {
          console.log("  ✓ Index updated for current session!")
          try {
            const indexPath = path.join(indexDir, filename)
            const data = JSON.parse(await fs.readFile(indexPath, 'utf-8'))
            console.log("  - Now contains", data.length, "sub-sessions")
            console.log("  - IDs:", data)
          } catch (e) {
            console.log("  Error reading index:", e.message)
          }
        } else {
          console.log("  Index for different session:", filename.replace('.json', ''))
        }
      }
    })
    
    // Keep the script running
    await new Promise(() => {})
  })
}

monitorStorage().catch(console.error)
