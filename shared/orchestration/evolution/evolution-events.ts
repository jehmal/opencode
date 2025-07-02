/**
 * Evolution Event System
 * Provides typed event emitters for monitoring evolution progress
 */

import { EventEmitter } from 'events';
import { 
  Agent, 
  FitnessScore, 
  Population, 
  PopulationStats,
  EvolutionEventType,
  SelectionCandidate,
  ParentSelectionResult,
  EvaluationResult,
  GenerationResult,
  Mutation
} from './evolution-types';

// Event payload interfaces
export interface GenerationStartEvent {
  generation: number;
  populationSize: number;
  parentCommitIds: string[];
  timestamp: Date;
}

export interface AgentEvaluatedEvent {
  agentId: string;
  commitId: string;
  generation: number;
  fitness: FitnessScore;
  evaluationResults: EvaluationResult[];
  duration: number;
  timestamp: Date;
}

export interface SelectionCompleteEvent {
  generation: number;
  selectedParents: ParentSelectionResult[];
  candidatePool: SelectionCandidate[];
  selectionMethod: string;
  timestamp: Date;
}

export interface GenerationCompleteEvent {
  generation: number;
  result: GenerationResult;
  statistics: PopulationStats;
  bestAgent: Agent;
  archiveSize: number;
  duration: number;
  timestamp: Date;
}

export interface MutationAppliedEvent {
  agentId: string;
  mutation: Mutation;
  parentCommitId: string;
  generation: number;
  timestamp: Date;
}

export interface ArchiveUpdatedEvent {
  generation: number;
  newAgents: Agent[];
  archiveSize: number;
  bestFitness: FitnessScore;
  timestamp: Date;
}

export interface ConvergenceDetectedEvent {
  generation: number;
  stagnationCount: number;
  diversityScore: number;
  recommendation: 'continue' | 'stop' | 'adjust_parameters';
  timestamp: Date;
}

export interface EvolutionErrorEvent {
  generation: number;
  error: Error;
  context: string;
  agentId?: string;
  recoverable: boolean;
  timestamp: Date;
}

// Type-safe event map
export interface EvolutionEventMap {
  [EvolutionEventType.GENERATION_START]: GenerationStartEvent;
  [EvolutionEventType.AGENT_EVALUATED]: AgentEvaluatedEvent;
  [EvolutionEventType.SELECTION_COMPLETE]: SelectionCompleteEvent;
  [EvolutionEventType.GENERATION_COMPLETE]: GenerationCompleteEvent;
  [EvolutionEventType.MUTATION_APPLIED]: MutationAppliedEvent;
  [EvolutionEventType.ARCHIVE_UPDATED]: ArchiveUpdatedEvent;
  [EvolutionEventType.CONVERGENCE_DETECTED]: ConvergenceDetectedEvent;
  [EvolutionEventType.ERROR]: EvolutionErrorEvent;
}

