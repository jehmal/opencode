/**
 * Comprehensive Metrics Collection and Aggregation System
 *
 * Provides unified metrics platform for MCP monitoring and analysis with:
 * - Multiple metric types (counters, gauges, histograms, timers)
 * - Real-time and batch collection
 * - Statistical aggregation and analysis
 * - Multiple export formats
 * - Retention policies and cleanup
 */

import { EventEmitter } from "events"

// Core metric interfaces and types
export interface MetricLabels {
  [key: string]: string | number
}

export interface MetricValue {
  value: number
  timestamp: number
  labels?: MetricLabels
}

export interface MetricSample {
  name: string
  type: MetricType
  value: number
  timestamp: number
  labels: MetricLabels
}

export enum MetricType {
  COUNTER = "counter",
  GAUGE = "gauge",
  HISTOGRAM = "histogram",
  TIMER = "timer",
  SUMMARY = "summary",
}

export interface HistogramBucket {
  le: number // Less than or equal to
  count: number
}

export interface HistogramData {
  buckets: HistogramBucket[]
  sum: number
  count: number
}

export interface TimerData {
  count: number
  sum: number
  min: number
  max: number
  mean: number
  p50: number
  p95: number
  p99: number
}

export interface MetricStatistics {
  count: number
  sum: number
  min: number
  max: number
  mean: number
  median: number
  stdDev: number
  p95: number
  p99: number
}

// Base metric class
abstract class BaseMetric {
  protected name: string
  protected type: MetricType
  protected help: string
  protected labels: MetricLabels
  protected samples: MetricValue[] = []
  protected lastUpdated: number = 0

  constructor(
    name: string,
    type: MetricType,
    help: string,
    labels: MetricLabels = {},
  ) {
    this.name = name
    this.type = type
    this.help = help
    this.labels = labels
  }

  getName(): string {
    return this.name
  }

  getType(): MetricType {
    return this.type
  }

  getHelp(): string {
    return this.help
  }

  getLabels(): MetricLabels {
    return { ...this.labels }
  }

  getLastUpdated(): number {
    return this.lastUpdated
  }

  getSamples(): MetricValue[] {
    return [...this.samples]
  }

  protected addSample(value: number, labels?: MetricLabels): void {
    const timestamp = Date.now()
    this.samples.push({
      value,
      timestamp,
      labels: { ...this.labels, ...labels },
    })
    this.lastUpdated = timestamp
  }

  abstract getValue(): number | HistogramData | TimerData
  abstract reset(): void
}

// Counter metric - monotonically increasing
export class Counter extends BaseMetric {
  private value: number = 0

  constructor(name: string, help: string, labels?: MetricLabels) {
    super(name, MetricType.COUNTER, help, labels)
  }

  inc(value: number = 1, labels?: MetricLabels): void {
    if (value < 0) {
      throw new Error("Counter can only be incremented by non-negative values")
    }
    this.value += value
    this.addSample(this.value, labels)
  }

  getValue(): number {
    return this.value
  }

  reset(): void {
    this.value = 0
    this.samples = []
  }
}

// Gauge metric - can go up and down
export class Gauge extends BaseMetric {
  private value: number = 0

  constructor(name: string, help: string, labels?: MetricLabels) {
    super(name, MetricType.GAUGE, help, labels)
  }

  set(value: number, labels?: MetricLabels): void {
    this.value = value
    this.addSample(this.value, labels)
  }

  inc(value: number = 1, labels?: MetricLabels): void {
    this.value += value
    this.addSample(this.value, labels)
  }

  dec(value: number = 1, labels?: MetricLabels): void {
    this.value -= value
    this.addSample(this.value, labels)
  }

  getValue(): number {
    return this.value
  }

  reset(): void {
    this.value = 0
    this.samples = []
  }
}

// Histogram metric - tracks distribution of values
export class Histogram extends BaseMetric {
  private buckets: Map<number, number> = new Map()
  private sum: number = 0
  private count: number = 0
  private bucketBounds: number[]

