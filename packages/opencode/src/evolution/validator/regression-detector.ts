/**
 * Regression Detector for Performance Validation
 * Identifies performance degradations and other regressions
 */

import type {
  MetricsComparison,
  ValidationThresholds
} from './performance-validator';

export interface RegressionThresholds {
  performance: number; // Percentage threshold for performance regression
  memory: number; // Percentage threshold for memory regression
  errorRate: number; // Absolute threshold for error rate increase
}

export interface Regression {
  type: 'performance' | 'memory' | 'reliability' | 'variance';
  severity: 'low' | 'medium' | 'high';
  impact: number;
  confidence: number;
  description?: string;
}

export interface RegressionAnalysis {
  hasRegressions: boolean;
  regressions: Regression[];
  recommendation: string;
}

export class RegressionDetector {
  private thresholds: RegressionThresholds;
  
  constructor(thresholds?: Partial<ValidationThresholds>) {
    this.thresholds = {
      performance: thresholds?.performance || 5,
      memory: thresholds?.memory || 10,
      errorRate: thresholds?.errorRate || 0
    };
  }
  
  detectRegressions(
    comparison: MetricsComparison
  ): RegressionAnalysis {
    const regressions: Regression[] = [];
    
    // Performance regression
    if (comparison.performance.improvement < -this.thresholds.performance) {
      regressions.push({
        type: 'performance',
        severity: this.calculateSeverity(comparison.performance.improvement),
        impact: Math.abs(comparison.performance.improvement),
        confidence: comparison.performance.confidence,
        description: `Performance degraded by ${Math.abs(comparison.performance.improvement).toFixed(1)}%`
      });
    }
    
    // Memory regression
    if (comparison.memory.increase > this.thresholds.memory) {
      regressions.push({
        type: 'memory',
        severity: comparison.memory.leakDetected ? 'high' : 'medium',
        impact: comparison.memory.increase,
        confidence: comparison.memory.confidence,
        description: comparison.memory.leakDetected ? 
          'Memory leak detected' : 
          `Memory usage increased by ${comparison.memory.increase.toFixed(1)}%`
      });
    }
    
    // Reliability regression
    if (comparison.reliability.errorRateChange > this.thresholds.errorRate) {
      regressions.push({
        type: 'reliability',
        severity: 'high',
        impact: comparison.reliability.errorRateChange * 100,
        confidence: comparison.reliability.confidence,
        description: `Error rate increased by ${(comparison.reliability.errorRateChange * 100).toFixed(1)}%`
      });
    }
    
    // Check for new error types
    if (comparison.reliability.newErrorTypes.length > 0) {
      regressions.push({
        type: 'reliability',
        severity: 'medium',
        impact: comparison.reliability.newErrorTypes.length,
        confidence: 1,
        description: `New error types introduced: ${comparison.reliability.newErrorTypes.join(', ')}`
      });
    }
    
    // Variance regression (performance became less predictable)
    if (this.hasIncreasedVariance(comparison)) {
      regressions.push({
        type: 'variance',
        severity: 'low',
        impact: 20, // Estimated impact
        confidence: 0.8,
        description: 'Performance became less predictable'
      });
    }
    
    return {
      hasRegressions: regressions.length > 0,
      regressions,
      recommendation: this.generateRecommendation(regressions)
    };
  }
  
  private calculateSeverity(improvement: number): 'low' | 'medium' | 'high' {
    const degradation = Math.abs(improvement);
    
    if (degradation > 20) return 'high';
    if (degradation > 10) return 'medium';
    return 'low';
  }
  
  private hasIncreasedVariance(comparison: MetricsComparison): boolean {
    // This is a simplified check - in a real implementation,
    // we would compare the coefficient of variation between baseline and evolved
    return comparison.overall.confidence < 0.5;
  }
  
  private generateRecommendation(regressions: Regression[]): string {
    if (regressions.length === 0) {
      return 'No regressions detected. Evolution is safe to apply.';
    }
    
    const highSeverity = regressions.filter(r => r.severity === 'high');
    const mediumSeverity = regressions.filter(r => r.severity === 'medium');
    
    if (highSeverity.length > 0) {
      return 'Critical regressions detected. DO NOT apply this evolution without fixes.';
    }
    
    if (mediumSeverity.length > 0) {
      return 'Moderate regressions detected. Review and consider fixes before applying.';
    }
    
    return 'Minor regressions detected. Monitor closely after deployment.';
  }
  
  /**
   * Analyze regression trends over multiple evolutions
   */
  analyzeRegressionTrends(history: RegressionAnalysis[]): {
    commonTypes: string[];
    averageSeverity: number;
    improvementRate: number;
  } {
    if (history.length === 0) {
      return {
        commonTypes: [],
        averageSeverity: 0,
        improvementRate: 0
      };
    }
    
    // Count regression types
    const typeCounts = new Map<string, number>();
    let totalSeverity = 0;
    let totalRegressions = 0;
    
    history.forEach(analysis => {
      analysis.regressions.forEach(regression => {
        const count = typeCounts.get(regression.type) || 0;
        typeCounts.set(regression.type, count + 1);
        
        totalSeverity += regression.severity === 'high' ? 3 : 
                        regression.severity === 'medium' ? 2 : 1;
        totalRegressions++;
      });
    });
    
    // Find most common types
    const commonTypes = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);
    
    // Calculate improvement rate (evolutions without regressions)
    const successfulEvolutions = history.filter(a => !a.hasRegressions).length;
    const improvementRate = (successfulEvolutions / history.length) * 100;
    
    return {
      commonTypes,
      averageSeverity: totalRegressions > 0 ? totalSeverity / totalRegressions : 0,
      improvementRate
    };
  }
}
