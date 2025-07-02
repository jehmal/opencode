/**
 * TypeScript Adapter for calling Python tools
 * Provides seamless integration for TypeScript code to execute Python tools
 */

import { z } from 'zod';
import { spawn } from 'child_process';
import { Tool as OpenCodeTool } from '../../opencode/packages/opencode/src/tool/tool';
import { ExecutionBridge } from '../../protocol/typescript/src/bridge';
import { 
  ToolContext,
  ToolResult,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolError,
  ToolExecutionStatus
} from '../../shared/types/typescript/tool.types';
import { JsonSchemaToZod } from '../types/converters/json-converter';
import { snakeToCamel, camelToSnake } from '../types/converters/camel-snake-converter';

export interface PythonToolInfo {
  name: string;
  description: string;
  input_schema: any;
  output_schema?: any;
}

export interface PythonToolRegistration {
  module: string;
  className?: string;
  info: PythonToolInfo;
}

export class TypeScriptPythonAdapter {
  private static bridge: ExecutionBridge;
  private static initialized = false;
  private static pythonTools = new Map<string, PythonToolRegistration>();
  
  /**
   * Initialize the adapter
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    this.bridge = new ExecutionBridge();
    await this.bridge.initialize();
    this.initialized = true;
  }
  
  /**
   * Register a Python tool to be callable from TypeScript
   */
  static async registerPythonTool(registration: PythonToolRegistration): Promise<void> {
    await this.initialize();
    
    const toolId = registration.info.name;
    this.pythonTools.set(toolId, registration);
    
    // Create TypeScript wrapper for the Python tool
    const tsWrapper = this.createTypeScriptWrapper(registration);
    
    // Register with OpenCode if available
    if (typeof OpenCodeTool !== 'undefined') {
      // Tool is already registered through the wrapper
    }
  }
  
  /**
   * Create a TypeScript wrapper for a Python tool
   */
  private static createTypeScriptWrapper(registration: PythonToolRegistration): any {
    const { info } = registration;
    
    // Convert Python JSON Schema to Zod schema
    const zodSchema = JsonSchemaToZod.convert(info.input_schema);
    
    // Create the tool definition
    return OpenCodeTool.define({
      id: info.name,
      description: info.description,
      parameters: zodSchema,
      async execute(params: any, ctx: any) {
        // Convert parameter names from camelCase to snake_case
        const pythonParams = camelToSnake(params);
        
        // Create context object
        const context: ToolContext = {
          sessionId: ctx.sessionId || 'default',
          messageId: ctx.messageId || Date.now().toString(),
          userId: ctx.userId,
          agentId: ctx.agentId,
          environment: process.env as Record<string, string>,
          abortSignal: ctx.abort || new AbortController().signal,
          timeout: ctx.timeout || 120000,
          metadata: new Map(Object.entries(ctx.metadata || {})),
          logger: {
            debug: (msg: string, data?: any) => console.debug(msg, data),
            info: (msg: string, data?: any) => console.info(msg, data),
            warn: (msg: string, data?: any) => console.warn(msg, data),
            error: (msg: string, error?: any) => console.error(msg, error),
            metric: (name: string, value: number, tags?: Record<string, string>) => {
              console.log(`METRIC: ${name}=${value}`, tags);
            }
          }
        };
        
        try {
          // Execute the Python tool through the bridge
          const result = await TypeScriptPythonAdapter.bridge.execute(
            info.name,
            'python',
            pythonParams,
            context
          );
          
          // Convert result from snake_case to camelCase
          const tsResult = snakeToCamel(result);
          
          return {
            output: tsResult.output || JSON.stringify(tsResult),
            metadata: tsResult.metadata || {}
          };
        } catch (error) {
          const toolError: ToolError = {
            code: 'PYTHON_TOOL_ERROR',
            message: error instanceof Error ? error.message : String(error),
            details: { tool: info.name, params: pythonParams },
            retryable: false
          };
          
          throw toolError;
        }
      }
    });
  }
  
