/**
 * Post-Deployment Validator
 * Validates deployment success over extended time periods
 */

import type { Deployment } from "./evolution-deployment-manager"

export interface PostDeploymentMetrics {
  errorRates: MetricSample[]
  performanceMetrics: MetricSample[]
  userFeedback: MetricSample[]
  businessMetrics: MetricSample[]
}

export interface MetricSample {
  timestamp: number
  value: number
  metadata?: Record<string, any>
}

export interface ValidationReport {
  deploymentId: string
  validationDuration: number
  success: boolean
  findings: ValidationFinding[]
  recommendations: string[]
  confidenceScore: number
}

export interface ValidationFinding {
  type: "positive" | "negative" | "neutral"
  category: "performance" | "reliability" | "user-experience" | "business"
  severity: "low" | "medium" | "high"
  message: string
  evidence: any
}

export interface ValidationAnalysis {
  success: boolean
  findings: ValidationFinding[]
  recommendations: string[]
  confidence: number
}

export class PostDeploymentValidator {
  async validateDeployment(
    deployment: Deployment,
    duration: number = 3600000, // 1 hour default
  ): Promise<ValidationReport> {
    const startTime = Date.now()
    const metrics: PostDeploymentMetrics = {
      errorRates: [],
      performanceMetrics: [],
      userFeedback: [],
      businessMetrics: [],
    }

    // Collect metrics over time
    const collectionInterval = 60000 // Every minute
    const iterations = Math.floor(duration / collectionInterval)

    for (let i = 0; i < iterations; i++) {
      await this.collectPostDeploymentMetrics(deployment, metrics)

      // Check for early termination conditions
      if (this.shouldTerminateEarly(metrics)) {
        break
      }

      await this.sleep(collectionInterval)
    }

    // Analyze collected metrics
    const analysis = this.analyzeMetrics(metrics)

    return {
      deploymentId: deployment.id,
      validationDuration: Date.now() - startTime,
      success: analysis.success,
      findings: analysis.findings,
      recommendations: analysis.recommendations,
      confidenceScore: analysis.confidence,
    }
  }

  private async collectPostDeploymentMetrics(
    deployment: Deployment,
    metrics: PostDeploymentMetrics,
  ): Promise<void> {
    const timestamp = Date.now()

    // Collect error rates
    const errorRate = await this.getErrorRate(deployment)
    metrics.errorRates.push({
      timestamp,
      value: errorRate,
      metadata: { source: "apm" },
    })

    // Collect performance metrics
    const performance = await this.getPerformanceMetrics(deployment)
    metrics.performanceMetrics.push({
      timestamp,
      value: performance.avgResponseTime,
      metadata: {
        p95: performance.p95ResponseTime,
        p99: performance.p99ResponseTime,
      },
    })

    // Collect user feedback
    const feedback = await this.getUserFeedback(deployment)
    if (feedback) {
      metrics.userFeedback.push({
        timestamp,
        value: feedback.score,
        metadata: {
          sampleSize: feedback.sampleSize,
          sentiment: feedback.sentiment,
        },
      })
    }

    // Collect business metrics
    const business = await this.getBusinessMetrics(deployment)
    metrics.businessMetrics.push({
      timestamp,
      value: business.conversionRate,
      metadata: {
        revenue: business.revenue,
        userEngagement: business.engagement,
      },
    })
  }

  private shouldTerminateEarly(metrics: PostDeploymentMetrics): boolean {
    // Check for critical issues that warrant early termination
    const recentErrors = metrics.errorRates.slice(-5)
    const avgErrorRate = this.average(recentErrors.map((m) => m.value))

    if (avgErrorRate > 0.1) {
      // 10% error rate
      return true
    }

    const recentPerformance = metrics.performanceMetrics.slice(-5)
    const avgResponseTime = this.average(recentPerformance.map((m) => m.value))

    if (avgResponseTime > 1000) {
      // 1 second response time
      return true
    }

    return false
  }

  private analyzeMetrics(metrics: PostDeploymentMetrics): ValidationAnalysis {
    const findings: ValidationFinding[] = []
    const recommendations: string[] = []
    let confidence = 1.0

    // Analyze error rates
    const errorAnalysis = this.analyzeErrorRates(metrics.errorRates)
    findings.push(...errorAnalysis.findings)
    confidence *= errorAnalysis.confidence

    // Analyze performance
    const perfAnalysis = this.analyzePerformance(metrics.performanceMetrics)
    findings.push(...perfAnalysis.findings)
    confidence *= perfAnalysis.confidence

    // Analyze user feedback
    if (metrics.userFeedback.length > 0) {
      const feedbackAnalysis = this.analyzeUserFeedback(metrics.userFeedback)
      findings.push(...feedbackAnalysis.findings)
      confidence *= feedbackAnalysis.confidence
    }

    // Analyze business metrics
    const businessAnalysis = this.analyzeBusinessMetrics(
      metrics.businessMetrics,
    )
    findings.push(...businessAnalysis.findings)
    confidence *= businessAnalysis.confidence

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(findings))

