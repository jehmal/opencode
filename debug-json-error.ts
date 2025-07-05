#!/usr/bin/env bun
/**
 * Debug what's causing the JSON error
 */

import fs from 'fs'
import path from 'path'

console.log("=== DEBUGGING JSON ERROR ===\n")

const opencodePath = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"

// Check various JSON files that might be causing issues
const jsonFiles = [
  ".opencode/app.json",
  ".opencode/config.json",
  "opencode.json",
  "package.json",
  ".opencode/state.json"
]

console.log("Checking JSON files in:", opencodePath)
console.log("")

jsonFiles.forEach(file => {
  const fullPath = path.join(opencodePath, file)
  console.log(`Checking ${file}:`)
  
  try {
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8')
      console.log(`  ✓ File exists, size: ${content.length} bytes`)
      
      // Try to parse it
      try {
        JSON.parse(content)
        console.log(`  ✓ Valid JSON`)
      } catch (e) {
        console.log(`  ✗ Invalid JSON: ${e.message}`)
        console.log(`  Content: ${content.substring(0, 100)}...`)
      }
      
      // Check if it's empty
      if (content.trim().length === 0) {
        console.log(`  ⚠️  File is empty!`)
      }
    } else {
      console.log(`  ✗ File does not exist`)
    }
  } catch (e) {
    console.log(`  ✗ Error reading file: ${e.message}`)
  }
  console.log("")
})

// Create the missing files with proper content
console.log("Creating/fixing required files...")

const requiredFiles = {
  ".opencode/app.json": {
    name: "dgmstt",
    version: "1.0.0",
    description: "DGMSTT - Multi-Session Task Tool"
  },
  ".opencode/config.json": {
    agentMode: "all-tools",
    experimental: {
      mcp: true
    }
  },
  "opencode.json": {
    "$schema": "https://opencode.ai/config.json",
    name: "dgmstt",
    version: "1.0.0",
    agentMode: "all-tools"
  }
}

// Ensure .opencode directory exists
const opencodeDir = path.join(opencodePath, ".opencode")
if (!fs.existsSync(opencodeDir)) {
  fs.mkdirSync(opencodeDir, { recursive: true })
  console.log("Created .opencode directory")
}

// Create the files
Object.entries(requiredFiles).forEach(([file, content]) => {
  const fullPath = path.join(opencodePath, file)
  try {
    fs.writeFileSync(fullPath, JSON.stringify(content, null, 2))
    console.log(`✓ Created/updated ${file}`)
  } catch (e) {
    console.log(`✗ Failed to create ${file}: ${e.message}`)
  }
})

console.log("\nDone! The TUI should now start without JSON errors.")
