#!/usr/bin/env bun
/**
 * Comprehensive trace that monitors EVERYTHING
 * including temporary files, all projects, and console output
 */

import { spawn } from "child_process"
import path from "path"
import fs from "fs/promises"
import os from "os"
import { watch } from "fs"

console.log("=== COMPREHENSIVE DGMO TRACE ===\n")

// Monitor ALL possible locations
const locations = [
  path.join(os.homedir(), ".local", "share", "opencode"),
  path.join(os.homedir(), ".config", "opencode"),
  path.join(os.tmpdir()),
  process.cwd(),
  "/tmp"
]

console.log("Monitoring locations:")
locations.forEach(loc => console.log("  -", loc))

// Set up file watchers for all locations
const watchers = []

async function setupWatcher(dir, label) {
  try {
    await fs.access(dir)
    const w = watch(dir, { recursive: true }, (event, filename) => {
      if (filename && (filename.includes('session') || filename.includes('agent') || filename.includes('.json'))) {
        console.log(`\n[${new Date().toLocaleTimeString()}] ${label} - ${event}: ${filename}`)
      }
    })
    watchers.push(w)
    console.log(`  ✓ Watching ${label}`)
  } catch {
    console.log(`  ✗ Cannot watch ${label}`)
  }
}

// Start watchers
for (const loc of locations) {
  await setupWatcher(loc, loc)
}

// Also trace process activity
console.log("\n2. Starting process trace...")
console.log("   This will show all file operations\n")

// Use strace to capture ALL file operations
const strace = spawn('strace', [
  '-e', 'trace=open,openat,write,mkdir,rename',
  '-f', // Follow forks
  '-s', '200', // String size
  'dgmo'
], {
  stdio: ['inherit', 'pipe', 'pipe']
})

// Capture strace output
strace.stderr.on('data', (data) => {
  const lines = data.toString().split('\n')
  for (const line of lines) {
    // Filter for relevant operations
    if (line.includes('session') || line.includes('agent') || line.includes('.json')) {
      if (!line.includes('/proc/') && !line.includes('/sys/')) {
        console.log(`[STRACE] ${line.trim()}`)
      }
    }
  }
})

strace.on('error', (err) => {
  console.error('Failed to start strace:', err)
  console.log('\nFalling back to manual monitoring...')
  
  // If strace fails, just monitor the opencode storage
  monitorManually()
})

async function monitorManually() {
  const baseDir = path.join(os.homedir(), ".local", "share", "opencode", "project")
  
  console.log("\n3. Manual monitoring active")
  console.log("   Checking for changes every second...\n")
  
  // Keep track of known files
  const knownFiles = new Map()
  
  // Initial scan
  for (const project of await fs.readdir(baseDir)) {
    const subDir = path.join(baseDir, project, "storage", "session", "sub-sessions")
    try {
      const files = await fs.readdir(subDir)
      files.forEach(f => knownFiles.set(path.join(subDir, f), true))
    } catch {}
  }
  
  console.log(`   Tracking ${knownFiles.size} existing sub-session files`)
  
  // Poll for changes
  setInterval(async () => {
    for (const project of await fs.readdir(baseDir)) {
      const subDir = path.join(baseDir, project, "storage", "session", "sub-sessions")
      try {
        const files = await fs.readdir(subDir)
        for (const file of files) {
          const fullPath = path.join(subDir, file)
          if (!knownFiles.has(fullPath)) {
            console.log(`\n[NEW FILE] ${fullPath}`)
            knownFiles.set(fullPath, true)
            
            // Read and display contents
            try {
              const data = JSON.parse(await fs.readFile(fullPath, 'utf-8'))
              console.log("  Parent:", data.parentSessionId)
              console.log("  Agent:", data.agentName)
              console.log("  Status:", data.status)
            } catch {}
          }
        }
      } catch {}
    }
  }, 1000)
}

console.log("\n=== READY ===")
console.log("1. In another terminal, run: dgmo")
console.log("2. Create agents: 'Create 2 agents to test'")
console.log("3. Watch this output for ALL file operations")
console.log("\nPress Ctrl+C to stop\n")

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nCleaning up...')
  watchers.forEach(w => w.close())
  if (strace) strace.kill()
  process.exit()
})

// If strace isn't available, fall back to manual
setTimeout(() => {
  if (!strace.pid) {
    monitorManually()
  }
}, 1000)
