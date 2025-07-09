/**
 * Deployment Dashboard
 * Provides real-time visibility into deployment status and analytics
 */

import type { Deployment } from "./evolution-deployment-manager"
import { DeploymentHistoryTracker } from "./deployment-history"
import { DeploymentMonitor } from "./deployment-monitor"

export class DeploymentDashboard {
  private historyTracker: DeploymentHistoryTracker
  private monitor: DeploymentMonitor

  constructor(
    monitor: DeploymentMonitor,
    historyTracker?: DeploymentHistoryTracker,
  ) {
    this.monitor = monitor
    this.historyTracker = historyTracker || new DeploymentHistoryTracker()
  }

  async generateDashboard(): Promise<string> {
    const activeDeployments = await this.getActiveDeployments()
    const recentHistory = await this.getRecentHistory()
    const analytics = await this.getAnalytics()

    return `
╔══════════════════════════════════════════════════════════════╗
║                  Evolution Deployment Dashboard               ║
╠══════════════════════════════════════════════════════════════╣
║ Active Deployments:                                          ║
${this.formatActiveDeployments(activeDeployments)}
║                                                              ║
║ Recent Deployments:                                          ║
${this.formatRecentDeployments(recentHistory)}
║                                                              ║
║ Deployment Analytics:                                        ║
${this.formatAnalytics(analytics)}
╚══════════════════════════════════════════════════════════════╝
    `.trim()
  }

  private async getActiveDeployments(): Promise<ActiveDeploymentInfo[]> {
    const activeMonitors = this.monitor.getActiveMonitors()
    const deployments: ActiveDeploymentInfo[] = []

    for (const deploymentId of activeMonitors) {
      const summary = await this.monitor.getMetricsSummary(deploymentId)
      if (summary) {
        deployments.push({
          deploymentId,
          errorRate: summary.errorRate,
          responseTime: summary.responseTime,
          health: summary.health,
          alerts: summary.alerts,
        })
      }
    }

    return deployments
  }

  private async getRecentHistory(): Promise<RecentDeploymentInfo[]> {
    const recent = await this.historyTracker.getRecentDeployments(5)

    return recent.map((deployment) => ({
      id: deployment.id,
      evolutionId: deployment.evolutionId,
      timestamp: new Date(deployment.timestamp),
      strategy: deployment.strategy,
      duration: deployment.duration,
      success: deployment.result.success,
      rollback: deployment.metrics.rollbackRequired,
    }))
  }

  private async getAnalytics(): Promise<any> {
    return this.historyTracker.getDeploymentAnalytics()
  }

  private formatActiveDeployments(deployments: ActiveDeploymentInfo[]): string {
    if (deployments.length === 0) {
      return "║   No active deployments                                      ║"
    }

    return deployments
      .map((d) => {
        const healthIcon = d.health > 0.8 ? "✅" : d.health > 0.5 ? "⚠️" : "❌"
        const errorTrend =
          d.errorRate.trend === "up"
            ? "↑"
            : d.errorRate.trend === "down"
              ? "↓"
              : "→"
        const perfTrend =
          d.responseTime.trend === "up"
            ? "↑"
            : d.responseTime.trend === "down"
              ? "↓"
              : "→"

        return `║ ${healthIcon} ${d.deploymentId.substring(0, 20).padEnd(20)} │ Error: ${(d.errorRate.current * 100).toFixed(1)}% ${errorTrend} │ RT: ${d.responseTime.current.toFixed(0)}ms ${perfTrend} │ ${d.alerts} alerts ║`
      })
      .join("\n")
  }

  private formatRecentDeployments(deployments: RecentDeploymentInfo[]): string {
    if (deployments.length === 0) {
      return "║   No recent deployments                                      ║"
    }

    return deployments
      .map((d) => {
        const statusIcon = d.success ? "✅" : d.rollback ? "↩️" : "❌"
        const timeAgo = this.formatTimeAgo(d.timestamp)
        const duration = this.formatDuration(d.duration)

        return `║ ${statusIcon} ${d.evolutionId.substring(0, 15).padEnd(15)} │ ${d.strategy.padEnd(10)} │ ${timeAgo.padEnd(12)} │ ${duration.padEnd(8)} ║`
      })
      .join("\n")
  }

