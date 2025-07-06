/**
 * Advanced Performance Regression Detection System
 *
 * Provides comprehensive statistical analysis and automated alerting
 * for performance regressions in MCP operations.
 */

export interface PerformanceMetric {
  timestamp: number
  value: number
  operation: string
  metadata?: Record<string, unknown>
}

export interface PerformanceBaseline {
  operation: string
  mean: number
  standardDeviation: number
  percentiles: {
    p50: number
    p75: number
    p90: number
    p95: number
    p99: number
  }
  sampleSize: number
  establishedAt: number
  lastUpdated: number
}

export interface RegressionDetectionConfig {
  movingAverageWindow: number
  standardDeviationThreshold: number
  percentileThreshold: number
  trendAnalysisWindow: number
  zScoreThreshold: number
  minimumSampleSize: number
  baselineUpdateFrequency: number
  alertingEnabled: boolean
  sensitivityLevel: "low" | "medium" | "high"
}

export interface RegressionAlert {
  id: string
  operation: string
  severity: "minor" | "major" | "critical"
  detectionMethod: string
  currentValue: number
  expectedValue: number
  deviationPercentage: number
  confidence: number
  timestamp: number
  metadata: {
    baseline: PerformanceBaseline
    recentMetrics: PerformanceMetric[]
    statisticalAnalysis: StatisticalAnalysis
    rootCauseHints: string[]
  }
}

export interface StatisticalAnalysis {
  movingAverage: number
  standardDeviation: number
  zScore: number
  trendSlope: number
  trendCorrelation: number
  anomalyScore: number
  percentileRank: number
}

export interface TrendAnalysis {
  operation: string
  timeRange: { start: number; end: number }
  slope: number
  correlation: number
  prediction: {
    nextValue: number
    confidence: number
    timeHorizon: number
  }
  patterns: {
    cyclical: boolean
    seasonal: boolean
    trending: "improving" | "degrading" | "stable"
  }
}

export interface VisualizationData {
  operation: string
  timeSeriesData: Array<{ timestamp: number; value: number; baseline?: number }>
  regressionPoints: Array<{
    timestamp: number
    severity: string
    description: string
  }>
  trendLine: Array<{ timestamp: number; value: number }>
  confidenceBands: Array<{ timestamp: number; upper: number; lower: number }>
  statistics: {
    mean: number
    median: number
    standardDeviation: number
    variance: number
    skewness: number
    kurtosis: number
  }
}

export class PerformanceRegressionDetector {
  private metrics: Map<string, PerformanceMetric[]> = new Map()
  private baselines: Map<string, PerformanceBaseline> = new Map()
  private alerts: RegressionAlert[] = []
  private config: RegressionDetectionConfig

  constructor(config: Partial<RegressionDetectionConfig> = {}) {
    this.config = {
      movingAverageWindow: 20,
      standardDeviationThreshold: 2.0,
      percentileThreshold: 0.95,
      trendAnalysisWindow: 50,
      zScoreThreshold: 2.5,
      minimumSampleSize: 10,
      baselineUpdateFrequency: 100,
      alertingEnabled: true,
      sensitivityLevel: "medium",
      ...config,
    }

    this.adjustConfigBySensitivity()
  }

  private adjustConfigBySensitivity(): void {
    const adjustments = {
      low: {
        standardDeviationThreshold: 3.0,
        zScoreThreshold: 3.0,
        percentileThreshold: 0.99,
      },
      medium: {
        standardDeviationThreshold: 2.0,
        zScoreThreshold: 2.5,
        percentileThreshold: 0.95,
      },
      high: {
        standardDeviationThreshold: 1.5,
        zScoreThreshold: 2.0,
        percentileThreshold: 0.9,
      },
    }

    Object.assign(this.config, adjustments[this.config.sensitivityLevel])
  }

  addMetric(metric: PerformanceMetric): RegressionAlert[] {
    const operation = metric.operation

    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }

    const operationMetrics = this.metrics.get(operation)!
    operationMetrics.push(metric)

