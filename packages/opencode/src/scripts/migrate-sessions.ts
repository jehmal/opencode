#!/usr/bin/env bun
/**
 * Session Migration Script
 * Consolidates all scattered sessions into the unified storage location
 */

import fs from "fs/promises"
import path from "path"
import { Global } from "../global"

const UNIFIED_DIR = path.join(Global.Path.data, "project", "unified", "storage")
const PROJECT_BASE = path.join(Global.Path.data, "project")

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

async function copyDir(src: string, dest: string) {
  await ensureDir(dest)
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      // Only copy if destination doesn't exist or source is newer
      try {
        const srcStat = await fs.stat(srcPath)
        const destStat = await fs.stat(destPath).catch(() => null)

        if (!destStat || srcStat.mtime > destStat.mtime) {
          await fs.copyFile(srcPath, destPath)
          console.log(`  Copied: ${entry.name}`)
        }
      } catch (e) {
        console.error(`  Error copying ${srcPath}: ${e}`)
      }
    }
  }
}

async function migrateStorage(sourceDir: string) {
  const storagePath = path.join(sourceDir, "storage")

  try {
    await fs.access(storagePath)
  } catch {
    return // No storage directory
  }

  console.log(`\nMigrating from: ${sourceDir}`)

  const subdirs = ["session", "performance"]
  for (const subdir of subdirs) {
    const src = path.join(storagePath, subdir)
    const dest = path.join(UNIFIED_DIR, subdir)

    try {
      await fs.access(src)
      console.log(`  Processing ${subdir}/...`)
      await copyDir(src, dest)
    } catch {
      // Subdir doesn't exist
    }
  }
}

async function countSessions(dir: string): Promise<number> {
  try {
    const infoDir = path.join(dir, "session", "info")
    const files = await fs.readdir(infoDir)
    return files.filter((f) => f.endsWith(".json")).length
  } catch {
    return 0
  }
}

async function main() {
  console.log("DGMO Session Migration Tool")
  console.log("===========================")
  console.log(`Unified storage location: ${UNIFIED_DIR}`)

  // Ensure unified directory exists
  await ensureDir(UNIFIED_DIR)

  // Find all project directories
  const projectDirs = await fs.readdir(PROJECT_BASE, { withFileTypes: true })
  const storageDirs = projectDirs
    .filter((d) => d.isDirectory() && d.name !== "unified")
    .map((d) => path.join(PROJECT_BASE, d.name))

  console.log(`\nFound ${storageDirs.length} project directories to check`)

  // Count sessions before migration
  const beforeCounts = new Map<string, number>()
  for (const dir of storageDirs) {
    const count = await countSessions(path.join(dir, "storage"))
    if (count > 0) {
      beforeCounts.set(dir, count)
      console.log(`  ${path.basename(dir)}: ${count} sessions`)
    }
  }

  // Migrate each directory
  for (const dir of storageDirs) {
    await migrateStorage(dir)
  }

  // Count sessions after migration
  const unifiedCount = await countSessions(UNIFIED_DIR)
  console.log(`\nMigration complete!`)
  console.log(`Total sessions in unified storage: ${unifiedCount}`)

  // Create a migration report
  const report = {
    timestamp: new Date().toISOString(),
    unifiedPath: UNIFIED_DIR,
    migratedFrom: Object.fromEntries(beforeCounts),
    totalSessions: unifiedCount,
  }

  await fs.writeFile(
    path.join(UNIFIED_DIR, "migration-report.json"),
    JSON.stringify(report, null, 2),
  )

  console.log("\nMigration report saved to migration-report.json")
  console.log("\nNext steps:")
  console.log("1. Restart DGMO to use the unified storage")
  console.log("2. All sessions will now be accessible from any directory")
  console.log("3. Old storage directories can be removed after verification")
}

// Run the migration
main().catch(console.error)
