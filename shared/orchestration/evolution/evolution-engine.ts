/**
 * Evolution Engine
 * Orchestrates the full evolution cycle integrating DGM with TypeScript components
 */

import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  Agent,
  EvolutionConfig,
  EvolutionEvent,
  EvolutionEventType,
  GenerationResult,
  ParentSelectionResult,
  EvaluationTask,
  FitnessScore,
} from './evolution-types';
import { PopulationManager } from './population-manager';
import { FitnessEvaluator } from './fitness-evaluator';
import { EvolutionEventPublisher } from './evolution-events';
import { EvolutionMetrics } from './evolution-metrics';
import { ArchiveManager } from './archive-manager';
import { AgentOrchestrator } from '../orchestrator/agent-orchestrator';
import axios from 'axios';

interface EvolutionEngineConfig extends EvolutionConfig {
  outputDir: string;
  redisUrl: string;
  rabbitMqUrl: string;
  orchestratorUrl: string;
  evolutionBridgeUrl: string;
  checkpointInterval: number;
  maxStagnationGenerations: number;
  fitnessThreshold: number;
}

interface CheckpointData {
  generation: number;
  archive: any;
  populationStats: any;
  config: EvolutionEngineConfig;
  timestamp: Date;
}

interface StopCondition {
  type: 'generations' | 'fitness' | 'stagnation' | 'time';
  value: number;
}

export class EvolutionEngine extends EventEmitter {
  private config: EvolutionEngineConfig;
  private redis: Redis;
  private populationManager: PopulationManager;
  private fitnessEvaluator: FitnessEvaluator;
  private archiveManager: ArchiveManager;
  private eventPublisher: EvolutionEventPublisher;
  private metrics: EvolutionMetrics;
  private orchestrator: AgentOrchestrator;
  
  private isRunning: boolean = false;
  private currentGeneration: number = 0;
  private startTime: Date;
  private lastCheckpointGeneration: number = 0;
  private stagnationCount: number = 0;
  private lastBestFitness: number = 0;
  
  private stopConditions: StopCondition[] = [];

  constructor(config: EvolutionEngineConfig) {
    super();
    this.config = config;
    this.redis = new Redis(config.redisUrl);
    this.startTime = new Date();
    
    // Initialize stop conditions
    this.stopConditions = [
      { type: 'generations', value: config.generations },
      { type: 'fitness', value: config.fitnessThreshold },
      { type: 'stagnation', value: config.maxStagnationGenerations },
    ];
  }

  /**
   * Initialize the evolution engine and all components
   */
  async initialize(continueFrom?: string): Promise<void> {
    console.log('Initializing Evolution Engine...');
    
    // Initialize archive manager
    this.archiveManager = new ArchiveManager(this.config.outputDir);
    await this.archiveManager.initialize();
    
    // Initialize orchestrator
    this.orchestrator = new AgentOrchestrator({
      redisUrl: this.config.redisUrl,
      amqpUrl: this.config.rabbitMqUrl,
    });
    
    // Initialize population manager
    this.populationManager = new PopulationManager(
      this.archiveManager,
      this.orchestrator,
      this.config,
      this.config.redisUrl
    );
    
    // Initialize fitness evaluator
    this.fitnessEvaluator = new FitnessEvaluator({
      evaluationMethod: this.config.evaluationMethod,
      parallelEvaluations: this.config.parallelEvaluations,
      timeout: this.config.timeout,
    });
    
    // Initialize event publisher
    this.eventPublisher = new EvolutionEventPublisher(this.config.rabbitMqUrl);
    await this.eventPublisher.initialize();
    
    // Initialize metrics
    this.metrics = new EvolutionMetrics();
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Load from checkpoint if provided
    if (continueFrom) {
      await this.loadCheckpoint(continueFrom);
    } else {
      // Initialize with DGM
      await this.initializeWithDGM();
    }
    
    console.log('Evolution Engine initialized successfully');
    this.emit('engine:initialized', { generation: this.currentGeneration });
  }

