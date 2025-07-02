/**
 * Archive Manager
 * Manages the evolution archive, tracking all agents and their performance
 */

import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  Agent, 
  Archive, 
  ArchiveMetadata, 
  FitnessScore, 
  ConvergenceMetrics,
  EvolutionEventType,
  AgentMetadata
} from './evolution-types';

export class ArchiveManager extends EventEmitter {
  private archive: Map<string, Agent> = new Map();
  private currentGeneration: number = 0;
  private metadata: ArchiveMetadata;
  private redis?: Redis;
  private outputDir: string;

  constructor(
    outputDir: string,
    redisUrl?: string
  ) {
    super();
    this.outputDir = outputDir;
    
    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    }

    this.metadata = {
      startTime: new Date(),
      lastUpdateTime: new Date(),
      totalEvaluations: 0,
      convergenceMetrics: {
        generationalImprovement: [],
        diversityScore: 1.0,
        stagnationCount: 0,
      },
    };
  }

  async initialize(previousRunDir?: string): Promise<void> {
    // Create output directory
    await fs.mkdir(this.outputDir, { recursive: true });

    if (previousRunDir) {
      // Load previous run's archive
      await this.loadPreviousRun(previousRunDir);
    } else {
      // Initialize with 'initial' agent
      await this.addInitialAgent();
    }

    this.emit(EvolutionEventType.ARCHIVE_UPDATED, this.getArchiveState());
  }

  private async loadPreviousRun(previousRunDir: string): Promise<void> {
    try {
      const metadataPath = path.join(previousRunDir, 'dgm_metadata.jsonl');
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const lines = metadataContent.trim().split('\n');
      
      // Get the last generation's metadata
      const lastGeneration = JSON.parse(lines[lines.length - 1]);
      this.currentGeneration = lastGeneration.generation + 1;
      
      // Load all agents from the archive
      for (const commitId of lastGeneration.archive) {
        await this.loadAgent(previousRunDir, commitId);
      }
    } catch (error) {
      throw new Error(`Failed to load previous run: ${error}`);
    }
  }

  private async loadAgent(baseDir: string, commitId: string): Promise<void> {
    try {
      const metadataPath = path.join(baseDir, commitId, 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      
      const agent: Agent = {
        id: commitId,
        commitId: commitId,
        parentCommitId: metadata.parent_commit,
        generation: metadata.generation || 0,
        fitness: this.extractFitnessScore(metadata),
        metadata: metadata,
        status: 'archived',
        createdAt: new Date(metadata.created_at || Date.now()),
        evaluatedAt: new Date(metadata.evaluated_at || Date.now()),
      };
      
      this.archive.set(commitId, agent);
      await this.storeInRedis(agent);
    } catch (error) {
      console.error(`Failed to load agent ${commitId}:`, error);
    }
  }

  private async addInitialAgent(): Promise<void> {
    const initialAgent: Agent = {
      id: 'initial',
      commitId: 'initial',
      generation: 0,
      status: 'archived',
      createdAt: new Date(),
      metadata: {
        overall_performance: {
          accuracy_score: 0,
          total_resolved_ids: [],
          total_unresolved_ids: [],
          total_emptypatch_ids: [],
          total_submitted_instances: 0,
        },
        run_id: 'initial',
        children_count: 0,
      },
    };

    // Check if initial evaluation exists
    const initialPath = path.join(this.outputDir, 'initial');
    try {
      await fs.access(initialPath);
      const metadata = JSON.parse(
        await fs.readFile(path.join(initialPath, 'metadata.json'), 'utf-8')
      );
      initialAgent.metadata = metadata;
      initialAgent.fitness = this.extractFitnessScore(metadata);
      initialAgent.evaluatedAt = new Date();
    } catch (error) {
      console.log('Initial evaluation not found, will be created during first generation');
    }

    this.archive.set('initial', initialAgent);
    await this.storeInRedis(initialAgent);
  }

  async addAgent(agent: Agent): Promise<void> {
    this.archive.set(agent.commitId, agent);
    await this.storeInRedis(agent);
    
    // Update parent's children count
    if (agent.parentCommitId) {
      const parent = this.archive.get(agent.parentCommitId);
      if (parent) {
        parent.metadata.children_count++;
        await this.storeInRedis(parent);
      }
    }

    this.metadata.totalEvaluations++;
    this.metadata.lastUpdateTime = new Date();
    
    this.emit(EvolutionEventType.AGENT_CREATED, agent);
    this.emit(EvolutionEventType.ARCHIVE_UPDATED, this.getArchiveState());
  }

  async updateAgentFitness(commitId: string, fitness: FitnessScore): Promise<void> {
    const agent = this.archive.get(commitId);
    if (!agent) {
      throw new Error(`Agent ${commitId} not found in archive`);
    }

    agent.fitness = fitness;
    agent.evaluatedAt = new Date();
    agent.status = 'evaluated';
    
    await this.storeInRedis(agent);
    
    // Update convergence metrics
    await this.updateConvergenceMetrics();
    
    this.emit(EvolutionEventType.AGENT_EVALUATED, agent);
  }

  getAgent(commitId: string): Agent | undefined {
    return this.archive.get(commitId);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.archive.values());
  }

  getAgentsByGeneration(generation: number): Agent[] {
    return this.getAllAgents().filter(agent => agent.generation === generation);
  }

  getEligibleParents(): Agent[] {
    return this.getAllAgents().filter(agent => 
      agent.fitness && 
      agent.fitness.compilationSuccess &&
      agent.status === 'evaluated'
    );
  }

  getCurrentGeneration(): number {
    return this.currentGeneration;
  }

  incrementGeneration(): void {
    this.currentGeneration++;
  }

  getBestAgent(): Agent | undefined {
    const agents = this.getEligibleParents();
    if (agents.length === 0) return undefined;
    
    return agents.reduce((best, current) => {
      if (!best.fitness || !current.fitness) return best;
      return current.fitness.accuracy > best.fitness.accuracy ? current : best;
    });
  }

  getArchiveState(): Archive {
    const agents = this.getAllAgents();
    const bestAgent = this.getBestAgent();
    
    return {
      agents,
      currentGeneration: this.currentGeneration,
      bestFitness: bestAgent?.fitness || {
        accuracy: 0,
        resolvedCount: 0,
        unresolvedCount: 0,
        emptyPatchCount: 0,
        contextLengthExceeded: false,
        compilationSuccess: false,
      },
      metadata: this.metadata,
    };
  }

  private extractFitnessScore(metadata: AgentMetadata): FitnessScore {
    const perf = metadata.overall_performance;
    return {
      accuracy: perf.accuracy_score,
      resolvedCount: perf.total_resolved_ids.length,
      unresolvedCount: perf.total_unresolved_ids.length,
      emptyPatchCount: perf.total_emptypatch_ids.length,
      contextLengthExceeded: false, // Will be determined during evaluation
      compilationSuccess: true, // Agents in archive are assumed to have compiled
      testsPassed: perf.total_resolved_ids.length,
      totalTests: perf.total_submitted_instances,
    };
  }

  private async updateConvergenceMetrics(): Promise<void> {
    const metrics = this.metadata.convergenceMetrics!;
    const currentGenAgents = this.getAgentsByGeneration(this.currentGeneration);
    
    if (currentGenAgents.length > 0) {
      // Calculate average fitness for current generation
      const avgFitness = currentGenAgents
        .filter(a => a.fitness)
        .reduce((sum, a) => sum + a.fitness!.accuracy, 0) / currentGenAgents.length;
      
      // Calculate improvement
      const lastAvgFitness = metrics.generationalImprovement.length > 0
        ? metrics.generationalImprovement[metrics.generationalImprovement.length - 1]
        : 0;
      
      metrics.generationalImprovement.push(avgFitness);
      
      // Update stagnation count
      if (avgFitness <= lastAvgFitness * 1.01) {
        metrics.stagnationCount++;
      } else {
        metrics.stagnationCount = 0;
      }
      
      // Calculate diversity score (simplified: based on unique parent commits)
      const uniqueParents = new Set(currentGenAgents.map(a => a.parentCommitId).filter(Boolean));
      metrics.diversityScore = uniqueParents.size / Math.max(1, currentGenAgents.length);
      
      // Emit convergence event if detected
      if (metrics.stagnationCount >= 5) {
        this.emit(EvolutionEventType.CONVERGENCE_DETECTED, metrics);
      }
    }
  }

  private async storeInRedis(agent: Agent): Promise<void> {
    if (this.redis) {
      await this.redis.hset(
        'evolution:archive',
        agent.commitId,
        JSON.stringify(agent)
      );
    }
  }

  async persistToDisk(): Promise<void> {
    const archiveData = {
      generation: this.currentGeneration,
      archive: Array.from(this.archive.keys()),
      metadata: this.metadata,
      timestamp: new Date(),
    };
    
    const metadataPath = path.join(this.outputDir, 'dgm_metadata.jsonl');
    await fs.appendFile(
      metadataPath,
      JSON.stringify(archiveData, null, 2) + '\n'
    );
  }

  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

export default ArchiveManager;