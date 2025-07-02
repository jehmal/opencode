/**
 * Unified Tool Registry for cross-language tool management
 */

import { 
  Tool,
  ToolCategory,
  ToolFilter,
  ToolHandler,
  Language
} from '../types/typescript/tool.types';
import { TypeScriptPythonAdapter } from './typescript-adapter';
import { ExecutionBridge } from '../../protocol/typescript/src/bridge';

export interface ToolRegistration {
  tool: Tool;
  handler: ToolHandler;
  source: 'local' | 'remote';
  module?: string;
}

export class UnifiedToolRegistry {
  private static instance: UnifiedToolRegistry;
  private tools = new Map<string, Map<Language, ToolRegistration>>();
  private initialized = false;
  
  private constructor() {}
  
  static getInstance(): UnifiedToolRegistry {
    if (!this.instance) {
      this.instance = new UnifiedToolRegistry();
    }
    return this.instance;
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    // Initialize adapters
    await TypeScriptPythonAdapter.initialize();
    
    // Load built-in tools
    await this.loadBuiltInTools();
    
    this.initialized = true;
  }
  
  /**
   * Register a tool
   */
  async register(tool: Tool, handler: ToolHandler, module?: string): Promise<void> {
    const languageMap = this.tools.get(tool.id) || new Map<Language, ToolRegistration>();
    
    languageMap.set(tool.language, {
      tool,
      handler,
      source: module ? 'remote' : 'local',
      module
    });
    
    this.tools.set(tool.id, languageMap);
    
    // If it's a Python tool, make it available to TypeScript
    if (tool.language === 'python' && module) {
      await TypeScriptPythonAdapter.registerPythonTool({
        module,
        info: {
          name: tool.id,
          description: tool.description,
          input_schema: tool.inputSchema
        }
      });
    }
  }
  
  /**
   * Unregister a tool
   */
  async unregister(toolId: string, language?: Language): Promise<void> {
    if (language) {
      const languageMap = this.tools.get(toolId);
      if (languageMap) {
        languageMap.delete(language);
        if (languageMap.size === 0) {
          this.tools.delete(toolId);
        }
      }
    } else {
      this.tools.delete(toolId);
    }
  }
  
  /**
   * Get a tool by ID and optionally language
   */
  async get(toolId: string, language?: Language): Promise<Tool | undefined> {
    const languageMap = this.tools.get(toolId);
    if (!languageMap) {
      return undefined;
    }
    
    if (language) {
      const registration = languageMap.get(language);
      return registration?.tool;
    }
    
    // Return the first available tool
    const firstRegistration = languageMap.values().next().value;
    return firstRegistration?.tool;
  }
  
  /**
   * Get tool handler
   */
  getHandler(toolId: string, language: Language): ToolHandler | undefined {
    const languageMap = this.tools.get(toolId);
    if (!languageMap) {
      return undefined;
    }
    
    const registration = languageMap.get(language);
    return registration?.handler;
  }
  
  /**
   * List tools with optional filter
   */
  async list(filter?: ToolFilter): Promise<Tool[]> {
    const tools: Tool[] = [];
    
    for (const languageMap of this.tools.values()) {
      for (const registration of languageMap.values()) {
        const tool = registration.tool;
        
        // Apply filters
        if (filter) {
          if (filter.category && tool.category !== filter.category) {
            continue;
          }
          if (filter.language && tool.language !== filter.language) {
            continue;
          }
          if (filter.tags && filter.tags.length > 0) {
            const toolTags = tool.metadata?.tags as string[] || [];
            if (!filter.tags.some(tag => toolTags.includes(tag))) {
              continue;
            }
          }
        }
        
        tools.push(tool);
      }
    }
    
    return tools;
  }
  
  /**
   * Search tools by query
   */
  async search(query: string): Promise<Tool[]> {
    const lowerQuery = query.toLowerCase();
    const tools: Tool[] = [];
    
    for (const languageMap of this.tools.values()) {
      for (const registration of languageMap.values()) {
        const tool = registration.tool;
        
        // Search in name, description, and category
        if (
          tool.name.toLowerCase().includes(lowerQuery) ||
          tool.description.toLowerCase().includes(lowerQuery) ||
          tool.category.toLowerCase().includes(lowerQuery)
        ) {
          tools.push(tool);
        }
      }
    }
    
    return tools;
  }
  
