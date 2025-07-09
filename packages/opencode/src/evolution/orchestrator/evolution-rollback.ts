/**
 * Evolution Rollback Manager
 * Manages snapshots and rollback functionality for safe evolution recovery
 */

import { EventEmitter } from "events"
import { Log } from "../../util/log"
import { NamedError } from "../../util/error"
import { z } from "zod"
import { readFile, writeFile } from "fs/promises"
import * as path from "path"
import type { EvolutionResult } from "../types"

const log = Log.create({ service: "evolution-rollback" })

/**
 * Code snapshot
 */
export interface CodeSnapshot {
  id: string
  evolutionId: string
  timestamp: number
  files: Array<{
    path: string
    content: string
    originalContent: string
  }>
  metadata: {
    evolutionId: string
    reason: string
    hypothesis?: any
  }
}

/**
 * Rollback errors
 */
export const RollbackError = NamedError.create(
  "RollbackError",
  z.object({
    code: z.string(),
    message: z.string(),
    evolutionId: z.string(),
    details: z.any().optional(),
  }),
)

/**
 * Evolution Rollback Manager
 */
export class EvolutionRollbackManager extends EventEmitter {
  private snapshots = new Map<string, CodeSnapshot>()
  private readonly maxSnapshots = 100

  /**
   * Create a snapshot before applying evolution
   */
  async createSnapshot(evolution: EvolutionResult): Promise<string> {
    const snapshotId = `snapshot-${evolution.id}-${Date.now()}`

    try {
      const files = await this.captureFiles(
        evolution.changes.map((c) => c.file),
      )

      const snapshot: CodeSnapshot = {
        id: snapshotId,
        evolutionId: evolution.id,
        timestamp: Date.now(),
        files: files.map((file, index) => ({
          path: file.path,
          content: file.content,
          originalContent:
            evolution.changes[index]?.originalContent || file.content,
        })),
        metadata: {
          evolutionId: evolution.id,
          reason: evolution.hypothesis.description,
          hypothesis: evolution.hypothesis,
        },
      }

      this.snapshots.set(snapshotId, snapshot)

      // Cleanup old snapshots
      if (this.snapshots.size > this.maxSnapshots) {
        const oldestKey = Array.from(this.snapshots.keys())[0]
        this.snapshots.delete(oldestKey)
      }

      log.info("Created snapshot", {
        snapshotId,
        evolutionId: evolution.id,
        fileCount: files.length,
      })

      this.emit("snapshot-created", { snapshotId, evolutionId: evolution.id })
      return snapshotId
    } catch (error) {
      throw new RollbackError({
        code: "SNAPSHOT_FAILED",
        message: "Failed to create snapshot",
        evolutionId: evolution.id,
        details: error,
      })
    }
  }

  /**
   * Rollback to a previous state
   */
  async rollback(evolutionId: string): Promise<void> {
    const snapshot = this.findSnapshot(evolutionId)

    if (!snapshot) {
      throw new RollbackError({
        code: "NO_SNAPSHOT",
        message: "No snapshot found for evolution",
        evolutionId,
      })
    }

    log.info("Starting rollback", {
      evolutionId,
      snapshotId: snapshot.id,
      fileCount: snapshot.files.length,
    })

    try {
      // Restore files
      for (const file of snapshot.files) {
        await writeFile(file.path, file.originalContent, "utf-8")
        log.info("Restored file", { path: file.path })
      }

      log.info("Rollback completed", {
        evolutionId,
        snapshotId: snapshot.id,
        filesRestored: snapshot.files.length,
      })

      this.emit("rollback-completed", {
        evolutionId,
        snapshotId: snapshot.id,
      })
    } catch (error) {
      throw new RollbackError({
        code: "ROLLBACK_FAILED",
        message: "Failed to rollback evolution",
        evolutionId,
        details: error,
      })
    }
  }

  /**
   * Check if rollback is available
   */
  canRollback(evolutionId: string): boolean {
    return this.findSnapshot(evolutionId) !== undefined
  }

  /**
   * Get snapshot for evolution
   */
  getSnapshot(evolutionId: string): CodeSnapshot | undefined {
    return this.findSnapshot(evolutionId)
  }

  /**
   * List all snapshots
   */
  listSnapshots(): Array<{
    id: string
    evolutionId: string
    timestamp: number
    fileCount: number
  }> {
    return Array.from(this.snapshots.values()).map((snapshot) => ({
      id: snapshot.id,
      evolutionId: snapshot.evolutionId,
      timestamp: snapshot.timestamp,
      fileCount: snapshot.files.length,
    }))
  }

  /**
   * Clear all snapshots
   */
  clearSnapshots(): void {
    this.snapshots.clear()
    log.info("Cleared all snapshots")
  }

  /**
   * Delete specific snapshot
   */
  deleteSnapshot(snapshotId: string): boolean {
    const deleted = this.snapshots.delete(snapshotId)
    if (deleted) {
      log.info("Deleted snapshot", { snapshotId })
    }
    return deleted
  }

  /**
   * Find snapshot by evolution ID
   */
  private findSnapshot(evolutionId: string): CodeSnapshot | undefined {
    // Find the most recent snapshot for this evolution
    let latestSnapshot: CodeSnapshot | undefined

    for (const snapshot of this.snapshots.values()) {
      if (snapshot.evolutionId === evolutionId) {
        if (!latestSnapshot || snapshot.timestamp > latestSnapshot.timestamp) {
          latestSnapshot = snapshot
        }
      }
    }

    return latestSnapshot
  }

  /**
   * Capture current file contents
   */
  private async captureFiles(filePaths: string[]): Promise<
    Array<{
      path: string
      content: string
    }>
  > {
    const files: Array<{ path: string; content: string }> = []

    for (const filePath of filePaths) {
      try {
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(process.cwd(), filePath)

        const content = await readFile(absolutePath, "utf-8")
        files.push({
          path: absolutePath,
          content,
        })
      } catch (error) {
        log.warn("Failed to capture file", { path: filePath, error })
        // Continue with other files
      }
    }

    return files
  }

  /**
   * Export snapshots for persistence
   */
  exportSnapshots(): CodeSnapshot[] {
    return Array.from(this.snapshots.values())
  }

  /**
   * Import snapshots from persistence
   */
  importSnapshots(snapshots: CodeSnapshot[]): void {
    for (const snapshot of snapshots) {
      this.snapshots.set(snapshot.id, snapshot)
    }

    // Cleanup if over limit
    while (this.snapshots.size > this.maxSnapshots) {
      const oldestKey = Array.from(this.snapshots.keys())[0]
      this.snapshots.delete(oldestKey)
    }

    log.info("Imported snapshots", { count: snapshots.length })
  }
}
