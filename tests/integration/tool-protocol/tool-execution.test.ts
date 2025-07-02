/**
 * Tool Execution Integration Tests
 * Tests cross-language tool execution via JSON-RPC
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  TestContext,
  setupTestContext,
  teardownTestContext,
  executeTool,
  createTestFile,
  readTestFile
} from './setup';

describe('Tool Execution Integration Tests', () => {
  let context: TestContext;
  
  beforeAll(async () => {
    context = await setupTestContext();
  }, 60000);
  
  afterAll(async () => {
    await teardownTestContext(context);
  });
  
  describe('Bash Tool', () => {
    test('should execute bash commands from TypeScript', async () => {
      const result = await executeTool(8002, 'bash', {
        command: 'echo "Hello from TypeScript"'
      }, context);
      
      expect(result.output).toContain('Hello from TypeScript');
      expect(result.metadata.title).toBe('Command executed');
    });
    
    test('should execute bash commands from Python', async () => {
      const result = await executeTool(8001, 'bash', {
        command: 'echo "Hello from Python"'
      }, context);
      
      expect(result.output).toContain('Hello from Python');
      expect(result.metadata).toBeDefined();
    });
    
    test('should handle command errors properly', async () => {
      await expect(executeTool(8002, 'bash', {
        command: 'exit 1'
      }, context)).rejects.toThrow();
    });
    
    test('should support timeout parameter', async () => {
      const start = Date.now();
      
      await expect(executeTool(8002, 'bash', {
        command: 'sleep 10',
        timeout: 1000
      }, context)).rejects.toThrow();
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(2000);
    });
  });
  
  describe('Edit Tool', () => {
    test('should edit files from TypeScript', async () => {
      // Create test file
      const filepath = await createTestFile(
        context,
        'test-ts.txt',
        'Hello\nWorld\n'
      );
      
      // Edit file
      await executeTool(8002, 'edit', {
        file_path: filepath,
        old_string: 'World',
        new_string: 'Universe'
      }, context);
      
      // Verify changes
      const content = await readTestFile(context, 'test-ts.txt');
      expect(content).toBe('Hello\nUniverse\n');
    });
    
    test('should edit files from Python', async () => {
      // Create test file
      const filepath = await createTestFile(
        context,
        'test-py.txt',
        'foo\nbar\nbaz\n'
      );
      
      // Edit file
      await executeTool(8001, 'edit', {
        file_path: filepath,
        old_string: 'bar',
        new_string: 'qux'
      }, context);
      
      // Verify changes
      const content = await readTestFile(context, 'test-py.txt');
      expect(content).toBe('foo\nqux\nbaz\n');
    });
    
    test('should handle multi-line edits', async () => {
      const filepath = await createTestFile(
        context,
        'multiline.txt',
        'line1\nline2\nline3\nline4\n'
      );
      
      await executeTool(8002, 'edit', {
        file_path: filepath,
        old_string: 'line2\nline3',
        new_string: 'modified2\nmodified3'
      }, context);
      
      const content = await readTestFile(context, 'multiline.txt');
      expect(content).toBe('line1\nmodified2\nmodified3\nline4\n');
    });
    
    test('should fail on non-existent string', async () => {
      const filepath = await createTestFile(
        context,
        'fail-test.txt',
        'content'
      );
      
      await expect(executeTool(8002, 'edit', {
        file_path: filepath,
        old_string: 'nonexistent',
        new_string: 'replacement'
      }, context)).rejects.toThrow();
    });
  });
  
  describe('Glob Tool', () => {
    beforeAll(async () => {
      // Create test file structure
      await createTestFile(context, 'src/main.ts', 'export {}');
      await createTestFile(context, 'src/utils.ts', 'export {}');
      await createTestFile(context, 'src/types.d.ts', 'export {}');
      await createTestFile(context, 'tests/main.test.ts', 'test()');
      await createTestFile(context, 'docs/README.md', '# Docs');
    });
    
    test('should find files with glob pattern from TypeScript', async () => {
      const result = await executeTool(8002, 'glob', {
        pattern: '**/*.ts',
        path: context.tempDir
      }, context);
      
      expect(result.output).toContain('src/main.ts');
      expect(result.output).toContain('src/utils.ts');
      expect(result.output).toContain('tests/main.test.ts');
      expect(result.output).not.toContain('README.md');
    });
    
    test('should find files with glob pattern from Python', async () => {
      const result = await executeTool(8001, 'glob', {
        pattern: 'src/*.ts',
        path: context.tempDir
      }, context);
      
      expect(result.output).toContain('main.ts');
      expect(result.output).toContain('utils.ts');
    });
    
    test('should handle no matches', async () => {
      const result = await executeTool(8002, 'glob', {
        pattern: '**/*.java',
        path: context.tempDir
      }, context);
      
      expect(result.output).toContain('No files found');
    });
  });
  
  describe('Grep Tool', () => {
    beforeAll(async () => {
      await createTestFile(
        context,
        'search/file1.txt',
        'Hello World\nThis is a test\nHello again'
      );
      await createTestFile(
        context,
        'search/file2.txt',
        'Another file\nWith some content\nHello there'
      );
      await createTestFile(
        context,
        'search/file3.md',
        '# Hello\nMarkdown content'
      );
    });
    
    test('should search content from TypeScript', async () => {
      const result = await executeTool(8002, 'grep', {
        pattern: 'Hello',
        path: context.tempDir + '/search'
      }, context);
      
      expect(result.output).toContain('file1.txt');
      expect(result.output).toContain('file2.txt');
      expect(result.output).toContain('file3.md');
    });
    
    test('should search with regex from Python', async () => {
      const result = await executeTool(8001, 'grep', {
        pattern: 'test|content',
        path: context.tempDir + '/search'
      }, context);
      
      expect(result.output).toContain('file1.txt');
      expect(result.output).toContain('file2.txt');
      expect(result.output).toContain('file3.md');
    });
    
    test('should filter by file pattern', async () => {
      const result = await executeTool(8002, 'grep', {
        pattern: 'Hello',
        path: context.tempDir + '/search',
        include: '*.txt'
      }, context);
      
      expect(result.output).toContain('file1.txt');
      expect(result.output).toContain('file2.txt');
      expect(result.output).not.toContain('file3.md');
    });
  });
  
  describe('Cross-Language Compatibility', () => {
    test('should handle TypeScript tool from Python client', async () => {
      // Create a file using TypeScript tool
      await executeTool(8002, 'write', {
        file_path: context.tempDir + '/cross-lang.txt',
        content: 'Created by TypeScript'
      }, context);
      
      // Read it using Python tool
      const result = await executeTool(8001, 'read', {
        file_path: context.tempDir + '/cross-lang.txt'
      }, context);
      
      expect(result.output).toContain('Created by TypeScript');
    });
    
    test('should handle Python tool from TypeScript client', async () => {
      // Use Python bash to create file
      await executeTool(8001, 'bash', {
        command: `echo "Created by Python" > ${context.tempDir}/py-created.txt`
      }, context);
      
      // Read using TypeScript
      const result = await executeTool(8002, 'read', {
        file_path: context.tempDir + '/py-created.txt'
      }, context);
      
      expect(result.output).toContain('Created by Python');
    });
  });
});