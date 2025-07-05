#!/usr/bin/env bun
/**
 * Find all app.json files and check their content
 */

import { execSync } from 'child_process'
import fs from 'fs'

console.log("=== FINDING ALL APP.JSON FILES ===\n")

// Search for all app.json files
try {
  const result = execSync('find /mnt/c/Users/jehma/Desktop/AI/DGMSTT -name "app.json" -type f 2>/dev/null', { encoding: 'utf-8' })
  const files = result.trim().split('\n').filter(f => f.length > 0)
  
  console.log(`Found ${files.length} app.json files:\n`)
  
  files.forEach(file => {
    console.log(`File: ${file}`)
    try {
      const content = fs.readFileSync(file, 'utf-8')
      console.log(`  Size: ${content.length} bytes`)
      
      if (content.length === 0) {
        console.log(`  ⚠️  FILE IS EMPTY!`)
      } else {
        try {
          const parsed = JSON.parse(content)
          console.log(`  ✓ Valid JSON:`, JSON.stringify(parsed).substring(0, 100))
        } catch (e) {
          console.log(`  ✗ Invalid JSON: ${e.message}`)
          console.log(`  Raw content: "${content.substring(0, 50)}"`)
        }
      }
    } catch (e) {
      console.log(`  ✗ Cannot read file: ${e.message}`)
    }
    console.log("")
  })
  
  // Also check the home directory storage
  console.log("\nChecking storage locations:")
  const storagePaths = [
    '/home/jehma/.local/share/opencode',
    '/home/jehma/.config/opencode',
    '/home/jehma/.opencode'
  ]
  
  storagePaths.forEach(path => {
    console.log(`\nChecking ${path}:`)
    try {
      const findResult = execSync(`find ${path} -name "*.json" -type f 2>/dev/null | head -20`, { encoding: 'utf-8' })
      const jsonFiles = findResult.trim().split('\n').filter(f => f.length > 0)
      
      jsonFiles.forEach(file => {
        // Check if any are empty
        try {
          const stat = fs.statSync(file)
          if (stat.size === 0) {
            console.log(`  ⚠️  EMPTY FILE: ${file}`)
          }
        } catch (e) {
          // Ignore
        }
      })
    } catch (e) {
      console.log(`  Directory not found or not accessible`)
    }
  })
  
} catch (e) {
  console.log("Error searching for files:", e.message)
}

// Check if there's an issue with the OpenCode SDK initialization
console.log("\n\nChecking OpenCode binary app info:")
try {
  const result = execSync('cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode && bun run packages/opencode/bin/opencode.js app 2>&1', { encoding: 'utf-8' })
  console.log("OpenCode app info:", result)
} catch (e) {
  console.log("Error getting app info:", e.message)
  console.log("Output:", e.stdout?.toString())
  console.log("Error:", e.stderr?.toString())
}
