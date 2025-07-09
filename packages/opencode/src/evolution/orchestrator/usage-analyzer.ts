/**
 * Usage Analyzer wrapper for the Evolution Orchestrator
 * Provides a simplified interface to pattern detection and hypothesis generation
 */

import { PatternEvolutionIntegration } from "../pattern-integration"
import type { DetectedPattern } from "../patterns/pattern-recognition"
import type { ImprovementHypothesis } from "../types"

/**
 * Usage Analyzer for Evolution Orchestrator
 */
export class UsageAnalyzer {
  private integration = new PatternEvolutionIntegration()

  /**
   * Detect patterns from current session
   */
  async detectPatterns(sessionId?: string): Promise<DetectedPattern[]> {
    // If no session ID provided, analyze aggregated patterns
    if (!sessionId) {
      const aggregated = await this.integration.getAggregatedPatterns()
      return aggregated.topPatterns
    }

    // Analyze specific session
    const analysis = await this.integration.analyzeSession(sessionId)
    return analysis.patterns
  }

  /**
   * Generate hypotheses from detected patterns
   */
  async generateHypotheses(
    patterns: DetectedPattern[],
  ): Promise<ImprovementHypothesis[]> {
    // The pattern integration already generates hypotheses
    // We'll extract them from the stored data
    const hypotheses: ImprovementHypothesis[] = []

    // Get hypotheses related to these patterns
    const analysis = await this.integration.getAggregatedPatterns()
    for (const opportunity of analysis.improvementOpportunities) {
      hypotheses.push(...opportunity.relatedHypotheses)
    }

    // Remove duplicates based on ID
    const uniqueHypotheses = new Map<string, ImprovementHypothesis>()
    for (const hypothesis of hypotheses) {
      uniqueHypotheses.set(hypothesis.id, hypothesis)
    }

    return Array.from(uniqueHypotheses.values())
  }

  /**
   * Monitor patterns and trigger evolution when thresholds are met
   */
  async monitorAndEvolve(
    sessionId: string,
    config: {
      minPatternFrequency?: number
      minConfidence?: number
      minImpact?: number
    } = {},
  ): Promise<{
    triggered: boolean
    patterns: DetectedPattern[]
    recommendations: any[]
  }> {
    // Set default values for the config
    const threshold = {
      minPatternFrequency: config.minPatternFrequency || 5,
      minConfidence: config.minConfidence || 0.7,
      minImpact: config.minImpact || 0.3,
    }

    const result = await this.integration.monitorAndEvolve(sessionId, threshold)

    // Get patterns for the response
    const patterns = await this.detectPatterns(sessionId)

    return {
      triggered: result.triggered,
      patterns,
      recommendations: result.recommendations || [],
    }
  }
}
