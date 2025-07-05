#!/usr/bin/env bun
/**
 * WSL-compatible sub-session testing script
 * This script tests the entire flow of sub-session creation and retrieval
 */

import path from "path"
import fs from "fs/promises"
import os from "os"

console.log("=== DGMO Sub-Session Debug Script (WSL) ===")
console.log("This script will test sub-session creation and retrieval\n")

// Get the storage path - in WSL it's in the Linux home directory
async function getStoragePath() {
  const homeDir = os.homedir()
  const possiblePaths = [
    path.join(homeDir, ".local", "share", "opencode"),
    path.join(homeDir, ".config", "opencode"),
    path.join(homeDir, ".opencode")
  ]
  
  for (const p of possiblePaths) {
    try {
      await fs.access(p)
      console.log("Found opencode directory at:", p)
      return p
    } catch {
      // Continue checking
    }
  }
  
  // If not found, return the most likely path
  return path.join(homeDir, ".local", "share", "opencode")
}

async function runDiagnostics() {
  const opencodeBase = await getStoragePath()
  console.log("1. OpenCode base path:", opencodeBase)
  
  // List project directories
  const projectDir = path.join(opencodeBase, "project")
  let projects = []
  
  try {
    const dirs = await fs.readdir(projectDir)
    console.log(`\n2. Found ${dirs.length} project directories`)
    
    for (const dir of dirs) {
      const projectPath = path.join(projectDir, dir)
      const stat = await fs.stat(projectPath)
      if (stat.isDirectory()) {
        projects.push({
          name: dir,
          path: projectPath
        })
        console.log(`   - ${dir}`)
      }
    }
  } catch (e) {
    console.error("Error reading project directories:", e.message)
    return
  }
  
  // Check each project for sub-sessions
  for (const project of projects) {
    console.log(`\n3. Checking project: ${project.name}`)
    const storagePath = path.join(project.path, "storage")
    
    // Check if storage exists
    try {
      await fs.access(storagePath)
      console.log("   ✓ Storage directory exists")
    } catch {
      console.log("   ✗ No storage directory")
      continue
    }
    
    // Find sessions
    const sessionInfoDir = path.join(storagePath, "session", "info")
    let sessions = []
    
    try {
      const files = await fs.readdir(sessionInfoDir)
      console.log(`   Found ${files.length} sessions`)
      
      // Get details of recent sessions
      for (const file of files.slice(-5)) {
        const sessionId = file.replace('.json', '')
        try {
          const data = await fs.readFile(path.join(sessionInfoDir, file), 'utf-8')
          const sessionData = JSON.parse(data)
          sessions.push({ id: sessionId, ...sessionData })
          
          const isMain = !sessionData.parentID
          console.log(`\n   Session: ${sessionId}`)
          console.log(`   - Type: ${isMain ? 'MAIN' : 'SUB'}`)
          console.log(`   - Created: ${new Date(sessionData.time.created).toLocaleString()}`)
          if (!isMain) {
            console.log(`   - Parent: ${sessionData.parentID}`)
          }
        } catch (e) {
          console.error(`   Error reading session ${sessionId}:`, e.message)
        }
      }
    } catch (e) {
      console.error("   Error reading sessions:", e.message)
      continue
    }
    
    // Find main sessions
    const mainSessions = sessions.filter(s => !s.parentID)
    console.log(`\n   Main sessions: ${mainSessions.length}`)
    
    if (mainSessions.length === 0) {
      console.log("   No main sessions found")
      continue
    }
    
    // Check sub-sessions for the most recent main session
    const mainSession = mainSessions.sort((a, b) => b.time.created - a.time.created)[0]
    console.log(`\n4. Checking sub-sessions for: ${mainSession.id}`)
    
    // Check index file
    const indexPath = path.join(storagePath, "session", "sub-session-index", `${mainSession.id}.json`)
    let indexData = []
    
    try {
      const data = await fs.readFile(indexPath, 'utf-8')
      indexData = JSON.parse(data)
      console.log(`   ✓ Index file exists with ${indexData.length} entries`)
      console.log("   Sub-session IDs:", indexData)
    } catch {
      console.log("   ✗ No index file found")
    }
    
    // Check sub-session files
    const subSessionDir = path.join(storagePath, "session", "sub-sessions")
    let subSessionCount = 0
    
    try {
      const files = await fs.readdir(subSessionDir)
      subSessionCount = files.length
      console.log(`\n   Total sub-session files: ${subSessionCount}`)
      
      // Check recent sub-sessions
      for (const file of files.slice(-5)) {
        try {
          const data = await fs.readFile(path.join(subSessionDir, file), 'utf-8')
          const subData = JSON.parse(data)
          const isForCurrentSession = subData.parentSessionId === mainSession.id
          
          console.log(`\n   ${file}:`)
          console.log(`   - Parent: ${subData.parentSessionId}`)
          console.log(`   - For current session: ${isForCurrentSession ? 'YES ✓' : 'NO'}`)
          console.log(`   - Status: ${subData.status}`)
          console.log(`   - Agent: ${subData.agentName}`)
          console.log(`   - Task: ${subData.taskDescription}`)
        } catch (e) {
          console.error(`   Error reading ${file}:`, e.message)
        }
      }
    } catch (e) {
      console.error("   Error reading sub-sessions:", e.message)
    }
    
    // Summary
    console.log("\n=== SUMMARY ===")
    console.log(`Project: ${project.name}`)
    console.log(`Main session: ${mainSession.id}`)
    console.log(`Sub-sessions in index: ${indexData.length}`)
    console.log(`Total sub-session files: ${subSessionCount}`)
    
    // Check for mismatches
    if (indexData.length === 0 && subSessionCount > 0) {
      console.log("\n⚠️  WARNING: Sub-session files exist but index is empty!")
      console.log("This might be why they don't show in the TUI")
    }
  }
  
  console.log("\n=== END OF DIAGNOSTICS ===")
}

// Run the diagnostics
runDiagnostics().catch(console.error)
