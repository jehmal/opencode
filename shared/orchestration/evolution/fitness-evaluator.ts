/**
 * Fitness Evaluator
 * Evaluates agent performance and calculates fitness scores
 * Supports SWE-bench and Polyglot evaluation methods with resource management
 */

import { EventEmitter } from 'events';
import * as amqp from 'amqplib';
import * as os from 'os';
import { 
  Agent, 
  FitnessScore, 
  EvaluationResult, 
  EvolutionEventType,
  EvaluationMethod,
  SWEBenchConfig,
  PolyglotConfig,
  ResourceMetrics
} from './evolution-types';

export interface EvaluationRequest {
  agentId: string;
  commitId: string;
  evaluationMethod: EvaluationMethod;
  taskList: string[];
  numEvals: number;
  shallowEval: boolean;
  timeout: number;
  resourceConstraints?: ResourceConstraints;
}

export interface ResourceConstraints {
  maxMemoryMB?: number;
  maxCpuPercent?: number;
  maxDiskMB?: number;
}

export interface EvaluationResponse {
  agentId: string;
  commitId: string;
  fitness: FitnessScore;
  evaluationResults: EvaluationResult[];
  executionTime: number;
  resourceMetrics?: ResourceMetrics;
  error?: string;
}

export class FitnessEvaluator extends EventEmitter {
  private amqpConnection?: amqp.Connection;
  private requestChannel?: amqp.Channel;
  private responseChannel?: amqp.Channel;
  private pendingEvaluations: Map<string, (response: EvaluationResponse) => void> = new Map();
  private resourceMonitorInterval?: NodeJS.Timer;
  private currentResourceUsage: ResourceMetrics = {
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    networkIO: 0
  };

  constructor(
    private config: {
      amqpUrl: string;
      evaluationTimeout?: number;
      resourceConstraints?: ResourceConstraints;
      monitoringInterval?: number;
      parallelEvaluations?: number;
    }
  ) {
    super();
    this.initialize();
    this.startResourceMonitoring();
  }

  private async initialize() {
    try {
      this.amqpConnection = await amqp.connect(this.config.amqpUrl);
      
      this.requestChannel = await this.amqpConnection.createChannel();
      this.responseChannel = await this.amqpConnection.createChannel();
      
      // Setup evaluation queues
      await this.requestChannel.assertQueue('evaluation_requests', {
        durable: true,
        arguments: {
          'x-message-ttl': 600000, // 10 minutes TTL
        }
      });
      
      await this.responseChannel.assertQueue('evaluation_responses', {
        durable: true
      });
      
      // Start consuming responses
      await this.startResponseConsumer();
      
      this.emit('evaluator:ready');
    } catch (error) {
      this.emit('evaluator:error', error);
      throw error;
    }
  }

  async evaluateAgent(
    agent: Agent,
    evaluationMethod: EvaluationMethod,
    config: {
      numEvals?: number;
      shallowEval?: boolean;
      testMoreThreshold?: number;
    } = {}
  ): Promise<FitnessScore> {
    // Check resource constraints before evaluation
    if (!this.checkResourceAvailability()) {
      throw new Error('Insufficient resources for evaluation');
    }

    const taskList = this.getTaskList(evaluationMethod, config.shallowEval || false);
    
    const request: EvaluationRequest = {
      agentId: agent.id,
      commitId: agent.commitId,
      evaluationMethod,
      taskList,
      numEvals: config.numEvals || 1,
      shallowEval: config.shallowEval || false,
      timeout: this.config.evaluationTimeout || 300000, // 5 minutes default
      resourceConstraints: this.config.resourceConstraints
    };

    return new Promise((resolve, reject) => {
      const correlationId = `${agent.id}-${Date.now()}`;
      const timeout = setTimeout(() => {
        this.pendingEvaluations.delete(correlationId);
        reject(new Error(`Evaluation timeout for agent ${agent.id}`));
      }, request.timeout);

      this.pendingEvaluations.set(correlationId, (response) => {
        clearTimeout(timeout);
        
        if (response.error) {
          reject(new Error(response.error));
        } else {
          // Update fitness with resource metrics
          if (response.resourceMetrics) {
            response.fitness.memoryUsage = response.resourceMetrics.memoryUsage;
            response.fitness.executionTime = response.executionTime;
          }
          resolve(response.fitness);
        }
      });

      // Send evaluation request
      this.requestChannel!.sendToQueue(
        'evaluation_requests',
        Buffer.from(JSON.stringify(request)),
        {
          persistent: true,
          correlationId,
          replyTo: 'evaluation_responses',
        }
      );
    });
  }