  /**
   * Call a Python tool directly
   */
  static async callPythonTool(
    toolId: string,
    parameters: any,
    context?: Partial<ToolContext>
  ): Promise<ToolExecutionResult> {
    await this.initialize();
    
    const registration = this.pythonTools.get(toolId);
    if (!registration) {
      throw new Error(`Python tool '${toolId}' not found`);
    }
    
    const startTime = new Date().toISOString();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Convert parameters to snake_case
      const pythonParams = camelToSnake(parameters);
      
      // Create full context
      const fullContext: ToolContext = {
        sessionId: context?.sessionId || 'default',
        messageId: context?.messageId || Date.now().toString(),
        userId: context?.userId,
        agentId: context?.agentId,
        environment: process.env as Record<string, string>,
        abortSignal: context?.abortSignal || new AbortController().signal,
        timeout: context?.timeout || 120000,
        metadata: context?.metadata || new Map(),
        logger: context?.logger || {
          debug: (msg: string, data?: any) => console.debug(msg, data),
          info: (msg: string, data?: any) => console.info(msg, data),
          warn: (msg: string, data?: any) => console.warn(msg, data),
          error: (msg: string, error?: any) => console.error(msg, error),
          metric: (name: string, value: number, tags?: Record<string, string>) => {
            console.log(`METRIC: ${name}=${value}`, tags);
          }
        }
      };
      
      // Execute through bridge
      const result = await this.bridge.execute(
        toolId,
        'python',
        pythonParams,
        fullContext
      );
      
      // Convert result to camelCase
      const output = snakeToCamel(result);
      
      const endTime = new Date().toISOString();
      
      return {
        toolId,
        executionId,
        status: ToolExecutionStatus.SUCCESS,
        output,
        performance: {
          startTime,
          endTime,
          duration: new Date(endTime).getTime() - new Date(startTime).getTime()
        }
      };
    } catch (error) {
      const endTime = new Date().toISOString();
      
      const toolError: ToolError = {
        code: 'PYTHON_EXECUTION_ERROR',
        message: error instanceof Error ? error.message : String(error),
        details: { toolId, parameters },
        retryable: false
      };
      
      return {
        toolId,
        executionId,
        status: ToolExecutionStatus.ERROR,
        error: toolError,
        performance: {
          startTime,
          endTime,
          duration: new Date(endTime).getTime() - new Date(startTime).getTime()
        }
      };
    }
  }
  
  /**
   * Load Python tools from a module
   */
  static async loadPythonModule(modulePath: string): Promise<void> {
    await this.initialize();
    
    // Register the module with the bridge
    await this.bridge.registerPythonModule(modulePath);
    
    // Get tool info from the module
    const toolInfo = await this.getPythonModuleTools(modulePath);
    
    // Register each tool
    for (const info of toolInfo) {
      await this.registerPythonTool({
        module: modulePath,
        info
      });
    }
  }
  
  /**
   * Get tool information from a Python module
   */
  private static async getPythonModuleTools(modulePath: string): Promise<PythonToolInfo[]> {
    return new Promise((resolve, reject) => {
      const pythonScript = `
import sys
import json
import importlib.util

spec = importlib.util.spec_from_file_location("module", "${modulePath}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

tools = []
if hasattr(module, 'tool_info'):
    info = module.tool_info()
    tools.append(info)
elif hasattr(module, 'get_tools'):
    tools = module.get_tools()

print(json.dumps(tools))
`;
      
      const python = spawn('python', ['-c', pythonScript]);
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to load Python module: ${error}`));
        } else {
          try {
            const tools = JSON.parse(output);
            resolve(tools);
          } catch (e) {
            reject(new Error(`Failed to parse Python module output: ${e}`));
          }
        }
      });
    });
  }
  
  /**
   * Shutdown the adapter
   */
  static async shutdown(): Promise<void> {
    if (this.bridge) {
      await this.bridge.shutdown();
    }
    this.initialized = false;
    this.pythonTools.clear();
  }
}

// Export convenience functions
export async function registerPythonTool(registration: PythonToolRegistration): Promise<void> {
  return TypeScriptPythonAdapter.registerPythonTool(registration);
}

export async function callPythonTool(
  toolId: string,
  parameters: any,
  context?: Partial<ToolContext>
): Promise<ToolExecutionResult> {
  return TypeScriptPythonAdapter.callPythonTool(toolId, parameters, context);
}

export async function loadPythonModule(modulePath: string): Promise<void> {
  return TypeScriptPythonAdapter.loadPythonModule(modulePath);
}