/**
 * Tool Registry Manager for Cross-Language Tool Execution
 * Manages tool registration, discovery, and metadata for both TypeScript and Python tools
 */

import { 
  ToolMetadata,
  ToolCapability,
  ToolExecutionRequest,
  ToolExecutionResult,
  Language,
  PROTOCOL_VERSION
} from './types'
import { ToolRegistry } from './registry'
import { ExecutionBridge } from './bridge'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface RegisteredTool {
  id: string
  name: string
  description: string
  language: Language
  category: string
  version: string
  inputSchema: Record<string, any>
  outputSchema?: Record<string, any>
  capabilities: ToolCapability[]
  dependencies: string[]
  examples: Array<Record<string, any>>
  handler?: (params: any, context: any) => Promise<any>
  remote: boolean
  registeredAt: Date
  lastUsed?: Date
  executionCount: number
  averageExecutionTime: number
}

export interface ToolFilter {
  category?: string
  language?: Language
  capabilities?: string[]
}

export interface ToolStatistics {
  id: string
  executionCount: number
  averageExecutionTime: number
  lastUsed?: string
  registeredAt: string
}

export class ToolRegistryManager {
  private static instance: ToolRegistryManager | null = null
  
  private language: Language
  private tools: Map<string, RegisteredTool> = new Map()
  private remoteTools: Map<string, RegisteredTool> = new Map()
  private capabilities: Map<string, Set<string>> = new Map() // capability -> tool_ids
  private categories: Map<string, Set<string>> = new Map()   // category -> tool_ids
  private bridge?: ExecutionBridge
  private syncLock = false
  private initialized = false
  