  private getTaskList(evaluationMethod: EvaluationMethod, shallowEval: boolean): string[] {
    if (evaluationMethod.name === 'swe-bench') {
      const config = evaluationMethod.config as SWEBenchConfig;
      if (shallowEval) {
        return config.taskLists.small;
      } else {
        return [...config.taskLists.small, ...config.taskLists.medium];
      }
    } else {
      const config = evaluationMethod.config as PolyglotConfig;
      // Combine tasks from different languages
      const allTasks: string[] = [];
      for (const lang of config.languages) {
        if (config.taskSets[lang]) {
          allTasks.push(...config.taskSets[lang]);
        }
      }
      return allTasks;
    }
  }

  calculateFitness(evaluationResults: EvaluationResult[]): FitnessScore {
    const resolved = evaluationResults.filter(r => r.status === 'resolved');
    const unresolved = evaluationResults.filter(r => r.status === 'unresolved');
    const emptyPatch = evaluationResults.filter(r => r.status === 'empty_patch');
    const errors = evaluationResults.filter(r => r.status === 'error');
    
    const total = evaluationResults.length;
    const accuracy = total > 0 ? resolved.length / total : 0;
    
    // Check for context length issues
    const contextLengthExceeded = errors.some(r => 
      r.error?.includes('Input is too long for requested model')
    );
    
    // Assume compilation success if we got results
    const compilationSuccess = evaluationResults.length > 0 && 
                              errors.length < evaluationResults.length;

    return {
      accuracy,
      resolvedCount: resolved.length,
      unresolvedCount: unresolved.length,
      emptyPatchCount: emptyPatch.length,
      contextLengthExceeded,
      compilationSuccess,
      testsPassed: resolved.length,
      totalTests: total,
    };
  }

  async evaluateBatch(
    agents: Agent[],
    evaluationMethod: EvaluationMethod,
    config: {
      numEvals?: number;
      shallowEval?: boolean;
      testMoreThreshold?: number;
      maxConcurrent?: number;
      retryFailedEvaluations?: boolean;
    } = {}
  ): Promise<Map<string, FitnessScore>> {
    const results = new Map<string, FitnessScore>();
    const maxConcurrent = config.maxConcurrent || this.config.parallelEvaluations || 5;
    
    // Adaptive concurrency based on resource availability
    const adaptiveConcurrency = this.calculateAdaptiveConcurrency(maxConcurrent);
    
    // Process in batches with adaptive sizing
    for (let i = 0; i < agents.length; i += adaptiveConcurrency) {
      // Check resources before starting batch
      if (!this.checkResourceAvailability()) {
        this.emit('evaluation:paused', { reason: 'resource_constraint', progress: i / agents.length });
        // Wait for resources to become available
        await this.waitForResources();
      }
      
      const batch = agents.slice(i, i + adaptiveConcurrency);
      const batchPromises = batch.map(agent =>
        (config.retryFailedEvaluations ? 
          this.retryEvaluation(agent, evaluationMethod, config) : 
          this.evaluateAgent(agent, evaluationMethod, config)
        )
          .then(fitness => {
            results.set(agent.id, fitness);
            this.emit(EvolutionEventType.AGENT_EVALUATED, { 
              agent, 
              fitness,
              progress: (i + batch.indexOf(agent) + 1) / agents.length
            });
          })
          .catch(error => {
            console.error(`Failed to evaluate agent ${agent.id}:`, error);
            const failedFitness: FitnessScore = {
              accuracy: 0,
              resolvedCount: 0,
              unresolvedCount: 0,
              emptyPatchCount: 0,
              contextLengthExceeded: error.message?.includes('Input is too long'),
              compilationSuccess: false,
              testsPassed: 0,
              totalTests: 0,
            };
            results.set(agent.id, failedFitness);
            this.emit('evaluation:failed', { agent, error: error.message });
          })
      );
      
      await Promise.all(batchPromises);
      
      // Emit batch completion
      this.emit('batch:complete', { 
        batchIndex: Math.floor(i / adaptiveConcurrency),
        totalBatches: Math.ceil(agents.length / adaptiveConcurrency),
        evaluated: results.size
      });
    }
    
    return results;
  }

  /**
   * Calculate adaptive concurrency based on current resource usage
   */
  private calculateAdaptiveConcurrency(maxConcurrent: number): number {
    const cpuFactor = 1 - (this.currentResourceUsage.cpuUsage / 100);
    const memoryFactor = 1 - (this.currentResourceUsage.memoryUsage / 100);
    
    const resourceFactor = Math.min(cpuFactor, memoryFactor);
    const adaptiveConcurrency = Math.max(1, Math.floor(maxConcurrent * resourceFactor));
    
    return adaptiveConcurrency;
  }

