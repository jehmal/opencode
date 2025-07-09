/**
 * Integration between pattern analysis and Evolution Bridge
 * Connects usage patterns to improvement hypotheses
 */

import { SessionPerformanceExtended } from "../performance/session-performance-extended"
import {
  PatternRecognitionEngine,
  HypothesisGenerator,
} from "./patterns/pattern-recognition"
import { PatternStorage } from "../performance/pattern-storage"
import type { ImprovementHypothesis, EvolutionRequest } from "./types"
import type { DetectedPattern } from "./patterns/pattern-recognition"

/**
 * Pattern-based evolution integration
 */
export class PatternEvolutionIntegration {
  private storage = PatternStorage.getInstance()

  /**
   * Analyze session and generate improvement hypotheses
   */
  async analyzeSession(sessionId: string): Promise<{
    patterns: DetectedPattern[]
    hypotheses: ImprovementHypothesis[]
    recommendations: EvolutionRequest[]
  }> {
    // Get detailed metrics
    const metrics = SessionPerformanceExtended.exportMetrics(sessionId)

    // Run pattern recognition
    const patterns = PatternRecognitionEngine.analyzeMetrics(metrics.metrics)

    // Store patterns
    await this.storage.storePatterns(sessionId, patterns)

    // Generate hypotheses
    const hypotheses = HypothesisGenerator.generateHypotheses(patterns)

    // Store hypotheses
    await this.storage.storeHypotheses(hypotheses)

    // Generate evolution recommendations
    const recommendations = this.generateRecommendations(patterns, hypotheses)

    return {
      patterns,
      hypotheses,
      recommendations,
    }
  }

  /**
   * Get aggregated patterns across all sessions
   */
  async getAggregatedPatterns(timeWindow?: number): Promise<{
    topPatterns: DetectedPattern[]
    commonIssues: Array<{
      issue: string
      frequency: number
      impact: number
      affectedTools: string[]
    }>
    improvementOpportunities: Array<{
      opportunity: string
      potentialImpact: number
      complexity: string
      relatedHypotheses: ImprovementHypothesis[]
    }>
  }> {
    const aggregated = await this.storage.aggregatePatterns(timeWindow)

    // Get top patterns by improvement potential
    const topPatterns: DetectedPattern[] = []
    for (const agg of aggregated.slice(0, 10)) {
      const pattern = await this.storage.getPatternDetails(agg.patternId)
      if (pattern) {
        topPatterns.push(pattern)
      }
    }

    // Identify common issues
    const issueMap = new Map<
      string,
      {
        frequency: number
        impact: number
        tools: Set<string>
      }
    >()

    for (const pattern of topPatterns) {
      const issue = pattern.improvementOpportunity.description
      const existing = issueMap.get(issue) || {
        frequency: 0,
        impact: 0,
        tools: new Set(),
      }

      existing.frequency += pattern.frequency
      existing.impact = Math.max(
        existing.impact,
        (pattern.impact.performanceImpact +
          pattern.impact.userExperienceImpact) /
          2,
      )
      pattern.context.tools.forEach((t) => existing.tools.add(t))

      issueMap.set(issue, existing)
    }

    const commonIssues = Array.from(issueMap.entries())
      .map(([issue, data]) => ({
        issue,
        frequency: data.frequency,
        impact: data.impact,
        affectedTools: Array.from(data.tools),
      }))
      .sort((a, b) => b.frequency * b.impact - a.frequency * a.impact)

    // Group improvement opportunities
    const opportunityMap = new Map<
      string,
      {
        potentialImpact: number
        complexity: string
        hypotheses: Set<string>
      }
    >()

    for (const pattern of topPatterns) {
      const opp = pattern.improvementOpportunity
      const key = `${opp.description}|${opp.implementationComplexity}`

      const existing = opportunityMap.get(key) || {
        potentialImpact: 0,
        complexity: opp.implementationComplexity,
        hypotheses: new Set(),
      }

      existing.potentialImpact +=
        (pattern.frequency *
          (pattern.impact.performanceImpact +
            pattern.impact.userExperienceImpact +
            pattern.impact.resourceImpact)) /
        3

      opportunityMap.set(key, existing)
    }

    // Get related hypotheses
    const improvementOpportunities = await Promise.all(
      Array.from(opportunityMap.entries()).map(async ([key, data]) => {
        const [opportunity] = key.split("|")
        const relatedHypotheses: ImprovementHypothesis[] = []

        // Get hypotheses that match this opportunity
        const allTypes = [
          "improve_performance",
          "fix_bugs",
          "refactor_code",
          "optimize_memory",
        ]
        for (const type of allTypes) {
          const hyps = await this.storage.getHypothesesByType(type)
          relatedHypotheses.push(
            ...hyps.filter((h) =>
              h.description.toLowerCase().includes(opportunity.toLowerCase()),
            ),
          )
        }

        return {
          opportunity,
          potentialImpact: data.potentialImpact,
          complexity: data.complexity,
          relatedHypotheses,
        }
      }),
    )

    return {
      topPatterns,
      commonIssues,
      improvementOpportunities: improvementOpportunities
        .sort((a, b) => b.potentialImpact - a.potentialImpact)
        .slice(0, 10),
    }
  }