// Type-safe event emitter
export class EvolutionEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Support multiple monitoring subscribers
  }

  // Type-safe emit methods
  emitGenerationStart(event: GenerationStartEvent): void {
    this.emit(EvolutionEventType.GENERATION_START, event);
  }

  emitAgentEvaluated(event: AgentEvaluatedEvent): void {
    this.emit(EvolutionEventType.AGENT_EVALUATED, event);
  }

  emitSelectionComplete(event: SelectionCompleteEvent): void {
    this.emit(EvolutionEventType.SELECTION_COMPLETE, event);
  }

  emitGenerationComplete(event: GenerationCompleteEvent): void {
    this.emit(EvolutionEventType.GENERATION_COMPLETE, event);
  }

  emitMutationApplied(event: MutationAppliedEvent): void {
    this.emit(EvolutionEventType.MUTATION_APPLIED, event);
  }

  emitArchiveUpdated(event: ArchiveUpdatedEvent): void {
    this.emit(EvolutionEventType.ARCHIVE_UPDATED, event);
  }

  emitConvergenceDetected(event: ConvergenceDetectedEvent): void {
    this.emit(EvolutionEventType.CONVERGENCE_DETECTED, event);
  }

  emitError(event: EvolutionErrorEvent): void {
    this.emit(EvolutionEventType.ERROR, event);
  }

  // Type-safe listener methods
  onGenerationStart(listener: (event: GenerationStartEvent) => void): this {
    return this.on(EvolutionEventType.GENERATION_START, listener);
  }

  onAgentEvaluated(listener: (event: AgentEvaluatedEvent) => void): this {
    return this.on(EvolutionEventType.AGENT_EVALUATED, listener);
  }

  onSelectionComplete(listener: (event: SelectionCompleteEvent) => void): this {
    return this.on(EvolutionEventType.SELECTION_COMPLETE, listener);
  }

  onGenerationComplete(listener: (event: GenerationCompleteEvent) => void): this {
    return this.on(EvolutionEventType.GENERATION_COMPLETE, listener);
  }

  onMutationApplied(listener: (event: MutationAppliedEvent) => void): this {
    return this.on(EvolutionEventType.MUTATION_APPLIED, listener);
  }

  onArchiveUpdated(listener: (event: ArchiveUpdatedEvent) => void): this {
    return this.on(EvolutionEventType.ARCHIVE_UPDATED, listener);
  }

  onConvergenceDetected(listener: (event: ConvergenceDetectedEvent) => void): this {
    return this.on(EvolutionEventType.CONVERGENCE_DETECTED, listener);
  }

  onError(listener: (event: EvolutionErrorEvent) => void): this {
    return this.on(EvolutionEventType.ERROR, listener);
  }

  // Remove specific listeners
  offGenerationStart(listener: (event: GenerationStartEvent) => void): this {
    return this.off(EvolutionEventType.GENERATION_START, listener);
  }

  offAgentEvaluated(listener: (event: AgentEvaluatedEvent) => void): this {
    return this.off(EvolutionEventType.AGENT_EVALUATED, listener);
  }

  offSelectionComplete(listener: (event: SelectionCompleteEvent) => void): this {
    return this.off(EvolutionEventType.SELECTION_COMPLETE, listener);
  }

  offGenerationComplete(listener: (event: GenerationCompleteEvent) => void): this {
    return this.off(EvolutionEventType.GENERATION_COMPLETE, listener);
  }

  offMutationApplied(listener: (event: MutationAppliedEvent) => void): this {
    return this.off(EvolutionEventType.MUTATION_APPLIED, listener);
  }

  offArchiveUpdated(listener: (event: ArchiveUpdatedEvent) => void): this {
    return this.off(EvolutionEventType.ARCHIVE_UPDATED, listener);
  }

  offConvergenceDetected(listener: (event: ConvergenceDetectedEvent) => void): this {
    return this.off(EvolutionEventType.CONVERGENCE_DETECTED, listener);
  }

  offError(listener: (event: EvolutionErrorEvent) => void): this {
    return this.off(EvolutionEventType.ERROR, listener);
  }
}

// Singleton instance for global event handling
export const evolutionEvents = new EvolutionEventEmitter();

// Event publishers for integration with monitoring systems
export class EvolutionEventPublisher {
  constructor(private emitter: EvolutionEventEmitter = evolutionEvents) {}

  publishGenerationStart(
    generation: number, 
    populationSize: number, 
    parentCommitIds: string[]
  ): void {
    this.emitter.emitGenerationStart({
      generation,
      populationSize,
      parentCommitIds,
      timestamp: new Date()
    });
  }

  publishAgentEvaluated(
    agentId: string,
    commitId: string,
    generation: number,
    fitness: FitnessScore,
    evaluationResults: EvaluationResult[],
    duration: number
  ): void {
    this.emitter.emitAgentEvaluated({
      agentId,
      commitId,
      generation,
      fitness,
      evaluationResults,
      duration,
      timestamp: new Date()
    });
  }

  publishSelectionComplete(
    generation: number,
    selectedParents: ParentSelectionResult[],
    candidatePool: SelectionCandidate[],
    selectionMethod: string
  ): void {
    this.emitter.emitSelectionComplete({
      generation,
      selectedParents,
      candidatePool,
      selectionMethod,
      timestamp: new Date()
    });
  }