  /**
   * Wait for resources to become available
   */
  private async waitForResources(maxWaitTime: number = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (!this.checkResourceAvailability()) {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error('Timeout waiting for resources');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
    }
  }

  private async startResponseConsumer() {
    await this.responseChannel!.consume('evaluation_responses', async (msg) => {
      if (!msg) return;
      
      try {
        const response: EvaluationResponse = JSON.parse(msg.content.toString());
        const correlationId = msg.properties.correlationId;
        
        const handler = this.pendingEvaluations.get(correlationId);
        if (handler) {
          handler(response);
          this.pendingEvaluations.delete(correlationId);
        }
        
        this.responseChannel!.ack(msg);
      } catch (error) {
        console.error('Error processing evaluation response:', error);
        this.responseChannel!.nack(msg, false, false);
      }
    });
  }

  getFullEvaluationThreshold(agents: Agent[]): number {
    // Get scores from eligible agents that had full evaluation
    const fullEvalScores = agents
      .filter(agent => 
        agent.fitness && 
        agent.metadata.overall_performance.total_submitted_instances >= 100
      )
      .map(agent => agent.fitness!.accuracy)
      .sort((a, b) => b - a);
    
    // Get second highest score or default to 0.4
    const threshold = fullEvalScores.length > 1 ? fullEvalScores[1] : 
                     fullEvalScores.length > 0 ? fullEvalScores[0] : 0.4;
    
    // Ensure minimum threshold of 0.4
    return Math.max(threshold, 0.4);
  }

  shouldRunFullEvaluation(
    agent: Agent,
    threshold: number,
    noFullEval: boolean = false
  ): boolean {
    if (noFullEval) return false;
    
    if (!agent.fitness) return true;
    
    // Run full evaluation if agent exceeds threshold
    return agent.fitness.accuracy >= threshold;
  }

  async cleanup() {
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
    }
    await this.amqpConnection?.close();
  }

  /**
   * Start monitoring system resources
   */
  private startResourceMonitoring() {
    const interval = this.config.monitoringInterval || 5000; // 5 seconds default
    
    this.resourceMonitorInterval = setInterval(() => {
      this.updateResourceMetrics();
    }, interval);
  }

  /**
   * Update current resource usage metrics
   */
  private updateResourceMetrics() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    // Calculate CPU usage (simplified)
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    this.currentResourceUsage = {
      cpuUsage,
      memoryUsage,
      diskUsage: 0, // Would need fs module for disk usage
      networkIO: 0  // Would need network monitoring for this
    };
    
    this.emit('resource:update', this.currentResourceUsage);
  }

  /**
   * Check if resources are available for evaluation
   */
  private checkResourceAvailability(): boolean {
    if (!this.config.resourceConstraints) {
      return true;
    }
    
    const { maxMemoryMB, maxCpuPercent } = this.config.resourceConstraints;
    
    if (maxMemoryMB) {
      const currentMemoryMB = (os.totalmem() - os.freemem()) / (1024 * 1024);
      if (currentMemoryMB > maxMemoryMB) {
        this.emit('resource:constraint', { type: 'memory', current: currentMemoryMB, max: maxMemoryMB });
        return false;
      }
    }
    
    if (maxCpuPercent && this.currentResourceUsage.cpuUsage > maxCpuPercent) {
      this.emit('resource:constraint', { type: 'cpu', current: this.currentResourceUsage.cpuUsage, max: maxCpuPercent });
      return false;
    }
    
    return true;
  }

  /**
   * Get current resource usage
   */
  getResourceMetrics(): ResourceMetrics {
    return { ...this.currentResourceUsage };
  }

  /**
   * Calculate adaptive timeout based on task complexity and current resources
   */
  private calculateAdaptiveTimeout(taskCount: number, baseTimeout: number): number {
    const resourceFactor = 1 + (this.currentResourceUsage.cpuUsage / 100);
    const complexityFactor = Math.log10(taskCount + 1) + 1;
    
    return Math.min(
      baseTimeout * resourceFactor * complexityFactor,
      3600000 // Max 1 hour
    );
  }

  /**
   * Handle evaluation failures with exponential backoff
   */
  private async retryEvaluation(
    agent: Agent,
    evaluationMethod: EvaluationMethod,
    config: any,
    maxRetries: number = 3
  ): Promise<FitnessScore> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.evaluateAgent(agent, evaluationMethod, config);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries - 1) {
          const backoffTime = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    throw lastError || new Error('Evaluation failed after retries');
  }
}

export default FitnessEvaluator;