  constructor(
    name: string,
    help: string,
    buckets: number[] = [0.1, 0.5, 1, 2.5, 5, 10],
    labels?: MetricLabels,
  ) {
    super(name, MetricType.HISTOGRAM, help, labels)
    this.bucketBounds = [...buckets, Infinity].sort((a, b) => a - b)
    this.bucketBounds.forEach((bound) => this.buckets.set(bound, 0))
  }

  observe(value: number, labels?: MetricLabels): void {
    this.sum += value
    this.count++

    // Increment appropriate buckets
    for (const bound of this.bucketBounds) {
      if (value <= bound) {
        this.buckets.set(bound, (this.buckets.get(bound) || 0) + 1)
      }
    }

    this.addSample(value, labels)
  }

  getValue(): HistogramData {
    const buckets: HistogramBucket[] = []
    for (const [le, count] of this.buckets) {
      buckets.push({ le, count })
    }

    return {
      buckets,
      sum: this.sum,
      count: this.count,
    }
  }

  reset(): void {
    this.buckets.clear()
    this.bucketBounds.forEach((bound) => this.buckets.set(bound, 0))
    this.sum = 0
    this.count = 0
    this.samples = []
  }
}

// Timer metric - specialized histogram for timing measurements
export class Timer extends BaseMetric {
  private values: number[] = []
  private sum: number = 0

  constructor(name: string, help: string, labels?: MetricLabels) {
    super(name, MetricType.TIMER, help, labels)
  }

  time<T>(fn: () => T): T
  time<T>(fn: () => Promise<T>): Promise<T>
  time<T>(fn: () => T | Promise<T>): T | Promise<T> {
    const start = performance.now()
    const result = fn()

    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start
        this.record(duration)
      })
    } else {
      const duration = performance.now() - start
      this.record(duration)
      return result
    }
  }

  record(duration: number, labels?: MetricLabels): void {
    this.values.push(duration)
    this.sum += duration
    this.addSample(duration, labels)
  }

  getValue(): TimerData {
    if (this.values.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      }
    }

    const sorted = [...this.values].sort((a, b) => a - b)
    const count = sorted.length

    return {
      count,
      sum: this.sum,
      min: sorted[0],
      max: sorted[count - 1],
      mean: this.sum / count,
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    }
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1
    return sorted[Math.max(0, index)]
  }

  reset(): void {
    this.values = []
    this.sum = 0
    this.samples = []
  }
}

// Metric registry for managing all metrics
export class MetricRegistry {
  private metrics: Map<string, BaseMetric> = new Map()
  private defaultLabels: MetricLabels = {}

  setDefaultLabels(labels: MetricLabels): void {
    this.defaultLabels = { ...labels }
  }

  getDefaultLabels(): MetricLabels {
    return { ...this.defaultLabels }
  }

  register(metric: BaseMetric): void {
    const name = metric.getName()
    if (this.metrics.has(name)) {
      throw new Error(`Metric with name '${name}' already registered`)
    }
    this.metrics.set(name, metric)
  }

  unregister(name: string): boolean {
    return this.metrics.delete(name)
  }

  get(name: string): BaseMetric | undefined {
    return this.metrics.get(name)
  }

  getAll(): BaseMetric[] {
    return Array.from(this.metrics.values())
  }

  clear(): void {
    this.metrics.clear()
  }

  getSamples(): MetricSample[] {
    const samples: MetricSample[] = []

    for (const metric of this.metrics.values()) {
      const metricSamples = metric.getSamples()
      for (const sample of metricSamples) {
        samples.push({
          name: metric.getName(),
          type: metric.getType(),
          value: sample.value,
          timestamp: sample.timestamp,
          labels: { ...this.defaultLabels, ...sample.labels },
        })
      }
    }

    return samples.sort((a, b) => a.timestamp - b.timestamp)
  }
}

