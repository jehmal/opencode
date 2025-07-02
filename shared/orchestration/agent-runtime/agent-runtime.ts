/**
 * Agent Runtime Management for DGM Agents
 * Handles Docker container lifecycle, health checks, and resource management
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface AgentConfig {
  id: string;
  name: string;
  image: string;
  cpuLimit?: string; // e.g., "0.5" for half CPU
  memoryLimit?: string; // e.g., "512m"
  environment?: Record<string, string>;
  volumes?: string[];
  autoRestart?: boolean;
}

export interface AgentStatus {
  id: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  containerId?: string;
  startTime?: Date;
  lastHealthCheck?: Date;
  healthStatus?: 'healthy' | 'unhealthy' | 'unknown';
  metrics?: {
    cpuUsage: number;
    memoryUsage: number;
  };
}

export class AgentRuntime extends EventEmitter {
  private agents: Map<string, AgentStatus> = new Map();
  private healthCheckInterval?: NodeJS.Timer;
  private readonly runtimeDir: string;

  constructor(runtimeDir: string = '/tmp/agent-runtime') {
    super();
    this.runtimeDir = runtimeDir;
    this.initialize();
  }

  private async initialize() {
    // Ensure runtime directory exists
    await fs.mkdir(this.runtimeDir, { recursive: true });
    
    // Start health check loop
    this.healthCheckInterval = setInterval(() => {
      this.checkAllAgents();
    }, 30000); // Every 30 seconds
  }

  async startAgent(config: AgentConfig): Promise<AgentStatus> {
    const existingAgent = this.agents.get(config.id);
    if (existingAgent && existingAgent.status === 'running') {
      throw new Error(`Agent ${config.id} is already running`);
    }

    // Update status
    this.updateAgentStatus(config.id, {
      id: config.id,
      status: 'starting',
      startTime: new Date()
    });

    try {
      // Build docker run command
      const dockerCmd = this.buildDockerCommand(config);
      
      // Start container
      const { stdout } = await execAsync(dockerCmd);
      const containerId = stdout.trim();

      // Update status with container ID
      this.updateAgentStatus(config.id, {
        status: 'running',
        containerId
      });

      this.emit('agent:started', { agentId: config.id, containerId });
      
      return this.agents.get(config.id)!;
    } catch (error) {
      this.updateAgentStatus(config.id, {
        status: 'error'
      });
      this.emit('agent:error', { agentId: config.id, error });
      throw error;
    }
  }

  async stopAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status !== 'running') {
      throw new Error(`Agent ${agentId} is not running`);
    }

    this.updateAgentStatus(agentId, { status: 'stopping' });

    try {
      // Stop container gracefully
      await execAsync(`docker stop ${agent.containerId} --time=10`);
      
      // Remove container
      await execAsync(`docker rm ${agent.containerId}`);
      
      this.updateAgentStatus(agentId, { status: 'stopped' });
      this.emit('agent:stopped', { agentId });
    } catch (error) {
      this.updateAgentStatus(agentId, { status: 'error' });
      this.emit('agent:error', { agentId, error });
      throw error;
    }
  }

  async getAgentStatus(agentId: string): Promise<AgentStatus | undefined> {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.containerId) {
      return agent;
    }

    try {
      // Get container stats
      const { stdout } = await execAsync(
        `docker stats ${agent.containerId} --no-stream --format "{{json .}}"`
      );
      
      const stats = JSON.parse(stdout);
      agent.metrics = {
        cpuUsage: parseFloat(stats.CPUPerc.replace('%', '')),
        memoryUsage: this.parseMemoryUsage(stats.MemUsage)
      };
    } catch (error) {
      // Container might be stopped
    }

    return agent;
  }

  async executeInAgent(agentId: string, command: string): Promise<string> {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status !== 'running') {
      throw new Error(`Agent ${agentId} is not running`);
    }

    const { stdout } = await execAsync(
      `docker exec ${agent.containerId} ${command}`
    );
    
    return stdout;
  }

  private buildDockerCommand(config: AgentConfig): string {
    const parts = ['docker run -d'];
    
    // Resource limits
    if (config.cpuLimit) {
      parts.push(`--cpus="${config.cpuLimit}"`);
    }
    if (config.memoryLimit) {
      parts.push(`-m ${config.memoryLimit}`);
    }
    
    // Environment variables
    if (config.environment) {
      Object.entries(config.environment).forEach(([key, value]) => {
        parts.push(`-e ${key}="${value}"`);
      });
    }
    
    // Volumes
    if (config.volumes) {
      config.volumes.forEach(volume => {
        parts.push(`-v ${volume}`);
      });
    }
    
    // Name and restart policy
    parts.push(`--name agent-${config.id}`);
    if (config.autoRestart) {
      parts.push('--restart unless-stopped');
    }
    
    // Security
    parts.push('--security-opt no-new-privileges');
    parts.push('--cap-drop ALL');
    
    // Network
    parts.push('--network agent-network');
    
    // Image
    parts.push(config.image);
    
    return parts.join(' ');
  }

  private async checkAllAgents() {
    for (const [agentId, agent] of this.agents) {
      if (agent.status === 'running' && agent.containerId) {
        try {
          const { stdout } = await execAsync(
            `docker inspect --format='{{.State.Health.Status}}' ${agent.containerId}`
          );
          
          const healthStatus = stdout.trim() as 'healthy' | 'unhealthy' | 'unknown';
          agent.healthStatus = healthStatus;
          agent.lastHealthCheck = new Date();
          
          if (healthStatus === 'unhealthy') {
            this.emit('agent:unhealthy', { agentId });
          }
        } catch (error) {
          // Container might be stopped
          agent.healthStatus = 'unknown';
        }
      }
    }
  }

  private updateAgentStatus(agentId: string, updates: Partial<AgentStatus>) {
    const current = this.agents.get(agentId) || { id: agentId } as AgentStatus;
    this.agents.set(agentId, { ...current, ...updates });
  }

  private parseMemoryUsage(memUsage: string): number {
    // Parse Docker memory usage string (e.g., "100MiB / 512MiB")
    const [used] = memUsage.split(' / ');
    const value = parseFloat(used);
    if (used.includes('GiB')) return value * 1024;
    if (used.includes('MiB')) return value;
    if (used.includes('KiB')) return value / 1024;
    return value;
  }

  async cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Stop all running agents
    for (const [agentId, agent] of this.agents) {
      if (agent.status === 'running') {
        await this.stopAgent(agentId);
      }
    }
  }
}

export default AgentRuntime;