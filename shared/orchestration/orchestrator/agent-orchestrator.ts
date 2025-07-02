/**
 * Agent Orchestrator Service
 * Manages task distribution, agent coordination, and workflow execution
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as amqp from 'amqplib';
import { AgentRuntime, AgentConfig } from '../agent-runtime/agent-runtime';
import { Redis } from 'ioredis';

export interface Task {
  id: string;
  type: 'coding' | 'analysis' | 'evolution' | 'tool_execution';
  priority: number;
  prompt: string;
  context?: Record<string, any>;
  dependencies?: string[];
  timeout?: number;
  createdAt: Date;
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
  assignedTo?: string;
  result?: any;
  error?: string;
}

export interface Workflow {
  id: string;
  name: string;
  tasks: Task[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export interface AgentCapabilities {
  agentId: string;
  taskTypes: string[];
  maxConcurrentTasks: number;
  specializations?: string[];
}

export class AgentOrchestrator extends EventEmitter {
  private runtime: AgentRuntime;
  private redis: Redis;
  private amqpConnection?: amqp.Connection;
  private taskChannel?: amqp.Channel;
  private resultChannel?: amqp.Channel;
  
  private agents: Map<string, AgentCapabilities> = new Map();
  private taskQueue: Task[] = [];
  private activeWorkflows: Map<string, Workflow> = new Map();
  private taskAssignments: Map<string, string> = new Map(); // taskId -> agentId
  
  constructor(
    private config: {
      redisUrl: string;
      amqpUrl: string;
      maxRetries?: number;
      taskTimeout?: number;
    }
  ) {
    super();
    this.runtime = new AgentRuntime();
    this.redis = new Redis(config.redisUrl);
    this.initialize();
  }

  private async initialize() {
    try {
      // Connect to RabbitMQ
      this.amqpConnection = await amqp.connect(this.config.amqpUrl);
      
      // Create channels
      this.taskChannel = await this.amqpConnection.createChannel();
      this.resultChannel = await this.amqpConnection.createChannel();
      
      // Setup queues
      await this.setupQueues();
      
      // Start consuming results
      await this.startResultConsumer();
      
      // Start task scheduler
      this.startTaskScheduler();
      
      this.emit('orchestrator:ready');
    } catch (error) {
      this.emit('orchestrator:error', error);
      throw error;
    }
  }

  private async setupQueues() {
    // Task distribution queue
    await this.taskChannel!.assertQueue('agent_tasks', {
      durable: true,
      arguments: {
        'x-message-ttl': 300000, // 5 minutes TTL
        'x-max-priority': 10
      }
    });
    
    // Result collection queue
    await this.resultChannel!.assertQueue('task_results', {
      durable: true
    });
    
    // Dead letter queue for failed tasks
    await this.taskChannel!.assertQueue('task_dlq', {
      durable: true
    });
  }

  async registerAgent(capabilities: AgentCapabilities): Promise<void> {
    const { agentId } = capabilities;
    
    // Start agent container
    const agentConfig: AgentConfig = {
      id: agentId,
      name: `dgm-agent-${agentId}`,
      image: 'dgmstt/agent:latest',
      cpuLimit: '0.5',
      memoryLimit: '512m',
      environment: {
        AGENT_ID: agentId,
        REDIS_URL: this.config.redisUrl,
        AMQP_URL: this.config.amqpUrl
      },
      autoRestart: true
    };
    
    await this.runtime.startAgent(agentConfig);
    
    // Store capabilities
    this.agents.set(agentId, capabilities);
    await this.redis.hset('agents', agentId, JSON.stringify(capabilities));
    
    this.emit('agent:registered', { agentId, capabilities });
  }

  async createWorkflow(name: string, tasks: Omit<Task, 'id' | 'createdAt' | 'status'>[]): Promise<Workflow> {
    const workflow: Workflow = {
      id: uuidv4(),
      name,
      tasks: tasks.map(t => ({
        ...t,
        id: uuidv4(),
        createdAt: new Date(),
        status: 'pending'
      })),
      status: 'pending',
      createdAt: new Date()
    };
    
    // Store workflow
    this.activeWorkflows.set(workflow.id, workflow);
    await this.redis.hset('workflows', workflow.id, JSON.stringify(workflow));
    
    // Add tasks to queue
    for (const task of workflow.tasks) {
      await this.enqueueTask(task);
    }
    
    workflow.status = 'running';
    this.emit('workflow:created', workflow);
    
    return workflow;
  }

  async enqueueTask(task: Task): Promise<void> {
    // Check dependencies
    if (task.dependencies?.length) {
      const pendingDeps = task.dependencies.filter(depId => {
        const depTask = this.findTaskById(depId);
        return depTask && depTask.status !== 'completed';
      });
      
      if (pendingDeps.length > 0) {
        // Re-queue after dependencies complete
        setTimeout(() => this.enqueueTask(task), 5000);
        return;
      }
    }
    
    // Add to queue
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => b.priority - a.priority);
    
    // Store in Redis
    await this.redis.zadd('task_queue', task.priority, JSON.stringify(task));
    
    this.emit('task:enqueued', task);
  }

  private async startTaskScheduler() {
    setInterval(async () => {
      await this.scheduleTasks();
    }, 1000); // Check every second
  }

  private async scheduleTasks() {
    const availableAgents = this.getAvailableAgents();
    
    for (const agent of availableAgents) {
      const task = this.findSuitableTask(agent);
      if (!task) continue;
      
      await this.assignTaskToAgent(task, agent.agentId);
    }
  }

  private getAvailableAgents(): AgentCapabilities[] {
    const available: AgentCapabilities[] = [];
    
    for (const [agentId, capabilities] of this.agents) {
      const assignedTasks = Array.from(this.taskAssignments.values())
        .filter(id => id === agentId).length;
      
      if (assignedTasks < capabilities.maxConcurrentTasks) {
        available.push(capabilities);
      }
    }
    
    return available;
  }

  private findSuitableTask(agent: AgentCapabilities): Task | undefined {
    return this.taskQueue.find(task => {
      // Check if agent can handle task type
      if (!agent.taskTypes.includes(task.type)) return false;
      
      // Check if task is not already assigned
      if (task.status !== 'pending') return false;
      
      // Check specializations if any
      if (agent.specializations && task.context?.requiredSpecializations) {
        const required = task.context.requiredSpecializations as string[];
        return required.every(spec => agent.specializations!.includes(spec));
      }
      
      return true;
    });
  }

  private async assignTaskToAgent(task: Task, agentId: string) {
    // Update task status
    task.status = 'assigned';
    task.assignedTo = agentId;
    
    // Remove from queue
    const index = this.taskQueue.indexOf(task);
    if (index > -1) {
      this.taskQueue.splice(index, 1);
    }
    
    // Store assignment
    this.taskAssignments.set(task.id, agentId);
    await this.redis.hset('task_assignments', task.id, agentId);
    
    // Send task to agent via RabbitMQ
    const message = {
      task_id: task.id,
      task_type: task.type,
      prompt: task.prompt,
      context: task.context,
      timeout: task.timeout || this.config.taskTimeout || 300000
    };
    
    await this.taskChannel!.sendToQueue(
      'agent_tasks',
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
        priority: task.priority,
        headers: {
          'agent-id': agentId
        }
      }
    );
    
    // Update task status
    task.status = 'running';
    
    this.emit('task:assigned', { task, agentId });
  }

  private async startResultConsumer() {
    await this.resultChannel!.consume('task_results', async (msg) => {
      if (!msg) return;
      
      try {
        const result = JSON.parse(msg.content.toString());
        await this.handleTaskResult(result);
        
        // Acknowledge message
        this.resultChannel!.ack(msg);
      } catch (error) {
        console.error('Error processing result:', error);
        // Reject and requeue
        this.resultChannel!.nack(msg, false, true);
      }
    });
  }

  private async handleTaskResult(result: any) {
    const { task_id, status, result: taskResult, error } = result;
    
    // Find task
    const task = this.findTaskById(task_id);
    if (!task) {
      console.warn(`Task ${task_id} not found`);
      return;
    }
    
    // Update task
    task.status = status === 'completed' ? 'completed' : 'failed';
    task.result = taskResult;
    task.error = error;
    
    // Remove assignment
    this.taskAssignments.delete(task_id);
    await this.redis.hdel('task_assignments', task_id);
    
    // Check workflow completion
    await this.checkWorkflowCompletion(task);
    
    this.emit('task:completed', task);
  }

  private async checkWorkflowCompletion(task: Task) {
    for (const [workflowId, workflow] of this.activeWorkflows) {
      const workflowTask = workflow.tasks.find(t => t.id === task.id);
      if (!workflowTask) continue;
      
      // Check if all tasks are completed
      const allCompleted = workflow.tasks.every(t => 
        t.status === 'completed' || t.status === 'failed'
      );
      
      if (allCompleted) {
        workflow.status = workflow.tasks.some(t => t.status === 'failed') 
          ? 'failed' 
          : 'completed';
        workflow.completedAt = new Date();
        
        await this.redis.hset('workflows', workflowId, JSON.stringify(workflow));
        this.emit('workflow:completed', workflow);
      }
    }
  }

  private findTaskById(taskId: string): Task | undefined {
    // Check active tasks
    for (const workflow of this.activeWorkflows.values()) {
      const task = workflow.tasks.find(t => t.id === taskId);
      if (task) return task;
    }
    
    // Check queue
    return this.taskQueue.find(t => t.id === taskId);
  }

  async getWorkflowStatus(workflowId: string): Promise<Workflow | undefined> {
    return this.activeWorkflows.get(workflowId);
  }

  async getAgentStatus(agentId: string) {
    const capabilities = this.agents.get(agentId);
    const runtimeStatus = await this.runtime.getAgentStatus(agentId);
    const assignedTasks = Array.from(this.taskAssignments.entries())
      .filter(([_, id]) => id === agentId)
      .map(([taskId]) => taskId);
    
    return {
      capabilities,
      runtime: runtimeStatus,
      assignedTasks
    };
  }

  async shutdown() {
    // Stop task scheduler
    this.emit('orchestrator:shutdown');
    
    // Close connections
    await this.amqpConnection?.close();
    await this.redis.quit();
    await this.runtime.cleanup();
  }
}

export default AgentOrchestrator;