/**
 * Validation Report Generator
 * Creates detailed reports with visualizations for evolution validation
 */

import type { EvolutionResult } from '../types';
import type {
  ValidationReport,
  MetricsComparison,
  ValidationDecision,
  PerformanceDetails,
  MemoryDetails,
  ReliabilityDetails,
  Visualizations
} from './performance-validator';

export class ValidationReportGenerator {
  generateReport(
    evolution: EvolutionResult,
    comparison: MetricsComparison,
    decision: ValidationDecision
  ): ValidationReport {
    const report: ValidationReport = {
      id: `validation-${evolution.id}`,
      timestamp: Date.now(),
      evolution: {
        id: evolution.id,
        type: evolution.hypothesis.type,
        description: evolution.hypothesis.description
      },
      summary: this.generateSummary(comparison, decision),
      details: {
        performance: this.formatPerformanceDetails(comparison.performance),
        memory: this.formatMemoryDetails(comparison.memory),
        reliability: this.formatReliabilityDetails(comparison.reliability)
      },
      recommendations: this.generateRecommendations(comparison, decision),
      visualizations: this.generateVisualizations(comparison)
    };
    
    return report;
  }
  
  private generateSummary(comparison: MetricsComparison, decision: ValidationDecision): string {
    const perf = comparison.performance;
    
    if (decision.approved) {
      if (perf.improvement > 10 && perf.significant) {
        return `✅ Significant performance improvement: ${perf.improvement.toFixed(1)}% faster`;
      } else {
        return `✅ Evolution approved with ${perf.improvement.toFixed(1)}% improvement`;
      }
    } else {
      if (perf.improvement < -5 && perf.significant) {
        return `❌ Performance regression: ${Math.abs(perf.improvement).toFixed(1)}% slower`;
      } else if (decision.failures.length > 0) {
        return `❌ Evolution rejected: ${decision.failures[0].message}`;
      } else {
        return `❌ Evolution rejected: Insufficient improvement`;
      }
    }
  }
  
  private formatPerformanceDetails(performance: any): PerformanceDetails {
    return {
      improvementPercentage: performance.improvement,
      absoluteImprovement: performance.evolvedOps - performance.baselineOps,
      statisticalSignificance: performance.pValue < 0.001 ? 'Very High' :
                              performance.pValue < 0.01 ? 'High' :
                              performance.pValue < 0.05 ? 'Moderate' : 'Low',
      performanceChart: this.createPerformanceChart(performance)
    };
  }
  
  private formatMemoryDetails(memory: any): MemoryDetails {
    return {
      changePercentage: memory.increase,
      absoluteChange: memory.evolvedMemory - memory.baselineMemory,
      leakAnalysis: memory.leakDetected ? 
        'Memory leak detected - memory usage increases over time' :
        'No memory leaks detected',
      memoryChart: this.createMemoryChart(memory)
    };
  }
  
  private formatReliabilityDetails(reliability: any): ReliabilityDetails {
    return {
      errorRateChange: reliability.errorRateChange,
      newErrors: reliability.newErrorTypes,
      stabilityScore: 100 - (reliability.evolvedErrorRate * 100),
      reliabilityChart: this.createReliabilityChart(reliability)
    };
  }
  
  private generateRecommendations(
    comparison: MetricsComparison,
    decision: ValidationDecision
  ): string[] {
    const recommendations: string[] = [];
    
    // Performance recommendations
    if (comparison.performance.improvement < 5) {
      recommendations.push('Consider more aggressive optimizations to achieve meaningful performance gains');
    }
    
    // Memory recommendations
    if (comparison.memory.leakDetected) {
      recommendations.push('Fix memory leak before deployment - check for unreleased resources');
    } else if (comparison.memory.increase > 5) {
      recommendations.push('Monitor memory usage in production - increase detected');
    }
    
    // Reliability recommendations
    if (comparison.reliability.errorRateChange > 0) {
      recommendations.push('Address new errors introduced by evolution');
    }
    
    // Decision-based recommendations
    if (!decision.approved) {
      decision.failures.forEach(failure => {
        if (failure.severity === 'high') {
          recommendations.push(`Critical: ${failure.message}`);
        }
      });
    }
    
    // Confidence recommendations
    if (comparison.overall.confidence < 0.7) {
      recommendations.push('Run more benchmark iterations to increase confidence');
    }
    
    return recommendations;
  }
  
  private generateVisualizations(comparison: MetricsComparison): Visualizations {
    return {
      performanceChart: this.createPerformanceChart(comparison.performance),
      memoryChart: this.createMemoryChart(comparison.memory),
      distributionPlot: this.createDistributionPlot(comparison),
      comparisonTable: this.createComparisonTable(comparison)
    };
  }
  
