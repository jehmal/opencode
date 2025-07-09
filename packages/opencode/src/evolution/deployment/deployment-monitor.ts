/**
 * Deployment Monitor for Evolution System
 * Tracks deployment health and collects metrics in real-time
 */

import { EventEmitter } from "events"
import type { Deployment } from "./evolution-deployment-manager"

export interface MonitoringConfig {
  interval: number
  errorThreshold: number
  performanceThreshold: number
}

export interface MonitoringSession {
  deploymentId: string
  startTime: number
  metrics: DeploymentMetrics
  alerts: Alert[]
  healthChecks: HealthCheck[]
  interval?: NodeJS.Timeout
}

export interface DeploymentMetrics {
  errorRate: MetricPoint[]
  responseTime: MetricPoint[]
  cpuUsage: MetricPoint[]
  memoryUsage: MetricPoint[]
  userFeedback: MetricPoint[]
}

export interface MetricPoint {
  timestamp: number
  value: number
}

export interface Alert {
  severity: "low" | "medium" | "high" | "critical"
  message: string
  timestamp: number
  metric?: string
  value?: number
}

export interface HealthCheck {
  timestamp: number
  status: "healthy" | "degraded" | "unhealthy"
  checks: {
    errorRate: boolean
    responseTime: boolean
    resources: boolean
    dependencies: boolean
  }
}

export interface HealthReport {
  deploymentId: string
  duration: number
  overallHealth: number // 0-1 score
  metrics: {
    avgErrorRate: number
    avgResponseTime: number
    p95ResponseTime: number
    alertCount: number
  }
  recommendation: "proceed" | "monitor" | "rollback"
}

export class DeploymentMonitor extends EventEmitter {
  private monitors: Map<string, MonitoringSession> = new Map()

  constructor(private config: MonitoringConfig) {
    super()
  }

  async startMonitoring(deployment: Deployment): Promise<MonitoringSession> {
    const session: MonitoringSession = {
      deploymentId: deployment.id,
      startTime: Date.now(),
      metrics: {
        errorRate: [],
        responseTime: [],
        cpuUsage: [],
        memoryUsage: [],
        userFeedback: [],
      },
      alerts: [],
      healthChecks: [],
    }

    // Start metric collection
    const interval = setInterval(async () => {
      await this.collectMetrics(session)
      await this.checkHealth(session)
      await this.evaluateAlerts(session)
    }, this.config.interval || 10000) // Default 10 seconds

    session.interval = interval
    this.monitors.set(deployment.id, session)

    this.emit("monitoring:started", { deploymentId: deployment.id })
    return session
  }

  async stopMonitoring(deploymentId: string): Promise<void> {
    const session = this.monitors.get(deploymentId)
    if (session && session.interval) {
      clearInterval(session.interval)
      this.monitors.delete(deploymentId)
      this.emit("monitoring:stopped", { deploymentId })
    }
  }

  private async collectMetrics(session: MonitoringSession): Promise<void> {
    // In real implementation, these would come from actual monitoring systems
    const metrics = await this.gatherMetrics()

    session.metrics.errorRate.push({
      timestamp: Date.now(),
      value: metrics.errorRate,
    })

    session.metrics.responseTime.push({
      timestamp: Date.now(),
      value: metrics.avgResponseTime,
    })

    session.metrics.cpuUsage.push({
      timestamp: Date.now(),
      value: metrics.cpuUsage,
    })

    session.metrics.memoryUsage.push({
      timestamp: Date.now(),
      value: metrics.memoryUsage,
    })

    if (metrics.userFeedback !== undefined) {
      session.metrics.userFeedback.push({
        timestamp: Date.now(),
        value: metrics.userFeedback,
      })
    }
  }

  private async gatherMetrics(): Promise<{
    errorRate: number
    avgResponseTime: number
    cpuUsage: number
    memoryUsage: number
    userFeedback?: number
  }> {
    // Simulate metric collection
    // In production, this would integrate with APM tools
    return {
      errorRate: Math.random() * 0.05, // 0-5% error rate
      avgResponseTime: 100 + Math.random() * 50, // 100-150ms
      cpuUsage: 40 + Math.random() * 20, // 40-60%
      memoryUsage: 50 + Math.random() * 20, // 50-70%
      userFeedback: 4 + Math.random() * 0.5, // 4-4.5 stars
    }
  }