  /**
   * Generate evolution recommendations from patterns and hypotheses
   */
  private generateRecommendations(
    patterns: DetectedPattern[],
    hypotheses: ImprovementHypothesis[],
  ): EvolutionRequest[] {
    const recommendations: EvolutionRequest[] = []

    // Group hypotheses by type and impact
    const groupedHypotheses = new Map<string, ImprovementHypothesis[]>()
    hypotheses.forEach((h) => {
      const group = groupedHypotheses.get(h.type) || []
      group.push(h)
      groupedHypotheses.set(h.type, group)
    })

    // Create recommendations for high-impact improvements
    groupedHypotheses.forEach((hyps, type) => {
      // Sort by expected impact
      const sorted = hyps.sort((a, b) => {
        const impactA = a.expectedImpact.reduce(
          (sum, i) => sum + i.improvementPercentage,
          0,
        )
        const impactB = b.expectedImpact.reduce(
          (sum, i) => sum + i.improvementPercentage,
          0,
        )
        return impactB - impactA
      })

      // Take top hypothesis for each type
      const topHypothesis = sorted[0]
      if (topHypothesis && topHypothesis.confidence > 0.7) {
        const affectedFiles = this.identifyAffectedFiles(
          patterns,
          topHypothesis,
        )

        recommendations.push({
          id: `rec-${topHypothesis.id}`,
          type: type as any,
          targetFiles: affectedFiles,
          context: {
            projectPath: process.cwd(),
            language: "typescript",
            framework: "node",
            testCommand: "bun test",
            performanceCommand: "bun run benchmark",
          },
          constraints: {
            maxExecutionTime: 300000,
            preserveApi: true,
            maintainBackwardCompatibility: true,
            requireTests: true,
            minTestCoverage: 80,
          },
          metrics: {
            baseline: this.extractBaselineMetrics(patterns, topHypothesis),
            targets: this.extractTargetMetrics(topHypothesis),
          },
          customPrompt: this.generateEvolutionPrompt(topHypothesis, patterns),
          metadata: {
            hypothesisId: topHypothesis.id,
            patternCount: patterns.length,
            confidence: topHypothesis.confidence,
          },
        })
      }
    })

    return recommendations
  }

  /**
   * Identify files affected by a hypothesis
   */
  private identifyAffectedFiles(
    patterns: DetectedPattern[],
    hypothesis: ImprovementHypothesis,
  ): string[] {
    const files = new Set<string>()

    // Map tools to likely file locations
    const toolFileMap: Record<string, string[]> = {
      read: ["src/tools/read.ts"],
      write: ["src/tools/write.ts"],
      edit: ["src/tools/edit.ts"],
      bash: ["src/tools/bash.ts"],
      grep: ["src/tools/grep.ts"],
      glob: ["src/tools/glob.ts"],
      list: ["src/tools/list.ts"],
      task: ["src/tools/task.ts"],
      webfetch: ["src/tools/webfetch.ts"],
    }

    // Get files from hypothesis dependencies
    hypothesis.dependencies.forEach((dep) => {
      const mappedFiles = toolFileMap[dep]
      if (mappedFiles) {
        mappedFiles.forEach((f) => files.add(f))
      }
    })

    // Add files from related patterns
    patterns
      .filter((p) =>
        p.context.tools.some((t) => hypothesis.dependencies.includes(t)),
      )
      .forEach((p) => {
        p.context.tools.forEach((tool) => {
          const mappedFiles = toolFileMap[tool]
          if (mappedFiles) {
            mappedFiles.forEach((f) => files.add(f))
          }
        })
      })

    return Array.from(files)
  }

