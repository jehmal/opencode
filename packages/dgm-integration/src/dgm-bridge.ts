/**
 * DGM Bridge - TypeScript to Python subprocess management
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for locating Python scripts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON-RPC message schema
const JSONRPCRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.any().optional(),
  id: z.union([z.string(), z.number()])
});

const JSONRPCResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.any().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.any().optional()
  }).optional(),
  id: z.union([z.string(), z.number()])
});

export interface DGMBridgeOptions {
  pythonPath?: string;
  scriptPath?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface DGMRequest {
  method: string;
  params?: any;
}

export interface DGMResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class DGMBridge extends EventEmitter {
  private process?: ChildProcess;
  private pythonPath: string;
  private scriptPath: string;
  private messageQueue: Map<string | number, {
    resolve: (value: DGMResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private messageId = 0;
  private buffer = '';
  private isInitialized = false;
  private maxRetries: number;
  private timeout: number;

  constructor(options: DGMBridgeOptions = {}) {
    super();
    // Use DGM venv Python if available
    const dgmVenvPath = path.join(__dirname, '../../../../dgm/venv/bin/python');
    this.pythonPath = options.pythonPath || dgmVenvPath;
    this.scriptPath = options.scriptPath || path.join(__dirname, '..', 'python', 'bridge.py');
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 30000; // 30 seconds default timeout
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.spawnProcess();
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize DGM bridge: ${error}`);
    }
  }

  private async spawnProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.pythonPath, [this.scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      this.process.stdout?.on('data', (data) => {
        this.handleData(data);
      });

      this.process.stderr?.on('data', (data) => {
        console.error('Python stderr:', data.toString());
        this.emit('stderr', data.toString());
      });

      this.process.on('close', (code) => {
        this.isInitialized = false;
        this.emit('close', code);
        
        // Reject all pending requests
        this.messageQueue.forEach(({ reject, timeout }) => {
          clearTimeout(timeout);
          reject(new Error(`Process closed with code ${code}`));
        });
        this.messageQueue.clear();
      });

      this.process.on('error', (error) => {
        this.isInitialized = false;
        reject(error);
      });

      // Wait for ready signal
      this.once('ready', () => {
        resolve();
      });

      // Set initialization timeout
      setTimeout(() => {
        if (!this.isInitialized) {
          reject(new Error('Bridge initialization timeout'));
        }
      }, 10000);
    });
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString();
    
    // Process complete messages (delimited by newlines)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    lines.forEach(line => {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          
          // Check for ready signal
          if (message.type === 'ready') {
            this.emit('ready');
            return;
          }

          // Validate JSON-RPC response
          const response = JSONRPCResponseSchema.parse(message);
          const pending = this.messageQueue.get(response.id);
          
          if (pending) {
            clearTimeout(pending.timeout);
            this.messageQueue.delete(response.id);
            
            if (response.error) {
              pending.resolve({
                success: false,
                error: response.error.message,
                data: response.error.data
              });
            } else {
              pending.resolve({
                success: true,
                data: response.result
              });
            }
          }
        } catch (error) {
          console.error('Failed to parse message:', line, error);
        }
      }
    });
  }

  async call(request: DGMRequest): Promise<DGMResponse> {
    if (!this.isInitialized) {
      throw new Error('Bridge not initialized');
    }

    const id = ++this.messageId;
    const jsonrpcRequest = {
      jsonrpc: '2.0' as const,
      method: request.method,
      params: request.params,
      id
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageQueue.delete(id);
        reject(new Error(`Request timeout: ${request.method}`));
      }, this.timeout);

      this.messageQueue.set(id, { resolve, reject, timeout });

      try {
        this.process?.stdin?.write(JSON.stringify(jsonrpcRequest) + '\n');
      } catch (error) {
        clearTimeout(timeout);
        this.messageQueue.delete(id);
        reject(error);
      }
    });
  }

  // Convenience methods for common DGM operations
  async searchMemory(query: string, filters?: any): Promise<DGMResponse> {
    return this.call({
      method: 'search_memory',
      params: { query, filters }
    });
  }

  async storeMemory(data: any, metadata?: any): Promise<DGMResponse> {
    return this.call({
      method: 'store_memory',
      params: { data, metadata }
    });
  }

  async updateMemory(id: string, updates: any): Promise<DGMResponse> {
    return this.call({
      method: 'update_memory',
      params: { id, updates }
    });
  }

  async executeTool(toolName: string, params: any): Promise<DGMResponse> {
    return this.call({
      method: 'execute_tool',
      params: { tool_name: toolName, params }
    });
  }

  async getStats(): Promise<DGMResponse> {
    return this.call({
      method: 'get_stats',
      params: {}
    });
  }

  async close(): Promise<void> {
    if (this.process) {
      // Send shutdown command
      try {
        await this.call({ method: 'shutdown' });
      } catch (error) {
        // Ignore errors during shutdown
      }

      // Force kill after timeout
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGTERM');
        }
      }, 5000);
    }

    this.isInitialized = false;
  }

  isReady(): boolean {
    return this.isInitialized && this.process && !this.process.killed;
  }

  // Restart the bridge if it crashes
  async restart(): Promise<void> {
    await this.close();
    await this.initialize();
  }
}