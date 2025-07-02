import { 
  ToolExecuteRequest, 
  ToolExecuteResponse, 
  ToolResult,
  ErrorCode,
  JsonRpcError,
  ToolContext,
  PROTOCOL_VERSION
} from './types'
import { ToolRegistry } from './registry'
import { ExecutionBridge } from './bridge'

export class ToolProtocol {
  /**
   * Handle a tool execution request
   */
  static async handleRequest(request: ToolExecuteRequest): Promise<ToolExecuteResponse> {
    try {
      // Validate request
      if (request.jsonrpc !== '2.0') {
        return this.errorResponse(request.id, ErrorCode.InvalidRequest, 'Invalid JSON-RPC version')
      }

      if (request.method !== 'tool.execute') {
        return this.errorResponse(request.id, ErrorCode.InvalidRequest, `Unknown method: ${request.method}`)
      }

      if (!request.params?.tool || !request.params?.language) {
        return this.errorResponse(request.id, ErrorCode.InvalidParams, 'Missing required parameters')
      }

      // Create context
      const context: ToolContext = {
        sessionId: request.params.context.sessionId,
        messageId: request.params.context.messageId,
        abort: new AbortController().signal,
        timeout: request.params.context.timeout || 120000,
        metadata: new Map()
      }

      // Execute tool
      const result = await ExecutionBridge.execute(
        request.params.tool,
        request.params.language,
        request.params.parameters,
        context
      )

      return {
        jsonrpc: '2.0',
        id: request.id,
        result,
        protocol: PROTOCOL_VERSION
      }
    } catch (error) {
      return this.errorResponse(
        request.id,
        ErrorCode.ExecutionError,
        error instanceof Error ? error.message : 'Unknown error',
        { tool: request.params?.tool, language: request.params?.language }
      )
    }
  }

  /**
   * Create an error response
   */
  private static errorResponse(
    id: string | number,
    code: ErrorCode,
    message: string,
    data?: any
  ): ToolExecuteResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message, data },
      protocol: PROTOCOL_VERSION
    }
  }

  /**
   * Initialize the protocol with default tools
   */
  static async initialize(options?: {
    pythonPath?: string
    loadPythonTools?: boolean
    toolModules?: string[]
  }): Promise<void> {
    // Initialize Python bridge if needed
    if (options?.loadPythonTools) {
      await ExecutionBridge.initialize(options.pythonPath)
      
      // Load specified Python tool modules
      if (options.toolModules) {
        for (const module of options.toolModules) {
          await ExecutionBridge.registerPythonModule(module)
        }
      }
    }
  }

  /**
   * Execute a tool by ID
   */
  static async executeTool(
    toolId: string,
    parameters: any,
    options?: {
      language?: 'typescript' | 'python'
      sessionId?: string
      messageId?: string
      timeout?: number
    }
  ): Promise<ToolResult> {
    // Try to find the tool in the registry
    let language = options?.language
    if (!language) {
      // Auto-detect language
      const tsTool = ToolRegistry.get(toolId, 'typescript')
      const pyTool = ToolRegistry.get(toolId, 'python')
      
      if (tsTool && !pyTool) {
        language = 'typescript'
      } else if (pyTool && !tsTool) {
        language = 'python'
      } else if (tsTool && pyTool) {
        // Prefer TypeScript if both exist
        language = 'typescript'
      } else {
        throw new Error(`Tool '${toolId}' not found`)
      }
    }

    const context: ToolContext = {
      sessionId: options?.sessionId || 'default',
      messageId: options?.messageId || String(Date.now()),
      abort: new AbortController().signal,
      timeout: options?.timeout || 120000,
      metadata: new Map()
    }

    return ExecutionBridge.execute(toolId, language, parameters, context)
  }

  /**
   * List all available tools
   */
  static listTools(): Array<{
    id: string
    language: 'typescript' | 'python'
    description: string
  }> {
    return ToolRegistry.list().map(tool => ({
      id: tool.id,
      language: tool.language,
      description: tool.description
    }))
  }

  /**
   * Shutdown the protocol
   */
  static async shutdown(): Promise<void> {
    await ExecutionBridge.shutdown()
  }
}