  private constructor(language: Language = Language.TYPESCRIPT) {
    this.language = language
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(language?: Language): ToolRegistryManager {
    if (!ToolRegistryManager.instance) {
      ToolRegistryManager.instance = new ToolRegistryManager(language)
    }
    return ToolRegistryManager.instance
  }
  
  /**
   * Initialize the registry manager
   */
  async initialize(bridge?: ExecutionBridge): Promise<void> {
    if (this.initialized) {
      return
    }
    
    this.bridge = bridge || new ExecutionBridge()
    
    // Load local tools
    await this.loadLocalTools()
    
    // Sync with remote registry if bridge is available
    if (this.bridge) {
      await this.syncRemoteTools()
    }
    
    this.initialized = true
    console.log(`ToolRegistryManager initialized with ${this.tools.size} local tools and ${this.remoteTools.size} remote tools`)
  }
  
  /**
   * Load tools from the local registry
   */
  private async loadLocalTools(): Promise<void> {
    if (this.language === Language.TYPESCRIPT) {
      await this.loadTypeScriptTools()
    } else {
      await this.loadPythonTools()
    }
  }
  
  /**
   * Load TypeScript tools from opencode/packages/opencode/src/tool directory
   */
  private async loadTypeScriptTools(): Promise<void> {
    const toolsDir = path.join(__dirname, '../../../../opencode/packages/opencode/src/tool')
    
    try {
      const files = await fs.readdir(toolsDir)
      
      for (const file of files) {
        if (!file.endsWith('.ts') || file === 'tool.ts') {
          continue
        }
        
        try {
          // Dynamically import tool module
          const modulePath = path.join(toolsDir, file)
          const module = await import(modulePath)
          
          // Look for tool exports
          for (const exportName of Object.keys(module)) {
            const exported = module[exportName]
            
            if (exported && typeof exported === 'object' && exported.id) {
              // Create RegisteredTool
              const tool: RegisteredTool = {
                id: exported.id,
                name: exported.name || exported.id,
                description: exported.description || '',
                language: Language.TYPESCRIPT,
                category: exported.category || 'utility',
                version: exported.version || '1.0.0',
                inputSchema: exported.parameters || {},
                outputSchema: exported.outputSchema,
                capabilities: exported.capabilities || [],
                dependencies: exported.dependencies || [],
                examples: exported.examples || [],
                handler: exported.execute,
                remote: false,
                registeredAt: new Date(),
                executionCount: 0,
                averageExecutionTime: 0
              }
              
              await this.registerTool(tool)
            }
          }
        } catch (error) {
          console.error(`Failed to load tool from ${file}:`, error)
        }
      }
    } catch (error) {
      console.warn(`Tools directory not found: ${toolsDir}`)
    }
  }
  
  /**
   * Load Python tools via bridge
   */
  private async loadPythonTools(): Promise<void> {
    // Python tools are loaded via the bridge
  }
  
  /**
   * Register a tool in the registry
   */
  async registerTool(tool: RegisteredTool): Promise<void> {
    while (this.syncLock) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    this.syncLock = true
    try {
      this.tools.set(tool.id, tool)
      
      // Update capability index
      for (const capability of tool.capabilities) {
        if (!this.capabilities.has(capability)) {
          this.capabilities.set(capability, new Set())
        }
        this.capabilities.get(capability)!.add(tool.id)
      }
      
      // Update category index
      if (!this.categories.has(tool.category)) {
        this.categories.set(tool.category, new Set())
      }
      this.categories.get(tool.category)!.add(tool.id)
      
      console.log(`Registered tool: ${tool.id} (${tool.language})`)
    } finally {
      this.syncLock = false
    }
  }
  
  /**
   * Unregister a tool from the registry
   */
  async unregisterTool(toolId: string): Promise<void> {
    while (this.syncLock) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    this.syncLock = true
    try {
      const tool = this.tools.get(toolId)
      if (tool) {
        // Remove from capability index
        for (const capability of tool.capabilities) {
          this.capabilities.get(capability)?.delete(toolId)
        }
        
        // Remove from category index
        this.categories.get(tool.category)?.delete(toolId)
        
        this.tools.delete(toolId)
        console.log(`Unregistered tool: ${toolId}`)
      }
    } finally {
      this.syncLock = false
    }
  }
  
  /**
   * Get a tool by ID
   */
  async getTool(toolId: string): Promise<RegisteredTool | undefined> {
    // Check local tools first
    if (this.tools.has(toolId)) {
      return this.tools.get(toolId)
    }
    
    // Check remote tools
    if (this.remoteTools.has(toolId)) {
      return this.remoteTools.get(toolId)
    }
    
    return undefined
  }
  
  /**
   * List tools with optional filters
   */
  async listTools(filter?: ToolFilter): Promise<RegisteredTool[]> {
    let tools = [...this.tools.values(), ...this.remoteTools.values()]
    
    // Filter by category
    if (filter?.category) {
      tools = tools.filter(t => t.category === filter.category)
    }
    
    // Filter by language
    if (filter?.language) {
      tools = tools.filter(t => t.language === filter.language)
    }
    
    // Filter by capabilities
    if (filter?.capabilities && filter.capabilities.length > 0) {
      const requiredCaps = new Set(filter.capabilities)
      tools = tools.filter(t => {
        const toolCaps = new Set(t.capabilities)
        for (const cap of requiredCaps) {
          if (!toolCaps.has(cap as ToolCapability)) {
            return false
          }
        }
        return true
      })
    }
    
    return tools
  }
  
  /**
   * Search tools by name or description
   */
  async searchTools(query: string): Promise<RegisteredTool[]> {
    const queryLower = query.toLowerCase()
    const results: RegisteredTool[] = []
    
    for (const tool of [...this.tools.values(), ...this.remoteTools.values()]) {
      if (tool.name.toLowerCase().includes(queryLower) ||
          tool.description.toLowerCase().includes(queryLower) ||
          tool.capabilities.some(cap => cap.toLowerCase().includes(queryLower))) {
        results.push(tool)
      }
    }
    
    return results
  }
  
  /**
   * Get all tools with a specific capability
   */
  async getToolsByCapability(capability: string): Promise<RegisteredTool[]> {
    const toolIds = this.capabilities.get(capability) || new Set()
    const tools: RegisteredTool[] = []
    
    for (const toolId of toolIds) {
      const tool = await this.getTool(toolId)
      if (tool) {
        tools.push(tool)
      }
    }
    
    return tools
  }
  
  /**
   * Synchronize with remote tool registry
   */
  private async syncRemoteTools(): Promise<void> {
    if (!this.bridge) {
      return
    }
    
    try {
      // Request tool list from remote registry
      const request = {
        jsonrpc: '2.0',
        method: 'registry.list_tools',
        params: {
          language: this.language
        },
        id: `sync-${Date.now()}`
      }
      
      const response = await this.bridge.sendRequest(request)
      
      if (response.result) {
        const remoteTools = response.result.tools as any[]
        
        // Update remote tools registry
        this.remoteTools.clear()
        for (const toolData of remoteTools) {
          const tool: RegisteredTool = {
            ...toolData,
            remote: true,
            registeredAt: new Date(toolData.registeredAt),
            lastUsed: toolData.lastUsed ? new Date(toolData.lastUsed) : undefined
          }
          
          this.remoteTools.set(tool.id, tool)
          
          // Update indices
          for (const capability of tool.capabilities) {
            if (!this.capabilities.has(capability)) {
              this.capabilities.set(capability, new Set())
            }
            this.capabilities.get(capability)!.add(tool.id)
          }
          
          if (!this.categories.has(tool.category)) {
            this.categories.set(tool.category, new Set())
          }
          this.categories.get(tool.category)!.add(tool.id)
        }
        
        console.log(`Synchronized ${this.remoteTools.size} remote tools`)
      }
    } catch (error) {
      console.error('Failed to sync remote tools:', error)
    }
  }
  
  /**
   * Execute a tool by ID
   */
  async executeTool(
    toolId: string,
    parameters: any,
    context?: Record<string, any>
  ): Promise<ToolExecutionResult> {
    const tool = await this.getTool(toolId)
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`)
    }
    
    // Update usage statistics
    tool.lastUsed = new Date()
    tool.executionCount++
    const startTime = Date.now()
    
    try {
      let result: any
      
      if (tool.remote) {
        // Execute via bridge
        result = await this.bridge!.execute(
          toolId,
          tool.language,
          parameters,
          context || {}
        )
      } else {
        // Execute locally
        if (!tool.handler) {
          throw new Error(`Tool ${toolId} has no handler`)
        }
        
        result = await tool.handler(parameters, context)
      }
      
      // Update execution time statistics
      const executionTime = Date.now() - startTime
      tool.averageExecutionTime = 
        (tool.averageExecutionTime * (tool.executionCount - 1) + executionTime) /
        tool.executionCount
      
      return result
    } catch (error) {
      console.error(`Tool execution failed for ${toolId}:`, error)
      throw error
    }
  }
  
  /**
   * Get execution statistics for a tool
   */
  async getToolStatistics(toolId: string): Promise<ToolStatistics | null> {
    const tool = await this.getTool(toolId)
    if (!tool) {
      return null
    }
    
    return {
      id: tool.id,
      executionCount: tool.executionCount,
      averageExecutionTime: tool.averageExecutionTime,
      lastUsed: tool.lastUsed?.toISOString(),
      registeredAt: tool.registeredAt.toISOString()
    }
  }
  
  /**
   * Export registry to a JSON file
   */
  async exportRegistry(filePath: string): Promise<void> {
    const registryData = {
      version: PROTOCOL_VERSION,
      language: this.language,
      tools: Array.from(this.tools.values()).map(tool => this.toolToJson(tool)),
      remoteTools: Array.from(this.remoteTools.values()).map(tool => this.toolToJson(tool)),
      exportedAt: new Date().toISOString()
    }
    
    await fs.writeFile(filePath, JSON.stringify(registryData, null, 2))
    console.log(`Exported registry to ${filePath}`)
  }
  
  /**
   * Import registry from a JSON file
   */
  async importRegistry(filePath: string): Promise<void> {
    const data = await fs.readFile(filePath, 'utf-8')
    const registryData = JSON.parse(data)
    
    // Clear existing registry
    this.tools.clear()
    this.remoteTools.clear()
    this.capabilities.clear()
    this.categories.clear()
    
    // Import tools
    for (const toolData of registryData.tools || []) {
      const tool = this.toolFromJson(toolData)
      await this.registerTool(tool)
    }
    
    for (const toolData of registryData.remoteTools || []) {
      const tool = this.toolFromJson(toolData)
      tool.remote = true
      this.remoteTools.set(tool.id, tool)
    }
    
    console.log(`Imported registry from ${filePath}`)
  }
  
  /**
   * Convert tool to JSON-serializable format
   */
  private toolToJson(tool: RegisteredTool): any {
    const { handler, ...data } = tool
    return {
      ...data,
      registeredAt: tool.registeredAt.toISOString(),
      lastUsed: tool.lastUsed?.toISOString()
    }
  }
  
  /**
   * Convert JSON data to tool
   */
  private toolFromJson(data: any): RegisteredTool {
    return {
      ...data,
      registeredAt: new Date(data.registeredAt),
      lastUsed: data.lastUsed ? new Date(data.lastUsed) : undefined
    }
  }
}