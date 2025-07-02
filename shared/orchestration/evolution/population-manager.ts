/**
 * Population Manager
 * Manages the agent population during evolution
 * Implements DGM's parent selection strategies and generation management
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import {
  Agent,
  AgentStatus,
  EvolutionTask,
  GenerationResult,
  EvolutionEventType,
  SelectionCandidate,
  ParentSelectionResult,
  EvolutionConfig,
} from './evolution-types';
import { ArchiveManager } from './archive-manager';
import { AgentOrchestrator } from '../orchestrator/agent-orchestrator';

export class PopulationManager extends EventEmitter {
  private activeAgents: Map<string, Agent> = new Map();
  private generationTasks: Map<number, EvolutionTask[]> = new Map();
  private redis?: Redis;
  private config: EvolutionConfig;

  constructor(
    private archiveManager: ArchiveManager,
    private orchestrator: AgentOrchestrator,
    config: EvolutionConfig,
    redisUrl?: string
  ) {
    super();
    this.config = config;
    
    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    }
  }

  async createNewGeneration(
    selfImproveEntries: Array<[string, string | any]>,
    generation: number
  ): Promise<string[]> {
    const newAgentIds: string[] = [];
    const tasks: EvolutionTask[] = [];

    for (const [parentCommitId, entry] of selfImproveEntries) {
      const parentAgent = this.archiveManager.getAgent(parentCommitId);
      if (!parentAgent) {
        console.warn(`Parent agent ${parentCommitId} not found, skipping`);
        continue;
      }

      // Create new agent
      const newAgentId = this.generateAgentId();
      const newAgent: Agent = {
        id: newAgentId,
        commitId: newAgentId,
        parentCommitId: parentCommitId,
        generation,
        status: 'pending',
        createdAt: new Date(),
        metadata: {
          overall_performance: {
            accuracy_score: 0,
            total_resolved_ids: [],
            total_unresolved_ids: [],
            total_emptypatch_ids: [],
            total_submitted_instances: 0,
          },
          parent_commit: parentCommitId,
          run_id: newAgentId,
          self_improve_entry: entry,
          children_count: 0,
        },
      };

      // Add to active population
      this.activeAgents.set(newAgentId, newAgent);
      newAgentIds.push(newAgentId);
      
      // Store in Redis
      if (this.redis) {
        await this.redis.hset(
          'evolution:active_agents',
          newAgentId,
          JSON.stringify(newAgent)
        );
      }

      // Create evolution task
      const task: EvolutionTask = {
        id: uuidv4(),
        type: 'self_improve',
        parentCommitId,
        entry,
        priority: this.calculateTaskPriority(parentAgent),
        generation,
        createdAt: new Date(),
        status: 'pending',
      };
      
      tasks.push(task);
      
      this.emit(EvolutionEventType.AGENT_CREATED, newAgent);
    }

    // Store generation tasks
    this.generationTasks.set(generation, tasks);
    
    // Submit tasks to orchestrator
    await this.submitTasksToOrchestrator(tasks);
    
    return newAgentIds;
  }

  /**
   * DGM Parent Selection Methods
   * Implements score_prop and score_child_prop from the original DGM system
   */
  
  /**
   * Score-proportional selection (score_prop)
   * Selects parents proportionally to their fitness scores
   */
  async selectParentsScoreProp(numParents: number): Promise<ParentSelectionResult[]> {
    const eligibleParents = this.archiveManager.getEligibleParents();
    
    if (eligibleParents.length === 0) {
      throw new Error('No eligible parents available for selection');
    }
    
    // Calculate selection scores based on accuracy
    const candidates: SelectionCandidate[] = eligibleParents.map(agent => ({
      commitId: agent.commitId,
      fitness: agent.fitness!,
      childrenCount: agent.metadata.children_count,
      selectionProbability: 0,
    }));
    
    // Calculate total fitness
    const totalFitness = candidates.reduce(
      (sum, candidate) => sum + candidate.fitness.accuracy,
      0
    );
    
    // Assign selection probabilities
    candidates.forEach(candidate => {
      candidate.selectionProbability = candidate.fitness.accuracy / totalFitness;
    });
    
    // Sort by probability for efficiency
    candidates.sort((a, b) => b.selectionProbability! - a.selectionProbability!);
    
    // Select parents using roulette wheel selection
    const selectedParents: ParentSelectionResult[] = [];
    const candidateScores = new Map<string, number>();
    
    for (let i = 0; i < numParents; i++) {
      const selected = this.rouletteWheelSelection(candidates);
      selectedParents.push({
        parentCommitId: selected.commitId,
        selectionScore: selected.fitness.accuracy,
        selectionMethod: 'score_prop',
        candidateScores: candidateScores,
      });
      
      // Store scores for transparency
      candidates.forEach(c => candidateScores.set(c.commitId, c.fitness.accuracy));
    }
    
    // Store selection history in Redis
    if (this.redis) {
      await this.redis.lpush(
        'evolution:parent_selections',
        JSON.stringify({
          generation: this.archiveManager.getCurrentGeneration(),
          method: 'score_prop',
          selections: selectedParents,
          timestamp: new Date(),
        })
      );
    }
    
    return selectedParents;
  }
  
  /**
   * Score-child proportional selection (score_child_prop)
   * Selects parents based on fitness divided by number of children + 1
   * Encourages exploration by favoring high-performing agents with fewer children
   */
  async selectParentsScoreChildProp(numParents: number): Promise<ParentSelectionResult[]> {
    const eligibleParents = this.archiveManager.getEligibleParents();
    
    if (eligibleParents.length === 0) {
      throw new Error('No eligible parents available for selection');
    }
    
    // Calculate selection scores: accuracy / (children_count + 1)
    const candidates: SelectionCandidate[] = eligibleParents.map(agent => ({
      commitId: agent.commitId,
      fitness: agent.fitness!,
      childrenCount: agent.metadata.children_count,
      selectionProbability: 0,
    }));
    
    // Calculate adjusted scores
    const adjustedScores = candidates.map(candidate => ({
      ...candidate,
      adjustedScore: candidate.fitness.accuracy / (candidate.childrenCount + 1),
    }));
    
    // Calculate total adjusted fitness
    const totalAdjustedFitness = adjustedScores.reduce(
      (sum, candidate) => sum + candidate.adjustedScore,
      0
    );
    
    // Assign selection probabilities
    adjustedScores.forEach(candidate => {
      candidate.selectionProbability = candidate.adjustedScore / totalAdjustedFitness;
    });
    
    // Sort by probability for efficiency
    adjustedScores.sort((a, b) => b.selectionProbability! - a.selectionProbability!);
    
    // Select parents
    const selectedParents: ParentSelectionResult[] = [];
    const candidateScores = new Map<string, number>();
    
    for (let i = 0; i < numParents; i++) {
      const selected = this.rouletteWheelSelection(adjustedScores);
      selectedParents.push({
        parentCommitId: selected.commitId,
        selectionScore: selected.adjustedScore,
        selectionMethod: 'score_child_prop',
        candidateScores: candidateScores,
      });
      
      // Store scores for transparency
      adjustedScores.forEach(c => candidateScores.set(c.commitId, c.adjustedScore));
    }
    
    // Store selection history
    if (this.redis) {
      await this.redis.lpush(
        'evolution:parent_selections',
        JSON.stringify({
          generation: this.archiveManager.getCurrentGeneration(),
          method: 'score_child_prop',
          selections: selectedParents,
          timestamp: new Date(),
        })
      );
    }
    
    return selectedParents;
  }
  
  /**
   * Generic parent selection based on configured method
   */
  async selectParents(numParents: number): Promise<ParentSelectionResult[]> {
    switch (this.config.selectionMethod) {
      case 'score_prop':
        return this.selectParentsScoreProp(numParents);
      case 'score_child_prop':
        return this.selectParentsScoreChildProp(numParents);
      case 'tournament':
        return this.tournamentSelection(numParents);
      case 'random':
        return this.randomSelection(numParents);
      default:
        throw new Error(`Unknown selection method: ${this.config.selectionMethod}`);
    }
  }
  
  /**
   * Roulette wheel selection helper
   */
  private rouletteWheelSelection<T extends { selectionProbability?: number }>(
    candidates: T[]
  ): T {
    const random = Math.random();
    let cumulativeProbability = 0;
    
    for (const candidate of candidates) {
      cumulativeProbability += candidate.selectionProbability || 0;
      if (random <= cumulativeProbability) {
        return candidate;
      }
    }
    
    // Fallback to last candidate (should rarely happen due to floating point precision)
    return candidates[candidates.length - 1];
  }
  
  /**
   * Tournament selection for comparison
   */
  private async tournamentSelection(numParents: number): Promise<ParentSelectionResult[]> {
    const eligibleParents = this.archiveManager.getEligibleParents();
    const tournamentSize = Math.min(3, eligibleParents.length);
    const selectedParents: ParentSelectionResult[] = [];
    
    for (let i = 0; i < numParents; i++) {
      // Randomly select tournament participants
      const tournament = this.randomSample(eligibleParents, tournamentSize);
      
      // Select the best from tournament
      const winner = tournament.reduce((best, current) => {
        return (current.fitness?.accuracy || 0) > (best.fitness?.accuracy || 0) 
          ? current : best;
      });
      
      selectedParents.push({
        parentCommitId: winner.commitId,
        selectionScore: winner.fitness?.accuracy || 0,
        selectionMethod: 'tournament',
      });
    }
    
    return selectedParents;
  }
  
  /**
   * Random selection for baseline comparison
   */
  private async randomSelection(numParents: number): Promise<ParentSelectionResult[]> {
    const eligibleParents = this.archiveManager.getEligibleParents();
    const selected = this.randomSample(eligibleParents, numParents);
    
    return selected.map(agent => ({
      parentCommitId: agent.commitId,
      selectionScore: agent.fitness?.accuracy || 0,
      selectionMethod: 'random',
    }));
  }
  
  /**
   * Helper to randomly sample from array
   */
  private randomSample<T>(array: T[], size: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, size);
  }

  private calculateTaskPriority(parentAgent: Agent): number {
    // Higher fitness parents get higher priority
    const basePriority = 5;
    const fitnessBonus = (parentAgent.fitness?.accuracy || 0) * 5;
    return Math.min(10, basePriority + fitnessBonus);
  }

  private async submitTasksToOrchestrator(tasks: EvolutionTask[]): Promise<void> {
    for (const task of tasks) {
      const agent = Array.from(this.activeAgents.values())
        .find(a => a.parentCommitId === task.parentCommitId && a.generation === task.generation);
      
      if (!agent) continue;

      await this.orchestrator.enqueueTask({
        id: task.id,
        type: 'evolution',
        priority: task.priority,
        prompt: this.createSelfImprovePrompt(task),
        context: {
          evolutionTask: task,
          agentId: agent.id,
          generation: task.generation,
          parentCommitId: task.parentCommitId,
        },
        timeout: 5400000, // 1.5 hours
        createdAt: task.createdAt,
        status: 'pending',
      });
      
      // Update task status
      task.status = 'running';
      task.assignedTo = agent.id;
      agent.status = 'running';
    }
  }

  private createSelfImprovePrompt(task: EvolutionTask): string {
    const entryType = typeof task.entry === 'string' ? task.entry : task.entry.type;
    
    switch (entryType) {
      case 'solve_empty_patches':
        return `Analyze and fix empty patch submissions in the parent agent. 
                Focus on cases where no code changes were generated.`;
      
      case 'solve_stochasticity':
        return `Improve consistency and reduce randomness in agent responses. 
                Make the agent more deterministic and reliable.`;
      
      case 'solve_contextlength':
        return `Optimize prompts and code to avoid context length limits. 
                Implement strategies to handle large codebases efficiently.`;
      
      default:
        return `Improve performance on task: ${JSON.stringify(task.entry)}. 
                Analyze failures and implement targeted improvements.`;
    }
  }

  async updateAgentStatus(agentId: string, status: AgentStatus, result?: any): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      console.warn(`Agent ${agentId} not found in active population`);
      return;
    }

    agent.status = status;
    
    if (status === 'evaluated' && result) {
      // Move to archive
      await this.archiveManager.addAgent(agent);
      this.activeAgents.delete(agentId);
      
      if (this.redis) {
        await this.redis.hdel('evolution:active_agents', agentId);
      }
    }
    
    this.emit('agent:status_changed', { agentId, status, result });
  }

  getActiveAgents(): Agent[] {
    return Array.from(this.activeAgents.values());
  }

  getAgentsByGeneration(generation: number): Agent[] {
    return this.getActiveAgents().filter(agent => agent.generation === generation);
  }

  getGenerationTasks(generation: number): EvolutionTask[] {
    return this.generationTasks.get(generation) || [];
  }

  isGenerationComplete(generation: number): boolean {
    const tasks = this.getGenerationTasks(generation);
    return tasks.every(task => 
      task.status === 'completed' || task.status === 'failed'
    );
  }

  /**
   * Process generation transitions following DGM's approach
   */
  async transitionGeneration(): Promise<void> {
    const currentGen = this.archiveManager.getCurrentGeneration();
    
    this.emit(EvolutionEventType.GENERATION_COMPLETE, {
      generation: currentGen,
      stats: await this.getGenerationStats(currentGen),
    });
    
    // Archive current generation results
    await this.archiveManager.persistToDisk();
    
    // Move to next generation
    this.archiveManager.incrementGeneration();
    
    // Clear active agents that haven't been evaluated
    for (const [agentId, agent] of this.activeAgents) {
      if (agent.status !== 'evaluated') {
        console.warn(`Agent ${agentId} was not evaluated before generation transition`);
        // Optionally move to archive with failed status
        agent.status = 'failed';
        await this.archiveManager.addAgent(agent);
      }
    }
    this.activeAgents.clear();
    
    this.emit(EvolutionEventType.GENERATION_START, {
      generation: currentGen + 1,
    });
  }
  
  /**
   * Create next generation using parent selection
   */
  async createNextGeneration(): Promise<string[]> {
    const nextGen = this.archiveManager.getCurrentGeneration();
    const parents = await this.selectParents(this.config.populationSize);
    
    // Generate self-improvement entries based on parent analysis
    const selfImproveEntries: Array<[string, string | any]> = [];
    
    for (const parent of parents) {
      const parentAgent = this.archiveManager.getAgent(parent.parentCommitId);
      if (!parentAgent) continue;
      
      // Analyze parent to determine improvement strategy
      const entry = await this.generateSelfImproveEntry(parentAgent);
      selfImproveEntries.push([parent.parentCommitId, entry]);
    }
    
    // Create new generation
    return this.createNewGeneration(selfImproveEntries, nextGen);
  }
  
  /**
   * Generate self-improvement entry based on parent analysis
   */
  private async generateSelfImproveEntry(parentAgent: Agent): Promise<string | any> {
    const fitness = parentAgent.fitness;
    if (!fitness) {
      return 'general_improvement';
    }
    
    // Priority-based entry selection following DGM patterns
    if (fitness.emptyPatchCount > 0) {
      return {
        type: 'solve_empty_patches',
        instanceIds: parentAgent.metadata.overall_performance.total_emptypatch_ids,
      };
    }
    
    if (fitness.contextLengthExceeded) {
      return {
        type: 'solve_contextlength',
        details: 'Optimize for large codebases',
      };
    }
    
    if (fitness.unresolvedCount > fitness.resolvedCount) {
      // Focus on specific unresolved instances
      const unresolvedIds = parentAgent.metadata.overall_performance.total_unresolved_ids;
      if (unresolvedIds.length > 0) {
        // Pick a random unresolved instance for targeted improvement
        const targetId = unresolvedIds[Math.floor(Math.random() * unresolvedIds.length)];
        return {
          type: 'solve_instance',
          instanceId: targetId,
        };
      }
    }
    
    // General improvement for high-performing agents
    return {
      type: 'solve_stochasticity',
      targetAccuracy: Math.min(fitness.accuracy + 0.1, 1.0),
    };
  }
  
  /**
   * Get detailed generation statistics
   */
  private async getGenerationStats(generation: number) {
    const agents = this.archiveManager.getAgentsByGeneration(generation);
    const evaluated = agents.filter(a => a.status === 'evaluated');
    const successful = evaluated.filter(a => a.fitness && a.fitness.accuracy > 0);
    
    const accuracies = evaluated
      .map(a => a.fitness?.accuracy || 0)
      .filter(acc => acc > 0);
    
    const avgAccuracy = accuracies.length > 0
      ? accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length
      : 0;
    
    const maxAccuracy = Math.max(...accuracies, 0);
    const minAccuracy = Math.min(...accuracies, 1);
    
    return {
      totalAgents: agents.length,
      evaluatedAgents: evaluated.length,
      successfulAgents: successful.length,
      averageAccuracy: avgAccuracy,
      maxAccuracy,
      minAccuracy,
      parentDiversity: this.calculateParentDiversity(agents),
    };
  }
  
  /**
   * Calculate parent diversity for the generation
   */
  private calculateParentDiversity(agents: Agent[]): number {
    const parentIds = agents
      .map(a => a.parentCommitId)
      .filter(id => id !== undefined);
    
    if (parentIds.length === 0) return 0;
    
    const uniqueParents = new Set(parentIds);
    return uniqueParents.size / parentIds.length;
  }

  async processGenerationResults(generation: number): Promise<GenerationResult> {
    const tasks = this.getGenerationTasks(generation);
    const agents = this.getAgentsByGeneration(generation);
    
    const children = agents.map(a => a.commitId);
    const childrenCompiled = agents
      .filter(a => a.status === 'evaluated' && a.fitness?.compilationSuccess)
      .map(a => a.commitId);
    
    const selfImproveEntries = tasks.map(t => [t.parentCommitId, t.entry] as [string, any]);
    const archive = this.archiveManager.getAllAgents().map(a => a.commitId);
    
    const result: GenerationResult = {
      generation,
      selfImproveEntries,
      children,
      childrenCompiled,
      archive,
      timestamp: new Date(),
    };
    
    // Store generation results in Redis for persistence
    if (this.redis) {
      await this.redis.hset(
        'evolution:generation_results',
        generation.toString(),
        JSON.stringify(result)
      );
    }
    
    // Clean up generation data
    this.generationTasks.delete(generation);
    
    return result;
  }

  private generateAgentId(): string {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}`;
  }

  /**
   * Load population state from Redis
   */
  async loadFromRedis(): Promise<void> {
    if (!this.redis) return;
    
    try {
      // Load active agents
      const activeAgentsData = await this.redis.hgetall('evolution:active_agents');
      for (const [agentId, agentData] of Object.entries(activeAgentsData)) {
        const agent = JSON.parse(agentData);
        this.activeAgents.set(agentId, agent);
      }
      
      // Load generation tasks
      const taskKeys = await this.redis.keys('evolution:generation_tasks:*');
      for (const key of taskKeys) {
        const generation = parseInt(key.split(':').pop()!);
        const tasksData = await this.redis.get(key);
        if (tasksData) {
          this.generationTasks.set(generation, JSON.parse(tasksData));
        }
      }
      
      console.log(`Loaded ${this.activeAgents.size} active agents from Redis`);
    } catch (error) {
      console.error('Failed to load population from Redis:', error);
    }
  }
  
  /**
   * Save current population state to Redis
   */
  async saveToRedis(): Promise<void> {
    if (!this.redis) return;
    
    try {
      // Save active agents
      const pipeline = this.redis.pipeline();
      
      for (const [agentId, agent] of this.activeAgents) {
        pipeline.hset('evolution:active_agents', agentId, JSON.stringify(agent));
      }
      
      // Save generation tasks
      for (const [generation, tasks] of this.generationTasks) {
        pipeline.set(
          `evolution:generation_tasks:${generation}`,
          JSON.stringify(tasks),
          'EX',
          86400 // 24 hour expiry
        );
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error('Failed to save population to Redis:', error);
    }
  }
  
  /**
   * Get population health metrics
   */
  async getPopulationHealth(): Promise<{
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    const stats = await this.getPopulationStats();
    const currentGen = this.archiveManager.getCurrentGeneration();
    const convergenceMetrics = this.archiveManager.getArchiveState().metadata.convergenceMetrics;
    
    // Check for stagnation
    if (convergenceMetrics && convergenceMetrics.stagnationCount >= 3) {
      issues.push(`Population stagnating for ${convergenceMetrics.stagnationCount} generations`);
      recommendations.push('Consider increasing mutation rate or changing selection method');
    }
    
    // Check diversity
    if (convergenceMetrics && convergenceMetrics.diversityScore < 0.3) {
      issues.push('Low population diversity');
      recommendations.push('Switch to score_child_prop selection to encourage exploration');
    }
    
    // Check failure rate
    const currentGenStats = stats.generationStats.get(currentGen);
    if (currentGenStats && currentGenStats.failed > currentGenStats.evaluated * 0.5) {
      issues.push('High failure rate in current generation');
      recommendations.push('Review error logs and adjust evolution parameters');
    }
    
    // Check if making progress
    const recentGens = Array.from(stats.generationStats.entries())
      .filter(([gen]) => gen >= currentGen - 3)
      .map(([, genStats]) => genStats.avgFitness);
    
    if (recentGens.length >= 3) {
      const avgImprovement = recentGens.reduce((sum, fitness, i) => {
        if (i === 0) return sum;
        return sum + (fitness - recentGens[i - 1]);
      }, 0) / (recentGens.length - 1);
      
      if (avgImprovement < 0.01) {
        issues.push('Minimal improvement in recent generations');
        recommendations.push('Consider adjusting self-improvement strategies');
      }
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations,
    };
  }

  async getPopulationStats() {
    const totalAgents = this.archiveManager.getAllAgents().length;
    const activeAgents = this.activeAgents.size;
    const currentGeneration = this.archiveManager.getCurrentGeneration();
    const bestAgent = this.archiveManager.getBestAgent();
    
    const generationStats = new Map<number, {
      total: number;
      evaluated: number;
      failed: number;
      avgFitness: number;
    }>();
    
    // Calculate stats per generation
    for (let gen = 0; gen <= currentGeneration; gen++) {
      const genAgents = this.archiveManager.getAgentsByGeneration(gen);
      const evaluated = genAgents.filter(a => a.status === 'evaluated');
      const failed = genAgents.filter(a => a.status === 'failed');
      
      const avgFitness = evaluated.length > 0
        ? evaluated.reduce((sum, a) => sum + (a.fitness?.accuracy || 0), 0) / evaluated.length
        : 0;
      
      generationStats.set(gen, {
        total: genAgents.length,
        evaluated: evaluated.length,
        failed: failed.length,
        avgFitness,
      });
    }
    
    return {
      totalAgents,
      activeAgents,
      currentGeneration,
      bestFitness: bestAgent?.fitness?.accuracy || 0,
      generationStats,
    };
  }

  /**
   * Get current evolution configuration
   */
  getConfig(): EvolutionConfig {
    return this.config;
  }
  
  /**
   * Update evolution configuration dynamically
   */
  updateConfig(updates: Partial<EvolutionConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config:updated', this.config);
  }
  
  /**
   * Export population data for analysis
   */
  async exportPopulationData(): Promise<{
    agents: Agent[];
    generations: GenerationResult[];
    selectionHistory: any[];
    config: EvolutionConfig;
  }> {
    const agents = this.archiveManager.getAllAgents();
    const generations: GenerationResult[] = [];
    const selectionHistory: any[] = [];
    
    if (this.redis) {
      // Get generation results
      const genResults = await this.redis.hgetall('evolution:generation_results');
      for (const [gen, data] of Object.entries(genResults)) {
        generations.push(JSON.parse(data));
      }
      
      // Get selection history
      const selections = await this.redis.lrange('evolution:parent_selections', 0, -1);
      for (const selection of selections) {
        selectionHistory.push(JSON.parse(selection));
      }
    }
    
    return {
      agents,
      generations,
      selectionHistory,
      config: this.config,
    };
  }
  
  /**
   * Monitor evolution progress
   */
  startMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(async () => {
      const stats = await this.getPopulationStats();
      const health = await this.getPopulationHealth();
      
      this.emit('monitor:update', {
        stats,
        health,
        timestamp: new Date(),
      });
      
      // Auto-save to Redis periodically
      await this.saveToRedis();
    }, intervalMs);
  }

  async cleanup() {
    // Save final state
    await this.saveToRedis();
    await this.archiveManager.persistToDisk();
    
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

export default PopulationManager;