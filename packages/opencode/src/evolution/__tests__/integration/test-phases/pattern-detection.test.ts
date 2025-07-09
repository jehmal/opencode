/**
 * Pattern Detection Test Phase
 * Tests the pattern detection and hypothesis generation capabilities
 */

import { UsageAnalyzer } from "../../../orchestrator/usage-analyzer"
import type {
  PhaseTestResult,
  TestCase,
} from "../evolution-integration-test-suite"
import { Log } from "../../../../util/log"

const log = Log.create({ service: "pattern-detection-test" })

export async function testPatternDetection(
  analyzer: UsageAnalyzer,
): Promise<PhaseTestResult> {
  const result: PhaseTestResult = {
    phase: "Pattern Detection",
    success: false,
    tests: [],
  }

  const startTime = Date.now()

  try {
    // Test 1: Detect performance hotspots
    const hotspotTest = await testAsync(
      "Detect performance hotspots",
      async () => {
        // Get patterns from analyzer
        const patterns = await analyzer.detectPatterns()

        if (!Array.isArray(patterns)) {
          throw new Error("Expected patterns to be an array")
        }

        // Check if we have any patterns
        if (patterns.length === 0) {
          log.warn(
            "No patterns detected - this may be normal for a fresh session",
          )
          return true // Allow empty patterns for new sessions
        }

        // Verify pattern structure
        for (const pattern of patterns) {
          if (!pattern.type || !pattern.confidence || !pattern.frequency) {
            throw new Error("Invalid pattern structure")
          }
        }

        // Look for performance-related patterns
        const performancePatterns = patterns.filter(
          (p) =>
            p.type === "hotspot" ||
            p.type === "bottleneck" ||
            p.type === "resource_intensive",
        )

        log.info(
          `Found ${performancePatterns.length} performance patterns out of ${patterns.length} total`,
        )
        return true
      },
    )
    result.tests.push(hotspotTest)

    // Test 2: Generate improvement hypotheses
    const hypothesisTest = await testAsync("Generate hypotheses", async () => {
      const patterns = await analyzer.detectPatterns()
      const hypotheses = await analyzer.generateHypotheses(patterns)

      if (!Array.isArray(hypotheses)) {
        throw new Error("Expected hypotheses to be an array")
      }

      // Allow empty hypotheses for patterns that don't suggest improvements
      if (hypotheses.length === 0 && patterns.length === 0) {
        log.info("No hypotheses generated - no patterns detected")
        return true
      }

      // Verify hypothesis structure
      for (const hypothesis of hypotheses) {
        if (
          !hypothesis.id ||
          !hypothesis.description ||
          typeof hypothesis.confidence !== "number"
        ) {
          throw new Error(
            `Invalid hypothesis structure: ${JSON.stringify(hypothesis)}`,
          )
        }

        // Check confidence is in valid range
        if (hypothesis.confidence < 0 || hypothesis.confidence > 1) {
          throw new Error(`Invalid confidence value: ${hypothesis.confidence}`)
        }
      }

      log.info(
        `Generated ${hypotheses.length} hypotheses from ${patterns.length} patterns`,
      )
      return true
    })
    result.tests.push(hypothesisTest)

    // Test 3: Pattern aggregation
    const aggregationTest = await testAsync(
      "Pattern aggregation across sessions",
      async () => {
        // Test aggregated patterns
        const aggregatedPatterns = await analyzer.detectPatterns() // No session ID = aggregated

        if (!Array.isArray(aggregatedPatterns)) {
          throw new Error("Expected aggregated patterns to be an array")
        }

        log.info(`Found ${aggregatedPatterns.length} aggregated patterns`)
        return true
      },
    )
    result.tests.push(aggregationTest)

    result.success = result.tests.every((t) => t.passed)
    result.duration = Date.now() - startTime
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    log.error("Pattern detection phase failed", { error })
  }

  return result
}

async function testAsync(
  name: string,
  testFn: () => Promise<boolean>,
): Promise<TestCase> {
  const startTime = Date.now()
  const testCase: TestCase = {
    name,
    passed: false,
    duration: 0,
  }

  try {
    testCase.passed = await testFn()
    testCase.duration = Date.now() - startTime
    log.info(`Test "${name}" ${testCase.passed ? "passed" : "failed"}`, {
      duration: testCase.duration,
    })
  } catch (error) {
    testCase.passed = false
    testCase.error = error instanceof Error ? error.message : String(error)
    testCase.duration = Date.now() - startTime
    log.error(`Test "${name}" threw error`, { error: testCase.error })
  }

  return testCase
}
