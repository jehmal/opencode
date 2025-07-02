/**
 * Evolution Metrics Module
 * Prometheus metrics for tracking genetic algorithm evolution progress
 */

import { Registry, Counter, Gauge, Histogram, Summary } from 'prom-client';
import {
  EvolutionEventEmitter,
  GenerationStartEvent,
  AgentEvaluatedEvent,
  SelectionCompleteEvent,
  GenerationCompleteEvent,
  MutationAppliedEvent,
  ArchiveUpdatedEvent,
  ConvergenceDetectedEvent,
  EvolutionErrorEvent,
  evolutionEvents
} from './evolution-events';

export class EvolutionMetrics {
  private registry: Registry;
  
  // Generation metrics
  private generationCounter: Counter;
  private generationDuration: Histogram;
  private currentGeneration: Gauge;
  
  // Agent metrics
  private agentEvaluationCounter: Counter;
  private agentEvaluationDuration: Histogram;
  private agentFitnessScore: Summary;
  private activeAgents: Gauge;
  
  // Fitness metrics
  private bestFitness: Gauge;
  private averageFitness: Gauge;
  private worstFitness: Gauge;
  private fitnessImprovement: Gauge;
  private fitnessStagnation: Counter;
  
  // Population metrics
  private populationSize: Gauge;
  private populationDiversity: Gauge;
  private archiveSize: Gauge;
  
  // Mutation metrics
  private mutationCounter: Counter;
  private mutationSuccessRate: Gauge;
  
  // Selection metrics
  private selectionCounter: Counter;
  private selectionDuration: Histogram;
  private parentSelectionDistribution: Histogram;
  
  // Success rate metrics
  private resolvedInstancesTotal: Counter;
  private unresolvedInstancesTotal: Counter;
  private emptyPatchesTotal: Counter;
  private evaluationSuccessRate: Gauge;
  
  // Convergence metrics
  private convergenceCounter: Counter;
  private stagnationCount: Gauge;
  private diversityScore: Gauge;
  
  // Error metrics
  private errorCounter: Counter;
  private errorRate: Gauge;
  
  // Resource metrics
  private cpuUsage: Gauge;
  private memoryUsage: Gauge;
  private evaluationQueueSize: Gauge;

  constructor(
    registry?: Registry,
    private eventEmitter: EvolutionEventEmitter = evolutionEvents
  ) {
    this.registry = registry || new Registry();
    this.initializeMetrics();
    this.subscribeToEvents();
  }

