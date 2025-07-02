/**
 * Error Scenario Integration Tests
 * Tests error handling and edge cases in tool protocol
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  TestContext,
  setupTestContext,
  teardownTestContext,
  executeTool,
  createTestFile
} from './setup';

describe('Error Scenario Tests', () => {
  let context: TestContext;
  
  beforeAll(async () => {
    context = await setupTestContext();
  }, 60000);
  
  afterAll(async () => {
    await teardownTestContext(context);
  });
  
  describe('Invalid Tool Requests', () => {
    test('should handle non-existent tool', async () => {
      await expect(executeTool(8002, 'nonexistent-tool', {}, context))
        .rejects.toThrow(/Tool execution failed/);
    });
    
    test('should handle missing required parameters', async () => {
      await expect(executeTool(8002, 'bash', {}, context))
        .rejects.toThrow();
    });
    
    test('should handle invalid parameter types', async () => {
      await expect(executeTool(8002, 'bash', {
        command: 123 // Should be string
      }, context)).rejects.toThrow();
    });
    
    test('should handle malformed JSON-RPC request', async () => {
      const response = await fetch('http://localhost:8002/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing jsonrpc version
          id: 'test',
          method: 'tool.execute'
        })
      });
      
      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32600); // Invalid request
    });
  });
  
  describe('File System Errors', () => {
    test('should handle reading non-existent file', async () => {
      await expect(executeTool(8002, 'read', {
        file_path: '/nonexistent/file.txt'
      }, context)).rejects.toThrow();
    });
    
    test('should handle writing to protected directory', async () => {
      await expect(executeTool(8002, 'write', {
        file_path: '/root/protected.txt',
        content: 'test'
      }, context)).rejects.toThrow();
    });
    
    test('should handle editing with invalid path', async () => {
      await expect(executeTool(8002, 'edit', {
        file_path: '../../../etc/passwd',
        old_string: 'root',
        new_string: 'hacked'
      }, context)).rejects.toThrow();
    });
  });
  
  describe('Resource Limits', () => {
    test('should handle large file operations', async () => {
      // Create a large file (10MB)
      const largeContent = 'x'.repeat(10 * 1024 * 1024);
      const filepath = context.tempDir + '/large.txt';
      
      await executeTool(8002, 'write', {
        file_path: filepath,
        content: largeContent
      }, context);
      
      // Reading should work but may be truncated
      const result = await executeTool(8002, 'read', {
        file_path: filepath
      }, context);
      
      expect(result.output).toBeDefined();
    });
    
    test('should handle command timeout', async () => {
      const start = Date.now();
      
      await expect(executeTool(8002, 'bash', {
        command: 'sleep 30',
        timeout: 2000
      }, context)).rejects.toThrow();
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(3000);
    });
    
    test('should handle infinite output', async () => {
      // This should be terminated by timeout or output limit
      await expect(executeTool(8002, 'bash', {
        command: 'yes',
        timeout: 1000
      }, context)).rejects.toThrow();
    });
  });
  
  describe('Concurrent Operations', () => {
    test('should handle concurrent tool executions', async () => {
      const promises = [];
      
      // Execute 10 tools concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          executeTool(8002, 'bash', {
            command: `echo "Concurrent ${i}"`
          }, context)
        );
      }
      
      const results = await Promise.all(promises);
      
      results.forEach((result, i) => {
        expect(result.output).toContain(`Concurrent ${i}`);
      });
    });
    
    test('should handle file conflicts', async () => {
      const filepath = context.tempDir + '/conflict.txt';
      
      // Create initial file
      await createTestFile(context, 'conflict.txt', 'initial content');
      
      // Try to edit concurrently
      const edit1 = executeTool(8002, 'edit', {
        file_path: filepath,
        old_string: 'initial',
        new_string: 'edit1'
      }, context);
      
      const edit2 = executeTool(8001, 'edit', {
        file_path: filepath,
        old_string: 'initial',
        new_string: 'edit2'
      }, context);
      
      // One should succeed, one should fail
      const results = await Promise.allSettled([edit1, edit2]);
      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;
      
      expect(successes).toBe(1);
      expect(failures).toBe(1);
    });
  });
  
  describe('Protocol Violations', () => {
    test('should handle invalid JSON-RPC version', async () => {
      const response = await fetch('http://localhost:8002/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '1.0', // Should be 2.0
          id: 'test',
          method: 'tool.execute',
          params: {}
        })
      });
      
      const result = await response.json();
      expect(result.error).toBeDefined();
    });
    
    test('should handle missing method', async () => {
      const response = await fetch('http://localhost:8002/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'test',
          params: {}
        })
      });
      
      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32600);
    });
  });
  
  describe('Recovery Scenarios', () => {
    test('should recover from transient errors', async () => {
      let attempts = 0;
      const maxRetries = 3;
      
      async function executeWithRetry() {
        attempts++;
        try {
          return await executeTool(8002, 'bash', {
            command: attempts < maxRetries ? 'exit 1' : 'echo "Success"'
          }, context);
        } catch (error) {
          if (attempts < maxRetries) {
            return executeWithRetry();
          }
          throw error;
        }
      }
      
      const result = await executeWithRetry();
      expect(result.output).toContain('Success');
      expect(attempts).toBe(maxRetries);
    });
    
    test('should handle server restart', async () => {
      // This test would require actually restarting the server
      // For now, we'll just verify the error handling
      
      // Simulate server being down
      context.tsServer?.kill('SIGTERM');
      
      await expect(executeTool(8002, 'bash', {
        command: 'echo "test"'
      }, context)).rejects.toThrow();
      
      // Note: In a real test, we'd restart the server here
    });
  });
});