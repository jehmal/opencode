/**
 * Evolution Engine Configuration
 * Default settings and configuration management for evolution cycles
 */

import { EvolutionConfig } from './evolution-types';

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  populationSize: 10,
  generations: 100,
  mutationRate: 0.1,
  crossoverRate: 0.7,
  eliteSize: 2,
  selectionMethod: 'score_prop',
  evaluationMethod: 'swe-bench',
  archiveStrategy: 'all',
  parallelEvaluations: 4,
  timeout: 3600000 // 1 hour in milliseconds
};

export class EvolutionConfigManager {
  private config: EvolutionConfig;
  
  constructor(customConfig?: Partial<EvolutionConfig>) {
    this.config = { ...DEFAULT_EVOLUTION_CONFIG, ...customConfig };
  }
  
  getConfig(): EvolutionConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<EvolutionConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (this.config.populationSize < 1) {
      errors.push('Population size must be at least 1');
    }
    
    if (this.config.generations < 1) {
      errors.push('Number of generations must be at least 1');
    }
    
    if (this.config.mutationRate < 0 || this.config.mutationRate > 1) {
      errors.push('Mutation rate must be between 0 and 1');
    }
    
    if (this.config.crossoverRate < 0 || this.config.crossoverRate > 1) {
      errors.push('Crossover rate must be between 0 and 1');
    }
    
    if (this.config.eliteSize < 0 || this.config.eliteSize > this.config.populationSize) {
      errors.push('Elite size must be between 0 and population size');
    }
    
    if (this.config.parallelEvaluations < 1) {
      errors.push('Parallel evaluations must be at least 1');
    }
    
    if (this.config.timeout < 60000) { // 1 minute minimum
      errors.push('Timeout must be at least 60 seconds');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get configuration for DGM compatibility
   */
  toDGMConfig(): Record<string, any> {
    return {
      selfimprove_size: this.config.populationSize,
      num_gens: this.config.generations,
      parent_select_method: this.config.selectionMethod,
      polyglot: this.config.evaluationMethod === 'polyglot',
      archive_strategy: this.config.archiveStrategy,
      parallel_eval: this.config.parallelEvaluations,
      timeout_seconds: Math.floor(this.config.timeout / 1000)
    };
  }
  
  /**
   * Create config from DGM parameters
   */
  static fromDGMConfig(dgmConfig: Record<string, any>): EvolutionConfig {
    return {
      populationSize: dgmConfig.selfimprove_size || DEFAULT_EVOLUTION_CONFIG.populationSize,
      generations: dgmConfig.num_gens || DEFAULT_EVOLUTION_CONFIG.generations,
      mutationRate: DEFAULT_EVOLUTION_CONFIG.mutationRate,
      crossoverRate: DEFAULT_EVOLUTION_CONFIG.crossoverRate,
      eliteSize: DEFAULT_EVOLUTION_CONFIG.eliteSize,
      selectionMethod: dgmConfig.parent_select_method || DEFAULT_EVOLUTION_CONFIG.selectionMethod,
      evaluationMethod: dgmConfig.polyglot ? 'polyglot' : 'swe-bench',
      archiveStrategy: dgmConfig.archive_strategy || DEFAULT_EVOLUTION_CONFIG.archiveStrategy,
      parallelEvaluations: dgmConfig.parallel_eval || DEFAULT_EVOLUTION_CONFIG.parallelEvaluations,
      timeout: (dgmConfig.timeout_seconds || 3600) * 1000
    };
  }
}