// Metric aggregation and analysis
export class MetricAggregator {
  static calculateStatistics(values: number[]): MetricStatistics {
    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        p95: 0,
        p99: 0,
      }
    }

    const sorted = [...values].sort((a, b) => a - b)
    const count = sorted.length
    const sum = sorted.reduce((acc, val) => acc + val, 0)
    const mean = sum / count

    // Calculate standard deviation
    const variance =
      sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count
    const stdDev = Math.sqrt(variance)

    return {
      count,
      sum,
      min: sorted[0],
      max: sorted[count - 1],
      mean,
      median: this.percentile(sorted, 0.5),
      stdDev,
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    }
  }

  static percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1
    return sorted[Math.max(0, index)]
  }

  static aggregateByTimeWindow(
    samples: MetricSample[],
    windowMs: number,
  ): Map<number, MetricSample[]> {
    const windows = new Map<number, MetricSample[]>()

    for (const sample of samples) {
      const windowStart = Math.floor(sample.timestamp / windowMs) * windowMs
      if (!windows.has(windowStart)) {
        windows.set(windowStart, [])
      }
      windows.get(windowStart)!.push(sample)
    }

    return windows
  }

  static aggregateByLabels(
    samples: MetricSample[],
  ): Map<string, MetricSample[]> {
    const groups = new Map<string, MetricSample[]>()

    for (const sample of samples) {
      const labelKey = JSON.stringify(sample.labels)
      if (!groups.has(labelKey)) {
        groups.set(labelKey, [])
      }
      groups.get(labelKey)!.push(sample)
    }

    return groups
  }
}

// Metric storage with efficient data structures
export interface MetricStorageOptions {
  maxSamples?: number
  retentionMs?: number
  compressionEnabled?: boolean
  persistToDisk?: boolean
  diskPath?: string
}

export class MetricStorage {
  private samples: MetricSample[] = []
  private indices: Map<string, number[]> = new Map() // metric name -> sample indices
  private labelIndices: Map<string, number[]> = new Map() // label key -> sample indices
  private options: Required<MetricStorageOptions>

  constructor(options: MetricStorageOptions = {}) {
    this.options = {
      maxSamples: options.maxSamples || 100000,
      retentionMs: options.retentionMs || 24 * 60 * 60 * 1000, // 24 hours
      compressionEnabled: options.compressionEnabled || false,
      persistToDisk: options.persistToDisk || false,
      diskPath: options.diskPath || "./metrics.json",
    }
  }

  store(samples: MetricSample[]): void {
    const startIndex = this.samples.length

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]
      const sampleIndex = startIndex + i

      this.samples.push(sample)

      // Update metric name index
      if (!this.indices.has(sample.name)) {
        this.indices.set(sample.name, [])
      }
      this.indices.get(sample.name)!.push(sampleIndex)

