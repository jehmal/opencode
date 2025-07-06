import { EventEmitter } from "events"
import { z } from "zod"
import { App } from "../../../../src/app/app"
import { Storage } from "../../../../src/storage/storage"
import { Log } from "../../../../src/util/log"

/**
 * Resource monitoring configuration schema
 */
export const ResourceMonitorConfigSchema = z.object({
  interval: z.number().min(100).max(60000).default(1000),
  targets: z.array(z.string()).default([]),
  enablePersistence: z.boolean().default(true),
  maxHistorySize: z.number().min(10).max(10000).default(1000),
  thresholds: z
    .object({
      cpu: z.number().min(0).max(100).default(80),
      memory: z.number().min(0).max(100).default(85),
      connections: z.number().min(1).default(100),
    })
    .default({}),
  mode: z.enum(["sync", "async"]).default("async"),
})

export type ResourceMonitorConfig = z.infer<typeof ResourceMonitorConfigSchema>

/**
 * Resource monitoring state enumeration
 */
export enum MonitoringState {
  STOPPED = "stopped",
  STARTING = "starting",
  RUNNING = "running",
  PAUSED = "paused",
  STOPPING = "stopping",
  ERROR = "error",
}

/**
 * Resource metrics interface
 */
export interface ResourceMetrics {
  timestamp: number
  cpu: {
    usage: number
    processes: number
  }
  memory: {
    used: number
    total: number
    percentage: number
  }
  connections: {
    active: number
    total: number
  }
  custom: Record<string, any>
}

/**
 * Monitoring event types
 */
export interface MonitoringEvents {
  "state-changed": (
    state: MonitoringState,
    previousState: MonitoringState,
  ) => void
  "metrics-collected": (metrics: ResourceMetrics) => void
  "threshold-exceeded": (
    metric: string,
    value: number,
    threshold: number,
  ) => void
  error: (error: Error, context?: any) => void
  started: () => void
  stopped: () => void
  paused: () => void
  resumed: () => void
}

/**
 * Resource monitor instance interface
 */
export interface ResourceMonitorInstance {
  readonly id: string
  readonly config: ResourceMonitorConfig
  readonly state: MonitoringState
  readonly metrics: ResourceMetrics[]
  readonly emitter: EventEmitter

  start(): Promise<void>
  stop(): Promise<void>
  pause(): void
  resume(): void
  getLatestMetrics(): ResourceMetrics | null
  getMetricsHistory(limit?: number): ResourceMetrics[]
  updateConfig(config: Partial<ResourceMonitorConfig>): void
  clearHistory(): void
  destroy(): Promise<void>
}

/**
 * Internal monitor state
 */
interface MonitorState {
  instance: ResourceMonitorInstance
  intervalId: Timer | null
  lastCollection: number
  errorCount: number
  isDestroyed: boolean
}

/**
 * Core ResourceMonitor implementation
 */
class ResourceMonitorImpl implements ResourceMonitorInstance {
  public readonly id: string
  public readonly emitter: EventEmitter

  private _config: ResourceMonitorConfig
  private _state: MonitoringState = MonitoringState.STOPPED
  private _metrics: ResourceMetrics[] = []
  private _intervalId: Timer | null = null
  private _lastCollection = 0
  private _errorCount = 0
  private _isDestroyed = false
  private readonly _log = Log.create({ service: "resource-monitor" })

  constructor(id: string, config: ResourceMonitorConfig) {
    this.id = id
    this._config = config
    this.emitter = new EventEmitter()

    // Set max listeners to prevent memory leaks
    this.emitter.setMaxListeners(50)

    this._log.info("ResourceMonitor created", { id, config })
  }

  get config(): ResourceMonitorConfig {
    return { ...this._config }
  }

  get state(): MonitoringState {
    return this._state
  }