  publishGenerationComplete(
    generation: number,
    result: GenerationResult,
    statistics: PopulationStats,
    bestAgent: Agent,
    archiveSize: number,
    duration: number
  ): void {
    this.emitter.emitGenerationComplete({
      generation,
      result,
      statistics,
      bestAgent,
      archiveSize,
      duration,
      timestamp: new Date()
    });
  }

  publishMutationApplied(
    agentId: string,
    mutation: Mutation,
    parentCommitId: string,
    generation: number
  ): void {
    this.emitter.emitMutationApplied({
      agentId,
      mutation,
      parentCommitId,
      generation,
      timestamp: new Date()
    });
  }

  publishArchiveUpdated(
    generation: number,
    newAgents: Agent[],
    archiveSize: number,
    bestFitness: FitnessScore
  ): void {
    this.emitter.emitArchiveUpdated({
      generation,
      newAgents,
      archiveSize,
      bestFitness,
      timestamp: new Date()
    });
  }

  publishConvergenceDetected(
    generation: number,
    stagnationCount: number,
    diversityScore: number,
    recommendation: 'continue' | 'stop' | 'adjust_parameters'
  ): void {
    this.emitter.emitConvergenceDetected({
      generation,
      stagnationCount,
      diversityScore,
      recommendation,
      timestamp: new Date()
    });
  }

  publishError(
    generation: number,
    error: Error,
    context: string,
    agentId?: string,
    recoverable: boolean = true
  ): void {
    this.emitter.emitError({
      generation,
      error,
      context,
      agentId,
      recoverable,
      timestamp: new Date()
    });
  }
}

// Monitoring integration subscriber
export class MonitoringSubscriber {
  constructor(
    private emitter: EvolutionEventEmitter = evolutionEvents,
    private monitoringAdapter?: any // Can be Prometheus, RabbitMQ, etc.
  ) {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    // Subscribe to all events for monitoring
    this.emitter.onGenerationStart(event => {
      console.log(`[Evolution] Generation ${event.generation} started with ${event.populationSize} agents`);
      this.forwardToMonitoring('generation.start', event);
    });

    this.emitter.onAgentEvaluated(event => {
      console.log(`[Evolution] Agent ${event.agentId} evaluated: fitness=${event.fitness.accuracy}`);
      this.forwardToMonitoring('agent.evaluated', event);
    });

    this.emitter.onSelectionComplete(event => {
      console.log(`[Evolution] Selection complete: ${event.selectedParents.length} parents selected`);
      this.forwardToMonitoring('selection.complete', event);
    });

    this.emitter.onGenerationComplete(event => {
      console.log(`[Evolution] Generation ${event.generation} complete in ${event.duration}ms`);
      this.forwardToMonitoring('generation.complete', event);
    });

    this.emitter.onMutationApplied(event => {
      console.log(`[Evolution] Mutation applied to agent ${event.agentId}: ${event.mutation.type}`);
      this.forwardToMonitoring('mutation.applied', event);
    });

    this.emitter.onArchiveUpdated(event => {
      console.log(`[Evolution] Archive updated: ${event.newAgents.length} new agents added`);
      this.forwardToMonitoring('archive.updated', event);
    });

    this.emitter.onConvergenceDetected(event => {
      console.log(`[Evolution] Convergence detected at generation ${event.generation}: ${event.recommendation}`);
      this.forwardToMonitoring('convergence.detected', event);
    });

    this.emitter.onError(event => {
      console.error(`[Evolution] Error at generation ${event.generation}: ${event.error.message}`);
      this.forwardToMonitoring('evolution.error', event);
    });
  }

  private forwardToMonitoring(eventType: string, data: any): void {
    if (this.monitoringAdapter) {
      this.monitoringAdapter.send(eventType, data);
    }
  }

  // Cleanup method
  dispose(): void {
    this.emitter.removeAllListeners();
  }
}

// Export default publisher instance
export const evolutionPublisher = new EvolutionEventPublisher();