      // Update label indices
      const labelKey = JSON.stringify(sample.labels)
      if (!this.labelIndices.has(labelKey)) {
        this.labelIndices.set(labelKey, [])
      }
      this.labelIndices.get(labelKey)!.push(sampleIndex)
    }

    this.cleanup()
  }

  query(
    options: {
      metricName?: string
      labels?: MetricLabels
      startTime?: number
      endTime?: number
      limit?: number
    } = {},
  ): MetricSample[] {
    let candidateIndices: Set<number> | undefined

    // Filter by metric name
    if (options.metricName) {
      const metricIndices = this.indices.get(options.metricName)
      if (!metricIndices) return []
      candidateIndices = new Set(metricIndices)
    }

    // Filter by labels
    if (options.labels) {
      const labelKey = JSON.stringify(options.labels)
      const labelIndices = this.labelIndices.get(labelKey)
      if (!labelIndices) return []

      if (candidateIndices) {
        candidateIndices = new Set(
          labelIndices.filter((idx) => candidateIndices!.has(idx)),
        )
      } else {
        candidateIndices = new Set(labelIndices)
      }
    }

    // Get samples from indices or all samples
    const samples = candidateIndices
      ? Array.from(candidateIndices).map((idx) => this.samples[idx])
      : [...this.samples]

    // Filter by time range
    let filtered = samples
    if (options.startTime || options.endTime) {
      filtered = samples.filter((sample) => {
        if (options.startTime && sample.timestamp < options.startTime)
          return false
        if (options.endTime && sample.timestamp > options.endTime) return false
        return true
      })
    }

    // Apply limit
    if (options.limit && filtered.length > options.limit) {
      filtered = filtered.slice(-options.limit)
    }

    return filtered.sort((a, b) => a.timestamp - b.timestamp)
  }

  getMetricNames(): string[] {
    return Array.from(this.indices.keys())
  }

  getSize(): number {
    return this.samples.length
  }

  clear(): void {
    this.samples = []
    this.indices.clear()
    this.labelIndices.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    const cutoffTime = now - this.options.retentionMs

    // Remove old samples
    let removeCount = 0
    for (let i = 0; i < this.samples.length; i++) {
      if (this.samples[i].timestamp >= cutoffTime) {
        break
      }
      removeCount++
    }

    if (removeCount > 0) {
      this.samples.splice(0, removeCount)
      this.rebuildIndices()
    }

    // Limit total samples
    if (this.samples.length > this.options.maxSamples) {
      const excess = this.samples.length - this.options.maxSamples
      this.samples.splice(0, excess)
      this.rebuildIndices()
    }
  }

  private rebuildIndices(): void {
    this.indices.clear()
    this.labelIndices.clear()

    for (let i = 0; i < this.samples.length; i++) {
      const sample = this.samples[i]

      // Rebuild metric name index
      if (!this.indices.has(sample.name)) {
        this.indices.set(sample.name, [])
      }
      this.indices.get(sample.name)!.push(i)

      // Rebuild label indices
      const labelKey = JSON.stringify(sample.labels)
      if (!this.labelIndices.has(labelKey)) {
        this.labelIndices.set(labelKey, [])
      }
      this.labelIndices.get(labelKey)!.push(i)
    }
  }
}

// Export formats
export interface PrometheusExportOptions {
  includeHelp?: boolean
  includeType?: boolean
  timestamp?: boolean
}

export class MetricExporter {
  static toPrometheus(
    registry: MetricRegistry,
    options: PrometheusExportOptions = {},
  ): string {
    const lines: string[] = []
    const metrics = registry.getAll()

    for (const metric of metrics) {
      const name = metric.getName()
      const type = metric.getType()
      const help = metric.getHelp()

      // Add help comment
      if (options.includeHelp !== false) {
        lines.push(`# HELP ${name} ${help}`)
      }

      // Add type comment
      if (options.includeType !== false) {
        lines.push(`# TYPE ${name} ${type}`)
      }

      // Add metric samples
      const samples = metric.getSamples()
      for (const sample of samples) {
        const labelStr = this.formatLabels(sample.labels)
        const timestamp = options.timestamp ? ` ${sample.timestamp}` : ""
        lines.push(`${name}${labelStr} ${sample.value}${timestamp}`)
      }

      lines.push("")
    }

    return lines.join("\n")
  }

  static toJSON(registry: MetricRegistry): string {
    const data = {
      timestamp: Date.now(),
      metrics: registry.getAll().map((metric) => ({
        name: metric.getName(),
        type: metric.getType(),
        help: metric.getHelp(),
        value: metric.getValue(),
        samples: metric.getSamples(),
        lastUpdated: metric.getLastUpdated(),
      })),
    }

    return JSON.stringify(data, null, 2)
  }

  static toCSV(samples: MetricSample[]): string {
    if (samples.length === 0) return ""

    const headers = ["name", "type", "value", "timestamp", "labels"]
    const rows = samples.map((sample) => [
      sample.name,
      sample.type,
      sample.value.toString(),
      sample.timestamp.toString(),
      JSON.stringify(sample.labels),
    ])

    return [headers, ...rows].map((row) => row.join(",")).join("\n")
  }