  get metrics(): ResourceMetrics[] {
    return [...this._metrics]
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (this._isDestroyed) {
      throw new Error("Cannot start destroyed monitor")
    }

    if (this._state === MonitoringState.RUNNING) {
      this._log.warn("Monitor already running", { id: this.id })
      return
    }

    this._setState(MonitoringState.STARTING)

    try {
      // Initial metrics collection
      await this._collectMetrics()

      // Start interval-based collection
      this._startInterval()

      this._setState(MonitoringState.RUNNING)
      this.emitter.emit("started")

      this._log.info("Monitor started", {
        id: this.id,
        interval: this._config.interval,
      })
    } catch (error) {
      this._setState(MonitoringState.ERROR)
      this._handleError(error as Error, "start")
      throw error
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (this._state === MonitoringState.STOPPED) {
      return
    }

    this._setState(MonitoringState.STOPPING)

    try {
      this._stopInterval()

      // Save final metrics if persistence enabled
      if (this._config.enablePersistence && this._metrics.length > 0) {
        await this._persistMetrics()
      }

      this._setState(MonitoringState.STOPPED)
      this.emitter.emit("stopped")

      this._log.info("Monitor stopped", { id: this.id })
    } catch (error) {
      this._setState(MonitoringState.ERROR)
      this._handleError(error as Error, "stop")
      throw error
    }
  }

  /**
   * Pause monitoring
   */
  pause(): void {
    if (this._state !== MonitoringState.RUNNING) {
      return
    }

    this._stopInterval()
    this._setState(MonitoringState.PAUSED)
    this.emitter.emit("paused")

    this._log.info("Monitor paused", { id: this.id })
  }

  /**
   * Resume monitoring
   */
  resume(): void {
    if (this._state !== MonitoringState.PAUSED) {
      return
    }

    this._startInterval()
    this._setState(MonitoringState.RUNNING)
    this.emitter.emit("resumed")

    this._log.info("Monitor resumed", { id: this.id })
  }

  /**
   * Get latest metrics
   */
  getLatestMetrics(): ResourceMetrics | null {
    return this._metrics.length > 0
      ? this._metrics[this._metrics.length - 1]
      : null
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): ResourceMetrics[] {
    const metrics = [...this._metrics]
    return limit ? metrics.slice(-limit) : metrics
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ResourceMonitorConfig>): void {
    const wasRunning = this._state === MonitoringState.RUNNING

    if (wasRunning) {
      this.pause()
    }

    this._config = { ...this._config, ...config }

    this._log.info("Config updated", { id: this.id, config: this._config })

    if (wasRunning) {
      this.resume()
    }
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this._metrics = []
    this._log.info("Metrics history cleared", { id: this.id })
  }

  /**
   * Destroy monitor instance
   */
  async destroy(): Promise<void> {
    if (this._isDestroyed) {
      return
    }

    await this.stop()

    this._isDestroyed = true
    this.emitter.removeAllListeners()

    this._log.info("Monitor destroyed", { id: this.id })
  }

  /**
   * Set monitoring state
   */
  private _setState(newState: MonitoringState): void {
    const previousState = this._state
    this._state = newState

    if (previousState !== newState) {
      this.emitter.emit("state-changed", newState, previousState)
    }
  }

  /**
   * Start monitoring interval
   */
  private _startInterval(): void {
    this._stopInterval()

    if (this._config.mode === "async") {
      this._intervalId = setInterval(async () => {
        try {
          await this._collectMetrics()
        } catch (error) {
          this._handleError(error as Error, "interval-collection")
        }
      }, this._config.interval)
    } else {
      this._intervalId = setInterval(() => {
        try {
          this._collectMetricsSync()
        } catch (error) {
          this._handleError(error as Error, "sync-interval-collection")
        }
      }, this._config.interval)
    }
  }

  /**
   * Stop monitoring interval
   */
  private _stopInterval(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId)
      this._intervalId = null
    }
  }

  /**
   * Collect metrics asynchronously
   */
  private async _collectMetrics(): Promise<void> {
    const startTime = performance.now()

    try {
      const metrics: ResourceMetrics = {
        timestamp: Date.now(),
        cpu: await this._getCpuMetrics(),
        memory: await this._getMemoryMetrics(),
        connections: await this._getConnectionMetrics(),
        custom: await this._getCustomMetrics(),
      }

      this._addMetrics(metrics)
      this._checkThresholds(metrics)

      const collectionTime = performance.now() - startTime
      this._lastCollection = Date.now()

      this.emitter.emit("metrics-collected", metrics)

      // Log performance impact if significant
      if (collectionTime > 50) {
        this._log.warn("Slow metrics collection", {
          id: this.id,
          duration: collectionTime,
          metricsCount: this._metrics.length,
        })
      }
    } catch (error) {
      this._handleError(error as Error, "metrics-collection")
    }
  }

  /**
   * Collect metrics synchronously
   */
  private _collectMetricsSync(): void {
    const metrics: ResourceMetrics = {
      timestamp: Date.now(),
      cpu: this._getCpuMetricsSync(),
      memory: this._getMemoryMetricsSync(),
      connections: this._getConnectionMetricsSync(),
      custom: this._getCustomMetricsSync(),
    }

    this._addMetrics(metrics)
    this._checkThresholds(metrics)
    this._lastCollection = Date.now()

    this.emitter.emit("metrics-collected", metrics)
  }

  /**
   * Add metrics to history with size management
   */
  private _addMetrics(metrics: ResourceMetrics): void {
    this._metrics.push(metrics)

    // Maintain history size limit
    if (this._metrics.length > this._config.maxHistorySize) {
      this._metrics = this._metrics.slice(-this._config.maxHistorySize)
    }
  }

  /**
   * Check thresholds and emit warnings
   */
  private _checkThresholds(metrics: ResourceMetrics): void {
    const { thresholds } = this._config

    if (metrics.cpu.usage > thresholds.cpu) {
      this.emitter.emit(
        "threshold-exceeded",
        "cpu",
        metrics.cpu.usage,
        thresholds.cpu,
      )
    }

    if (metrics.memory.percentage > thresholds.memory) {
      this.emitter.emit(
        "threshold-exceeded",
        "memory",
        metrics.memory.percentage,
        thresholds.memory,
      )
    }

    if (metrics.connections.active > thresholds.connections) {
      this.emitter.emit(
        "threshold-exceeded",
        "connections",
        metrics.connections.active,
        thresholds.connections,
      )
    }
  }

  /**
   * Get CPU metrics asynchronously
   */
  private async _getCpuMetrics(): Promise<ResourceMetrics["cpu"]> {
    // Placeholder implementation - would use actual system monitoring
    return {
      usage: Math.random() * 100,
      processes: Math.floor(Math.random() * 50) + 10,
    }
  }

  /**
   * Get memory metrics asynchronously
   */
  private async _getMemoryMetrics(): Promise<ResourceMetrics["memory"]> {
    const memUsage = process.memoryUsage()
    const total = memUsage.heapTotal + memUsage.external
    const used = memUsage.heapUsed

    return {
      used,
      total,
      percentage: (used / total) * 100,
    }
  }

  /**
   * Get connection metrics asynchronously
   */
  private async _getConnectionMetrics(): Promise<
    ResourceMetrics["connections"]
  > {
    // Placeholder implementation - would monitor actual connections
    return {
      active: Math.floor(Math.random() * 20) + 1,
      total: Math.floor(Math.random() * 100) + 50,
    }
  }

  /**
   * Get custom metrics asynchronously
   */
  private async _getCustomMetrics(): Promise<Record<string, any>> {
    const custom: Record<string, any> = {}

    // Add target-specific metrics
    for (const target of this._config.targets) {
      custom[target] = {
        status: "active",
        lastCheck: Date.now(),
      }
    }

    return custom
  }

  /**
   * Synchronous CPU metrics
   */
  private _getCpuMetricsSync(): ResourceMetrics["cpu"] {
    return {
      usage: Math.random() * 100,
      processes: Math.floor(Math.random() * 50) + 10,
    }
  }

  /**
   * Synchronous memory metrics
   */
  private _getMemoryMetricsSync(): ResourceMetrics["memory"] {
    const memUsage = process.memoryUsage()
    const total = memUsage.heapTotal + memUsage.external
    const used = memUsage.heapUsed

    return {
      used,
      total,
      percentage: (used / total) * 100,
    }
  }

  /**
   * Synchronous connection metrics
   */
  private _getConnectionMetricsSync(): ResourceMetrics["connections"] {
    return {
      active: Math.floor(Math.random() * 20) + 1,
      total: Math.floor(Math.random() * 100) + 50,
    }
  }

  /**
   * Synchronous custom metrics
   */
  private _getCustomMetricsSync(): Record<string, any> {
    const custom: Record<string, any> = {}

    for (const target of this._config.targets) {
      custom[target] = {
        status: "active",
        lastCheck: Date.now(),
      }
    }

    return custom
  }

  /**
   * Handle errors with recovery logic
   */
  private _handleError(error: Error, context: string): void {
    this._errorCount++

    this._log.error("Monitor error", {
      id: this.id,
      context,
      error: error.message,
      errorCount: this._errorCount,
    })

    this.emitter.emit("error", error, { context, errorCount: this._errorCount })

    // Auto-recovery logic
    if (this._errorCount >= 5) {
      this._log.error("Too many errors, stopping monitor", { id: this.id })
      this.stop().catch(() => {})
    }
  }

  /**
   * Persist metrics to storage
   */
  private async _persistMetrics(): Promise<void> {
    if (!this._config.enablePersistence || this._metrics.length === 0) {
      return
    }

    try {
      const storageKey = `resource-monitor/${this.id}/metrics`
      await Storage.writeJSON(storageKey, {
        id: this.id,
        config: this._config,
        metrics: this._metrics,
        lastUpdate: Date.now(),
      })

      this._log.info("Metrics persisted", {
        id: this.id,
        metricsCount: this._metrics.length,
      })
    } catch (error) {
      this._log.error("Failed to persist metrics", {
        id: this.id,
        error: (error as Error).message,
      })
    }
  }
}