  private async checkHealth(session: MonitoringSession): Promise<void> {
    const recentMetrics = this.getRecentMetrics(session, 5) // Last 5 data points

    const healthCheck: HealthCheck = {
      timestamp: Date.now(),
      status: "healthy",
      checks: {
        errorRate: true,
        responseTime: true,
        resources: true,
        dependencies: true,
      },
    }

    // Check error rate
    const avgErrorRate = this.average(recentMetrics.errorRate)
    if (avgErrorRate > this.config.errorThreshold) {
      healthCheck.checks.errorRate = false
      healthCheck.status = "unhealthy"
    }

    // Check response time
    const avgResponseTime = this.average(recentMetrics.responseTime)
    if (avgResponseTime > this.config.performanceThreshold) {
      healthCheck.checks.responseTime = false
      if (healthCheck.status === "healthy") {
        healthCheck.status = "degraded"
      }
    }

    // Check resources
    const avgCpu = this.average(recentMetrics.cpuUsage)
    const avgMemory = this.average(recentMetrics.memoryUsage)
    if (avgCpu > 80 || avgMemory > 85) {
      healthCheck.checks.resources = false
      if (healthCheck.status === "healthy") {
        healthCheck.status = "degraded"
      }
    }

    session.healthChecks.push(healthCheck)

    if (healthCheck.status !== "healthy") {
      this.emit("health:degraded", {
        deploymentId: session.deploymentId,
        status: healthCheck.status,
        checks: healthCheck.checks,
      })
    }
  }

  private async evaluateAlerts(session: MonitoringSession): Promise<void> {
    const recentMetrics = this.getRecentMetrics(session, 3)

    // Error rate spike
    const currentErrorRate =
      recentMetrics.errorRate[recentMetrics.errorRate.length - 1]?.value || 0
    if (currentErrorRate > this.config.errorThreshold * 2) {
      const alert: Alert = {
        severity: "critical",
        message: `Critical error rate spike: ${(currentErrorRate * 100).toFixed(2)}%`,
        timestamp: Date.now(),
        metric: "errorRate",
        value: currentErrorRate,
      }
      session.alerts.push(alert)
      this.emit("alert", alert)
    } else if (currentErrorRate > this.config.errorThreshold) {
      const alert: Alert = {
        severity: "high",
        message: `Error rate above threshold: ${(currentErrorRate * 100).toFixed(2)}%`,
        timestamp: Date.now(),
        metric: "errorRate",
        value: currentErrorRate,
      }
      session.alerts.push(alert)
      this.emit("alert", alert)
    }

    // Performance degradation
    const avgResponseTime = this.average(recentMetrics.responseTime)
    if (avgResponseTime > this.config.performanceThreshold * 1.5) {
      const alert: Alert = {
        severity: "high",
        message: `Severe performance degradation: ${avgResponseTime.toFixed(0)}ms average response time`,
        timestamp: Date.now(),
        metric: "responseTime",
        value: avgResponseTime,
      }
      session.alerts.push(alert)
      this.emit("alert", alert)
    }

    // Resource exhaustion
    const currentMemory =
      recentMetrics.memoryUsage[recentMetrics.memoryUsage.length - 1]?.value ||
      0
    if (currentMemory > 90) {
      const alert: Alert = {
        severity: "critical",
        message: `Memory usage critical: ${currentMemory.toFixed(0)}%`,
        timestamp: Date.now(),
        metric: "memoryUsage",
        value: currentMemory,
      }
      session.alerts.push(alert)
      this.emit("alert", alert)
    }
  }

  async generateHealthReport(deploymentId: string): Promise<HealthReport> {
    const session = this.monitors.get(deploymentId)
    if (!session) throw new Error("No monitoring session found")

    const duration = Date.now() - session.startTime
    const overallHealth = this.calculateOverallHealth(session)

    const report: HealthReport = {
      deploymentId,
      duration,
      overallHealth,
      metrics: {
        avgErrorRate: this.average(session.metrics.errorRate),
        avgResponseTime: this.average(session.metrics.responseTime),
        p95ResponseTime: this.percentile(session.metrics.responseTime, 95),
        alertCount: session.alerts.length,
      },
      recommendation: this.generateRecommendation(session),
    }

    return report
  }