  private static formatLabels(labels: MetricLabels): string {
    const entries = Object.entries(labels)
    if (entries.length === 0) return ""

    const labelPairs = entries.map(([key, value]) => `${key}="${value}"`)
    return `{${labelPairs.join(",")}}`
  }
}

// Main metrics collector class
export interface MetricsCollectorOptions {
  registry?: MetricRegistry
  storage?: MetricStorage
  collectionInterval?: number
  autoCleanup?: boolean
  enableRealTimeCollection?: boolean
}

export class MetricsCollector extends EventEmitter {
  private registry: MetricRegistry
  private storage: MetricStorage
  private options: Required<MetricsCollectorOptions>
  private collectionTimer?: NodeJS.Timeout
  private isCollecting: boolean = false

  // Pre-defined metric categories
  public readonly performance: {
    latency: Timer
    throughput: Counter
    responseTime: Histogram
    errorRate: Gauge
  }

  public readonly resources: {
    cpuUsage: Gauge
    memoryUsage: Gauge
    networkIO: Counter
    diskIO: Counter
  }

  public readonly business: {
    successCount: Counter
    errorCount: Counter
    userActions: Counter
    conversionRate: Gauge
  }

  public readonly system: {
    connectionCount: Gauge
    queueSize: Gauge
    cacheHits: Counter
    cacheMisses: Counter
  }

  public readonly quality: {
    availability: Gauge
    reliability: Gauge
    slaCompliance: Gauge
  }

  constructor(options: MetricsCollectorOptions = {}) {
    super()

    this.registry = options.registry || new MetricRegistry()
    this.storage = options.storage || new MetricStorage()
    this.options = {
      registry: this.registry,
      storage: this.storage,
      collectionInterval: options.collectionInterval || 5000,
      autoCleanup: options.autoCleanup !== false,
      enableRealTimeCollection: options.enableRealTimeCollection !== false,
    }

    // Initialize metric categories
    this.performance = this.createPerformanceMetrics()
    this.resources = this.createResourceMetrics()
    this.business = this.createBusinessMetrics()
    this.system = this.createSystemMetrics()
    this.quality = this.createQualityMetrics()
  }

