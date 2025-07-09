#!/usr/bin/env bun
/**
 * Debug Evolution System
 * Direct testing script that bypasses TUI and tests evolution components
 */

import { EvolutionBridge } from "../bridge"
import { DGMStatus } from "../../dgm/types"
import { EvolutionRequestType } from "../types"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

// Color codes for output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
}

function log(phase: string, data: any, color = colors.cyan) {
  console.log(`${color}${colors.bright}[${phase}]${colors.reset}`)
  console.log(JSON.stringify(data, null, 2))
  console.log("")
}

function success(message: string) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`)
}

function error(message: string) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`)
}

function info(message: string) {
  console.log(`${colors.blue}ℹ ${message}${colors.reset}`)
}

async function testEvolutionSystem() {
  log("TEST START", { timestamp: new Date().toISOString() })

  try {
    // 1. Create test environment
    const testDir = join(tmpdir(), `evolution-debug-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    info(`Created test directory: ${testDir}`)

    // 2. Create test file with inefficient code
    const testFile = join(testDir, "slow-function.js")
    const inefficientCode = `
// Inefficient array processing
function processData(data) {
  const results = [];
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data.length; j++) {
      if (data[i] === data[j] && i !== j) {
        results.push(data[i]);
      }
    }
  }
  return results;
}

// Inefficient string concatenation
function buildString(items) {
  let result = '';
  for (const item of items) {
    result = result + item + ', ';
  }
  return result;
}

module.exports = { processData, buildString };
`
    await writeFile(testFile, inefficientCode)
    success("Created test file with inefficient code")

    // 3. Create mock DGM bridge
    const mockDGMBridge = {
      status: DGMStatus.READY,
      executeTool: async (tool: string, params: any) => {
        log("DGM Tool Called", { tool, params }, colors.yellow)

        switch (tool) {
          case "evolution.analyze":
            return {
              description: "Multiple performance optimizations detected",
              expectedImpact: [
                "O(n²) to O(n) complexity reduction in processData",
                "50% faster string concatenation",
                "Reduced memory allocations",
              ],
              confidence: 0.85,
              risks: ["Behavior change if duplicates order matters"],
              dependencies: [],
            }

          case "evolution.generate":
            const optimizedCode = `
// Optimized array processing - O(n) instead of O(n²)
function processData(data) {
  const seen = new Set();
  const duplicates = new Set();
  
  for (const item of data) {
    if (seen.has(item)) {
      duplicates.add(item);
    } else {
      seen.add(item);
    }
  }
  
  return Array.from(duplicates);
}

// Optimized string concatenation using array join
function buildString(items) {
  return items.join(', ') + ', ';
}

module.exports = { processData, buildString };
`
            return {
              content: optimizedCode,
              explanation:
                "Optimized O(n²) algorithm to O(n) using Set, and replaced string concatenation with array.join()",
            }

          case "evolution.validate":
            return {
              apiCompatibility: true,
              backwardCompatibility: true,
              securityCheck: true,
              performanceRegression: false,
              details: [
                "API signatures unchanged",
                "Output format preserved",
                "No security vulnerabilities introduced",
              ],
            }

          case "evolution.metrics":
            return {
              executionTime: 45,
              memoryUsage: 30,
              cpuUsage: 40,
            }

          case "evolution.snapshot":
            return {
              success: true,
              snapshotId: params.snapshotId,
            }

          default:
            return {}
        }
      },
      on: () => {},
      emit: () => {},
    } as any

    // 4. Create evolution bridge
    const evolutionConfig = {
      enabled: true,
      maxConcurrentEvolutions: 1,
      autoEvolve: false,
      evolutionThreshold: {
        performanceDegradation: 0.2,
        errorRateIncrease: 0.1,
        testFailureRate: 0.05,
      },
      evolutionTimeout: 30000,
      rollbackOnFailure: true,
      requireApproval: false,
      telemetry: {
        enabled: true,
        trackMetrics: true,
        reportingInterval: 60000,
        metricsEndpoint: undefined,
      },
    }

    const bridge = new EvolutionBridge(evolutionConfig, mockDGMBridge)
    success("Created evolution bridge")

    // 5. Track evolution phases
    const phases: string[] = []

    bridge.on("evolution:analysis:started", () => {
      phases.push("ANALYZE")
      info("Phase: Analysis started")
    })

    bridge.on("evolution:hypothesis:generated", (data) => {
      log("Hypothesis Generated", data.hypothesis, colors.green)
    })

    bridge.on("evolution:generation:started", () => {
      phases.push("GENERATE")
      info("Phase: Generation started")
    })

    bridge.on("evolution:testing:started", () => {
      phases.push("TEST")
      info("Phase: Testing started")
    })

    bridge.on("evolution:validation:started", () => {
      phases.push("VALIDATE")
      info("Phase: Validation started")
    })

    bridge.on("evolution:metrics:updated", (data) => {
      log("Metrics Updated", data.result.metrics, colors.green)
    })

    // 6. Create evolution request
    const request = {
      id: "debug-evolution-1",
      type: EvolutionRequestType.IMPROVE_PERFORMANCE,
      targetFiles: [testFile],
      metrics: {
        baseline: {
          executionTime: 100,
          memoryUsage: 50,
          cpuUsage: 80,
        },
      },
      constraints: {
        maxExecutionTime: 30000,
        preserveApi: true,
        maintainBackwardCompatibility: true,
        requireTests: false,
      },
      context: {
        projectPath: testDir,
        language: "javascript",
        testCommand: 'echo "Tests passed"',
        performanceCommand:
          'echo "execution time: 45ms\\nmemory usage: 30MB\\ncpu usage: 40%"',
      },
    }

    log("Evolution Request", request, colors.blue)

    // 7. Execute evolution
    info("Starting evolution process...")
    const result = await bridge.requestEvolution(request)

    log("Initial Result", {
      id: result.id,
      status: result.status,
      hypothesis: result.hypothesis,
    })

    // 8. Wait for completion
    info("Waiting for evolution to complete...")
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // 9. Check final status
    const finalStatus = await bridge.getEvolutionStatus(result.id)
    log(
      "Final Status",
      {
        status: finalStatus.status,
        changes: finalStatus.changes.map((c) => ({
          file: c.file,
          explanation: c.explanation,
        })),
        testResults: finalStatus.testResults,
        validationResults: finalStatus.validationResults,
        metrics: finalStatus.metrics,
      },
      colors.green,
    )

    // 10. Verify results
    console.log("\n" + colors.bright + "VERIFICATION RESULTS:" + colors.reset)

    if (phases.includes("ANALYZE")) {
      success("Analysis phase executed")
    } else {
      error("Analysis phase missing")
    }

    if (phases.includes("GENERATE")) {
      success("Generation phase executed")
    } else {
      error("Generation phase missing")
    }

    if (phases.includes("TEST")) {
      success("Testing phase executed")
    } else {
      error("Testing phase missing")
    }

    if (phases.includes("VALIDATE")) {
      success("Validation phase executed")
    } else {
      error("Validation phase missing")
    }

    if (finalStatus.status === "completed") {
      success("Evolution completed successfully")
    } else {
      error(`Evolution failed with status: ${finalStatus.status}`)
    }

    if (finalStatus.changes.length > 0) {
      success(`Generated ${finalStatus.changes.length} code changes`)
    } else {
      error("No code changes generated")
    }

    if (
      finalStatus.metrics.improvement &&
      Object.keys(finalStatus.metrics.improvement).length > 0
    ) {
      success("Performance improvements measured")
      log("Improvements", finalStatus.metrics.improvement, colors.green)
    } else {
      error("No performance improvements measured")
    }

    // 11. Test health check
    const health = await bridge.healthCheck()
    log("Bridge Health", health, colors.cyan)

    // 12. Shutdown
    await bridge.shutdown()
    success("Evolution bridge shutdown complete")

    console.log(
      "\n" +
        colors.green +
        colors.bright +
        "✓ Evolution system test completed successfully!" +
        colors.reset,
    )
  } catch (err) {
    console.error(
      "\n" + colors.red + colors.bright + "ERROR:" + colors.reset,
      err,
    )
    process.exit(1)
  }
}

// Run the test
console.log(colors.bright + "\n🧬 EVOLUTION SYSTEM DEBUG TEST\n" + colors.reset)
testEvolutionSystem().catch(console.error)