  /**
   * Load built-in tools
   */
  private async loadBuiltInTools(): Promise<void> {
    // Load TypeScript tools from OpenCode
    await this.loadOpenCodeTools();
    
    // Load Python tools from DGM
    await this.loadDGMTools();
  }
  
  /**
   * Load OpenCode tools
   */
  private async loadOpenCodeTools(): Promise<void> {
    try {
      // Dynamically import OpenCode tools
      const toolModules = [
        '../../opencode/packages/opencode/src/tool/bash',
        '../../opencode/packages/opencode/src/tool/edit',
        '../../opencode/packages/opencode/src/tool/read',
        '../../opencode/packages/opencode/src/tool/write',
        '../../opencode/packages/opencode/src/tool/ls',
        '../../opencode/packages/opencode/src/tool/grep',
        '../../opencode/packages/opencode/src/tool/glob'
      ];
      
      for (const modulePath of toolModules) {
        try {
          const module = await import(modulePath);
          if (module.default || module.BashTool || module.EditTool) {
            // Extract tool info and register
            const tool = module.default || module.BashTool || module.EditTool;
            if (tool && tool.id) {
              await this.registerOpenCodeTool(tool);
            }
          }
        } catch (error) {
          console.warn(`Failed to load OpenCode tool from ${modulePath}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load OpenCode tools:', error);
    }
  }
  
  /**
   * Register an OpenCode tool
   */
  private async registerOpenCodeTool(toolDef: any): Promise<void> {
    const tool: Tool = {
      id: toolDef.id,
      name: toolDef.id,
      description: toolDef.description || '',
      version: '1.0.0',
      category: this.inferCategory(toolDef.id),
      language: 'typescript',
      inputSchema: this.zodToJsonSchema(toolDef.parameters),
      metadata: {
        source: 'opencode'
      }
    };
    
    const handler: ToolHandler = async (input, context) => {
      try {
        const result = await toolDef.execute(input, {
          abort: context.abortSignal,
          sessionId: context.sessionId,
          messageId: context.messageId,
          timeout: context.timeout,
          metadata: Object.fromEntries(context.metadata)
        });
        
        return {
          success: true,
          data: result
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    };
    
    await this.register(tool, handler);
  }
  
  /**
   * Load DGM tools
   */
  private async loadDGMTools(): Promise<void> {
    try {
      const toolModules = [
        '/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm/tools/bash.py',
        '/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm/tools/edit.py'
      ];
      
      for (const modulePath of toolModules) {
        try {
          await TypeScriptPythonAdapter.loadPythonModule(modulePath);
        } catch (error) {
          console.warn(`Failed to load DGM tool from ${modulePath}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load DGM tools:', error);
    }
  }
  
  /**
   * Infer tool category from ID
   */
  private inferCategory(toolId: string): ToolCategory {
    const categoryMap: Record<string, ToolCategory> = {
      bash: 'utility',
      edit: 'file-system',
      read: 'file-system',
      write: 'file-system',
      ls: 'file-system',
      grep: 'text-processing',
      glob: 'file-system',
      patch: 'file-system',
      multiedit: 'file-system'
    };
    
    return categoryMap[toolId] || 'utility';
  }
  
  /**
   * Convert Zod schema to JSON Schema (simplified)
   */
  private zodToJsonSchema(zodSchema: any): any {
    // This is a simplified conversion
    // In production, use a proper Zod to JSON Schema converter
    return {
      type: 'object',
      properties: {},
      required: []
    };
  }
  
  /**
   * Get available languages for a tool
   */
  getAvailableLanguages(toolId: string): Language[] {
    const languageMap = this.tools.get(toolId);
    if (!languageMap) {
      return [];
    }
    
    return Array.from(languageMap.keys());
  }
  
  /**
   * Check if a tool supports a specific language
   */
  supportsLanguage(toolId: string, language: Language): boolean {
    const languageMap = this.tools.get(toolId);
    if (!languageMap) {
      return false;
    }
    
    return languageMap.has(language);
  }
}

// Export singleton instance
export const toolRegistry = UnifiedToolRegistry.getInstance();