  private createPerformanceMetrics() {
    const latency = new Timer(
      "mcp_operation_latency_ms",
      "MCP operation latency in milliseconds",
    )
    const throughput = new Counter(
      "mcp_operations_total",
      "Total number of MCP operations",
    )
    const responseTime = new Histogram(
      "mcp_response_time_ms",
      "MCP response time distribution",
      [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    )
    const errorRate = new Gauge(
      "mcp_error_rate",
      "Current error rate percentage",
    )

    this.registry.register(latency)
    this.registry.register(throughput)
    this.registry.register(responseTime)
    this.registry.register(errorRate)

    return { latency, throughput, responseTime, errorRate }
  }

  private createResourceMetrics() {
    const cpuUsage = new Gauge(
      "system_cpu_usage_percent",
      "CPU usage percentage",
    )
    const memoryUsage = new Gauge(
      "system_memory_usage_bytes",
      "Memory usage in bytes",
    )
    const networkIO = new Counter(
      "system_network_io_bytes_total",
      "Total network I/O in bytes",
    )
    const diskIO = new Counter(
      "system_disk_io_bytes_total",
      "Total disk I/O in bytes",
    )

    this.registry.register(cpuUsage)
    this.registry.register(memoryUsage)
    this.registry.register(networkIO)
    this.registry.register(diskIO)

    return { cpuUsage, memoryUsage, networkIO, diskIO }
  }

  private createBusinessMetrics() {
    const successCount = new Counter(
      "business_success_total",
      "Total successful operations",
    )
    const errorCount = new Counter(
      "business_error_total",
      "Total failed operations",
    )
    const userActions = new Counter(
      "business_user_actions_total",
      "Total user actions",
    )
    const conversionRate = new Gauge(
      "business_conversion_rate",
      "Current conversion rate",
    )

    this.registry.register(successCount)
    this.registry.register(errorCount)
    this.registry.register(userActions)
    this.registry.register(conversionRate)

    return { successCount, errorCount, userActions, conversionRate }
  }

  private createSystemMetrics() {
    const connectionCount = new Gauge(
      "system_connections_active",
      "Active connection count",
    )
    const queueSize = new Gauge("system_queue_size", "Current queue size")
    const cacheHits = new Counter("system_cache_hits_total", "Total cache hits")
    const cacheMisses = new Counter(
      "system_cache_misses_total",
      "Total cache misses",
    )

    this.registry.register(connectionCount)
    this.registry.register(queueSize)
    this.registry.register(cacheHits)
    this.registry.register(cacheMisses)

    return { connectionCount, queueSize, cacheHits, cacheMisses }
  }

  private createQualityMetrics() {
    const availability = new Gauge(
      "quality_availability_percent",
      "Service availability percentage",
    )
    const reliability = new Gauge(
      "quality_reliability_percent",
      "Service reliability percentage",
    )
    const slaCompliance = new Gauge(
      "quality_sla_compliance_percent",
      "SLA compliance percentage",
    )

    this.registry.register(availability)
    this.registry.register(reliability)
    this.registry.register(slaCompliance)

    return { availability, reliability, slaCompliance }
  }

  startCollection(): void {
    if (this.isCollecting) return

    this.isCollecting = true
    this.collectionTimer = setInterval(() => {
      this.collectMetrics()
    }, this.options.collectionInterval)

    this.emit("collection:started")
  }

  stopCollection(): void {
    if (!this.isCollecting) return

    this.isCollecting = false
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer)
      this.collectionTimer = undefined
    }

    this.emit("collection:stopped")
  }

  private collectMetrics(): void {
    try {
      const samples = this.registry.getSamples()
      this.storage.store(samples)

      if (this.options.enableRealTimeCollection) {
        this.emit("metrics:collected", samples)
      }

      // Auto cleanup if enabled
      if (this.options.autoCleanup) {
        this.cleanup()
      }
    } catch (error) {
      this.emit("collection:error", error)
    }
  }

  getRegistry(): MetricRegistry {
    return this.registry
  }

  getStorage(): MetricStorage {
    return this.storage
  }

  query(options: Parameters<MetricStorage["query"]>[0] = {}): MetricSample[] {
    return this.storage.query(options)
  }

  getStatistics(
    metricName: string,
    timeWindowMs?: number,
  ): MetricStatistics | null {
    const endTime = Date.now()
    const startTime = timeWindowMs ? endTime - timeWindowMs : undefined

    const samples = this.query({
      metricName,
      startTime,
      endTime,
    })

    if (samples.length === 0) return null

    const values = samples.map((s) => s.value)
    return MetricAggregator.calculateStatistics(values)
  }

  exportPrometheus(options?: PrometheusExportOptions): string {
    return MetricExporter.toPrometheus(this.registry, options)
  }

  exportJSON(): string {
    return MetricExporter.toJSON(this.registry)
  }

  exportCSV(metricName?: string): string {
    const samples = metricName
      ? this.query({ metricName })
      : this.storage.query()
    return MetricExporter.toCSV(samples)
  }

  cleanup(): void {
    // This will trigger internal cleanup in storage
    this.storage.store([])
  }

  reset(): void {
    this.registry.getAll().forEach((metric) => metric.reset())
    this.storage.clear()
    this.emit("metrics:reset")
  }

  // Convenience methods for common operations
  recordOperation(
    name: string,
    duration: number,
    success: boolean,
    labels?: MetricLabels,
  ): void {
    this.performance.latency.record(duration, labels)
    this.performance.throughput.inc(1, labels)
    this.performance.responseTime.observe(duration, labels)

    if (success) {
      this.business.successCount.inc(1, labels)
    } else {
      this.business.errorCount.inc(1, labels)
    }
  }

  recordUserAction(action: string, labels?: MetricLabels): void {
    this.business.userActions.inc(1, { action, ...labels })
  }

  updateResourceUsage(cpu: number, memory: number): void {
    this.resources.cpuUsage.set(cpu)
    this.resources.memoryUsage.set(memory)
  }

  updateSystemMetrics(connections: number, queueSize: number): void {
    this.system.connectionCount.set(connections)
    this.system.queueSize.set(queueSize)
  }

  recordCacheOperation(hit: boolean, labels?: MetricLabels): void {
    if (hit) {
      this.system.cacheHits.inc(1, labels)
    } else {
      this.system.cacheMisses.inc(1, labels)
    }
  }
}