    // Determine overall success
    const criticalFindings = findings.filter(
      (f) => f.severity === "high" && f.type === "negative",
    )
    const success = criticalFindings.length === 0

    return {
      success,
      findings,
      recommendations,
      confidence,
    }
  }

  private analyzeErrorRates(samples: MetricSample[]): {
    findings: ValidationFinding[]
    confidence: number
  } {
    const findings: ValidationFinding[] = []
    let confidence = 1.0

    if (samples.length === 0) {
      confidence = 0.5
      return { findings, confidence }
    }

    const avgErrorRate = this.average(samples.map((s) => s.value))
    const trend = this.calculateTrend(samples)

    if (avgErrorRate < 0.01) {
      findings.push({
        type: "positive",
        category: "reliability",
        severity: "low",
        message: `Excellent error rate: ${(avgErrorRate * 100).toFixed(2)}%`,
        evidence: { avgErrorRate, sampleCount: samples.length },
      })
    } else if (avgErrorRate < 0.05) {
      findings.push({
        type: "neutral",
        category: "reliability",
        severity: "low",
        message: `Acceptable error rate: ${(avgErrorRate * 100).toFixed(2)}%`,
        evidence: { avgErrorRate, sampleCount: samples.length },
      })
    } else {
      findings.push({
        type: "negative",
        category: "reliability",
        severity: "high",
        message: `High error rate detected: ${(avgErrorRate * 100).toFixed(2)}%`,
        evidence: { avgErrorRate, sampleCount: samples.length, trend },
      })
      confidence *= 0.7
    }

    if (trend === "increasing") {
      findings.push({
        type: "negative",
        category: "reliability",
        severity: "medium",
        message: "Error rate is increasing over time",
        evidence: { trend },
      })
      confidence *= 0.8
    }

    return { findings, confidence }
  }

  private analyzePerformance(samples: MetricSample[]): {
    findings: ValidationFinding[]
    confidence: number
  } {
    const findings: ValidationFinding[] = []
    let confidence = 1.0

    if (samples.length === 0) {
      confidence = 0.5
      return { findings, confidence }
    }

    const avgResponseTime = this.average(samples.map((s) => s.value))
    const p95Values = samples.map((s) => s.metadata?.p95 || s.value)
    const avgP95 = this.average(p95Values)

    if (avgResponseTime < 200) {
      findings.push({
        type: "positive",
        category: "performance",
        severity: "low",
        message: `Excellent response time: ${avgResponseTime.toFixed(0)}ms average`,
        evidence: { avgResponseTime, avgP95 },
      })
    } else if (avgResponseTime < 500) {
      findings.push({
        type: "neutral",
        category: "performance",
        severity: "low",
        message: `Good response time: ${avgResponseTime.toFixed(0)}ms average`,
        evidence: { avgResponseTime, avgP95 },
      })
    } else {
      findings.push({
        type: "negative",
        category: "performance",
        severity: "medium",
        message: `Slow response time: ${avgResponseTime.toFixed(0)}ms average`,
        evidence: { avgResponseTime, avgP95 },
      })
      confidence *= 0.8
    }

    // Check for performance degradation
    const trend = this.calculateTrend(samples)
    if (trend === "increasing") {
      findings.push({
        type: "negative",
        category: "performance",
        severity: "medium",
        message: "Performance is degrading over time",
        evidence: { trend },
      })
      confidence *= 0.85
    }

    return { findings, confidence }
  }

  private analyzeUserFeedback(samples: MetricSample[]): {
    findings: ValidationFinding[]
    confidence: number
  } {
    const findings: ValidationFinding[] = []
    let confidence = 1.0

    if (samples.length === 0) {
      confidence = 0.7 // Lower confidence without user feedback
      return { findings, confidence }
    }

    const avgScore = this.average(samples.map((s) => s.value))
    const totalSampleSize = samples.reduce(
      (sum, s) => sum + (s.metadata?.sampleSize || 0),
      0,
    )

    if (avgScore >= 4.5) {
      findings.push({
        type: "positive",
        category: "user-experience",
        severity: "low",
        message: `Excellent user satisfaction: ${avgScore.toFixed(1)}/5`,
        evidence: { avgScore, totalSampleSize },
      })
    } else if (avgScore >= 3.5) {
      findings.push({
        type: "neutral",
        category: "user-experience",
        severity: "low",
        message: `Good user satisfaction: ${avgScore.toFixed(1)}/5`,
        evidence: { avgScore, totalSampleSize },
      })
    } else {
      findings.push({
        type: "negative",
        category: "user-experience",
        severity: "high",
        message: `Poor user satisfaction: ${avgScore.toFixed(1)}/5`,
        evidence: { avgScore, totalSampleSize },
      })
      confidence *= 0.6
    }

    // Adjust confidence based on sample size
    if (totalSampleSize < 100) {
      confidence *= 0.8 // Lower confidence with small sample
    }

    return { findings, confidence }
  }

  private analyzeBusinessMetrics(samples: MetricSample[]): {
    findings: ValidationFinding[]
    confidence: number
  } {
    const findings: ValidationFinding[] = []
    let confidence = 1.0

    if (samples.length === 0) {
      confidence = 0.8
      return { findings, confidence }
    }

    const avgConversionRate = this.average(samples.map((s) => s.value))
    const trend = this.calculateTrend(samples)

    if (trend === "increasing") {
      findings.push({
        type: "positive",
        category: "business",
        severity: "low",
        message: `Conversion rate improving: ${(avgConversionRate * 100).toFixed(1)}% average`,
        evidence: { avgConversionRate, trend },
      })
    } else if (trend === "decreasing") {
      findings.push({
        type: "negative",
        category: "business",
        severity: "medium",
        message: `Conversion rate declining: ${(avgConversionRate * 100).toFixed(1)}% average`,
        evidence: { avgConversionRate, trend },
      })
      confidence *= 0.85
    } else {
      findings.push({
        type: "neutral",
        category: "business",
        severity: "low",
        message: `Stable conversion rate: ${(avgConversionRate * 100).toFixed(1)}%`,
        evidence: { avgConversionRate },
      })
    }

    return { findings, confidence }
  }

  private generateRecommendations(findings: ValidationFinding[]): string[] {
    const recommendations: string[] = []

    // Check for high severity negative findings
    const criticalIssues = findings.filter(
      (f) => f.type === "negative" && f.severity === "high",
    )

    if (criticalIssues.length > 0) {
      recommendations.push(
        "Consider rolling back this deployment due to critical issues",
      )

      criticalIssues.forEach((issue) => {
        if (issue.category === "reliability") {
          recommendations.push("Investigate and fix error sources immediately")
        } else if (issue.category === "user-experience") {
          recommendations.push(
            "Gather detailed user feedback to understand satisfaction issues",
          )
        }
      })
    }

    // Performance recommendations
    const perfIssues = findings.filter(
      (f) => f.category === "performance" && f.type === "negative",
    )
    if (perfIssues.length > 0) {
      recommendations.push(
        "Profile application to identify performance bottlenecks",
      )
      recommendations.push(
        "Consider implementing caching or optimization strategies",
      )
    }

    // Trend-based recommendations
    const negativetrends = findings.filter(
      (f) =>
        f.evidence?.trend === "increasing" ||
        f.evidence?.trend === "decreasing",
    )
    if (negativetrends.length > 0) {
      recommendations.push(
        "Monitor trends closely - metrics are changing over time",
      )
    }

    return [...new Set(recommendations)] // Remove duplicates
  }

  // Helper methods

  private async getErrorRate(deployment: Deployment): Promise<number> {
    // Simulate fetching error rate from monitoring system
    return Math.random() * 0.05 // 0-5% error rate
  }

  private async getPerformanceMetrics(deployment: Deployment): Promise<{
    avgResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
  }> {
    // Simulate fetching performance metrics
    const base = 100 + Math.random() * 200 // 100-300ms base
    return {
      avgResponseTime: base,
      p95ResponseTime: base * 1.5,
      p99ResponseTime: base * 2,
    }
  }

  private async getUserFeedback(deployment: Deployment): Promise<{
    score: number
    sampleSize: number
    sentiment: "positive" | "neutral" | "negative"
  } | null> {
    // Simulate fetching user feedback
    if (Math.random() > 0.7) return null // 30% chance of no feedback

    const score = 3 + Math.random() * 2 // 3-5 score
    return {
      score,
      sampleSize: Math.floor(Math.random() * 1000),
      sentiment: score >= 4 ? "positive" : score >= 3 ? "neutral" : "negative",
    }
  }

  private async getBusinessMetrics(deployment: Deployment): Promise<{
    conversionRate: number
    revenue: number
    engagement: number
  }> {
    // Simulate fetching business metrics
    return {
      conversionRate: 0.02 + Math.random() * 0.03, // 2-5% conversion
      revenue: Math.random() * 100000,
      engagement: 0.3 + Math.random() * 0.4, // 30-70% engagement
    }
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, v) => sum + v, 0) / values.length
  }

  private calculateTrend(
    samples: MetricSample[],
  ): "increasing" | "decreasing" | "stable" {
    if (samples.length < 3) return "stable"

    const firstHalf = samples.slice(0, Math.floor(samples.length / 2))
    const secondHalf = samples.slice(Math.floor(samples.length / 2))

    const firstAvg = this.average(firstHalf.map((s) => s.value))
    const secondAvg = this.average(secondHalf.map((s) => s.value))

    const change = (secondAvg - firstAvg) / firstAvg

    if (change > 0.1) return "increasing"
    if (change < -0.1) return "decreasing"
    return "stable"
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
