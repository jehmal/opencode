import { describe, expect, test, beforeEach } from "bun:test";
import { PerformanceTracker } from "../src/performance";

describe("Performance Tracker", () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = new PerformanceTracker();
  });

  test("should track operations", () => {
    const op = tracker.startOperation("tool-execution", { command: "test" });
    
    // Simulate some work
    const start = Date.now();
    while (Date.now() - start < 10) {
      // Wait 10ms
    }
    
    op.end();
    
    const report = tracker.getReport();
    expect(report.totalOperations).toBe(1);
    expect(report.averageLatency).toBeGreaterThan(0);
    expect(report.operationBreakdown["tool-execution"]).toBeDefined();
    expect(report.operationBreakdown["tool-execution"].count).toBe(1);
  });

  test("should track multiple operations", () => {
    const op1 = tracker.startOperation("memory-store");
    op1.end();
    
    const op2 = tracker.startOperation("memory-search");
    op2.end();
    
    const report = tracker.getReport();
    expect(report.totalOperations).toBe(2);
    expect(report.operationBreakdown["memory-store"].count).toBe(1);
    expect(report.operationBreakdown["memory-search"].count).toBe(1);
  });

  test("should calculate percentiles", () => {
    // Add multiple operations with different durations
    for (let i = 1; i <= 10; i++) {
      const op = tracker.startOperation("tool-execution");
      // End immediately - duration will be very small but consistent
      op.end();
    }
    
    const p50 = tracker.getPercentile(50);
    const p95 = tracker.getPercentile(95);
    const p99 = tracker.getPercentile(99);
    
    expect(p50).toBeGreaterThanOrEqual(0);
    expect(p95).toBeGreaterThanOrEqual(p50);
    expect(p99).toBeGreaterThanOrEqual(p95);
  });

  test("should handle memory usage reporting", () => {
    tracker.startOperation("bridge-init").end();
    
    const report = tracker.getReport();
    expect(report.memoryUsage).toBeDefined();
    expect(report.memoryUsage.heapUsed).toBeGreaterThanOrEqual(0);
    expect(report.memoryUsage.heapTotal).toBeGreaterThanOrEqual(0);
  });

  test("should maintain size limit", () => {
    // Add more than maxMetrics (1000)
    for (let i = 0; i < 1010; i++) {
      tracker.startOperation("tool-execution").end();
    }
    
    const report = tracker.getReport();
    // Should only keep last 1000
    expect(report.totalOperations).toBeLessThanOrEqual(1000);
  });

  test("should clear metrics", () => {
    tracker.startOperation("tool-execution").end();
    tracker.startOperation("memory-store").end();
    
    tracker.clear();
    
    const report = tracker.getReport();
    expect(report.totalOperations).toBe(0);
  });

  test("should handle min/max latency", () => {
    // Create operations with known timing
    const op1 = tracker.startOperation("tool-execution");
    const shortDelay = new Promise(resolve => setTimeout(resolve, 5));
    
    const op2 = tracker.startOperation("tool-execution");
    const longDelay = new Promise(resolve => setTimeout(resolve, 20));
    
    return Promise.all([shortDelay, longDelay]).then(() => {
      op1.end();
      op2.end();
      
      const report = tracker.getReport();
      expect(report.maxLatency).toBeGreaterThan(report.minLatency);
      expect(report.minLatency).toBeGreaterThan(0);
    });
  });
});