  /**
   * Initialize evolution with DGM system
   */
  private async initializeWithDGM(): Promise<void> {
    try {
      const response = await axios.post(`${this.config.evolutionBridgeUrl}/rpc`, {
        jsonrpc: '2.0',
        method: 'start_evolution',
        params: {
          maxGenerations: this.config.generations,
          selfImproveSize: this.config.populationSize,
          selfImproveWorkers: this.config.parallelEvaluations,
          chooseSelfImprovesMethod: this.config.selectionMethod,
          updateArchive: this.config.archiveStrategy === 'all' ? 'keep_all' : 'keep_better',
          numSweEvals: 1,
          evalNoise: 0.1,
          polyglot: this.config.evaluationMethod === 'polyglot',
        },
        id: 1,
      });
      
      if (response.data.result?.status === 'started') {
        console.log(`DGM evolution started with run ID: ${response.data.result.runId}`);
        await this.redis.set('evolution:dgm_run_id', response.data.result.runId);
      }
    } catch (error) {
      console.error('Failed to initialize DGM:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers for all components
   */
  private setupEventHandlers(): void {
    // Population manager events
    this.populationManager.on(EvolutionEventType.AGENT_CREATED, async (agent: Agent) => {
      await this.eventPublisher.publishAgentCreated(agent);
      this.metrics.incrementAgentsCreated();
    });
    
    this.populationManager.on(EvolutionEventType.GENERATION_COMPLETE, async (data: any) => {
      await this.handleGenerationComplete(data);
    });
    
    // Fitness evaluator events
    this.fitnessEvaluator.on('evaluation:complete', async (result: any) => {
      await this.handleEvaluationComplete(result);
    });
    
    // Archive manager events
    this.archiveManager.on('archive:updated', async (archive: any) => {
      await this.eventPublisher.publishArchiveUpdated(archive);
    });
    
    // Orchestrator events
    this.orchestrator.on('task:completed', async (task: any) => {
      await this.handleTaskCompleted(task);
    });
  }

  /**
   * Run a single generation of evolution
   */
  async runGeneration(): Promise<GenerationResult> {
    this.currentGeneration++;
    const generationStartTime = Date.now();
    
    console.log(`Starting generation ${this.currentGeneration}`);
    await this.eventPublisher.publishGenerationStarted(this.currentGeneration);
    this.metrics.incrementGenerations();
    
    try {
      // 1. Select parents
      const parents = await this.selectParents();
      console.log(`Selected ${parents.length} parents for generation ${this.currentGeneration}`);
      
      // 2. Generate offspring through self-improvement
      const offspringIds = await this.generateOffspring(parents);
      console.log(`Generated ${offspringIds.length} offspring`);
      
      // 3. Wait for all offspring to be evaluated
      await this.waitForEvaluations(offspringIds);
      
      // 4. Update archive
      await this.updateArchive();
      
      // 5. Calculate generation statistics
      const stats = await this.calculateGenerationStats();
      
      // 6. Check for stagnation
      this.checkStagnation(stats.bestFitness);
      
      // 7. Emit generation complete event
      const result = await this.populationManager.processGenerationResults(this.currentGeneration);
      
      const generationTime = Date.now() - generationStartTime;
      this.metrics.recordGenerationTime(generationTime);
      
      await this.eventPublisher.publishGenerationCompleted(
        this.currentGeneration,
        result,
        generationTime
      );
      
      // 8. Checkpoint if needed
      if (this.currentGeneration - this.lastCheckpointGeneration >= this.config.checkpointInterval) {
        await this.checkpoint();
      }
      
      return result;
      
    } catch (error) {
      console.error(`Error in generation ${this.currentGeneration}:`, error);
      this.metrics.incrementErrors();
      throw error;
    }
  }

  /**
   * Run the full evolution process
   */
  async runEvolution(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Evolution is already running');
    }
    
    this.isRunning = true;
    this.startTime = new Date();
    
    console.log('Starting evolution process...');
    
    try {
      while (this.isRunning && !this.shouldStop()) {
        await this.runGeneration();
        
        // Give some time between generations
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('Evolution completed');
      await this.finalize();
      
    } catch (error) {
      console.error('Evolution failed:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Check if evolution should stop based on conditions
   */
  private shouldStop(): boolean {
    for (const condition of this.stopConditions) {
      switch (condition.type) {
        case 'generations':
          if (this.currentGeneration >= condition.value) {
            console.log(`Stopping: Reached max generations (${condition.value})`);
            return true;
          }
          break;
          
        case 'fitness':
          const bestAgent = this.archiveManager.getBestAgent();
          if (bestAgent?.fitness?.accuracy && bestAgent.fitness.accuracy >= condition.value) {
            console.log(`Stopping: Reached fitness threshold (${condition.value})`);
            return true;
          }
          break;
          
        case 'stagnation':
          if (this.stagnationCount >= condition.value) {
            console.log(`Stopping: Population stagnated for ${condition.value} generations`);
            return true;
          }
          break;
          
        case 'time':
          const elapsedTime = Date.now() - this.startTime.getTime();
          if (elapsedTime >= condition.value) {
            console.log(`Stopping: Reached time limit (${condition.value}ms)`);
            return true;
          }
          break;
      }
    }
    
    return false;
  }

  /**
   * Select parents for the next generation
   */
  private async selectParents(): Promise<ParentSelectionResult[]> {
    // Use DGM's parent selection through population manager
    const parents = await this.populationManager.selectParents(this.config.populationSize);
    
    // Record parent selection metrics
    for (const parent of parents) {
      this.metrics.recordParentSelection(parent.selectionMethod);
    }
    
    return parents;
  }

  /**
   * Generate offspring through self-improvement
   */
  private async generateOffspring(parents: ParentSelectionResult[]): Promise<string[]> {
    // Create self-improvement entries based on parent analysis
    const selfImproveEntries: Array<[string, string | any]> = [];
    
    for (const parent of parents) {
      const parentAgent = this.archiveManager.getAgent(parent.parentCommitId);
      if (!parentAgent) continue;
      
      // Determine improvement strategy based on parent's weaknesses
      const entry = this.determineImprovementStrategy(parentAgent);
      selfImproveEntries.push([parent.parentCommitId, entry]);
    }
    
    // Create new generation through population manager
    const offspringIds = await this.populationManager.createNewGeneration(
      selfImproveEntries,
      this.currentGeneration
    );
    
    return offspringIds;
  }

  /**
   * Determine improvement strategy for a parent agent
   */
  private determineImprovementStrategy(parent: Agent): string | any {
    if (!parent.fitness) {
      return 'general_improvement';
    }
    
    // Priority-based strategy selection
    if (parent.fitness.emptyPatchCount > 0) {
      return {
        type: 'solve_empty_patches',
        targetInstances: parent.metadata.overall_performance.total_emptypatch_ids.slice(0, 5),
      };
    }
    
    if (parent.fitness.contextLengthExceeded) {
      return {
        type: 'solve_contextlength',
        strategy: 'chunk_processing',
      };
    }
    
    const unresolvedRatio = parent.fitness.unresolvedCount / 
      (parent.fitness.resolvedCount + parent.fitness.unresolvedCount);
    
    if (unresolvedRatio > 0.5) {
      // Focus on specific unresolved instances
      const targetInstances = parent.metadata.overall_performance.total_unresolved_ids.slice(0, 3);
      return {
        type: 'solve_instances',
        instances: targetInstances,
      };
    }
    
    // General improvement for high-performing agents
    return {
      type: 'solve_stochasticity',
      targetAccuracy: Math.min(parent.fitness.accuracy + 0.05, 1.0),
    };
  }

  /**
   * Wait for all offspring evaluations to complete
   */
  private async waitForEvaluations(offspringIds: string[]): Promise<void> {
    console.log(`Waiting for ${offspringIds.length} evaluations to complete...`);
    
    const evaluationPromises = offspringIds.map(async (agentId) => {
      // Create evaluation task
      const task: EvaluationTask = {
        agentId,
        commitId: agentId,
        evaluationType: this.config.evaluationMethod as 'swe-bench' | 'polyglot',
        instances: [], // Will be determined by evaluator
        timeout: this.config.timeout,
        priority: 'normal',
      };
      
      // Submit for evaluation
      const result = await this.fitnessEvaluator.evaluate(task);
      
      // Update agent with fitness score
      const agent = this.populationManager.getActiveAgents().find(a => a.id === agentId);
      if (agent) {
        agent.fitness = result;
        agent.status = 'evaluated';
        agent.evaluatedAt = new Date();
        
        await this.populationManager.updateAgentStatus(agentId, 'evaluated', result);
      }
      
      return result;
    });
    
    // Wait for all evaluations with timeout handling
    const results = await Promise.allSettled(evaluationPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`Evaluations complete: ${successful} successful, ${failed} failed`);
    
    if (failed > 0) {
      console.warn(`${failed} evaluations failed, check logs for details`);
    }
  }

  /**
   * Update archive with evaluated agents
   */
  private async updateArchive(): Promise<void> {
    const evaluatedAgents = this.populationManager.getActiveAgents()
      .filter(a => a.status === 'evaluated');
    
    for (const agent of evaluatedAgents) {
      // Only add to archive if meets criteria based on archive strategy
      if (this.shouldAddToArchive(agent)) {
        await this.archiveManager.addAgent(agent);
      }
    }
    
    // Transition to next generation
    await this.populationManager.transitionGeneration();
  }

  /**
   * Determine if agent should be added to archive
   */
  private shouldAddToArchive(agent: Agent): boolean {
    switch (this.config.archiveStrategy) {
      case 'all':
        // Keep all evaluated agents
        return agent.fitness?.compilationSuccess === true;
        
      case 'best':
        // Only keep if better than current average
        const avgFitness = this.archiveManager.getAverageFitness();
        return (agent.fitness?.accuracy || 0) > avgFitness;
        
      case 'diverse':
        // Keep if adds diversity (simplified check)
        const similarAgents = this.archiveManager.getAllAgents()
          .filter(a => Math.abs((a.fitness?.accuracy || 0) - (agent.fitness?.accuracy || 0)) < 0.05);
        return similarAgents.length < 3;
        
      default:
        return true;
    }
  }

  /**
   * Calculate generation statistics
   */
  private async calculateGenerationStats(): Promise<{
    bestFitness: number;
    avgFitness: number;
    diversity: number;
  }> {
    const agents = this.archiveManager.getAgentsByGeneration(this.currentGeneration);
    const fitnesses = agents
      .map(a => a.fitness?.accuracy || 0)
      .filter(f => f > 0);
    
    const bestFitness = Math.max(...fitnesses, 0);
    const avgFitness = fitnesses.length > 0
      ? fitnesses.reduce((sum, f) => sum + f, 0) / fitnesses.length
      : 0;
    
    // Simple diversity metric based on fitness variance
    const variance = fitnesses.length > 0
      ? fitnesses.reduce((sum, f) => sum + Math.pow(f - avgFitness, 2), 0) / fitnesses.length
      : 0;
    const diversity = Math.sqrt(variance);
    
    return { bestFitness, avgFitness, diversity };
  }

  /**
   * Check for population stagnation
   */
  private checkStagnation(currentBestFitness: number): void {
    const improvementThreshold = 0.01; // 1% improvement required
    
    if (currentBestFitness <= this.lastBestFitness * (1 + improvementThreshold)) {
      this.stagnationCount++;
      console.log(`Stagnation detected: ${this.stagnationCount} generations without significant improvement`);
    } else {
      this.stagnationCount = 0;
      this.lastBestFitness = currentBestFitness;
    }
  }

  /**
   * Handle generation complete event
   */
  private async handleGenerationComplete(data: any): Promise<void> {
    console.log(`Generation ${data.generation} completed with stats:`, data.stats);
    
    // Update metrics
    this.metrics.updateGenerationStats(data.generation, data.stats);
    
    // Check population health
    const health = await this.populationManager.getPopulationHealth();
    if (!health.isHealthy) {
      console.warn('Population health issues detected:', health.issues);
      console.log('Recommendations:', health.recommendations);
      
      // Potentially adjust configuration based on recommendations
      if (health.issues.includes('Low population diversity')) {
        console.log('Switching to score_child_prop selection method');
        this.populationManager.updateConfig({
          selectionMethod: 'score_child_prop',
        });
      }
    }
  }

  /**
   * Handle evaluation complete event
   */
  private async handleEvaluationComplete(result: any): Promise<void> {
    console.log(`Evaluation completed for agent ${result.agentId}`);
    this.metrics.recordEvaluation(result.success);
  }

  /**
   * Handle task completed event from orchestrator
   */
  private async handleTaskCompleted(task: any): Promise<void> {
    if (task.type === 'evolution' && task.status === 'completed') {
      console.log(`Evolution task ${task.id} completed`);
      
      // Extract agent information from task result
      if (task.result?.agentId) {
        await this.populationManager.updateAgentStatus(
          task.result.agentId,
          'evaluating',
          task.result
        );
      }
    }
  }

  /**
   * Create a checkpoint of current evolution state
   */
  async checkpoint(): Promise<string> {
    const checkpointName = `checkpoint_gen${this.currentGeneration}_${Date.now()}`;
    const checkpointPath = path.join(this.config.outputDir, 'checkpoints', checkpointName);
    
    console.log(`Creating checkpoint: ${checkpointName}`);
    
    try {
      // Create checkpoint directory
      await fs.mkdir(checkpointPath, { recursive: true });
      
      // Gather checkpoint data
      const checkpointData: CheckpointData = {
        generation: this.currentGeneration,
        archive: await this.archiveManager.exportArchive(),
        populationStats: await this.populationManager.getPopulationStats(),
        config: this.config,
        timestamp: new Date(),
      };
      
      // Save checkpoint data
      await fs.writeFile(
        path.join(checkpointPath, 'checkpoint.json'),
        JSON.stringify(checkpointData, null, 2)
      );
      
      // Save to Redis
      await this.redis.hset(
        'evolution:checkpoints',
        checkpointName,
        JSON.stringify({
          path: checkpointPath,
          generation: this.currentGeneration,
          timestamp: new Date(),
        })
      );
      
      // Call evolution bridge checkpoint
      await axios.post(`${this.config.evolutionBridgeUrl}/rpc`, {
        jsonrpc: '2.0',
        method: 'save_checkpoint',
        params: { checkpoint_name: checkpointName },
        id: Date.now(),
      });
      
      this.lastCheckpointGeneration = this.currentGeneration;
      console.log(`Checkpoint created successfully: ${checkpointName}`);
      
      return checkpointName;
      
    } catch (error) {
      console.error('Failed to create checkpoint:', error);
      throw error;
    }
  }

  /**
   * Recover from a checkpoint
   */
  async recover(checkpointName: string): Promise<void> {
    console.log(`Recovering from checkpoint: ${checkpointName}`);
    
    try {
      // Load checkpoint from evolution bridge
      const response = await axios.post(`${this.config.evolutionBridgeUrl}/rpc`, {
        jsonrpc: '2.0',
        method: 'load_checkpoint',
        params: { checkpoint_name: checkpointName },
        id: Date.now(),
      });
      
      if (response.data.result?.status !== 'loaded') {
        throw new Error('Failed to load checkpoint in evolution bridge');
      }
      
      // Load local checkpoint data
      const checkpointInfo = await this.redis.hget('evolution:checkpoints', checkpointName);
      if (!checkpointInfo) {
        throw new Error(`Checkpoint ${checkpointName} not found`);
      }
      
      const { path: checkpointPath, generation } = JSON.parse(checkpointInfo);
      const checkpointData: CheckpointData = JSON.parse(
        await fs.readFile(path.join(checkpointPath, 'checkpoint.json'), 'utf-8')
      );
      
      // Restore state
      this.currentGeneration = checkpointData.generation;
      await this.archiveManager.importArchive(checkpointData.archive);
      
      // Restore population manager state
      await this.populationManager.loadFromRedis();
      
      console.log(`Successfully recovered to generation ${this.currentGeneration}`);
      
    } catch (error) {
      console.error('Failed to recover from checkpoint:', error);
      throw error;
    }
  }

  /**
   * Load a checkpoint
   */
  private async loadCheckpoint(checkpointPath: string): Promise<void> {
    console.log(`Loading checkpoint from: ${checkpointPath}`);
    
    try {
      const checkpointData: CheckpointData = JSON.parse(
        await fs.readFile(path.join(checkpointPath, 'checkpoint.json'), 'utf-8')
      );
      
      this.currentGeneration = checkpointData.generation;
      await this.archiveManager.importArchive(checkpointData.archive);
      
      console.log(`Loaded checkpoint at generation ${this.currentGeneration}`);
      
    } catch (error) {
      console.error('Failed to load checkpoint:', error);
      throw error;
    }
  }

  /**
   * Finalize evolution process
   */
  private async finalize(): Promise<void> {
    console.log('Finalizing evolution process...');
    
    // Create final checkpoint
    await this.checkpoint();
    
    // Generate final report
    const report = await this.generateFinalReport();
    
    // Save report
    const reportPath = path.join(this.config.outputDir, 'evolution_report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Export metrics
    const metricsPath = path.join(this.config.outputDir, 'evolution_metrics.json');
    await fs.writeFile(metricsPath, JSON.stringify(this.metrics.export(), null, 2));
    
    // Cleanup
    await this.cleanup();
    
    console.log('Evolution process finalized');
    console.log(`Report saved to: ${reportPath}`);
    console.log(`Metrics saved to: ${metricsPath}`);
  }

  /**
   * Generate final evolution report
   */
  private async generateFinalReport(): Promise<any> {
    const bestAgent = this.archiveManager.getBestAgent();
    const populationStats = await this.populationManager.getPopulationStats();
    const archiveState = this.archiveManager.getArchiveState();
    
    return {
      summary: {
        totalGenerations: this.currentGeneration,
        totalAgentsCreated: populationStats.totalAgents,
        bestFitness: bestAgent?.fitness?.accuracy || 0,
        bestAgentId: bestAgent?.id,
        startTime: this.startTime,
        endTime: new Date(),
        duration: Date.now() - this.startTime.getTime(),
      },
      configuration: this.config,
      populationStats,
      archiveState,
      metrics: this.metrics.export(),
      stoppingReason: this.getStoppingReason(),
    };
  }

  /**
   * Get the reason evolution stopped
   */
  private getStoppingReason(): string {
    if (this.currentGeneration >= this.config.generations) {
      return 'Reached maximum generations';
    }
    
    const bestAgent = this.archiveManager.getBestAgent();
    if (bestAgent?.fitness?.accuracy && bestAgent.fitness.accuracy >= this.config.fitnessThreshold) {
      return 'Reached fitness threshold';
    }
    
    if (this.stagnationCount >= this.config.maxStagnationGenerations) {
      return 'Population stagnated';
    }
    
    return 'Manual stop or error';
  }

  /**
   * Stop the evolution process gracefully
   */
  async stop(): Promise<void> {
    console.log('Stopping evolution engine...');
    this.isRunning = false;
    
    // Wait for current generation to complete
    if (this.populationManager.getGenerationTasks(this.currentGeneration).length > 0) {
      console.log('Waiting for current generation to complete...');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (this.populationManager.isGenerationComplete(this.currentGeneration)) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 1000);
      });
    }
    
    await this.finalize();
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    await this.populationManager.cleanup();
    await this.eventPublisher.close();
    await this.orchestrator.shutdown();
    await this.redis.quit();
  }

  /**
   * Get current evolution status
   */
  async getStatus(): Promise<any> {
    const populationStats = await this.populationManager.getPopulationStats();
    const health = await this.populationManager.getPopulationHealth();
    const bestAgent = this.archiveManager.getBestAgent();
    
    return {
      isRunning: this.isRunning,
      currentGeneration: this.currentGeneration,
      populationStats,
      health,
      bestFitness: bestAgent?.fitness?.accuracy || 0,
      stagnationCount: this.stagnationCount,
      metrics: this.metrics.getSnapshot(),
    };
  }

  /**
   * Export evolution data for analysis
   */
  async exportData(): Promise<string> {
    const exportDir = path.join(this.config.outputDir, 'export', `export_${Date.now()}`);
    await fs.mkdir(exportDir, { recursive: true });
    
    // Export population data
    const populationData = await this.populationManager.exportPopulationData();
    await fs.writeFile(
      path.join(exportDir, 'population.json'),
      JSON.stringify(populationData, null, 2)
    );
    
    // Export archive
    const archiveData = await this.archiveManager.exportArchive();
    await fs.writeFile(
      path.join(exportDir, 'archive.json'),
      JSON.stringify(archiveData, null, 2)
    );
    
    // Export metrics
    await fs.writeFile(
      path.join(exportDir, 'metrics.json'),
      JSON.stringify(this.metrics.export(), null, 2)
    );
    
    console.log(`Data exported to: ${exportDir}`);
    return exportDir;
  }
}

export default EvolutionEngine;