/**
 * ResourceMonitor namespace following DGMO patterns
 */
export namespace ResourceMonitor {
  const log = Log.create({ service: "resource-monitor-manager" })

  // Global state management using App.state()
  const monitors = App.state(
    "resource-monitors",
    () => new Map<string, MonitorState>(),
    async (state) => {
      // Cleanup on app shutdown
      log.info("Cleaning up resource monitors", { count: state.size })

      for (const [id, monitorState] of state) {
        try {
          await monitorState.instance.destroy()
        } catch (error) {
          log.error("Failed to cleanup monitor", { id, error })
        }
      }
    },
  )

  /**
   * Create a new resource monitor instance
   */
  export function create(
    id: string,
    config: Partial<ResourceMonitorConfig> = {},
  ): ResourceMonitorInstance {
    const monitorsMap = monitors()

    if (monitorsMap.has(id)) {
      throw new Error(`Monitor with id '${id}' already exists`)
    }

    const validatedConfig = ResourceMonitorConfigSchema.parse(config)
    const instance = new ResourceMonitorImpl(id, validatedConfig)

    const monitorState: MonitorState = {
      instance,
      intervalId: null,
      lastCollection: 0,
      errorCount: 0,
      isDestroyed: false,
    }

    monitorsMap.set(id, monitorState)

    log.info("Monitor created", { id, config: validatedConfig })

    return instance
  }