  private calculateOverallHealth(session: MonitoringSession): number {
    const recentHealth = session.healthChecks.slice(-10) // Last 10 checks
    if (recentHealth.length === 0) return 1

    const healthScores = recentHealth.map((check) => {
      switch (check.status) {
        case "healthy":
          return 1
        case "degraded":
          return 0.7
        case "unhealthy":
          return 0.3
        default:
          return 0
      }
    })

    return this.averageNumbers(healthScores)
  }

  private generateRecommendation(
    session: MonitoringSession,
  ): "proceed" | "monitor" | "rollback" {
    const overallHealth = this.calculateOverallHealth(session)
    const criticalAlerts = session.alerts.filter(
      (a) => a.severity === "critical",
    ).length
    const highAlerts = session.alerts.filter(
      (a) => a.severity === "high",
    ).length

    if (overallHealth < 0.5 || criticalAlerts > 0) {
      return "rollback"
    } else if (overallHealth < 0.8 || highAlerts > 2) {
      return "monitor"
    } else {
      return "proceed"
    }
  }

  private getRecentMetrics(
    session: MonitoringSession,
    count: number,
  ): DeploymentMetrics {
    return {
      errorRate: session.metrics.errorRate.slice(-count),
      responseTime: session.metrics.responseTime.slice(-count),
      cpuUsage: session.metrics.cpuUsage.slice(-count),
      memoryUsage: session.metrics.memoryUsage.slice(-count),
      userFeedback: session.metrics.userFeedback.slice(-count),
    }
  }

  private average(metrics: MetricPoint[]): number {
    if (metrics.length === 0) return 0
    const sum = metrics.reduce((acc, m) => acc + m.value, 0)
    return sum / metrics.length
  }

  private averageNumbers(numbers: number[]): number {
    if (numbers.length === 0) return 0
    const sum = numbers.reduce((acc, n) => acc + n, 0)
    return sum / numbers.length
  }

  private percentile(metrics: MetricPoint[], p: number): number {
    if (metrics.length === 0) return 0

    const values = metrics.map((m) => m.value).sort((a, b) => a - b)
    const index = Math.ceil((p / 100) * values.length) - 1
    return values[Math.max(0, index)]
  }

  // Public methods for querying

  getSession(deploymentId: string): MonitoringSession | undefined {
    return this.monitors.get(deploymentId)
  }

  getActiveMonitors(): string[] {
    return Array.from(this.monitors.keys())
  }

  async getMetricsSummary(deploymentId: string): Promise<{
    errorRate: { current: number; trend: "up" | "down" | "stable" }
    responseTime: { current: number; trend: "up" | "down" | "stable" }
    health: number
    alerts: number
  } | null> {
    const session = this.monitors.get(deploymentId)
    if (!session) return null

    const recentError = session.metrics.errorRate.slice(-5)
    const recentResponse = session.metrics.responseTime.slice(-5)

    return {
      errorRate: {
        current: recentError[recentError.length - 1]?.value || 0,
        trend: this.calculateTrend(recentError),
      },
      responseTime: {
        current: recentResponse[recentResponse.length - 1]?.value || 0,
        trend: this.calculateTrend(recentResponse),
      },
      health: this.calculateOverallHealth(session),
      alerts: session.alerts.length,
    }
  }

  private calculateTrend(metrics: MetricPoint[]): "up" | "down" | "stable" {
    if (metrics.length < 2) return "stable"

    const firstHalf = metrics.slice(0, Math.floor(metrics.length / 2))
    const secondHalf = metrics.slice(Math.floor(metrics.length / 2))

    const firstAvg = this.average(firstHalf)
    const secondAvg = this.average(secondHalf)

    const change = (secondAvg - firstAvg) / firstAvg

    if (change > 0.1) return "up"
    if (change < -0.1) return "down"
    return "stable"
  }
}
