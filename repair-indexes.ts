#!/usr/bin/env bun
/**
 * Fix missing sub-session index files
 * This script rebuilds the index files that map parent sessions to their sub-sessions
 */

import path from "path"
import fs from "fs/promises"
import os from "os"

console.log("=== Sub-Session Index Repair Tool ===")
console.log("This will rebuild missing index files\n")

async function repairIndexes() {
  const opencodeBase = path.join(os.homedir(), ".local", "share", "opencode")
  const projectDir = path.join(opencodeBase, "project")
  
  // Process each project
  const projects = await fs.readdir(projectDir)
  
  for (const projectName of projects) {
    const projectPath = path.join(projectDir, projectName)
    const stat = await fs.stat(projectPath)
    
    if (!stat.isDirectory()) continue
    
    console.log(`\nProcessing project: ${projectName}`)
    
    const storagePath = path.join(projectPath, "storage")
    const subSessionDir = path.join(storagePath, "session", "sub-sessions")
    const indexDir = path.join(storagePath, "session", "sub-session-index")
    
    // Check if sub-sessions directory exists
    try {
      await fs.access(subSessionDir)
    } catch {
      console.log("  No sub-sessions directory, skipping")
      continue
    }
    
    // Create index directory if it doesn't exist
    await fs.mkdir(indexDir, { recursive: true })
    
    // Read all sub-session files
    const subFiles = await fs.readdir(subSessionDir)
    console.log(`  Found ${subFiles.length} sub-session files`)
    
    if (subFiles.length === 0) continue
    
    // Build index mapping
    const parentToSubs = new Map<string, string[]>()
    
    for (const file of subFiles) {
      if (!file.endsWith('.json')) continue
      
      try {
        const subPath = path.join(subSessionDir, file)
        const data = JSON.parse(await fs.readFile(subPath, 'utf-8'))
        const parentId = data.parentSessionId
        const subId = file.replace('.json', '')
        
        if (!parentToSubs.has(parentId)) {
          parentToSubs.set(parentId, [])
        }
        parentToSubs.get(parentId)!.push(subId)
        
      } catch (e) {
        console.error(`  Error reading ${file}:`, e.message)
      }
    }
    
    console.log(`  Found ${parentToSubs.size} parent sessions with sub-sessions`)
    
    // Write index files
    let created = 0
    let updated = 0
    
    for (const [parentId, subIds] of parentToSubs) {
      const indexPath = path.join(indexDir, `${parentId}.json`)
      
      try {
        // Check if index already exists
        let existing: string[] = []
        try {
          existing = JSON.parse(await fs.readFile(indexPath, 'utf-8'))
        } catch {
          // File doesn't exist
        }
        
        // Merge with existing and remove duplicates
        const merged = Array.from(new Set([...existing, ...subIds]))
        
        // Write the index
        await fs.writeFile(indexPath, JSON.stringify(merged, null, 2))
        
        if (existing.length === 0) {
          created++
          console.log(`  ✓ Created index for ${parentId} with ${merged.length} sub-sessions`)
        } else {
          updated++
          console.log(`  ✓ Updated index for ${parentId} from ${existing.length} to ${merged.length} sub-sessions`)
        }
        
      } catch (e) {
        console.error(`  Error writing index for ${parentId}:`, e.message)
      }
    }
    
    console.log(`  Summary: Created ${created} new indexes, updated ${updated} existing`)
  }
  
  console.log("\n=== Repair Complete ===")
  console.log("\nNow try opening /sub-session in DGMO to see if sub-sessions appear!")
}

// Run the repair
repairIndexes().catch(console.error)
