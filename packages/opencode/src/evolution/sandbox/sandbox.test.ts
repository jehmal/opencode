/**
 * Safe Evolution Sandbox Tests
 * Agent: safe-evolution-sandbox-003
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { SandboxManager } from "./sandbox-manager"
import { CodeIsolator } from "./code-isolator"
import { SafetyValidator } from "./safety-validator"
import { EvolutionTestRunner } from "./test-runner"
import { SnapshotManager } from "./snapshot-manager"
import type { SandboxConfig, SecurityPolicy } from "./types"
import * as fs from "fs/promises"
import * as path from "path"

describe("Safe Evolution Sandbox", () => {
  let sandboxManager: SandboxManager
  let codeIsolator: CodeIsolator
  let safetyValidator: SafetyValidator
  let testRunner: EvolutionTestRunner
  let snapshotManager: SnapshotManager

  const testConfig: SandboxConfig = {
    tempDir: "/tmp/sandbox-test",
    maxConcurrentSandboxes: 3,
    defaultTimeout: 10000,
  }

  const securityPolicy: SecurityPolicy = {
    allowedModules: [],
    blockedPatterns: [/eval\(/g],
    maxCodeSize: 100000,
    allowFileSystem: false,
    allowChildProcess: false,
    allowNetwork: false,
    allowedAPIs: ["setTimeout", "console"],
  }

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testConfig.tempDir, { recursive: true })

    // Initialize components
    sandboxManager = new SandboxManager(testConfig)
    codeIsolator = new CodeIsolator(securityPolicy)
    safetyValidator = new SafetyValidator(securityPolicy)
    testRunner = new EvolutionTestRunner()
    snapshotManager = new SnapshotManager(
      path.join(testConfig.tempDir, "snapshots"),
    )
  })

  afterEach(async () => {
    // Cleanup
    await fs.rm(testConfig.tempDir, { recursive: true, force: true })
  })

  describe("CodeIsolator", () => {
    it("should detect dangerous functions", async () => {
      const dangerousCode = `
        const result = eval('2 + 2');
        process.exit(0);
      `

      const validation = await codeIsolator.validateCode(dangerousCode)

      expect(validation.valid).toBe(false)
      expect(validation.violations.length).toBeGreaterThan(0)
      expect(
        validation.violations.some((v) => v.type === "DANGEROUS_FUNCTION"),
      ).toBe(true)
    })

    it("should allow safe code", async () => {
      const safeCode = `
        function add(a, b) {
          return a + b;
        }
        console.log(add(2, 3));
      `

      const validation = await codeIsolator.validateCode(safeCode)

      expect(validation.valid).toBe(true)
      expect(validation.violations.length).toBe(0)
    })

    it("should create isolated context", () => {
      const context = codeIsolator.createIsolatedContext()

      expect(context).toBeDefined()
      expect(context.process).toBeUndefined()
      expect(context.require).toBeUndefined()
      expect(context.console).toBeDefined()
    })

    it("should execute code in isolation", async () => {
      const code = `
        const result = 2 + 2;
        result;
      `

      const result = await codeIsolator.executeIsolated(code)
      expect(result).toBe(4)
    })
  })

  describe("SafetyValidator", () => {
    it("should validate safe code with high score", async () => {
      const safeCode = `
        function fibonacci(n) {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
      `

      const result = await safetyValidator.validate(safeCode)

      expect(result.valid).toBe(true)
      expect(result.score).toBeGreaterThan(80)
      expect(result.errors.length).toBe(0)
    })

    it("should detect critical patterns", async () => {
      const dangerousCode = `
        require('child_process').exec('rm -rf /');
      `

      const result = await safetyValidator.validate(dangerousCode)

      expect(result.valid).toBe(false)
      expect(result.score).toBeLessThan(50)
      expect(result.errors.some((e) => e.code === "CRITICAL_PATTERN")).toBe(
        true,
      )
    })

    it("should warn about suspicious patterns", async () => {
      const suspiciousCode = `
        while (true) {
          // Potential infinite loop
        }
      `

      const result = await safetyValidator.validate(suspiciousCode)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === "INFINITE_LOOP")).toBe(true)
    })

    it("should check code complexity", async () => {
      const complexCode = Array(60)
        .fill(0)
        .map((_, i) => `if (x === ${i}) { result = ${i}; }`)
        .join("\n")

      const result = await safetyValidator.validate(complexCode)

      expect(result.warnings.some((w) => w.code === "HIGH_COMPLEXITY")).toBe(
        true,
      )
    })
  })

  describe("EvolutionTestRunner", () => {
    it("should run tests successfully", async () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
      `

      const tests = `
        test('addition works', () => {
          expect(add(2, 3)).toBe(5);
        });
      `

      const results = await testRunner.runTests(code, tests)

      expect(results.total).toBe(1)
      expect(results.passed).toBe(1)
      expect(results.failed).toBe(0)
    })

    it("should detect test failures", async () => {
      const code = `
        function multiply(a, b) {
          return a + b; // Bug: should be a * b
        }
      `

      const tests = `
        test('multiplication works', () => {
          expect(multiply(2, 3)).toBe(6);
        });
      `

      const results = await testRunner.runTests(code, tests)

      expect(results.failed).toBe(1)
      expect(results.failures.length).toBe(1)
    })

    it("should run regression tests", async () => {
      const originalCode = `
        function calculate(x) {
          return x * 2;
        }
      `

      const evolvedCode = `
        function calculate(x) {
          return x * 2; // Same behavior
        }
      `

      const regressionTests = `
        test('calculate maintains behavior', () => {
          expect(calculate(5)).toBe(10);
        });
      `

      const results = await testRunner.runRegressionTests(
        evolvedCode,
        originalCode,
        regressionTests,
      )

      expect(results.passed).toBe(true)
      expect(results.differences.length).toBe(0)
    })
  })

  describe("SnapshotManager", () => {
    it("should create and retrieve snapshots", async () => {
      const code = "function test() { return 42; }"
      const tests = 'test("returns 42", () => expect(test()).toBe(42));'

      const snapshotId = await snapshotManager.createSnapshot(
        "sandbox-123",
        code,
        tests,
        undefined,
        { description: "Test snapshot" },
      )

      expect(snapshotId).toBeDefined()

      const snapshot = await snapshotManager.getSnapshot(snapshotId)
      expect(snapshot).toBeDefined()
      expect(snapshot?.code).toBe(code)
      expect(snapshot?.tests).toBe(tests)
    })

    it("should list snapshots for sandbox", async () => {
      const sandboxId = "sandbox-456"

      await snapshotManager.createSnapshot(sandboxId, "code1", "tests1")
      await snapshotManager.createSnapshot(sandboxId, "code2", "tests2")
      await snapshotManager.createSnapshot("other-sandbox", "code3", "tests3")

      const snapshots = await snapshotManager.listSnapshots(sandboxId)

      expect(snapshots.length).toBe(2)
      expect(snapshots.every((s) => s.sandboxId === sandboxId)).toBe(true)
    })

    it("should rollback to snapshot", async () => {
      const snapshotId = await snapshotManager.createSnapshot(
        "sandbox-789",
        "original code",
        "original tests",
      )

      const result = await snapshotManager.rollback({
        snapshotId,
        validateBeforeRollback: true,
        reason: "Test rollback",
      })

      expect(result.success).toBe(true)
      expect(result.snapshot?.code).toBe("original code")
    })

    it("should compare snapshots", async () => {
      const id1 = await snapshotManager.createSnapshot(
        "sandbox",
        "code1",
        "tests",
      )
      const id2 = await snapshotManager.createSnapshot(
        "sandbox",
        "code2",
        "tests",
      )

      const comparison = await snapshotManager.compareSnapshots(id1, id2)

      expect(comparison.codeDiff).toBe(true)
      expect(comparison.testDiff).toBe(false)
    })
  })

  describe("Integration Tests", () => {
    it("should validate, test, and snapshot evolved code", async () => {
      const evolvedCode = `
        function improvedSort(arr) {
          return arr.slice().sort((a, b) => a - b);
        }
      `

      const testSuite = `
        test('sorts numbers correctly', () => {
          expect(improvedSort([3, 1, 4, 1, 5])).toEqual([1, 1, 3, 4, 5]);
        });
      `

      // 1. Validate safety
      const validation = await safetyValidator.validate(evolvedCode)
      expect(validation.valid).toBe(true)
      expect(validation.score).toBeGreaterThan(90)

      // 2. Run tests
      const testResults = await testRunner.runTests(evolvedCode, testSuite)
      expect(testResults.passed).toBe(1)
      expect(testResults.failed).toBe(0)

      // 3. Create snapshot
      const snapshotId = await snapshotManager.createSnapshot(
        "evolution-test",
        evolvedCode,
        testSuite,
        {
          success: true,
          logs: [],
          testResults,
        },
        {
          description: "Improved sorting algorithm",
          tags: ["optimization", "sorting"],
        },
      )

      expect(snapshotId).toBeDefined()

      // 4. Verify snapshot
      const snapshot = await snapshotManager.getSnapshot(snapshotId)
      expect(snapshot?.executionResult?.success).toBe(true)
    })
  })
})