  private initializeMetrics(): void {
    // Generation metrics
    this.generationCounter = new Counter({
      name: 'evolution_generations_total',
      help: 'Total number of generations completed',
      registers: [this.registry]
    });

    this.generationDuration = new Histogram({
      name: 'evolution_generation_duration_seconds',
      help: 'Duration of each generation in seconds',
      buckets: [10, 30, 60, 120, 300, 600, 1200, 3600],
      registers: [this.registry]
    });

    this.currentGeneration = new Gauge({
      name: 'evolution_current_generation',
      help: 'Current generation number',
      registers: [this.registry]
    });

    // Agent metrics
    this.agentEvaluationCounter = new Counter({
      name: 'evolution_agent_evaluations_total',
      help: 'Total number of agent evaluations',
      labelNames: ['status', 'generation'],
      registers: [this.registry]
    });

    this.agentEvaluationDuration = new Histogram({
      name: 'evolution_agent_evaluation_duration_seconds',
      help: 'Duration of agent evaluations',
      buckets: [1, 5, 10, 30, 60, 120, 300],
      registers: [this.registry]
    });

    this.agentFitnessScore = new Summary({
      name: 'evolution_agent_fitness_score',
      help: 'Agent fitness scores',
      percentiles: [0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99],
      maxAgeSeconds: 600,
      ageBuckets: 5,
      registers: [this.registry]
    });

    this.activeAgents = new Gauge({
      name: 'evolution_active_agents',
      help: 'Number of active agents in current generation',
      registers: [this.registry]
    });

    // Fitness metrics
    this.bestFitness = new Gauge({
      name: 'evolution_best_fitness',
      help: 'Best fitness score in current generation',
      registers: [this.registry]
    });

    this.averageFitness = new Gauge({
      name: 'evolution_average_fitness',
      help: 'Average fitness score in current generation',
      registers: [this.registry]
    });

    this.worstFitness = new Gauge({
      name: 'evolution_worst_fitness',
      help: 'Worst fitness score in current generation',
      registers: [this.registry]
    });

    this.fitnessImprovement = new Gauge({
      name: 'evolution_fitness_improvement_rate',
      help: 'Rate of fitness improvement between generations',
      registers: [this.registry]
    });

    this.fitnessStagnation = new Counter({
      name: 'evolution_fitness_stagnation_total',
      help: 'Number of generations without fitness improvement',
      registers: [this.registry]
    });

    // Population metrics
    this.populationSize = new Gauge({
      name: 'evolution_population_size',
      help: 'Current population size',
      registers: [this.registry]
    });

    this.populationDiversity = new Gauge({
      name: 'evolution_population_diversity',
      help: 'Population diversity score',
      registers: [this.registry]
    });

    this.archiveSize = new Gauge({
      name: 'evolution_archive_size',
      help: 'Number of agents in archive',
      registers: [this.registry]
    });

    // Mutation metrics
    this.mutationCounter = new Counter({
      name: 'evolution_mutations_total',
      help: 'Total number of mutations applied',
      labelNames: ['type'],
      registers: [this.registry]
    });

    this.mutationSuccessRate = new Gauge({
      name: 'evolution_mutation_success_rate',
      help: 'Success rate of mutations',
      labelNames: ['type'],
      registers: [this.registry]
    });

    // Selection metrics
    this.selectionCounter = new Counter({
      name: 'evolution_selections_total',
      help: 'Total number of parent selections',
      labelNames: ['method'],
      registers: [this.registry]
    });

    this.selectionDuration = new Histogram({
      name: 'evolution_selection_duration_seconds',
      help: 'Duration of selection process',
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    });

    this.parentSelectionDistribution = new Histogram({
      name: 'evolution_parent_selection_score',
      help: 'Distribution of parent selection scores',
      buckets: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
      registers: [this.registry]
    });

    // Success rate metrics
    this.resolvedInstancesTotal = new Counter({
      name: 'evolution_resolved_instances_total',
      help: 'Total number of resolved instances',
      registers: [this.registry]
    });

    this.unresolvedInstancesTotal = new Counter({
      name: 'evolution_unresolved_instances_total',
      help: 'Total number of unresolved instances',
      registers: [this.registry]
    });

    this.emptyPatchesTotal = new Counter({
      name: 'evolution_empty_patches_total',
      help: 'Total number of empty patches',
      registers: [this.registry]
    });

    this.evaluationSuccessRate = new Gauge({
      name: 'evolution_evaluation_success_rate',
      help: 'Success rate of evaluations',
      registers: [this.registry]
    });

    // Convergence metrics
    this.convergenceCounter = new Counter({
      name: 'evolution_convergence_detections_total',
      help: 'Total number of convergence detections',
      labelNames: ['recommendation'],
      registers: [this.registry]
    });

    this.stagnationCount = new Gauge({
      name: 'evolution_stagnation_count',
      help: 'Number of generations without improvement',
      registers: [this.registry]
    });

    this.diversityScore = new Gauge({
      name: 'evolution_diversity_score',
      help: 'Current population diversity score',
      registers: [this.registry]
    });

    // Error metrics
    this.errorCounter = new Counter({
      name: 'evolution_errors_total',
      help: 'Total number of errors',
      labelNames: ['context', 'recoverable'],
      registers: [this.registry]
    });

    this.errorRate = new Gauge({
      name: 'evolution_error_rate',
      help: 'Error rate per generation',
      registers: [this.registry]
    });

    // Resource metrics
    this.cpuUsage = new Gauge({
      name: 'evolution_cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [this.registry]
    });

    this.memoryUsage = new Gauge({
      name: 'evolution_memory_usage_bytes',
      help: 'Memory usage in bytes',
      registers: [this.registry]
    });

    this.evaluationQueueSize = new Gauge({
      name: 'evolution_evaluation_queue_size',
      help: 'Number of agents waiting for evaluation',
      registers: [this.registry]
    });
  }

