/**
 * TypeScript Tool Server for Integration Testing
 * Implements JSON-RPC server for tool execution
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { glob } from 'glob';
import { promisify } from 'util';

const app = new Hono();
app.use(cors());

// JSON-RPC request schema
const JsonRpcRequest = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.string(),
  method: z.string(),
  params: z.any()
});

// Tool parameter schemas
const BashParams = z.object({
  command: z.string(),
  timeout: z.number().optional()
});

const EditParams = z.object({
  file_path: z.string(),
  old_string: z.string(),
  new_string: z.string()
});

const ReadParams = z.object({
  file_path: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional()
});

const WriteParams = z.object({
  file_path: z.string(),
  content: z.string()
});

const GlobParams = z.object({
  pattern: z.string(),
  path: z.string().optional()
});

const GrepParams = z.object({
  pattern: z.string(),
  path: z.string().optional(),
  include: z.string().optional()
});

// Tool implementations
const tools = {
  bash: async (params: z.infer<typeof BashParams>) => {
    const { command, timeout = 120000 } = params;
    
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', command], {
        timeout,
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('error', (error) => {
        reject(new Error(`Command failed: ${error.message}`));
      });
      
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Command exited with code ${code}: ${stderr}`));
        } else {
          resolve({
            output: stdout,
            metadata: {
              title: 'Command executed',
              exitCode: code,
              stderr: stderr
            }
          });
        }
      });
    });
  },
  
  edit: async (params: z.infer<typeof EditParams>) => {
    const { file_path, old_string, new_string } = params;
    
    const content = await fs.readFile(file_path, 'utf-8');
    if (!content.includes(old_string)) {
      throw new Error(`String not found in file: ${old_string}`);
    }
    
    const newContent = content.replace(old_string, new_string);
    await fs.writeFile(file_path, newContent, 'utf-8');
    
    return {
      output: 'File edited successfully',
      metadata: {
        title: 'File edited',
        file_path,
        changes: 1
      }
    };
  },
  
  read: async (params: z.infer<typeof ReadParams>) => {
    const { file_path, offset = 0, limit = 2000 } = params;
    
    const content = await fs.readFile(file_path, 'utf-8');
    const lines = content.split('\n');
    const selectedLines = lines.slice(offset, offset + limit);
    
    return {
      output: selectedLines.join('\n'),
      metadata: {
        title: 'File read',
        file_path,
        totalLines: lines.length,
        linesRead: selectedLines.length
      }
    };
  },
  
  write: async (params: z.infer<typeof WriteParams>) => {
    const { file_path, content } = params;
    
    await fs.mkdir(path.dirname(file_path), { recursive: true });
    await fs.writeFile(file_path, content, 'utf-8');
    
    return {
      output: 'File written successfully',
      metadata: {
        title: 'File written',
        file_path,
        size: content.length
      }
    };
  },
  
  glob: async (params: z.infer<typeof GlobParams>) => {
    const { pattern, path: searchPath = process.cwd() } = params;
    
    const matches = await promisify(glob)(pattern, {
      cwd: searchPath,
      nodir: true
    });
    
    if (matches.length === 0) {
      return {
        output: 'No files found',
        metadata: {
          title: 'Glob search',
          pattern,
          path: searchPath,
          matches: 0
        }
      };
    }
    
    return {
      output: matches.join('\n'),
      metadata: {
        title: 'Glob search',
        pattern,
        path: searchPath,
        matches: matches.length
      }
    };
  },
  
  grep: async (params: z.infer<typeof GrepParams>) => {
    const { pattern, path: searchPath = process.cwd(), include } = params;
    
    const globPattern = include || '**/*';
    const files = await promisify(glob)(globPattern, {
      cwd: searchPath,
      nodir: true
    });
    
    const matches: string[] = [];
    const regex = new RegExp(pattern, 'i');
    
    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(searchPath, file), 'utf-8');
        if (regex.test(content)) {
          matches.push(file);
        }
      } catch {
        // Skip files that can't be read
      }
    }
    
    if (matches.length === 0) {
      return {
        output: 'No matches found',
        metadata: {
          title: 'Grep search',
          pattern,
          path: searchPath,
          filesSearched: files.length,
          matches: 0
        }
      };
    }
    
    return {
      output: matches.join('\n'),
      metadata: {
        title: 'Grep search',
        pattern,
        path: searchPath,
        filesSearched: files.length,
        matches: matches.length
      }
    };
  }
};

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', server: 'typescript' });
});

// JSON-RPC endpoint
app.post('/rpc', async (c) => {
  try {
    const body = await c.req.json();
    const request = JsonRpcRequest.parse(body);
    
    if (request.method !== 'tool.execute') {
      return c.json({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      });
    }
    
    const { tool, parameters } = request.params;
    
    if (!(tool in tools)) {
      return c.json({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Tool not found: ${tool}`
        }
      });
    }
    
    // Validate parameters based on tool
    let validatedParams: any;
    switch (tool) {
      case 'bash':
        validatedParams = BashParams.parse(parameters);
        break;
      case 'edit':
        validatedParams = EditParams.parse(parameters);
        break;
      case 'read':
        validatedParams = ReadParams.parse(parameters);
        break;
      case 'write':
        validatedParams = WriteParams.parse(parameters);
        break;
      case 'glob':
        validatedParams = GlobParams.parse(parameters);
        break;
      case 'grep':
        validatedParams = GrepParams.parse(parameters);
        break;
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
    
    // Execute tool
    const result = await tools[tool as keyof typeof tools](validatedParams);
    
    return c.json({
      jsonrpc: '2.0',
      id: request.id,
      result
    });
    
  } catch (error: any) {
    const request = await c.req.json().catch(() => ({ id: 'unknown' }));
    
    return c.json({
      jsonrpc: '2.0',
      id: request.id || 'unknown',
      error: {
        code: -32000,
        message: 'Tool execution failed',
        data: {
          details: error.message
        }
      }
    });
  }
});

// Start server
const port = parseInt(process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] || '8002');
const sessionId = process.argv.find(arg => arg.startsWith('--session-id='))?.split('=')[1] || 'default';

console.log(`TypeScript tool server starting on port ${port} (session: ${sessionId})`);

export default {
  port,
  fetch: app.fetch,
};