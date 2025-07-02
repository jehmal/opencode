/**
 * Evolution Engine Type Definitions
 * Bridges DGM's Python evolution system with TypeScript orchestration
 */

export interface EvolutionConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteSize: number;
  selectionMethod: 'score_prop' | 'score_child_prop' | 'tournament' | 'random';
  evaluationMethod: 'swe-bench' | 'polyglot' | 'custom';
  archiveStrategy: 'all' | 'best' | 'diverse';
  parallelEvaluations: number;
  timeout: number;
}

export type AgentStatus = 'pending' | 'running' | 'evaluating' | 'evaluated' | 'failed' | 'archived';

export interface Agent {
  id: string;
  commitId: string;
  parentCommitId?: string;
  generation: number;
  code?: string;
  metadata: AgentMetadata;
  fitness?: FitnessScore;
  status: AgentStatus;
  createdAt: Date;
  evaluatedAt?: Date;
}

export interface AgentMetadata {
  overall_performance: {
    accuracy_score: number;
    total_resolved_ids: string[];
    total_unresolved_ids: string[];
    total_emptypatch_ids: string[];
    total_submitted_instances: number;
  };
  parent_commit?: string;
  run_id: string;
  self_improve_entry?: any;
  children_count: number;
  created_at?: string;
  evaluated_at?: string;
}

export interface Mutation {
  type: 'self-improve' | 'crossover' | 'random' | 'directed';
  timestamp: Date;
  description: string;
  affectedFiles: string[];
  diagnostics?: any;
}

export interface FitnessScore {
  accuracy: number;
  resolvedCount: number;
  unresolvedCount: number;
  emptyPatchCount: number;
  executionTime?: number;
  memoryUsage?: number;
  contextLengthExceeded: boolean;
  compilationSuccess: boolean;
  testsPassed?: number;
  totalTests?: number;
  testResults?: TestResults;
}

export interface TestResults {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export interface Population {
  generation: number;
  agents: Agent[];
  archive: Agent[];
  statistics: PopulationStats;
}

export interface PopulationStats {
  averageFitness: number;
  bestFitness: number;
  worstFitness: number;
  diversityScore: number;
  convergenceRate: number;
}

export interface EvolutionEvent {
  type: 'generation-start' | 'generation-complete' | 'agent-evaluated' | 
        'mutation-applied' | 'selection-complete' | 'archive-updated';
  generation: number;
  timestamp: Date;
  data: any;
}

export interface EvaluationTask {
  agentId: string;
  commitId: string;
  evaluationType: 'swe-bench' | 'polyglot';
  instances: string[];
  timeout: number;
  priority: 'high' | 'normal' | 'low';
}

export interface SelectionCandidate {
  commitId: string;
  fitness: FitnessScore;
  childrenCount: number;
  selectionProbability?: number;
  adjustedScore?: number;
}

export interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIO: number;
}

export interface EvolutionTask {
  id: string;
  type: 'self_improve' | 'evaluation' | 'mutation';
  parentCommitId: string;
  entry: string | SelfImproveEntry;
  priority: number;
  generation: number;
  createdAt: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedTo?: string;
  result?: any;
}

export interface GenerationResult {
  generation: number;
  selfImproveEntries: Array<[string, any]>;
  children: string[];
  childrenCompiled: string[];
  archive: string[];
  timestamp: Date;
}

export enum EvolutionEventType {
  GENERATION_START = 'generation:start',
  GENERATION_COMPLETE = 'generation:complete',
  AGENT_CREATED = 'agent:created',
  AGENT_EVALUATED = 'agent:evaluated',
  MUTATION_APPLIED = 'mutation:applied',
  SELECTION_COMPLETE = 'selection:complete',
  ARCHIVE_UPDATED = 'archive:updated',
  CONVERGENCE_DETECTED = 'convergence:detected',
  ERROR = 'evolution:error'
}

export interface EvaluationResult {
  instanceId: string;
  status: 'resolved' | 'unresolved' | 'empty_patch' | 'error';
  error?: string;
  patch?: string;
  executionTime?: number;
}

export interface EvaluationMethod {
  name: 'swe-bench' | 'polyglot';
  config: SWEBenchConfig | PolyglotConfig;
}

export interface SWEBenchConfig {
  taskLists: {
    small: string[];
    medium: string[];
    large?: string[];
  };
  evaluationTimeout: number;
  dockerImage?: string;
}

export interface PolyglotConfig {
  languages: string[];
  taskSets: Record<string, string[]>;
  evaluationTimeout: number;
}

export interface Archive {
  agents: Agent[];
  currentGeneration: number;
  bestFitness: FitnessScore;
  metadata: ArchiveMetadata;
}

export interface ArchiveMetadata {
  startTime: Date;
  lastUpdateTime: Date;
  totalEvaluations: number;
  convergenceMetrics?: ConvergenceMetrics;
}

export interface ConvergenceMetrics {
  generationalImprovement: number[];
  diversityScore: number;
  stagnationCount: number;
}

export interface ParentSelectionResult {
  parentCommitId: string;
  selectionScore: number;
  selectionMethod: string;
  candidateScores?: Map<string, number>;
}

export type SelfImproveEntry = string | {
  type: 'solve_empty_patches' | 'solve_stochasticity' | 'solve_contextlength';
  instanceId?: string;
  details?: any;
};