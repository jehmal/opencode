/**
 * Test Infrastructure Setup for Tool Protocol Integration Tests
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
// Simple UUID generator for tests
function nanoid(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export interface TestContext {
  pythonServer: ChildProcess | null;
  tsServer: ChildProcess | null;
  tempDir: string;
  sessionId: string;
  events: EventEmitter;
}

export interface TestConfig {
  pythonPort: number;
  tsPort: number;
  timeout: number;
  verbose: boolean;
}

const DEFAULT_CONFIG: TestConfig = {
  pythonPort: 8001,
  tsPort: 8002,
  timeout: 30000,
  verbose: process.env.VERBOSE_TESTS === 'true'
};

/**
 * Initialize test context for integration tests
 */
export async function setupTestContext(config: Partial<TestConfig> = {}): Promise<TestContext> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const sessionId = nanoid();
  const tempDir = path.join(process.cwd(), 'tmp', 'tests', sessionId);
  
  // Create temp directory
  await fs.mkdir(tempDir, { recursive: true });
  
  const context: TestContext = {
    pythonServer: null,
    tsServer: null,
    tempDir,
    sessionId,
    events: new EventEmitter()
  };
  
  // Start Python server
  if (finalConfig.verbose) {
    console.log('Starting Python tool server...');
  }
  
  context.pythonServer = spawn('python', [
    '-m',
    'shared.tools.server',
    '--port',
    String(finalConfig.pythonPort),
    '--session-id',
    sessionId
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PYTHONPATH: path.join(process.cwd(), 'dgm')
    }
  });
  
  // Start TypeScript server
  if (finalConfig.verbose) {
    console.log('Starting TypeScript tool server...');
  }
  
  context.tsServer = spawn('bun', [
    'run',
    path.join(process.cwd(), 'shared', 'tools', 'server.ts'),
    '--port',
    String(finalConfig.tsPort),
    '--session-id',
    sessionId
  ]);
  
  // Wait for servers to be ready
  await waitForServers(finalConfig, context);
  
  return context;
}

/**
 * Wait for both servers to be ready
 */
async function waitForServers(config: TestConfig, context: TestContext): Promise<void> {
  const maxRetries = 30;
  const retryDelay = 1000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Try to connect to both servers
      const pythonReady = await checkServer(`http://localhost:${config.pythonPort}/health`);
      const tsReady = await checkServer(`http://localhost:${config.tsPort}/health`);
      
      if (pythonReady && tsReady) {
        if (config.verbose) {
          console.log('Both servers are ready');
        }
        return;
      }
    } catch (error) {
      // Servers not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
  
  throw new Error('Servers failed to start within timeout');
}

/**
 * Check if a server is responding
 */
async function checkServer(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Cleanup test context
 */
export async function teardownTestContext(context: TestContext): Promise<void> {
  // Kill servers
  if (context.pythonServer) {
    context.pythonServer.kill('SIGTERM');
    await new Promise(resolve => {
      context.pythonServer!.on('exit', resolve);
      setTimeout(resolve, 5000); // Force timeout
    });
  }
  
  if (context.tsServer) {
    context.tsServer.kill('SIGTERM');
    await new Promise(resolve => {
      context.tsServer!.on('exit', resolve);
      setTimeout(resolve, 5000); // Force timeout
    });
  }
  
  // Clean up temp directory
  try {
    await fs.rm(context.tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to clean up temp directory:', error);
  }
}

/**
 * Create a test file in the temp directory
 */
export async function createTestFile(
  context: TestContext,
  filename: string,
  content: string
): Promise<string> {
  const filepath = path.join(context.tempDir, filename);
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, content, 'utf-8');
  return filepath;
}

/**
 * Read a test file from the temp directory
 */
export async function readTestFile(
  context: TestContext,
  filename: string
): Promise<string> {
  const filepath = path.join(context.tempDir, filename);
  return await fs.readFile(filepath, 'utf-8');
}

/**
 * Execute a tool via JSON-RPC
 */
export async function executeTool(
  port: number,
  tool: string,
  parameters: any,
  context: TestContext
): Promise<any> {
  const requestId = nanoid();
  
  const request = {
    jsonrpc: '2.0',
    id: requestId,
    method: 'tool.execute',
    params: {
      tool,
      parameters,
      context: {
        sessionId: context.sessionId,
        messageId: nanoid(),
        timeout: 120000
      }
    }
  };
  
  const response = await fetch(`http://localhost:${port}/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
  
  const result = await response.json() as any;
  
  if (result.error) {
    throw new Error(`Tool execution failed: ${result.error.message}`);
  }
  
  return result.result;
}

/**
 * Wait for an event with timeout
 */
export async function waitForEvent(
  context: TestContext,
  eventName: string,
  timeout: number = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);
    
    context.events.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Create a mock tool for testing
 */
export function createMockTool(name: string, handler: (params: any) => any) {
  return {
    name,
    description: `Mock tool: ${name}`,
    schema: {
      type: 'object',
      properties: {},
      additionalProperties: true
    },
    handler
  };
}