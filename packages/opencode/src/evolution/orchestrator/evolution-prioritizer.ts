/**
 * Evolution Prioritizer
 * Scores and prioritizes improvement hypotheses based on impact, confidence, and risk
 */

import { Log } from "../../util/log"
import type { ImprovementHypothesis } from "../types"

const log = Log.create({ service: "evolution-prioritizer" })

/**
 * Priority configuration
 */
export interface PriorityConfig {
  weights?: {
    impact?: number
    confidence?: number
    safety?: number
    urgency?: number
  }
  typeMultipliers?: Record<string, number>
}

/**
 * Scored hypothesis
 */
export interface ScoredHypothesis {
  hypothesis: ImprovementHypothesis
  score: number
  breakdown: {
    impactScore: number
    confidenceScore: number
    safetyScore: number
    urgencyScore: number
    typeMultiplier: number
  }
}

/**
 * Default priority configuration
 */
const DEFAULT_CONFIG: Required<PriorityConfig> = {
  weights: {
    impact: 0.4, // 40% weight on expected improvement
    confidence: 0.3, // 30% weight on confidence level
    safety: 0.2, // 20% weight on safety (inverse of risk)
    urgency: 0.1, // 10% weight on urgency/type
  },
  typeMultipliers: {
    fix_bugs: 1.0,
    enhance_security: 0.9,
    improve_performance: 0.8,
    optimize_memory: 0.7,
    add_feature: 0.6,
    improve_readability: 0.5,
    refactor_code: 0.4,
    custom: 0.3,
  },
}

/**
 * Evolution Prioritizer
 */
export class EvolutionPrioritizer {
  private config: Required<PriorityConfig>

  constructor(config?: PriorityConfig) {
    this.config = {
      weights: { ...DEFAULT_CONFIG.weights, ...config?.weights },
      typeMultipliers: {
        ...DEFAULT_CONFIG.typeMultipliers,
        ...config?.typeMultipliers,
      },
    }
  }

  /**
   * Prioritize hypotheses based on scoring
   */
  prioritize(
    hypotheses: ImprovementHypothesis[],
    customPriorities?: Record<string, number>,
  ): ImprovementHypothesis[] {
    log.info(`Prioritizing ${hypotheses.length} hypotheses`)

    // Score all hypotheses
    const scored = hypotheses.map((h) =>
      this.scoreHypothesis(h, customPriorities),
    )

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score)

    // Log top hypotheses
    const top3 = scored.slice(0, 3)
    top3.forEach((s, i) => {
      log.info(`Priority ${i + 1}: ${s.hypothesis.description}`, {
        score: s.score.toFixed(2),
        breakdown: s.breakdown,
      })
    })

    // Return sorted hypotheses
    return scored.map((s) => s.hypothesis)
  }

  /**
   * Score a single hypothesis
   */
  private scoreHypothesis(
    hypothesis: ImprovementHypothesis,
    customPriorities?: Record<string, number>,
  ): ScoredHypothesis {
    // Calculate component scores
    const impactScore = this.calculateImpactScore(hypothesis)
    const confidenceScore = this.calculateConfidenceScore(hypothesis)
    const safetyScore = this.calculateSafetyScore(hypothesis)
    const urgencyScore = this.calculateUrgencyScore(hypothesis)

    // Get type multiplier
    const typeMultiplier =
      customPriorities?.[hypothesis.type] ||
      this.config.typeMultipliers[hypothesis.type] ||
      0.5

    // Calculate weighted score
    const baseScore =
      impactScore * (this.config.weights.impact || 0) +
      confidenceScore * (this.config.weights.confidence || 0) +
      safetyScore * (this.config.weights.safety || 0) +
      urgencyScore * (this.config.weights.urgency || 0)

    // Apply type multiplier
    const score = baseScore * typeMultiplier

    return {
      hypothesis,
      score,
      breakdown: {
        impactScore,
        confidenceScore,
        safetyScore,
        urgencyScore,
        typeMultiplier,
      },
    }
  }

  /**
   * Calculate impact score (0-1)
   */
  private calculateImpactScore(hypothesis: ImprovementHypothesis): number {
    if (hypothesis.expectedImpact.length === 0) {
      return 0
    }

    // Average improvement percentage across all metrics
    const totalImprovement = hypothesis.expectedImpact.reduce(
      (sum, impact) => sum + impact.improvementPercentage,
      0,
    )
    const avgImprovement = totalImprovement / hypothesis.expectedImpact.length

    // Normalize to 0-1 scale (cap at 100% improvement)
    return Math.min(avgImprovement / 100, 1)
  }

  /**
   * Calculate confidence score (0-1)
   */
  private calculateConfidenceScore(hypothesis: ImprovementHypothesis): number {
    // Confidence is already 0-1
    return hypothesis.confidence
  }

  /**
   * Calculate safety score (0-1)
   */
  private calculateSafetyScore(hypothesis: ImprovementHypothesis): number {
    // More risks = lower safety score
    const riskCount = hypothesis.risks.length

    if (riskCount === 0) {
      return 1.0
    } else if (riskCount === 1) {
      return 0.8
    } else if (riskCount === 2) {
      return 0.6
    } else if (riskCount === 3) {
      return 0.4
    } else {
      return 0.2
    }
  }

  /**
   * Calculate urgency score (0-1)
   */
  private calculateUrgencyScore(hypothesis: ImprovementHypothesis): number {
    // Type-based urgency
    const urgencyMap: Record<string, number> = {
      fix_bugs: 1.0,
      enhance_security: 0.9,
      improve_performance: 0.7,
      optimize_memory: 0.6,
      add_feature: 0.5,
      improve_readability: 0.3,
      refactor_code: 0.2,
      custom: 0.1,
    }

    return urgencyMap[hypothesis.type] || 0.5
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PriorityConfig>): void {
    if (config.weights) {
      this.config.weights = { ...this.config.weights, ...config.weights }
    }
    if (config.typeMultipliers) {
      this.config.typeMultipliers = {
        ...this.config.typeMultipliers,
        ...config.typeMultipliers,
      }
    }

    log.info("Prioritizer configuration updated", { config: this.config })
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<PriorityConfig> {
    return { ...this.config }
  }
}
