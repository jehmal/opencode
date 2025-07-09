/**
 * Snapshot Manager - Code State Management
 * Agent: safe-evolution-sandbox-003
 * Purpose: Manages snapshots and rollbacks of code evolution
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as crypto from "crypto"
import type { SnapshotData, RollbackOptions, ExecutionResult } from "./types"
import { Logger } from "./logger"

export class SnapshotManager {
  private logger: Logger
  private snapshots: Map<string, SnapshotData> = new Map()

  constructor(private snapshotDir: string) {
    this.logger = new Logger("SnapshotManager")
    this.initializeSnapshotDirectory()
  }

  /**
   * Initialize snapshot directory
   */
  private async initializeSnapshotDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.snapshotDir, { recursive: true })
    } catch (error) {
      this.logger.error("Failed to create snapshot directory:", error)
    }
  }

  /**
   * Create a snapshot of current code state
   */
  async createSnapshot(
    sandboxId: string,
    code: string,
    tests: string,
    executionResult?: ExecutionResult,
    metadata?: {
      version?: string
      description?: string
      tags?: string[]
    },
  ): Promise<string> {
    const snapshotId = this.generateSnapshotId()
    const timestamp = Date.now()

    const snapshot: SnapshotData = {
      id: snapshotId,
      sandboxId,
      timestamp,
      code,
      tests,
      executionResult,
      metadata: {
        version: metadata?.version || "1.0.0",
        description: metadata?.description,
        tags: metadata?.tags || [],
      },
    }

    // Store in memory
    this.snapshots.set(snapshotId, snapshot)

    // Persist to disk
    await this.persistSnapshot(snapshot)

    this.logger.info(`Created snapshot ${snapshotId} for sandbox ${sandboxId}`)
    return snapshotId
  }

  /**
   * Get snapshot by ID
   */
  async getSnapshot(snapshotId: string): Promise<SnapshotData | null> {
    // Check memory first
    if (this.snapshots.has(snapshotId)) {
      return this.snapshots.get(snapshotId)!
    }

    // Try to load from disk
    try {
      const snapshot = await this.loadSnapshot(snapshotId)
      if (snapshot) {
        this.snapshots.set(snapshotId, snapshot)
      }
      return snapshot
    } catch (error) {
      this.logger.error(`Failed to load snapshot ${snapshotId}:`, error)
      return null
    }
  }

  /**
   * List all snapshots for a sandbox
   */
  async listSnapshots(sandboxId?: string): Promise<SnapshotData[]> {
    const allSnapshots = await this.loadAllSnapshots()

    if (sandboxId) {
      return allSnapshots.filter((s) => s.sandboxId === sandboxId)
    }

    return allSnapshots
  }

  /**
   * Rollback to a specific snapshot
   */
  async rollback(options: RollbackOptions): Promise<{
    success: boolean
    snapshot?: SnapshotData
    error?: string
  }> {
    try {
      const snapshot = await this.getSnapshot(options.snapshotId)

      if (!snapshot) {
        return {
          success: false,
          error: `Snapshot ${options.snapshotId} not found`,
        }
      }

      // Validate snapshot if requested
      if (options.validateBeforeRollback) {
        const isValid = await this.validateSnapshot(snapshot)
        if (!isValid) {
          return {
            success: false,
            error: "Snapshot validation failed",
          }
        }
      }

      // Create backup of current state if requested
      if (options.preserveCurrentState) {
        await this.createSnapshot(
          snapshot.sandboxId,
          snapshot.code, // This would be current code in real implementation
          snapshot.tests,
          undefined,
          {
            description: `Backup before rollback to ${options.snapshotId}`,
            tags: ["rollback-backup"],
          },
        )
      }

      // Log rollback
      this.logger.info(`Rolled back to snapshot ${options.snapshotId}`, {
        reason: options.reason,
      })

      return {
        success: true,
        snapshot,
      }
    } catch (error) {
      this.logger.error("Rollback failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Compare two snapshots
   */
  async compareSnapshots(
    snapshotId1: string,
    snapshotId2: string,
  ): Promise<{
    codeDiff: boolean
    testDiff: boolean
    performanceDiff?: {
      improved: boolean
      metrics: any
    }
  }> {
    const snapshot1 = await this.getSnapshot(snapshotId1)
    const snapshot2 = await this.getSnapshot(snapshotId2)

    if (!snapshot1 || !snapshot2) {
      throw new Error("One or both snapshots not found")
    }

    const codeDiff = snapshot1.code !== snapshot2.code
    const testDiff = snapshot1.tests !== snapshot2.tests

    // Compare performance if both have execution results
    let performanceDiff
    if (snapshot1.executionResult && snapshot2.executionResult) {
      const perf1 = snapshot1.executionResult.performanceMetrics
      const perf2 = snapshot2.executionResult.performanceMetrics

      if (perf1 && perf2) {
        performanceDiff = {
          improved: perf2.executionTime < perf1.executionTime,
          metrics: {
            executionTime: perf2.executionTime - perf1.executionTime,
            memoryUsage: perf2.memoryPeak - perf1.memoryPeak,
          },
        }
      }
    }

    return {
      codeDiff,
      testDiff,
      performanceDiff,
    }
  }

  /**
   * Clean up old snapshots
   */
  async cleanupOldSnapshots(
    maxAge: number = 7 * 24 * 60 * 60 * 1000, // 7 days
    keepMinimum: number = 10,
  ): Promise<number> {
    const allSnapshots = await this.loadAllSnapshots()
    const now = Date.now()

    // Sort by timestamp (newest first)
    allSnapshots.sort((a, b) => b.timestamp - a.timestamp)

    // Keep minimum number of snapshots
    const snapshotsToDelete = allSnapshots
      .slice(keepMinimum)
      .filter((s) => now - s.timestamp > maxAge)

    let deletedCount = 0
    for (const snapshot of snapshotsToDelete) {
      try {
        await this.deleteSnapshot(snapshot.id)
        deletedCount++
      } catch (error) {
        this.logger.error(`Failed to delete snapshot ${snapshot.id}:`, error)
      }
    }

    this.logger.info(`Cleaned up ${deletedCount} old snapshots`)
    return deletedCount
  }

  /**
   * Private: Generate unique snapshot ID
   */
  private generateSnapshotId(): string {
    return `snapshot-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`
  }

  /**
   * Private: Persist snapshot to disk
   */
  private async persistSnapshot(snapshot: SnapshotData): Promise<void> {
    const filename = `${snapshot.id}.json`
    const filepath = path.join(this.snapshotDir, filename)

    await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2), "utf-8")
  }

  /**
   * Private: Load snapshot from disk
   */
  private async loadSnapshot(snapshotId: string): Promise<SnapshotData | null> {
    const filename = `${snapshotId}.json`
    const filepath = path.join(this.snapshotDir, filename)

    try {
      const data = await fs.readFile(filepath, "utf-8")
      return JSON.parse(data)
    } catch (error) {
      return null
    }
  }

  /**
   * Private: Load all snapshots
   */
  private async loadAllSnapshots(): Promise<SnapshotData[]> {
    try {
      const files = await fs.readdir(this.snapshotDir)
      const snapshots: SnapshotData[] = []

      for (const file of files) {
        if (file.endsWith(".json")) {
          const filepath = path.join(this.snapshotDir, file)
          try {
            const data = await fs.readFile(filepath, "utf-8")
            snapshots.push(JSON.parse(data))
          } catch (error) {
            this.logger.error(`Failed to load snapshot ${file}:`, error)
          }
        }
      }

      return snapshots
    } catch (error) {
      this.logger.error("Failed to load snapshots:", error)
      return []
    }
  }

  /**
   * Private: Delete snapshot
   */
  private async deleteSnapshot(snapshotId: string): Promise<void> {
    const filename = `${snapshotId}.json`
    const filepath = path.join(this.snapshotDir, filename)

    await fs.unlink(filepath)
    this.snapshots.delete(snapshotId)
  }

  /**
   * Private: Validate snapshot
   */
  private async validateSnapshot(snapshot: SnapshotData): Promise<boolean> {
    // Basic validation
    if (!snapshot.code || !snapshot.tests) {
      return false
    }

    // Check if code is parseable
    try {
      new Function(snapshot.code)
      return true
    } catch {
      return false
    }
  }
}
