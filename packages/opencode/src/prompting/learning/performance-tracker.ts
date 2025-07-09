import type { TechniqueExecution } from "../types"
import { Storage } from "../../storage/storage"

interface PerformanceRecord {
  techniqueId: string
  executions: TechniqueExecution[]
  successRate: number
  averageDuration: number
  averageTokens: number
}

export class PerformanceTracker {
  private records = new Map<string, PerformanceRecord>()
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return

    // Load historical performance data from storage
    try {
      const data = await Storage.readJSON<Record<string, PerformanceRecord>>(
        "prompting/performance",
      ).catch(() => ({}))

      for (const [id, record] of Object.entries(data)) {
        this.records.set(id, record)
      }
    } catch (error) {
      // Start with empty records
    }

    this.initialized = true
  }

  async record(execution: TechniqueExecution): Promise<void> {
    for (const techniqueId of execution.techniques) {
      let record = this.records.get(techniqueId)

      if (!record) {
        record = {
          techniqueId,
          executions: [],
          successRate: 0,
          averageDuration: 0,
          averageTokens: 0,
        }
        this.records.set(techniqueId, record)
      }

      // Add execution
      record.executions.push(execution)

      // Keep only last 100 executions
      if (record.executions.length > 100) {
        record.executions = record.executions.slice(-100)
      }

      // Update metrics
      const successful = record.executions.filter((e) => e.success).length
      record.successRate = successful / record.executions.length

      const totalDuration = record.executions.reduce(
        (sum, e) => sum + e.duration,
        0,
      )
      record.averageDuration = totalDuration / record.executions.length

      const totalTokens = record.executions.reduce(
        (sum, e) => sum + (e.metrics?.tokensUsed || 0),
        0,
      )
      record.averageTokens = totalTokens / record.executions.length
    }

    // Persist to storage
    await this.persist()
  }

  async getHistory(sessionId: string): Promise<TechniqueExecution[]> {
    // In a real implementation, this would filter by session
    const allExecutions: TechniqueExecution[] = []

    for (const record of this.records.values()) {
      allExecutions.push(...record.executions)
    }

    return allExecutions
  }

  async getMetrics(): Promise<{
    totalExecutions: number
    techniquePerformance: Record<
      string,
      {
        successRate: number
        averageDuration: number
        averageTokens: number
        executionCount: number
      }
    >
  }> {
    const techniquePerformance: Record<string, any> = {}
    let totalExecutions = 0

    for (const [id, record] of this.records) {
      techniquePerformance[id] = {
        successRate: record.successRate,
        averageDuration: record.averageDuration,
        averageTokens: record.averageTokens,
        executionCount: record.executions.length,
      }
      totalExecutions += record.executions.length
    }

    return {
      totalExecutions,
      techniquePerformance,
    }
  }

  private async persist(): Promise<void> {
    const data: Record<string, PerformanceRecord> = {}

    for (const [id, record] of this.records) {
      data[id] = record
    }

    await Storage.writeJSON("prompting/performance", data)
  }

  clear(): void {
    this.records.clear()
  }
}
