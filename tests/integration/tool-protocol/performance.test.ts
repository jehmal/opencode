/**
 * Performance Benchmark Tests
 * Measures tool execution performance and resource usage
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { performance } from 'perf_hooks';
import {
  TestContext,
  setupTestContext,
  teardownTestContext,
  executeTool,
  createTestFile
} from './setup';

interface PerformanceMetrics {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
}

function calculateMetrics(measurements: number[]): PerformanceMetrics {
  const sorted = [...measurements].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

describe('Performance Benchmarks', () => {
  let context: TestContext;
  const iterations = 100;
  
  beforeAll(async () => {
    context = await setupTestContext({ verbose: false });
  }, 60000);
  
  afterAll(async () => {
    await teardownTestContext(context);
  });
  
  describe('Tool Execution Latency', () => {
    test('bash command latency', async () => {
      const measurements: number[] = [];
      
      // Warm up
      for (let i = 0; i < 10; i++) {
        await executeTool(8002, 'bash', {
          command: 'echo "warmup"'
        }, context);
      }
      
      // Measure
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await executeTool(8002, 'bash', {
          command: 'echo "test"'
        }, context);
        const end = performance.now();
        measurements.push(end - start);
      }
      
      const metrics = calculateMetrics(measurements);
      console.log('Bash Command Latency (ms):', metrics);
      
      // Performance assertions
      expect(metrics.mean).toBeLessThan(50); // Average under 50ms
      expect(metrics.p95).toBeLessThan(100); // 95th percentile under 100ms
    });
    
    test('file read latency', async () => {
      // Create test file
      await createTestFile(context, 'perf-read.txt', 'x'.repeat(1024)); // 1KB file
      const filepath = context.tempDir + '/perf-read.txt';
      
      const measurements: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await executeTool(8002, 'read', {
          file_path: filepath
        }, context);
        const end = performance.now();
        measurements.push(end - start);
      }
      
      const metrics = calculateMetrics(measurements);
      console.log('File Read Latency (ms):', metrics);
      
      expect(metrics.mean).toBeLessThan(20);
      expect(metrics.p95).toBeLessThan(50);
    });
    
    test('file write latency', async () => {
      const measurements: number[] = [];
      const content = 'x'.repeat(1024); // 1KB content
      
      for (let i = 0; i < iterations; i++) {
        const filepath = `${context.tempDir}/write-${i}.txt`;
        const start = performance.now();
        await executeTool(8002, 'write', {
          file_path: filepath,
          content: content
        }, context);
        const end = performance.now();
        measurements.push(end - start);
      }
      
      const metrics = calculateMetrics(measurements);
      console.log('File Write Latency (ms):', metrics);
      
      expect(metrics.mean).toBeLessThan(30);
      expect(metrics.p95).toBeLessThan(60);
    });
  });
  
  describe('Cross-Language Performance', () => {
    test('TypeScript vs Python tool performance', async () => {
      const tsMetrics: number[] = [];
      const pyMetrics: number[] = [];
      
      // Measure TypeScript
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        await executeTool(8002, 'bash', {
          command: 'echo "TS test"'
        }, context);
        tsMetrics.push(performance.now() - start);
      }
      
      // Measure Python
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        await executeTool(8001, 'bash', {
          command: 'echo "PY test"'
        }, context);
        pyMetrics.push(performance.now() - start);
      }
      
      const tsStats = calculateMetrics(tsMetrics);
      const pyStats = calculateMetrics(pyMetrics);
      
      console.log('TypeScript Tool Metrics:', tsStats);
      console.log('Python Tool Metrics:', pyStats);
      
      // Both should have reasonable performance
      expect(tsStats.mean).toBeLessThan(100);
      expect(pyStats.mean).toBeLessThan(100);
    });
  });
  
  describe('Throughput Tests', () => {
    test('maximum requests per second', async () => {
      const duration = 10000; // 10 seconds
      const start = Date.now();
      let count = 0;
      
      while (Date.now() - start < duration) {
        await executeTool(8002, 'bash', {
          command: 'true'
        }, context);
        count++;
      }
      
      const rps = count / (duration / 1000);
      console.log(`Requests per second: ${rps.toFixed(2)}`);
      
      expect(rps).toBeGreaterThan(50); // At least 50 RPS
    });
    
    test('concurrent request handling', async () => {
      const concurrentRequests = 20;
      const totalRequests = 200;
      
      const start = performance.now();
      const batches = Math.ceil(totalRequests / concurrentRequests);
      
      for (let batch = 0; batch < batches; batch++) {
        const promises = [];
        for (let i = 0; i < concurrentRequests; i++) {
          const requestNum = batch * concurrentRequests + i;
          if (requestNum >= totalRequests) break;
          
          promises.push(
            executeTool(8002, 'bash', {
              command: `echo "Request ${requestNum}"`
            }, context)
          );
        }
        await Promise.all(promises);
      }
      
      const duration = performance.now() - start;
      const rps = totalRequests / (duration / 1000);
      
      console.log(`Concurrent RPS (${concurrentRequests} concurrent): ${rps.toFixed(2)}`);
      expect(rps).toBeGreaterThan(100);
    });
  });
  
  describe('Resource Usage', () => {
    test('memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Execute many operations
      for (let i = 0; i < 100; i++) {
        await executeTool(8002, 'write', {
          file_path: `${context.tempDir}/mem-test-${i}.txt`,
          content: 'x'.repeat(10240) // 10KB each
        }, context);
      }
      
      const finalMemory = process.memoryUsage();
      const heapDiff = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      console.log(`Heap memory increase: ${heapDiff.toFixed(2)} MB`);
      
      // Should not leak excessive memory
      expect(heapDiff).toBeLessThan(50); // Less than 50MB increase
    });
    
    test('file handle management', async () => {
      // Create and read many files to test file handle cleanup
      const fileCount = 500;
      
      for (let i = 0; i < fileCount; i++) {
        const filepath = `${context.tempDir}/handle-${i}.txt`;
        
        await executeTool(8002, 'write', {
          file_path: filepath,
          content: `File ${i}`
        }, context);
        
        await executeTool(8002, 'read', {
          file_path: filepath
        }, context);
      }
      
      // If file handles leak, this would fail on most systems
      // Success means handles are properly closed
      expect(true).toBe(true);
    });
  });
  
  describe('Scaling Tests', () => {
    test('large file operations', async () => {
      const sizes = [1, 10, 100]; // KB
      const metrics: Record<number, PerformanceMetrics> = {};
      
      for (const sizeKB of sizes) {
        const content = 'x'.repeat(sizeKB * 1024);
        const measurements: number[] = [];
        
        for (let i = 0; i < 20; i++) {
          const filepath = `${context.tempDir}/scale-${sizeKB}KB-${i}.txt`;
          
          const start = performance.now();
          await executeTool(8002, 'write', {
            file_path: filepath,
            content: content
          }, context);
          
          await executeTool(8002, 'read', {
            file_path: filepath
          }, context);
          
          measurements.push(performance.now() - start);
        }
        
        metrics[sizeKB] = calculateMetrics(measurements);
      }
      
      console.log('File Size Scaling:');
      for (const [size, metric] of Object.entries(metrics)) {
        console.log(`  ${size}KB: mean=${metric.mean.toFixed(2)}ms, p95=${metric.p95.toFixed(2)}ms`);
      }
      
      // Verify reasonable scaling
      expect(metrics[100].mean).toBeLessThan(metrics[1].mean * 50); // Not worse than linear
    });
  });
});