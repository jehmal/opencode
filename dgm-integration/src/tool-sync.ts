/**
 * Tool Synchronization
 * 
 * Manages synchronization between OpenCode tools and DGM improvements.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolRegistration, Improvement } from './types';

export class ToolSync {
  private toolsDir: string;
  private approvedDir: string;
  private experimentalDir: string;

  constructor(private baseDir: string = './shared-tools') {
    this.toolsDir = path.join(baseDir, 'registry');
    this.approvedDir = path.join(baseDir, 'approved');
    this.experimentalDir = path.join(baseDir, 'experimental');
    this.initialize();
  }

  /**
   * Initialize directories
   */
  private async initialize(): Promise<void> {
    const dirs = [this.toolsDir, this.approvedDir, this.experimentalDir];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  /**
   * Register a tool
   */
  async registerTool(tool: ToolRegistration): Promise<void> {
    const filename = `${tool.name}.json`;
    const filepath = path.join(this.toolsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(tool, null, 2));
  }

  /**
   * Get all registered tools
   */
  async getRegisteredTools(): Promise<ToolRegistration[]> {
    const tools: ToolRegistration[] = [];
    
    try {
      const files = await fs.readdir(this.toolsDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }
        
        const content = await fs.readFile(path.join(this.toolsDir, file), 'utf-8');
        tools.push(JSON.parse(content));
      }
    } catch (error) {
      console.error('Failed to read registered tools:', error);
    }
    
    return tools;
  }

  /**
   * Save an experimental improvement
   */
  async saveExperimentalImprovement(improvement: Improvement): Promise<string> {
    const id = `${improvement.toolName}-${Date.now()}`;
    const filename = `${id}.json`;
    const filepath = path.join(this.experimentalDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify({
      id,
      ...improvement,
      created: new Date().toISOString()
    }, null, 2));
    
    return id;
  }

  /**
   * Get experimental improvements
   */
  async getExperimentalImprovements(): Promise<Array<Improvement & { id: string; created: string }>> {
    const improvements: Array<Improvement & { id: string; created: string }> = [];
    
    try {
      const files = await fs.readdir(this.experimentalDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }
        
        const content = await fs.readFile(path.join(this.experimentalDir, file), 'utf-8');
        improvements.push(JSON.parse(content));
      }
    } catch (error) {
      console.error('Failed to read experimental improvements:', error);
    }
    
    return improvements;
  }

  /**
   * Approve an improvement
   */
  async approveImprovement(improvementId: string): Promise<void> {
    const experimentalPath = path.join(this.experimentalDir, `${improvementId}.json`);
    const approvedPath = path.join(this.approvedDir, `${improvementId}.json`);
    
    try {
      const content = await fs.readFile(experimentalPath, 'utf-8');
      const improvement = JSON.parse(content);
      
      // Add approval metadata
      improvement.approved = new Date().toISOString();
      
      await fs.writeFile(approvedPath, JSON.stringify(improvement, null, 2));
      await fs.unlink(experimentalPath);
    } catch (error) {
      throw new Error(`Failed to approve improvement ${improvementId}: ${error}`);
    }
  }

  /**
   * Get approved improvements for a tool
   */
  async getApprovedImprovements(toolName?: string): Promise<Array<Improvement & { id: string; created: string; approved: string }>> {
    const improvements: Array<Improvement & { id: string; created: string; approved: string }> = [];
    
    try {
      const files = await fs.readdir(this.approvedDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }
        
        const content = await fs.readFile(path.join(this.approvedDir, file), 'utf-8');
        const improvement = JSON.parse(content);
        
        if (!toolName || improvement.toolName === toolName) {
          improvements.push(improvement);
        }
      }
    } catch (error) {
      console.error('Failed to read approved improvements:', error);
    }
    
    return improvements;
  }

  /**
   * Deploy an approved improvement
   */
  async deployImprovement(improvementId: string): Promise<void> {
    const approvedPath = path.join(this.approvedDir, `${improvementId}.json`);
    
    try {
      const content = await fs.readFile(approvedPath, 'utf-8');
      const improvement = JSON.parse(content);
      
      // Mark as deployed
      improvement.deployed = new Date().toISOString();
      await fs.writeFile(approvedPath, JSON.stringify(improvement, null, 2));
      
      // TODO: Actual deployment logic would go here
      // This would involve updating the tool's implementation
      // For now, we just mark it as deployed
      
    } catch (error) {
      throw new Error(`Failed to deploy improvement ${improvementId}: ${error}`);
    }
  }

  /**
   * Rollback a deployed improvement
   */
  async rollbackImprovement(improvementId: string): Promise<void> {
    const approvedPath = path.join(this.approvedDir, `${improvementId}.json`);
    
    try {
      const content = await fs.readFile(approvedPath, 'utf-8');
      const improvement = JSON.parse(content);
      
      // Mark as rolled back
      improvement.rolledBack = new Date().toISOString();
      delete improvement.deployed;
      
      await fs.writeFile(approvedPath, JSON.stringify(improvement, null, 2));
      
      // TODO: Actual rollback logic would go here
      
    } catch (error) {
      throw new Error(`Failed to rollback improvement ${improvementId}: ${error}`);
    }
  }

  /**
   * Clean up old experimental improvements
   */
  async cleanupExperimental(daysToKeep: number = 7): Promise<void> {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    try {
      const files = await fs.readdir(this.experimentalDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }
        
        const stat = await fs.stat(path.join(this.experimentalDir, file));
        if (stat.mtimeMs < cutoffTime) {
          await fs.unlink(path.join(this.experimentalDir, file));
        }
      }
    } catch (error) {
      console.error('Failed to cleanup experimental improvements:', error);
    }
  }
}