import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { DGMBridge } from "../src/dgm-bridge";
import { PerformanceTracker } from "../src/performance";
import * as path from "path";

describe("Simple Integration Test", () => {
  let bridge: DGMBridge;
  let tracker: PerformanceTracker;

  beforeAll(async () => {
    // Initialize components
    const pythonScript = path.join(__dirname, "../python/bridge.py");
    bridge = new DGMBridge({ scriptPath: pythonScript });
    tracker = new PerformanceTracker();
    
    try {
      await bridge.initialize();
    } catch (error) {
      console.error("Failed to initialize bridge:", error);
      throw error;
    }
  });

  afterAll(async () => {
    if (bridge) {
      await bridge.close();
    }
  });

  test("bridge should be ready", () => {
    expect(bridge.isReady()).toBe(true);
  });

  test("should track performance metrics", () => {
    const op = tracker.startOperation("tool-execution", { tool: "test" });
    // Simulate work
    const start = Date.now();
    while (Date.now() - start < 5) {}
    op.end();
    
    const report = tracker.getReport();
    expect(report.totalOperations).toBe(1);
    expect(report.averageLatency).toBeGreaterThan(0);
  });

  test("should handle DGM communication", async () => {
    const response = await bridge.call({
      method: "echo",
      params: { message: "Hello DGM" }
    });
    
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  test("should get DGM stats", async () => {
    const stats = await bridge.getStats();
    expect(stats.success).toBe(true);
    expect(stats.data).toBeDefined();
  });

  test("full workflow integration", async () => {
    // 1. Track operation
    const op = tracker.startOperation("memory-store");
    
    // 2. Store data in DGM
    const storeResult = await bridge.storeMemory(
      { content: "Test data" },
      { type: "test" }
    );
    
    op.end();
    
    // 3. Verify storage
    expect(storeResult.success).toBe(true);
    
    // 4. Check performance was tracked
    const report = tracker.getReport();
    const memoryOps = report.operationBreakdown["memory-store"];
    expect(memoryOps).toBeDefined();
    expect(memoryOps.count).toBeGreaterThan(0);
  });
});