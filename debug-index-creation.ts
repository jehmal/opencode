#!/usr/bin/env bun
/**
 * Debug why index files aren't being created
 * This simulates the SubSession.create process
 */

import path from "path"
import fs from "fs/promises"
import os from "os"

console.log("=== Debug SubSession Index Creation ===\n")

// Simulate what SubSession.create should do
async function testIndexCreation() {
  const opencodeBase = path.join(os.homedir(), ".local", "share", "opencode")
  const projectPath = path.join(opencodeBase, "project", "mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode")
  
  console.log("1. Testing paths:")
  console.log("   Base:", opencodeBase)
  console.log("   Project:", projectPath)
  
  const storagePath = path.join(projectPath, "storage")
  const indexDir = path.join(storagePath, "session", "sub-session-index")
  
  console.log("\n2. Checking index directory:")
  console.log("   Path:", indexDir)
  
  try {
    await fs.access(indexDir)
    console.log("   ✓ Directory exists")
  } catch {
    console.log("   ✗ Directory does NOT exist")
    console.log("   Creating directory...")
    await fs.mkdir(indexDir, { recursive: true })
    console.log("   ✓ Directory created")
  }
  
  // Test writing a file
  console.log("\n3. Testing file write:")
  const testFile = path.join(indexDir, "test-write.json")
  
  try {
    await fs.writeFile(testFile, JSON.stringify(["test"], null, 2))
    console.log("   ✓ Successfully wrote test file")
    
    // Read it back
    const data = JSON.parse(await fs.readFile(testFile, 'utf-8'))
    console.log("   ✓ Successfully read back:", data)
    
    // Clean up
    await fs.unlink(testFile)
    console.log("   ✓ Cleaned up test file")
  } catch (e) {
    console.error("   ✗ Error:", e)
  }
  
  // Check permissions
  console.log("\n4. Checking permissions:")
  try {
    const stat = await fs.stat(indexDir)
    console.log("   Mode:", stat.mode.toString(8))
    console.log("   Owner UID:", stat.uid)
    console.log("   Owner GID:", stat.gid)
  } catch (e) {
    console.error("   Error:", e)
  }
  
  // Test the exact operation SubSession.create would do
  console.log("\n5. Simulating SubSession.create index update:")
  const parentId = "ses_test_parent"
  const subId = "ses_test_sub"
  const indexPath = path.join(indexDir, `${parentId}.json`)
  
  try {
    // Read existing index
    let index: string[] = []
    try {
      index = JSON.parse(await fs.readFile(indexPath, 'utf-8'))
      console.log("   Existing index has", index.length, "entries")
    } catch {
      console.log("   No existing index, creating new")
    }
    
    // Add new sub-session
    index.push(subId)
    
    // Write back
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2))
    console.log("   ✓ Successfully updated index")
    
    // Verify
    const verify = JSON.parse(await fs.readFile(indexPath, 'utf-8'))
    console.log("   ✓ Verified index contains:", verify)
    
    // Clean up
    await fs.unlink(indexPath)
    console.log("   ✓ Cleaned up test index")
    
  } catch (e) {
    console.error("   ✗ Error during index update:", e)
  }
}

testIndexCreation().catch(console.error)