  private formatAnalytics(analytics: any): string {
    const lines: string[] = []

    lines.push(
      `║ Total Deployments: ${analytics.totalDeployments.toString().padEnd(10)} Success Rate: ${analytics.successRate.toFixed(1)}%     ║`,
    )
    lines.push(
      `║ Avg Duration: ${this.formatDuration(analytics.averageDuration).padEnd(15)} Rollback Rate: ${analytics.rollbackRate.toFixed(1)}%   ║`,
    )
    lines.push(
      "║                                                              ║",
    )
    lines.push(
      "║ Strategy Breakdown:                                          ║",
    )

    analytics.strategyBreakdown.forEach((strategy: any) => {
      lines.push(
        `║   ${strategy.strategy.padEnd(12)}: ${strategy.count.toString().padEnd(3)} deployments, ${strategy.successRate.toFixed(1)}% success      ║`,
      )
    })

    return lines.join("\n")
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return "just now"
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  // Real-time monitoring dashboard
  async generateRealTimeDashboard(deploymentId: string): Promise<string> {
    const session = this.monitor.getSession(deploymentId)
    if (!session) return "No monitoring session found"

    const healthReport = await this.monitor.generateHealthReport(deploymentId)
    const recentAlerts = session.alerts.slice(-5)

    return `
╔══════════════════════════════════════════════════════════════╗
║              Real-Time Deployment Monitor                     ║
║                                                              ║
║ Deployment: ${deploymentId.substring(0, 40).padEnd(40)}     ║
╠══════════════════════════════════════════════════════════════╣
║ Health Score: ${this.renderHealthBar(healthReport.overallHealth)} ${(healthReport.overallHealth * 100).toFixed(0)}%    ║
║                                                              ║
║ Metrics:                                                     ║
║   Error Rate:     ${(healthReport.metrics.avgErrorRate * 100).toFixed(2)}% avg                              ║
║   Response Time:  ${healthReport.metrics.avgResponseTime.toFixed(0)}ms avg, ${healthReport.metrics.p95ResponseTime.toFixed(0)}ms p95         ║
║   Alert Count:    ${healthReport.metrics.alertCount}                                        ║
║                                                              ║
║ Recommendation: ${healthReport.recommendation.toUpperCase().padEnd(40)}  ║
║                                                              ║
║ Recent Alerts:                                               ║
${this.formatAlerts(recentAlerts)}
╚══════════════════════════════════════════════════════════════╝
    `.trim()
  }

  private renderHealthBar(health: number): string {
    const barLength = 20
    const filledLength = Math.round(health * barLength)
    const emptyLength = barLength - filledLength

    const filled = "█".repeat(filledLength)
    const empty = "░".repeat(emptyLength)

    return `[${filled}${empty}]`
  }

  private formatAlerts(alerts: any[]): string {
    if (alerts.length === 0) {
      return "║   No recent alerts                                           ║"
    }

    return alerts
      .map((alert) => {
        const icon =
          alert.severity === "critical"
            ? "🔴"
            : alert.severity === "high"
              ? "🟠"
              : alert.severity === "medium"
                ? "🟡"
                : "🟢"
        const time = new Date(alert.timestamp).toLocaleTimeString()
        const message = alert.message.substring(0, 35).padEnd(35)

        return `║ ${icon} ${time} │ ${message} ║`
      })
      .join("\n")
  }
}

interface ActiveDeploymentInfo {
  deploymentId: string
  errorRate: { current: number; trend: "up" | "down" | "stable" }
  responseTime: { current: number; trend: "up" | "down" | "stable" }
  health: number
  alerts: number
}

interface RecentDeploymentInfo {
  id: string
  evolutionId: string
  timestamp: Date
  strategy: string
  duration: number
  success: boolean
  rollback: boolean
}