  private createPerformanceChart(performance: any): string {
    // ASCII chart showing before/after performance
    const baseline = performance.baselineOps;
    const evolved = performance.evolvedOps;
    const maxOps = Math.max(baseline, evolved);
    
    const baselineBar = '█'.repeat(Math.round((baseline / maxOps) * 50));
    const evolvedBar = '█'.repeat(Math.round((evolved / maxOps) * 50));
    
    return `
Performance Comparison (ops/sec):
Baseline: ${baselineBar} ${baseline.toFixed(0)}
Evolved:  ${evolvedBar} ${evolved.toFixed(0)}
${performance.improvement > 0 ? '↑' : '↓'} ${Math.abs(performance.improvement).toFixed(1)}%
    `.trim();
  }
  
  private createMemoryChart(memory: any): string {
    const baseline = memory.baselineMemory / 1024 / 1024; // Convert to MB
    const evolved = memory.evolvedMemory / 1024 / 1024;
    const maxMem = Math.max(baseline, evolved);
    
    const baselineBar = '▓'.repeat(Math.round((baseline / maxMem) * 40));
    const evolvedBar = '▓'.repeat(Math.round((evolved / maxMem) * 40));
    
    return `
Memory Usage (MB):
Baseline: ${baselineBar} ${baseline.toFixed(1)}
Evolved:  ${evolvedBar} ${evolved.toFixed(1)}
${memory.increase > 0 ? '↑' : '↓'} ${Math.abs(memory.increase).toFixed(1)}%
${memory.leakDetected ? '⚠️  Memory leak detected!' : ''}
    `.trim();
  }
  
  private createReliabilityChart(reliability: any): string {
    const baselineSuccess = 100 - (reliability.baselineErrorRate * 100);
    const evolvedSuccess = 100 - (reliability.evolvedErrorRate * 100);
    
    return `
Reliability (Success Rate %):
Baseline: ${'●'.repeat(Math.round(baselineSuccess / 2))} ${baselineSuccess.toFixed(1)}%
Evolved:  ${'●'.repeat(Math.round(evolvedSuccess / 2))} ${evolvedSuccess.toFixed(1)}%
${reliability.newErrorTypes.length > 0 ? `New error types: ${reliability.newErrorTypes.join(', ')}` : ''}
    `.trim();
  }
  
  private createDistributionPlot(comparison: MetricsComparison): string {
    // Simple histogram showing performance distribution
    const improvement = comparison.performance.improvement;
    const confidence = comparison.performance.confidence * 100;
    
    return `
Performance Distribution:
  -20% -10%  0%  +10% +20% +30%
    |    |    |    |    |    |
    ${this.plotPoint(improvement)}
    
Confidence: ${'■'.repeat(Math.round(confidence / 10))} ${confidence.toFixed(0)}%
Statistical Significance: ${comparison.performance.significant ? 'YES (p < 0.05)' : 'NO'}
    `.trim();
  }
  
  private plotPoint(value: number): string {
    const position = Math.round((value + 20) / 50 * 30); // Map -20 to +30 onto 30 chars
    const bounded = Math.max(0, Math.min(29, position));
    return ' '.repeat(bounded) + '▲';
  }
  
  private createComparisonTable(comparison: MetricsComparison): string {
    return `
╔═══════════════════╦════════════╦════════════╦═══════════╗
║ Metric            ║ Baseline   ║ Evolved    ║ Change    ║
╠═══════════════════╬════════════╬════════════╬═══════════╣
║ Performance       ║ ${this.pad(comparison.performance.baselineOps.toFixed(0), 10)} ║ ${this.pad(comparison.performance.evolvedOps.toFixed(0), 10)} ║ ${this.pad(comparison.performance.improvement.toFixed(1) + '%', 9)} ║
║ Memory (MB)       ║ ${this.pad((comparison.memory.baselineMemory / 1024 / 1024).toFixed(1), 10)} ║ ${this.pad((comparison.memory.evolvedMemory / 1024 / 1024).toFixed(1), 10)} ║ ${this.pad(comparison.memory.increase.toFixed(1) + '%', 9)} ║
║ Error Rate        ║ ${this.pad((comparison.reliability.baselineErrorRate * 100).toFixed(1) + '%', 10)} ║ ${this.pad((comparison.reliability.evolvedErrorRate * 100).toFixed(1) + '%', 10)} ║ ${this.pad(comparison.reliability.errorRateChange.toFixed(1) + '%', 9)} ║
╚═══════════════════╩════════════╩════════════╩═══════════╝
    `.trim();
  }
  
  private pad(str: string, length: number): string {
    return str.padEnd(length);
  }
}