  /**
   * Get an existing monitor instance
   */
  export function get(id: string): ResourceMonitorInstance | null {
    const monitorState = monitors().get(id)
    return monitorState?.instance || null
  }

  /**
   * Remove and destroy a monitor instance
   */
  export async function remove(id: string): Promise<boolean> {
    const monitorsMap = monitors()
    const monitorState = monitorsMap.get(id)

    if (!monitorState) {
      return false
    }

    try {
      await monitorState.instance.destroy()
      monitorsMap.delete(id)

      log.info("Monitor removed", { id })
      return true
    } catch (error) {
      log.error("Failed to remove monitor", { id, error })
      return false
    }
  }

  /**
   * List all monitor instances
   */
  export function list(): ResourceMonitorInstance[] {
    return Array.from(monitors().values()).map((state) => state.instance)
  }

  /**
   * Get monitor statistics
   */
  export function getStats(): {
    total: number
    running: number
    stopped: number
    paused: number
    error: number
  } {
    const instances = list()

    return {
      total: instances.length,
      running: instances.filter((m) => m.state === MonitoringState.RUNNING)
        .length,
      stopped: instances.filter((m) => m.state === MonitoringState.STOPPED)
        .length,
      paused: instances.filter((m) => m.state === MonitoringState.PAUSED)
        .length,
      error: instances.filter((m) => m.state === MonitoringState.ERROR).length,
    }
  }

  /**
   * Start all monitors
   */
  export async function startAll(): Promise<void> {
    const instances = list()
    const results = await Promise.allSettled(
      instances.map((instance) => instance.start()),
    )

    const failed = results.filter((r) => r.status === "rejected").length

    log.info("Started all monitors", {
      total: instances.length,
      failed,
    })
  }

  /**
   * Stop all monitors
   */
  export async function stopAll(): Promise<void> {
    const instances = list()
    const results = await Promise.allSettled(
      instances.map((instance) => instance.stop()),
    )

    const failed = results.filter((r) => r.status === "rejected").length

    log.info("Stopped all monitors", {
      total: instances.length,
      failed,
    })
  }

  /**
   * Load persisted monitor data
   */
  export async function loadPersisted(
    id: string,
  ): Promise<ResourceMetrics[] | null> {
    try {
      const storageKey = `resource-monitor/${id}/metrics`
      const data = await Storage.readJSON<{
        id: string
        config: ResourceMonitorConfig
        metrics: ResourceMetrics[]
        lastUpdate: number
      }>(storageKey)

      return data.metrics
    } catch {
      return null
    }
  }

  /**
   * Clear all persisted data
   */
  export async function clearPersisted(): Promise<void> {
    try {
      await Storage.removeDir("resource-monitor")
      log.info("Cleared all persisted monitor data")
    } catch (error) {
      log.error("Failed to clear persisted data", { error })
    }
  }
}