  /**
   * Extract baseline metrics from patterns
   */
  private extractBaselineMetrics(
    patterns: DetectedPattern[],
    hypothesis: ImprovementHypothesis,
  ): Record<string, number> {
    const metrics: Record<string, number> = {}

    // Get metrics from patterns related to this hypothesis
    const relatedPatterns = patterns.filter((p) =>
      p.context.tools.some((t) => hypothesis.dependencies.includes(t)),
    )

    if (relatedPatterns.length > 0) {
      const avgExecutionTime =
        relatedPatterns.reduce(
          (sum, p) => sum + p.context.averageExecutionTime,
          0,
        ) / relatedPatterns.length

      const avgMemoryUsage =
        relatedPatterns.reduce(
          (sum, p) => sum + p.context.resourceUsage.memory,
          0,
        ) / relatedPatterns.length

      const avgErrorRate =
        relatedPatterns.reduce((sum, p) => sum + p.context.errorRate, 0) /
        relatedPatterns.length

      metrics["execution_time"] = avgExecutionTime
      metrics["memory_usage"] = avgMemoryUsage
      metrics["error_rate"] = avgErrorRate * 100
    }

    return metrics
  }

  /**
   * Extract target metrics from hypothesis
   */
  private extractTargetMetrics(
    hypothesis: ImprovementHypothesis,
  ): Record<string, number> {
    const targets: Record<string, number> = {}

    hypothesis.expectedImpact.forEach((impact) => {
      targets[impact.metric] = impact.targetValue
    })

    return targets
  }

  /**
   * Generate evolution prompt from hypothesis and patterns
   */
  private generateEvolutionPrompt(
    hypothesis: ImprovementHypothesis,
    patterns: DetectedPattern[],
  ): string {
    const relatedPatterns = patterns.filter((p) =>
      p.context.tools.some((t) => hypothesis.dependencies.includes(t)),
    )

    let prompt = `Improve the following based on usage pattern analysis:\n\n`
    prompt += `Hypothesis: ${hypothesis.description}\n\n`
    prompt += `Expected Improvements:\n`

    hypothesis.expectedImpact.forEach((impact) => {
      prompt += `- ${impact.metric}: ${impact.currentValue} -> ${impact.targetValue} (${impact.improvementPercentage}% improvement)\n`
    })

    prompt += `\nDetected Patterns:\n`
    relatedPatterns.slice(0, 5).forEach((pattern) => {
      prompt += `- ${pattern.type}: ${pattern.improvementOpportunity.description}\n`
      prompt += `  Tools: ${pattern.context.tools.join(", ")}\n`
      prompt += `  Frequency: ${pattern.frequency} occurrences\n`
      prompt += `  Suggestion: ${pattern.improvementOpportunity.expectedBenefit}\n\n`
    })

    prompt += `\nConstraints:\n`
    prompt += `- Maintain backward compatibility\n`
    prompt += `- Preserve existing API contracts\n`
    prompt += `- Include comprehensive tests\n`
    prompt += `- Consider the risks: ${hypothesis.risks.join(", ")}\n`

    return prompt
  }

  /**
   * Monitor real-time patterns and trigger evolution when needed
   */
  async monitorAndEvolve(
    sessionId: string,
    threshold: {
      minPatternFrequency: number
      minConfidence: number
      minImpact: number
    },
  ): Promise<{
    triggered: boolean
    reason?: string
    recommendations?: EvolutionRequest[]
  }> {
    const analysis = await this.analyzeSession(sessionId)

    // Check if any patterns exceed thresholds
    const significantPatterns = analysis.patterns.filter(
      (p) =>
        p.frequency >= threshold.minPatternFrequency &&
        p.confidence >= threshold.minConfidence &&
        (p.impact.performanceImpact +
          p.impact.userExperienceImpact +
          p.impact.resourceImpact) /
          3 >=
          threshold.minImpact,
    )

    if (significantPatterns.length > 0) {
      const topPattern = significantPatterns[0]
      return {
        triggered: true,
        reason: `Detected ${significantPatterns.length} significant patterns. Top issue: ${topPattern.improvementOpportunity.description}`,
        recommendations: analysis.recommendations,
      }
    }

    return {
      triggered: false,
    }
  }
}
