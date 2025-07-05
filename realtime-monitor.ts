#!/usr/bin/env bun
/**
 * Real-time monitor to run while you create agents
 * This will show exactly what's happening with storage
 */

import { watch } from "fs"
import path from "path"
import fs from "fs/promises"
import os from "os"

console.log("=== REAL-TIME SUB-SESSION MONITOR ===")
console.log("Keep this running while you create agents in DGMO\n")

const baseDir = path.join(os.homedir(), ".local", "share", "opencode", "project")

// Find the newest session (should be your current one)
let newestSession = { id: "", project: "", time: 0 }

for (const project of await fs.readdir(baseDir)) {
  const infoDir = path.join(baseDir, project, "storage", "session", "info")
  try {
    for (const file of await fs.readdir(infoDir)) {
      const stat = await fs.stat(path.join(infoDir, file))
      if (stat.mtimeMs > newestSession.time) {
        newestSession = {
          id: file.replace('.json', ''),
          project,
          time: stat.mtimeMs
        }
      }
    }
  } catch {}
}

console.log("Monitoring session:", newestSession.id)
console.log("Project:", newestSession.project)
console.log("Started:", new Date(newestSession.time).toLocaleString())
console.log("\nWatching for changes...")
console.log("NOW CREATE AGENTS IN DGMO: 'Create 2 agents to test'\n")

// Watch all sub-session directories
const watchers = []

for (const project of await fs.readdir(baseDir)) {
  const subDir = path.join(baseDir, project, "storage", "session", "sub-sessions")
  const indexDir = path.join(baseDir, project, "storage", "session", "sub-session-index")
  
  try {
    await fs.access(subDir)
    
    // Watch sub-sessions
    const w1 = watch(subDir, async (event, filename) => {
      if (filename?.endsWith('.json')) {
        console.log(`\n[${new Date().toLocaleTimeString()}] SUB-SESSION ${event}: ${filename}`)
        console.log(`  Project: ${project}`)
        
        if (event === 'rename') {
          try {
            const data = JSON.parse(await fs.readFile(path.join(subDir, filename), 'utf-8'))
            console.log(`  Parent: ${data.parentSessionId}`)
            console.log(`  Agent: ${data.agentName}`)
            console.log(`  Status: ${data.status}`)
            
            if (data.parentSessionId === newestSession.id) {
              console.log(`  ✓ MATCHES YOUR CURRENT SESSION!`)
            } else {
              console.log(`  ✗ Different parent session`)
            }
          } catch (e) {
            console.log(`  (File might be deleted or not ready)`)
          }
        }
      }
    })
    watchers.push(w1)
    
    // Watch indexes
    await fs.access(indexDir)
    const w2 = watch(indexDir, async (event, filename) => {
      if (filename?.endsWith('.json')) {
        console.log(`\n[${new Date().toLocaleTimeString()}] INDEX ${event}: ${filename}`)
        console.log(`  Project: ${project}`)
        
        const sessionId = filename.replace('.json', '')
        if (sessionId === newestSession.id) {
          console.log(`  ✓ THIS IS YOUR SESSION'S INDEX!`)
          
          try {
            const data = JSON.parse(await fs.readFile(path.join(indexDir, filename), 'utf-8'))
            console.log(`  Contains ${data.length} sub-sessions:`, data)
          } catch {}
        }
      }
    })
    watchers.push(w2)
    
  } catch {}
}

// Keep running
process.on('SIGINT', () => {
  console.log('\nStopping monitor...')
  watchers.forEach(w => w.close())
  process.exit()
})

// Keep the process alive
setInterval(() => {}, 1000)
