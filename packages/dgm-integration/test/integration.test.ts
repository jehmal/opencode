import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { DGMBridge } from "../src/dgm-bridge";
import { PerformanceTracker } from "../src/performance";
import { ToolSynchronizer } from "../src/tool-sync";
import * as path from "path";

describe("Full Integration Test", () => {
  let bridge: DGMBridge;
  let tracker: PerformanceTracker;
  let synchronizer: ToolSynchronizer;

  beforeAll(async () => {
    // Start DGM bridge
    const pythonScript = path.join(__dirname, "../python/bridge.py");
    bridge = new DGMBridge(pythonScript);
    await bridge.start();

    // Initialize performance tracker
    tracker = new PerformanceTracker();

    // Initialize tool synchronizer
    synchronizer = new ToolSynchronizer(bridge, tracker);
  });

  afterAll(async () => {
    await bridge.stop();
  });

  test("should complete full workflow", async () => {
    // 1. Register a tool
    await synchronizer.registerTool({
      name: "test-tool",
      execute: async (params: any) => {
        return { result: `Processed: ${params.input}` };
      }
    });

    // 2. Execute tool with performance tracking
    const result = await synchronizer.executeTool("test-tool", { input: "Hello" });
    expect(result.result).toBe("Processed: Hello");

    // 3. Check performance was tracked
    const stats = tracker.getStatistics();
    expect(stats["tool:test-tool"]).toBeDefined();
    expect(stats["tool:test-tool"].count).toBe(1);

    // 4. Simulate multiple executions for pattern
    for (let i = 0; i < 5; i++) {
      await synchronizer.executeTool("test-tool", { input: `Test ${i}` });
    }

    // 5. Get performance patterns
    const patterns = tracker.getStatistics();
    expect(patterns["tool:test-tool"].count).toBe(6);

    // 6. Request evolution based on patterns
    const evolutionResult = await bridge.evolve([
      {
        tool: "test-tool",
        success: true,
        duration: patterns["tool:test-tool"].avgDuration
      }
    ]);

    expect(evolutionResult).toBeDefined();
    expect(evolutionResult.improvements).toBeGreaterThan(0);
  });

  test("should handle tool failures gracefully", async () => {
    // Register a failing tool
    await synchronizer.registerTool({
      name: "failing-tool",
      execute: async () => {
        throw new Error("Tool failure");
      }
    });

    // Execute and expect failure to be tracked
    try {
      await synchronizer.executeTool("failing-tool", {});
    } catch (error) {
      // Expected
    }

    const stats = tracker.getStatistics();
    expect(stats["tool:failing-tool"]).toBeDefined();
    expect(stats["tool:failing-tool"].failures).toBe(1);
    expect(stats["tool:failing-tool"].successRate).toBe(0);
  });

  test("should sync tools with DGM", async () => {
    // Get initial tool count
    const initialStatus = await synchronizer.getStatus();
    const initialCount = Object.keys(initialStatus.tools).length;

    // Sync tools from DGM
    await synchronizer.syncFromDGM();

    // Should have echo tool from DGM
    const updatedStatus = await synchronizer.getStatus();
    expect(Object.keys(updatedStatus.tools).length).toBeGreaterThanOrEqual(initialCount);
    expect(updatedStatus.tools["echo"]).toBeDefined();
  });

  test("should store and retrieve evolution data", async () => {
    // Store performance data
    const perfData = {
      timestamp: Date.now(),
      metrics: tracker.getStatistics()
    };

    await bridge.store("performance-snapshot", perfData);

    // Retrieve and verify
    const retrieved = await bridge.recall("performance-snapshot");
    expect(retrieved).toEqual(perfData);
  });

  test("should generate evolution suggestions", async () => {
    // Create pattern data
    const patterns = [
      { tool: "bash", success: true, duration: 100 },
      { tool: "bash", success: true, duration: 120 },
      { tool: "bash", success: false, duration: 500, error: "timeout" },
      { tool: "edit", success: true, duration: 50 },
      { tool: "edit", success: true, duration: 45 }
    ];

    // Request evolution
    const suggestions = await bridge.evolve(patterns);

    expect(suggestions).toBeDefined();
    expect(suggestions.improvements).toBeGreaterThan(0);
    expect(suggestions.suggestions).toBeDefined();
    expect(Array.isArray(suggestions.suggestions)).toBe(true);
  });
});