// Utility functions for metric correlation and analysis
export class MetricAnalyzer {
  static correlate(
    samples1: MetricSample[],
    samples2: MetricSample[],
    timeToleranceMs: number = 1000,
  ): number {
    if (samples1.length === 0 || samples2.length === 0) return 0

    const pairs: Array<[number, number]> = []

    for (const sample1 of samples1) {
      const matchingSample = samples2.find(
        (sample2) =>
          Math.abs(sample1.timestamp - sample2.timestamp) <= timeToleranceMs,
      )

      if (matchingSample) {
        pairs.push([sample1.value, matchingSample.value])
      }
    }

    if (pairs.length < 2) return 0

    return this.calculateCorrelation(pairs)
  }

  private static calculateCorrelation(pairs: Array<[number, number]>): number {
    const n = pairs.length
    const sumX = pairs.reduce((sum, [x]) => sum + x, 0)
    const sumY = pairs.reduce((sum, [, y]) => sum + y, 0)
    const sumXY = pairs.reduce((sum, [x, y]) => sum + x * y, 0)
    const sumX2 = pairs.reduce((sum, [x]) => sum + x * x, 0)
    const sumY2 = pairs.reduce((sum, [, y]) => sum + y * y, 0)

    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
    )

    return denominator === 0 ? 0 : numerator / denominator
  }

  static detectAnomalies(
    samples: MetricSample[],
    threshold: number = 2,
  ): MetricSample[] {
    if (samples.length < 3) return []

    const values = samples.map((s) => s.value)
    const stats = MetricAggregator.calculateStatistics(values)
    const anomalies: MetricSample[] = []

    for (const sample of samples) {
      const zScore = Math.abs(sample.value - stats.mean) / stats.stdDev
      if (zScore > threshold) {
        anomalies.push(sample)
      }
    }

    return anomalies
  }

  static calculateTrend(
    samples: MetricSample[],
  ): "increasing" | "decreasing" | "stable" {
    if (samples.length < 2) return "stable"

    const sortedSamples = samples.sort((a, b) => a.timestamp - b.timestamp)
    const firstHalf = sortedSamples.slice(
      0,
      Math.floor(sortedSamples.length / 2),
    )
    const secondHalf = sortedSamples.slice(Math.floor(sortedSamples.length / 2))

    const firstAvg =
      firstHalf.reduce((sum, s) => sum + s.value, 0) / firstHalf.length
    const secondAvg =
      secondHalf.reduce((sum, s) => sum + s.value, 0) / secondHalf.length

    const changePercent = Math.abs(secondAvg - firstAvg) / firstAvg

    if (changePercent < 0.05) return "stable" // Less than 5% change
    return secondAvg > firstAvg ? "increasing" : "decreasing"
  }
}

// Export all classes and interfaces
export {
  BaseMetric,
  MetricRegistry,
  MetricAggregator,
  MetricStorage,
  MetricExporter,
  MetricAnalyzer,
}