    // Keep only recent metrics for memory efficiency
    if (operationMetrics.length > 1000) {
      operationMetrics.splice(0, operationMetrics.length - 1000)
    }

    // Update baseline if needed
    this.updateBaselineIfNeeded(operation)

    // Detect regressions
    return this.detectRegressions(operation, metric)
  }

  private updateBaselineIfNeeded(operation: string): void {
    const metrics = this.metrics.get(operation)!
    const baseline = this.baselines.get(operation)

    const shouldUpdate =
      !baseline ||
      metrics.length % this.config.baselineUpdateFrequency === 0 ||
      Date.now() - baseline.lastUpdated > 24 * 60 * 60 * 1000 // 24 hours

    if (shouldUpdate && metrics.length >= this.config.minimumSampleSize) {
      this.establishBaseline(operation)
    }
  }

  establishBaseline(operation: string): PerformanceBaseline {
    const metrics = this.metrics.get(operation)
    if (!metrics || metrics.length < this.config.minimumSampleSize) {
      throw new Error(
        `Insufficient data for baseline establishment: ${metrics?.length || 0} samples`,
      )
    }

    const values = metrics.map((m) => m.value).sort((a, b) => a - b)
    const mean = this.calculateMean(values)
    const standardDeviation = this.calculateStandardDeviation(values, mean)

    const baseline: PerformanceBaseline = {
      operation,
      mean,
      standardDeviation,
      percentiles: this.calculatePercentiles(values),
      sampleSize: values.length,
      establishedAt: Date.now(),
      lastUpdated: Date.now(),
    }

    this.baselines.set(operation, baseline)
    return baseline
  }

  private detectRegressions(
    operation: string,
    currentMetric: PerformanceMetric,
  ): RegressionAlert[] {
    const baseline = this.baselines.get(operation)
    if (!baseline) return []

    const metrics = this.metrics.get(operation)!
    const recentMetrics = metrics.slice(-this.config.movingAverageWindow)

    const analysis = this.performStatisticalAnalysis(recentMetrics, baseline)
    const alerts: RegressionAlert[] = []

    // Moving Average Detection
    if (this.detectMovingAverageRegression(analysis, baseline)) {
      alerts.push(
        this.createAlert(
          operation,
          "moving_average",
          analysis,
          baseline,
          currentMetric,
          recentMetrics,
        ),
      )
    }

    // Standard Deviation Detection
    if (this.detectStandardDeviationRegression(analysis, baseline)) {
      alerts.push(
        this.createAlert(
          operation,
          "standard_deviation",
          analysis,
          baseline,
          currentMetric,
          recentMetrics,
        ),
      )
    }

    // Percentile Detection
    if (this.detectPercentileRegression(currentMetric.value, baseline)) {
      alerts.push(
        this.createAlert(
          operation,
          "percentile",
          analysis,
          baseline,
          currentMetric,
          recentMetrics,
        ),
      )
    }

    // Z-Score Detection
    if (this.detectZScoreRegression(analysis, baseline)) {
      alerts.push(
        this.createAlert(
          operation,
          "z_score",
          analysis,
          baseline,
          currentMetric,
          recentMetrics,
        ),
      )
    }

    // Trend Analysis Detection
    if (metrics.length >= this.config.trendAnalysisWindow) {
      const trendMetrics = metrics.slice(-this.config.trendAnalysisWindow)
      if (this.detectTrendRegression(trendMetrics)) {
        alerts.push(
          this.createAlert(
            operation,
            "trend_analysis",
            analysis,
            baseline,
            currentMetric,
            recentMetrics,
          ),
        )
      }
    }

    // Store alerts
    this.alerts.push(...alerts)

    // Trigger notifications if enabled
    if (this.config.alertingEnabled && alerts.length > 0) {
      this.triggerAlerts(alerts)
    }

    return alerts
  }

  private performStatisticalAnalysis(
    metrics: PerformanceMetric[],
    baseline: PerformanceBaseline,
  ): StatisticalAnalysis {
    const values = metrics.map((m) => m.value)
    const movingAverage = this.calculateMean(values)
    const standardDeviation = this.calculateStandardDeviation(
      values,
      movingAverage,
    )
    const zScore = (movingAverage - baseline.mean) / baseline.standardDeviation

    // Trend analysis
    const timestamps = metrics.map((m) => m.timestamp)
    const { slope, correlation } = this.calculateLinearRegression(
      timestamps,
      values,
    )

    // Anomaly score (combination of multiple factors)
    const anomalyScore = this.calculateAnomalyScore(
      movingAverage,
      baseline,
      zScore,
      slope,
    )

    // Percentile rank
    const sortedBaselineValues = this.getHistoricalValues(
      baseline.operation,
    ).sort((a, b) => a - b)
    const percentileRank = this.calculatePercentileRank(
      movingAverage,
      sortedBaselineValues,
    )

    return {
      movingAverage,
      standardDeviation,
      zScore,
      trendSlope: slope,
      trendCorrelation: correlation,
      anomalyScore,
      percentileRank,
    }
  }

  private detectMovingAverageRegression(
    analysis: StatisticalAnalysis,
    baseline: PerformanceBaseline,
  ): boolean {
    const deviationRatio =
      Math.abs(analysis.movingAverage - baseline.mean) / baseline.mean
    return deviationRatio > 0.2 // 20% deviation threshold
  }

  private detectStandardDeviationRegression(
    analysis: StatisticalAnalysis,
    baseline: PerformanceBaseline,
  ): boolean {
    return Math.abs(analysis.zScore) > this.config.standardDeviationThreshold
  }

  private detectPercentileRegression(
    value: number,
    baseline: PerformanceBaseline,
  ): boolean {
    const threshold = this.config.percentileThreshold
    const percentileValue =
      threshold === 0.95
        ? baseline.percentiles.p95
        : threshold === 0.9
          ? baseline.percentiles.p90
          : baseline.percentiles.p99
    return value > percentileValue
  }

  private detectZScoreRegression(
    analysis: StatisticalAnalysis,
    baseline: PerformanceBaseline,
  ): boolean {
    return Math.abs(analysis.zScore) > this.config.zScoreThreshold
  }

  private detectTrendRegression(metrics: PerformanceMetric[]): boolean {
    const values = metrics.map((m) => m.value)
    const timestamps = metrics.map((m) => m.timestamp)
    const { slope, correlation } = this.calculateLinearRegression(
      timestamps,
      values,
    )

    // Detect significant upward trend (performance degradation)
    return slope > 0 && Math.abs(correlation) > 0.7
  }

  private createAlert(
    operation: string,
    detectionMethod: string,
    analysis: StatisticalAnalysis,
    baseline: PerformanceBaseline,
    currentMetric: PerformanceMetric,
    recentMetrics: PerformanceMetric[],
  ): RegressionAlert {
    const deviationPercentage =
      ((analysis.movingAverage - baseline.mean) / baseline.mean) * 100
    const severity = this.classifySeverity(
      analysis,
      baseline,
      deviationPercentage,
    )
    const confidence = this.calculateConfidence(analysis, baseline)

    return {
      id: `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation,
      severity,
      detectionMethod,
      currentValue: currentMetric.value,
      expectedValue: baseline.mean,
      deviationPercentage,
      confidence,
      timestamp: Date.now(),
      metadata: {
        baseline,
        recentMetrics,
        statisticalAnalysis: analysis,
        rootCauseHints: this.generateRootCauseHints(
          analysis,
          baseline,
          detectionMethod,
        ),
      },
    }
  }

  private classifySeverity(
    analysis: StatisticalAnalysis,
    baseline: PerformanceBaseline,
    deviationPercentage: number,
  ): "minor" | "major" | "critical" {
    const absDeviation = Math.abs(deviationPercentage)
    const zScoreAbs = Math.abs(analysis.zScore)

    if (absDeviation > 100 || zScoreAbs > 4 || analysis.anomalyScore > 0.9) {
      return "critical"
    } else if (
      absDeviation > 50 ||
      zScoreAbs > 3 ||
      analysis.anomalyScore > 0.7
    ) {
      return "major"
    } else {
      return "minor"
    }
  }

  private calculateConfidence(
    analysis: StatisticalAnalysis,
    baseline: PerformanceBaseline,
  ): number {
    const sampleSizeConfidence = Math.min(baseline.sampleSize / 100, 1)
    const zScoreConfidence = Math.min(Math.abs(analysis.zScore) / 3, 1)
    const anomalyConfidence = analysis.anomalyScore

    return (sampleSizeConfidence + zScoreConfidence + anomalyConfidence) / 3
  }

  private generateRootCauseHints(
    analysis: StatisticalAnalysis,
    baseline: PerformanceBaseline,
    detectionMethod: string,
  ): string[] {
    const hints: string[] = []

    if (analysis.trendSlope > 0) {
      hints.push("Performance is consistently degrading over time")
    }

    if (analysis.anomalyScore > 0.8) {
      hints.push("Multiple statistical indicators suggest significant anomaly")
    }

    if (Math.abs(analysis.zScore) > 3) {
      hints.push(
        "Current performance is extremely unusual compared to baseline",
      )
    }

    if (detectionMethod === "trend_analysis") {
      hints.push(
        "Consider checking for resource leaks or gradual system degradation",
      )
    }

    if (analysis.percentileRank > 0.95) {
      hints.push("Performance is in the worst 5% of historical measurements")
    }

    return hints
  }

  analyzeTrend(
    operation: string,
    timeRange?: { start: number; end: number },
  ): TrendAnalysis | null {
    const metrics = this.metrics.get(operation)
    if (!metrics || metrics.length < this.config.trendAnalysisWindow) {
      return null
    }

    const filteredMetrics = timeRange
      ? metrics.filter(
          (m) => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end,
        )
      : metrics.slice(-this.config.trendAnalysisWindow)

    if (filteredMetrics.length < 10) return null

    const values = filteredMetrics.map((m) => m.value)
    const timestamps = filteredMetrics.map((m) => m.timestamp)
    const { slope, correlation } = this.calculateLinearRegression(
      timestamps,
      values,
    )

    // Predict next value
    const lastTimestamp = timestamps[timestamps.length - 1]
    const nextTimestamp = lastTimestamp + (timestamps[1] - timestamps[0]) // Assume regular intervals
    const nextValue =
      slope * nextTimestamp + this.calculateIntercept(timestamps, values, slope)

    // Determine trending direction
    const trending =
      slope > 0.1 ? "degrading" : slope < -0.1 ? "improving" : "stable"

    return {
      operation,
      timeRange: timeRange || {
        start: filteredMetrics[0].timestamp,
        end: filteredMetrics[filteredMetrics.length - 1].timestamp,
      },
      slope,
      correlation,
      prediction: {
        nextValue,
        confidence: Math.abs(correlation),
        timeHorizon: nextTimestamp - lastTimestamp,
      },
      patterns: {
        cyclical: this.detectCyclicalPattern(values),
        seasonal: this.detectSeasonalPattern(filteredMetrics),
        trending,
      },
    }
  }

  generateVisualizationData(operation: string): VisualizationData | null {
    const metrics = this.metrics.get(operation)
    const baseline = this.baselines.get(operation)

    if (!metrics || !baseline) return null

    const timeSeriesData = metrics.map((m) => ({
      timestamp: m.timestamp,
      value: m.value,
      baseline: baseline.mean,
    }))

    const regressionPoints = this.alerts
      .filter((alert) => alert.operation === operation)
      .map((alert) => ({
        timestamp: alert.timestamp,
        severity: alert.severity,
        description: `${alert.detectionMethod}: ${alert.deviationPercentage.toFixed(1)}% deviation`,
      }))

    // Generate trend line
    const values = metrics.map((m) => m.value)
    const timestamps = metrics.map((m) => m.timestamp)
    const { slope } = this.calculateLinearRegression(timestamps, values)
    const intercept = this.calculateIntercept(timestamps, values, slope)

    const trendLine = timestamps.map((timestamp) => ({
      timestamp,
      value: slope * timestamp + intercept,
    }))

    // Generate confidence bands
    const stdDev = baseline.standardDeviation
    const confidenceBands = timestamps.map((timestamp) => ({
      timestamp,
      upper: baseline.mean + 2 * stdDev,
      lower: baseline.mean - 2 * stdDev,
    }))

    return {
      operation,
      timeSeriesData,
      regressionPoints,
      trendLine,
      confidenceBands,
      statistics: {
        mean: this.calculateMean(values),
        median: this.calculateMedian(values),
        standardDeviation: this.calculateStandardDeviation(values),
        variance: this.calculateVariance(values),
        skewness: this.calculateSkewness(values),
        kurtosis: this.calculateKurtosis(values),
      },
    }
  }

  // Statistical utility methods
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  private calculateStandardDeviation(values: number[], mean?: number): number {
    const avg = mean ?? this.calculateMean(values)
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
      values.length
    return Math.sqrt(variance)
  }

  private calculateVariance(values: number[]): number {
    const mean = this.calculateMean(values)
    return (
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length
    )
  }

  private calculateSkewness(values: number[]): number {
    const mean = this.calculateMean(values)
    const stdDev = this.calculateStandardDeviation(values, mean)
    const n = values.length

    const skewness =
      values.reduce((sum, val) => {
        return sum + Math.pow((val - mean) / stdDev, 3)
      }, 0) / n

    return skewness
  }

  private calculateKurtosis(values: number[]): number {
    const mean = this.calculateMean(values)
    const stdDev = this.calculateStandardDeviation(values, mean)
    const n = values.length

    const kurtosis =
      values.reduce((sum, val) => {
        return sum + Math.pow((val - mean) / stdDev, 4)
      }, 0) / n

    return kurtosis - 3 // Excess kurtosis
  }

  private calculatePercentiles(
    values: number[],
  ): PerformanceBaseline["percentiles"] {
    const sorted = [...values].sort((a, b) => a - b)
    const getPercentile = (p: number) => {
      const index = Math.ceil(sorted.length * p) - 1
      return sorted[Math.max(0, index)]
    }

    return {
      p50: getPercentile(0.5),
      p75: getPercentile(0.75),
      p90: getPercentile(0.9),
      p95: getPercentile(0.95),
      p99: getPercentile(0.99),
    }
  }

  private calculatePercentileRank(
    value: number,
    sortedValues: number[],
  ): number {
    let rank = 0
    for (const val of sortedValues) {
      if (val <= value) rank++
      else break
    }
    return rank / sortedValues.length
  }

  private calculateLinearRegression(
    x: number[],
    y: number[],
  ): { slope: number; correlation: number } {
    const n = x.length
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0)
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)

    const correlation =
      (n * sumXY - sumX * sumY) /
      Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY))

    return { slope, correlation }
  }

  private calculateIntercept(x: number[], y: number[], slope: number): number {
    const meanX = this.calculateMean(x)
    const meanY = this.calculateMean(y)
    return meanY - slope * meanX
  }

  private calculateAnomalyScore(
    currentValue: number,
    baseline: PerformanceBaseline,
    zScore: number,
    trendSlope: number,
  ): number {
    const zScoreComponent = Math.min(Math.abs(zScore) / 3, 1)
    const deviationComponent = Math.min(
      Math.abs(currentValue - baseline.mean) / baseline.mean,
      1,
    )
    const trendComponent = Math.min(Math.abs(trendSlope) / 1000, 1) // Normalize trend slope

    return (zScoreComponent + deviationComponent + trendComponent) / 3
  }

  private detectCyclicalPattern(values: number[]): boolean {
    // Simple autocorrelation check for cyclical patterns
    if (values.length < 20) return false

    const autocorrelations: number[] = []
    const maxLag = Math.min(values.length / 4, 10)

    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0
      const n = values.length - lag

      for (let i = 0; i < n; i++) {
        correlation += values[i] * values[i + lag]
      }

      autocorrelations.push(correlation / n)
    }

    return autocorrelations.some((corr) => Math.abs(corr) > 0.5)
  }

  private detectSeasonalPattern(metrics: PerformanceMetric[]): boolean {
    // Check for patterns based on time of day, day of week, etc.
    if (metrics.length < 50) return false

    const hourlyAverages = new Map<number, number[]>()

    metrics.forEach((metric) => {
      const hour = new Date(metric.timestamp).getHours()
      if (!hourlyAverages.has(hour)) {
        hourlyAverages.set(hour, [])
      }
      hourlyAverages.get(hour)!.push(metric.value)
    })

    const hourlyMeans = Array.from(hourlyAverages.entries())
      .map(([hour, values]) => ({ hour, mean: this.calculateMean(values) }))
      .sort((a, b) => a.hour - b.hour)

    if (hourlyMeans.length < 12) return false // Need at least 12 hours of data

    const means = hourlyMeans.map((h) => h.mean)
    const overallMean = this.calculateMean(means)
    const variance = this.calculateVariance(means)

    // If hourly variance is significant compared to overall variance, it's seasonal
    return variance > overallMean * 0.1
  }

  private getHistoricalValues(operation: string): number[] {
    const metrics = this.metrics.get(operation)
    return metrics ? metrics.map((m) => m.value) : []
  }

  private triggerAlerts(alerts: RegressionAlert[]): void {
    // In a real implementation, this would send notifications
    // via email, Slack, PagerDuty, etc.
    console.warn(`Performance regression detected: ${alerts.length} alerts`)
    alerts.forEach((alert) => {
      console.warn(
        `[${alert.severity.toUpperCase()}] ${alert.operation}: ${alert.deviationPercentage.toFixed(1)}% deviation`,
      )
    })
  }

  // Public API methods
  getBaseline(operation: string): PerformanceBaseline | undefined {
    return this.baselines.get(operation)
  }

  getAlerts(operation?: string): RegressionAlert[] {
    return operation
      ? this.alerts.filter((alert) => alert.operation === operation)
      : this.alerts
  }

  getRecentMetrics(operation: string, count: number = 50): PerformanceMetric[] {
    const metrics = this.metrics.get(operation)
    return metrics ? metrics.slice(-count) : []
  }

  clearAlerts(operation?: string): void {
    if (operation) {
      this.alerts = this.alerts.filter((alert) => alert.operation !== operation)
    } else {
      this.alerts = []
    }
  }

  updateConfig(newConfig: Partial<RegressionDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.adjustConfigBySensitivity()
  }

  exportData(): {
    metrics: Record<string, PerformanceMetric[]>
    baselines: Record<string, PerformanceBaseline>
    alerts: RegressionAlert[]
    config: RegressionDetectionConfig
  } {
    return {
      metrics: Object.fromEntries(this.metrics),
      baselines: Object.fromEntries(this.baselines),
      alerts: this.alerts,
      config: this.config,
    }
  }

  importData(data: {
    metrics?: Record<string, PerformanceMetric[]>
    baselines?: Record<string, PerformanceBaseline>
    alerts?: RegressionAlert[]
    config?: Partial<RegressionDetectionConfig>
  }): void {
    if (data.metrics) {
      this.metrics = new Map(Object.entries(data.metrics))
    }
    if (data.baselines) {
      this.baselines = new Map(Object.entries(data.baselines))
    }
    if (data.alerts) {
      this.alerts = data.alerts
    }
    if (data.config) {
      this.updateConfig(data.config)
    }
  }
}

// Factory function for creating detector with common configurations
export function createPerformanceRegressionDetector(
  preset: "development" | "staging" | "production" = "production",
): PerformanceRegressionDetector {
  const configs = {
    development: {
      sensitivityLevel: "low" as const,
      alertingEnabled: false,
      minimumSampleSize: 5,
      movingAverageWindow: 10,
    },
    staging: {
      sensitivityLevel: "medium" as const,
      alertingEnabled: true,
      minimumSampleSize: 10,
      movingAverageWindow: 15,
    },
    production: {
      sensitivityLevel: "high" as const,
      alertingEnabled: true,
      minimumSampleSize: 20,
      movingAverageWindow: 20,
    },
  }

  return new PerformanceRegressionDetector(configs[preset])
}