  private subscribeToEvents(): void {
    // Generation events
    this.eventEmitter.onGenerationStart((event: GenerationStartEvent) => {
      this.currentGeneration.set(event.generation);
      this.populationSize.set(event.populationSize);
      this.activeAgents.set(event.populationSize);
    });

    this.eventEmitter.onGenerationComplete((event: GenerationCompleteEvent) => {
      this.generationCounter.inc();
      this.generationDuration.observe(event.duration / 1000); // Convert to seconds
      
      // Update fitness metrics
      this.bestFitness.set(event.statistics.bestFitness);
      this.averageFitness.set(event.statistics.averageFitness);
      this.worstFitness.set(event.statistics.worstFitness);
      this.populationDiversity.set(event.statistics.diversityScore);
      
      // Calculate fitness improvement
      const improvement = event.statistics.convergenceRate;
      this.fitnessImprovement.set(improvement);
      
      if (improvement <= 0) {
        this.fitnessStagnation.inc();
      }
      
      this.archiveSize.set(event.archiveSize);
    });

    // Agent evaluation events
    this.eventEmitter.onAgentEvaluated((event: AgentEvaluatedEvent) => {
      const status = event.fitness.compilationSuccess ? 'success' : 'failure';
      this.agentEvaluationCounter.labels(status, event.generation.toString()).inc();
      this.agentEvaluationDuration.observe(event.duration / 1000);
      this.agentFitnessScore.observe(event.fitness.accuracy);
      
      // Update success metrics
      this.resolvedInstancesTotal.inc(event.fitness.resolvedCount);
      this.unresolvedInstancesTotal.inc(event.fitness.unresolvedCount);
      this.emptyPatchesTotal.inc(event.fitness.emptyPatchCount);
      
      // Calculate success rate
      const total = event.fitness.resolvedCount + event.fitness.unresolvedCount + event.fitness.emptyPatchCount;
      if (total > 0) {
        const successRate = event.fitness.resolvedCount / total;
        this.evaluationSuccessRate.set(successRate);
      }
    });

    // Selection events
    this.eventEmitter.onSelectionComplete((event: SelectionCompleteEvent) => {
      this.selectionCounter.labels(event.selectionMethod).inc();
      
      // Track selection score distribution
      event.selectedParents.forEach(parent => {
        this.parentSelectionDistribution.observe(parent.selectionScore);
      });
    });

    // Mutation events
    this.eventEmitter.onMutationApplied((event: MutationAppliedEvent) => {
      this.mutationCounter.labels(event.mutation.type).inc();
    });

    // Archive events
    this.eventEmitter.onArchiveUpdated((event: ArchiveUpdatedEvent) => {
      this.archiveSize.set(event.archiveSize);
    });

    // Convergence events
    this.eventEmitter.onConvergenceDetected((event: ConvergenceDetectedEvent) => {
      this.convergenceCounter.labels(event.recommendation).inc();
      this.stagnationCount.set(event.stagnationCount);
      this.diversityScore.set(event.diversityScore);
    });

    // Error events
    this.eventEmitter.onError((event: EvolutionErrorEvent) => {
      this.errorCounter.labels(event.context, event.recoverable.toString()).inc();
    });
  }

  // Public methods for manual metric updates
  public updateResourceMetrics(cpu: number, memory: number, queueSize: number): void {
    this.cpuUsage.set(cpu);
    this.memoryUsage.set(memory);
    this.evaluationQueueSize.set(queueSize);
  }

  public updateMutationSuccessRate(type: string, rate: number): void {
    this.mutationSuccessRate.labels(type).set(rate);
  }

  public updateErrorRate(rate: number): void {
    this.errorRate.set(rate);
  }

  // Get all metrics for export
  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // Get specific metric values
  public getMetricValues(): {
    currentGeneration: number;
    bestFitness: number;
    averageFitness: number;
    populationSize: number;
    archiveSize: number;
    stagnationCount: number;
  } {
    return {
      currentGeneration: this.currentGeneration.get().values[0]?.value || 0,
      bestFitness: this.bestFitness.get().values[0]?.value || 0,
      averageFitness: this.averageFitness.get().values[0]?.value || 0,
      populationSize: this.populationSize.get().values[0]?.value || 0,
      archiveSize: this.archiveSize.get().values[0]?.value || 0,
      stagnationCount: this.stagnationCount.get().values[0]?.value || 0
    };
  }

  // Reset all metrics
  public reset(): void {
    this.registry.resetMetrics();
  }

  // Get registry for external use
  public getRegistry(): Registry {
    return this.registry;
  }
}

// Export singleton instance
export const evolutionMetrics = new EvolutionMetrics();