/**
 * Tool Synchronization between OpenCode and DGM
 */

import { z } from 'zod';
import { DGMBridge } from './dgm-bridge';

// Tool definition schema matching OpenCode's structure
export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
    required: z.array(z.string()).optional()
  }),
  handler: z.function().optional() // Optional as it's TypeScript-only
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export interface ToolSyncOptions {
  autoSync?: boolean;
  syncInterval?: number;
  filterTools?: (tool: ToolDefinition) => boolean;
}

export class ToolSynchronizer {
  private tools: Map<string, ToolDefinition> = new Map();
  private bridge: DGMBridge;
  private syncTimer?: NodeJS.Timer;
  private options: Required<ToolSyncOptions>;

  constructor(bridge: DGMBridge, options: ToolSyncOptions = {}) {
    this.bridge = bridge;
    this.options = {
      autoSync: options.autoSync ?? true,
      syncInterval: options.syncInterval ?? 60000, // 1 minute default
      filterTools: options.filterTools ?? (() => true)
    };

    if (this.options.autoSync) {
      this.startAutoSync();
    }
  }

  /**
   * Register a tool with the synchronizer
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    
    if (this.bridge.isReady()) {
      // Sync immediately if bridge is ready
      this.syncTool(tool).catch(error => {
        console.error(`Failed to sync tool ${tool.name}:`, error);
      });
    }
  }

  /**
   * Register multiple tools at once
   */
  registerTools(tools: ToolDefinition[]): void {
    tools.forEach(tool => this.registerTool(tool));
  }

  /**
   * Remove a tool from synchronization
   */
  unregisterTool(toolName: string): void {
    this.tools.delete(toolName);
    
    if (this.bridge.isReady()) {
      this.bridge.call({
        method: 'unregister_tool',
        params: { tool_name: toolName }
      }).catch(error => {
        console.error(`Failed to unregister tool ${toolName}:`, error);
      });
    }
  }

  /**
   * Get all registered tools
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Sync a single tool with DGM
   */
  private async syncTool(tool: ToolDefinition): Promise<void> {
    if (!this.options.filterTools(tool)) {
      return;
    }

    // Remove handler function before sending to Python
    const { handler, ...toolDef } = tool;
    
    const response = await this.bridge.call({
      method: 'register_tool',
      params: {
        tool: toolDef
      }
    });

    if (!response.success) {
      throw new Error(`Failed to sync tool ${tool.name}: ${response.error}`);
    }
  }

  /**
   * Sync all tools with DGM
   */
  async syncAll(): Promise<void> {
    const tools = Array.from(this.tools.values())
      .filter(this.options.filterTools)
      .map(({ handler, ...tool }) => tool);

    const response = await this.bridge.call({
      method: 'sync_tools',
      params: { tools }
    });

    if (!response.success) {
      throw new Error(`Failed to sync tools: ${response.error}`);
    }
  }

  /**
   * Start automatic synchronization
   */
  private startAutoSync(): void {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setInterval(() => {
      if (this.bridge.isReady()) {
        this.syncAll().catch(error => {
          console.error('Auto-sync failed:', error);
        });
      }
    }, this.options.syncInterval);
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Get synchronization status
   */
  async getSyncStatus(): Promise<{
    synchronized: number;
    pending: number;
    failed: string[];
  }> {
    if (!this.bridge.isReady()) {
      return {
        synchronized: 0,
        pending: this.tools.size,
        failed: []
      };
    }

    const response = await this.bridge.call({
      method: 'get_tool_sync_status',
      params: {}
    });

    if (response.success && response.data) {
      return response.data;
    }

    return {
      synchronized: 0,
      pending: this.tools.size,
      failed: []
    };
  }

  /**
   * Import tools from OpenCode's tool registry
   */
  async importFromOpenCode(toolRegistry: any): Promise<void> {
    // This would integrate with OpenCode's actual tool system
    // For now, it's a placeholder showing the intended interface
    
    if (toolRegistry && typeof toolRegistry.getTools === 'function') {
      const tools = await toolRegistry.getTools();
      
      for (const tool of tools) {
        // Transform OpenCode tool format to our format if needed
        const toolDef: ToolDefinition = {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters || {
            type: 'object',
            properties: {},
            required: []
          }
        };
        
        this.registerTool(toolDef);
      }
    }
  }

  /**
   * Execute a tool through DGM
   */
  async executeTool(toolName: string, params: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    // If tool has a local handler, use it
    if (tool.handler) {
      return tool.handler(params);
    }

    // Otherwise, execute through DGM
    const response = await this.bridge.executeTool(toolName, params);
    
    if (!response.success) {
      throw new Error(`Tool execution failed: ${response.error}`);
    }

    return response.data;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopAutoSync();
    this.tools.clear();
  }
}