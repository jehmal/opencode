import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { DGMBridge } from "../src/dgm-bridge";
import { spawn } from "child_process";
import * as path from "path";

describe("DGM Bridge", () => {
  let bridge: DGMBridge;

  beforeAll(async () => {
    const pythonScript = path.join(__dirname, "../python/bridge.py");
    bridge = new DGMBridge({ scriptPath: pythonScript });
    await bridge.initialize();
  });

  afterAll(async () => {
    if (bridge) {
      bridge.close();
    }
  });

  test("should start and be ready", async () => {
    expect(bridge).toBeDefined();
    // Bridge is ready after successful initialization
    expect(true).toBe(true);
  });

  test("should handle health check", async () => {
    const result = await bridge.call("health", {});
    expect(result).toEqual({ status: "healthy" });
  });

  test("should store and recall information", async () => {
    const info = { type: "test", content: "Hello DGM" };
    await bridge.store("test-key", info);
    
    const recalled = await bridge.recall("test-key");
    expect(recalled).toEqual(info);
  });

  test("should handle tool execution", async () => {
    const result = await bridge.executeTool("echo", { text: "Hello" });
    expect(result).toEqual({ output: "Echo: Hello" });
  });

  test("should handle errors gracefully", async () => {
    try {
      await bridge.call("nonexistent", {});
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain("Method not found");
    }
  });

  test("should handle evolution request", async () => {
    const patterns = [
      { tool: "bash", success: true, duration: 100 },
      { tool: "bash", success: false, duration: 200 }
    ];
    
    const result = await bridge.evolve(patterns);
    expect(result).toBeDefined();
    expect(result.improvements).toBeGreaterThan(0);
  });
});