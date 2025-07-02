/**
 * DGM Bridge - Simplified TypeScript to Python communication
 * 
 * This bridge provides a lightweight subprocess-based communication channel
 * between OpenCode (TypeScript) and DGM agent (Python).
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import { 
  JsonRpcRequest, 
  JsonRpcResponse, 
  UsagePattern, 
  Improvement, 
  DGMConfig,
  EvolutionResult 
} from './types';

export class DGMBridge extends EventEmitter {
  private dgmProcess: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private buffer = '';
  
  constructor(private config: DGMConfig) {
    super();
  }

  /**
   * Initialize the Python DGM bridge
   */
  async initialize(): Promise<void> {
    if (this.dgmProcess) {
      return;
    }

    const bridgeScript = path.join(__dirname, '..', 'python', 'bridge.py');
    
    this.dgmProcess = spawn(this.config.pythonPath, [
      bridgeScript,
      '--agent-path', this.config.agentPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1'
      }
    });

    this.dgmProcess.stdout?.on('data', (data) => {
      this.handleData(data.toString());
    });

    this.dgmProcess.stderr?.on('data', (data) => {
      console.error('[DGM Bridge Error]:', data.toString());
    });

    this.dgmProcess.on('close', (code) => {
      console.log(`[DGM Bridge] Process exited with code ${code}`);
      this.cleanup();
    });

    // Wait for ready signal
    await this.waitForReady();
  }

  /**
   * Analyze usage patterns and get improvement suggestions
   */
  async evolve(patterns: UsagePattern[]): Promise<EvolutionResult> {
    return this.call('evolve', { patterns });
  }

  /**
   * Test a proposed improvement
   */
  async testImprovement(improvement: Improvement): Promise<boolean> {
    const result = await this.call('test_improvement', { improvement });
    return result.success;
  }

  /**
   * Apply an approved improvement
   */
  async applyImprovement(improvement: Improvement): Promise<void> {
    await this.call('apply_improvement', { improvement });
  }

  /**
   * Get current agent status
   */
  async getStatus(): Promise<any> {
    return this.call('get_status', {});
  }

  /**
   * Shutdown the bridge
   */
  async shutdown(): Promise<void> {
    if (!this.dgmProcess) {
      return;
    }

    try {
      await this.call('shutdown', {});
    } catch (error) {
      // Ignore errors during shutdown
    }

    this.cleanup();
  }

  /**
   * Make a JSON-RPC call to the Python process
   */
  private async call(method: string, params: any): Promise<any> {
    if (!this.dgmProcess) {
      throw new Error('DGM Bridge not initialized');
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.config.maxExecutionTime || 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      
      this.dgmProcess!.stdin?.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Handle incoming data from Python process
   */
  private handleData(data: string): void {
    this.buffer += data;
    
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      
      if (line.trim()) {
        try {
          const response: JsonRpcResponse = JSON.parse(line);
          this.handleResponse(response);
        } catch (error) {
          console.error('[DGM Bridge] Failed to parse response:', line);
        }
      }
    }
  }

  /**
   * Handle JSON-RPC response
   */
  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(response.id);
    clearTimeout(pending.timeout);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Wait for the Python process to be ready
   */
  private async waitForReady(): Promise<void> {
    const maxAttempts = 50; // 5 seconds
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await this.call('ping', {});
        if (result === 'pong') {
          return;
        }
      } catch (error) {
        // Ignore errors during startup
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('DGM Bridge failed to start');
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Bridge closed'));
    }
    this.pendingRequests.clear();

    // Kill the process if still running
    if (this.dgmProcess && !this.dgmProcess.killed) {
      this.dgmProcess.kill();
    }
    
    this.dgmProcess = null;
    this.emit('closed');
  }
}