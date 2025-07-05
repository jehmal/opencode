import { spawn } from 'child_process'
import { 
  ToolContext, 
  ToolResult, 
  JsonRpcRequest, 
  JsonRpcResponse,
  ErrorCode,
  ToolExecuteRequest,
  PROTOCOL_VERSION
} from './types'
import { ToolRegistry } from './registry'

export class ExecutionBridge {
  private static pythonProcess: any = null
  private static requestId = 0
  private static pendingRequests = new Map<string, {
    resolve: (result: any) => void
    reject: (error: any) => void
    timeout: NodeJS.Timeout
  }>()

  /**
   * Initialize the Python bridge
   */
  static async initialize(pythonPath = 'python'): Promise<void> {
    if (this.pythonProcess) {
      return
    }

    // Start Python bridge process
    this.pythonProcess = spawn(pythonPath, [
      '-m', 
      'protocol.python.bridge',
      '--mode', 'server'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Handle incoming messages
    this.pythonProcess.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.trim())
      for (const line of lines) {
        try {
          const response: JsonRpcResponse = JSON.parse(line)
          this.handleResponse(response)
        } catch (error) {
          console.error('Failed to parse Python response:', error)
        }
      }
    })

    // Handle errors
    this.pythonProcess.stderr.on('data', (data: Buffer) => {
      console.error('Python bridge error:', data.toString())
    })

    // Handle process exit
    this.pythonProcess.on('exit', (code: number) => {
      console.error(`Python bridge exited with code ${code}`)
      this.pythonProcess = null
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('Python bridge process exited'))
      }
      this.pendingRequests.clear()
    })

    // Wait for ready signal
    await this.waitForReady()
  }

  /**
   * Execute a tool
   */
  static async execute(
    toolId: string,
    language: 'typescript' | 'python',
    parameters: any,
    context: ToolContext
  ): Promise<ToolResult> {
    if (language === 'typescript') {
      return this.executeTypeScript(toolId, parameters, context)
    } else {
      return this.executePython(toolId, parameters, context)
    }
  }

  /**
   * Execute a TypeScript tool
   */
  private static async executeTypeScript(
    toolId: string,
    parameters: any,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = ToolRegistry.get(toolId, 'typescript')
    if (!tool) {
      throw new Error(`TypeScript tool '${toolId}' not found`)
    }

    // Validate parameters
    const validation = await ToolRegistry.validateParameters(toolId, 'typescript', parameters)
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors?.join(', ')}`)
    }

    // Execute with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Tool execution timeout')), context.timeout)
    })

    const executionPromise = tool.handler(parameters, context)

    try {
      return await Promise.race([executionPromise, timeoutPromise])
    } catch (error) {
      if (error instanceof Error && error.message === 'Tool execution timeout') {
        throw error
      }
      throw error
    }
  }

  /**
   * Execute a Python tool
   */
  private static async executePython(
    toolId: string,
    parameters: any,
    context: ToolContext
  ): Promise<ToolResult> {
    if (!this.pythonProcess) {
      await this.initialize()
    }

    const requestId = String(++this.requestId)
    
    const request: ToolExecuteRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tool.execute',
      protocol: PROTOCOL_VERSION,
      params: {
        tool: toolId,
        language: 'python',
        parameters,
        context: {
          sessionId: context.sessionId,
          messageId: context.messageId,
          timeout: context.timeout
        }
      }
    }

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('Python tool execution timeout'))
      }, context.timeout)

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout })

      // Send request
      this.pythonProcess.stdin.write(JSON.stringify(request) + '\n')
    })
  }

  /**
   * Handle response from Python
   */
  private static handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(String(response.id))
    if (!pending) {
      console.warn('Received response for unknown request:', response.id)
      return
    }

    this.pendingRequests.delete(String(response.id))
    clearTimeout(pending.timeout)

    if (response.error) {
      pending.reject(new Error(response.error.message))
    } else {
      pending.resolve(response.result)
    }
  }

  /**
   * Wait for Python bridge to be ready
   */
  private static async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Python bridge failed to start'))
      }, 10000)

      const checkReady = () => {
        const request: JsonRpcRequest = {
          jsonrpc: '2.0',
          id: 'ready-check',
          method: 'ping',
          protocol: PROTOCOL_VERSION
        }

        this.pythonProcess.stdin.write(JSON.stringify(request) + '\n')

        const listener = (data: Buffer) => {
          try {
            const response: JsonRpcResponse = JSON.parse(data.toString())
            if (response.id === 'ready-check' && response.result === 'pong') {
              clearTimeout(timeout)
              this.pythonProcess.stdout.removeListener('data', listener)
              resolve()
            }
          } catch (error) {
            // Ignore parse errors during startup
          }
        }

        this.pythonProcess.stdout.on('data', listener)
      }

      setTimeout(checkReady, 100)
    })
  }

  /**
   * Shutdown the bridge
   */
  static async shutdown(): Promise<void> {
    if (!this.pythonProcess) {
      return
    }

    // Send shutdown request
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'shutdown',
      method: 'shutdown',
      protocol: PROTOCOL_VERSION
    }

    this.pythonProcess.stdin.write(JSON.stringify(request) + '\n')

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      this.pythonProcess.on('exit', () => resolve())
      setTimeout(() => {
        this.pythonProcess.kill()
        resolve()
      }, 5000)
    })

    this.pythonProcess = null
  }

  /**
   * Register Python tools from a module
   */
  static async registerPythonModule(modulePath: string): Promise<void> {
    if (!this.pythonProcess) {
      await this.initialize()
    }

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: String(++this.requestId),
      method: 'register.module',
      protocol: PROTOCOL_VERSION,
      params: { module: modulePath }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id as string)
        reject(new Error('Registration timeout'))
      }, 5000)

      this.pendingRequests.set(request.id as string, {
        resolve: () => {
          clearTimeout(timeout)
          resolve()
        },
        reject: (error) => {
          clearTimeout(timeout)
          reject(error)
        },
        timeout
      })

      this.pythonProcess.stdin.write(JSON.stringify(request) + '\n')
    })
  }
}