/**
 * CI/CD Integration Test Pipeline
 * Orchestrates integration tests for continuous integration
 */

import { IntegrationTestRunner } from "../test-runner"
import { Log } from "../../../../util/log"
import { TestUtilities } from "../test-utils"

const log = Log.create({ service: "ci-pipeline" })

export class CIPipeline {
  private runner: IntegrationTestRunner

  constructor() {
    this.runner = new IntegrationTestRunner()
  }

  async run(): Promise<void> {
    console.log("🚀 Starting DGMO-DGM Integration Tests")
    console.log("=====================================\n")

    try {
      // 1. Setup test environment
      await this.setupEnvironment()

      // 2. Run unit tests first
      await this.runUnitTests()

      // 3. Run integration tests
      const report = await this.runner.runAll()

      // 4. Check results
      if (report.summary.failed > 0) {
        throw new Error(`${report.summary.failed} tests failed`)
      }

      // 5. Generate coverage report
      await this.generateCoverageReport()

      console.log("\n✅ All integration tests passed!")
      console.log(`Total time: ${report.duration}ms`)
    } catch (error) {
      console.error("\n❌ Integration tests failed:", error)
      process.exit(1)
    } finally {
      await this.cleanup()
    }
  }

  private async setupEnvironment(): Promise<void> {
    log.info("Setting up test environment")

    // Create test fixtures
    await TestUtilities.createTestFixtures()

    // Set environment variables
    process.env.NODE_ENV = "test"
    process.env.EVOLUTION_TEST_MODE = "true"

    // Ensure required services are available
    await this.checkServices()
  }

  private async checkServices(): Promise<void> {
    log.info("Checking required services")

    // Check if DGM service is available
    try {
      const response = await fetch("http://localhost:8000/health")
      if (!response.ok) {
        log.warn("DGM service not available - some tests may be skipped")
      }
    } catch (error) {
      log.warn("DGM service not reachable - running in offline mode")
    }

    // Check if Qdrant is available
    try {
      const response = await fetch("http://localhost:6333/health")
      if (!response.ok) {
        log.warn("Qdrant service not available - memory tests may be skipped")
      }
    } catch (error) {
      log.warn("Qdrant service not reachable - running without memory")
    }
  }

  private async runUnitTests(): Promise<void> {
    console.log("Running unit tests...")

    try {
      const { execSync } = await import("child_process")
      execSync(
        'bun test src/evolution/**/*.test.ts --exclude "**/*.integration.test.ts"',
        {
          stdio: "inherit",
          cwd: process.cwd(),
        },
      )
      console.log("✓ Unit tests passed\n")
    } catch (error) {
      console.error("✗ Unit tests failed")
      throw error
    }
  }

  private async generateCoverageReport(): Promise<void> {
    console.log("\nGenerating coverage report...")

    try {
      const { execSync } = await import("child_process")

      // Run tests with coverage
      execSync("bun test --coverage src/evolution/", {
        stdio: "pipe",
        cwd: process.cwd(),
      })

      console.log("✓ Coverage report generated")
      console.log("  View at: coverage/lcov-report/index.html")
    } catch (error) {
      log.warn("Coverage generation failed - continuing anyway")
    }
  }

  private async cleanup(): Promise<void> {
    log.info("Cleaning up test environment")

    // Remove test fixtures
    const fs = await import("fs/promises")
    const path = await import("path")

    const fixturesDir = path.join(
      process.cwd(),
      "opencode/packages/opencode/src/evolution/__tests__/integration/__fixtures__",
    )

    try {
      await fs.rm(fixturesDir, { recursive: true, force: true })
    } catch (error) {
      log.warn("Failed to clean up fixtures", { error })
    }

    // Reset environment variables
    delete process.env.EVOLUTION_TEST_MODE
  }

  /**
   * Run tests in watch mode for development
   */
  async watch(): Promise<void> {
    console.log("👀 Starting integration tests in watch mode")
    console.log("=========================================\n")

    const { spawn } = await import("child_process")

    const watcher = spawn(
      "bun",
      ["test", "--watch", "src/evolution/__tests__/integration/"],
      {
        stdio: "inherit",
        cwd: process.cwd(),
      },
    )

    watcher.on("error", (error) => {
      console.error("Watch mode error:", error)
    })

    watcher.on("exit", (code) => {
      console.log(`Watch mode exited with code ${code}`)
    })
  }

  /**
   * Run a specific test suite
   */
  async runSuite(suiteName: string): Promise<void> {
    console.log(`🎯 Running ${suiteName} suite`)
    console.log("========================\n")

    try {
      await this.setupEnvironment()
      const report = await this.runner.runSuite(suiteName)

      if (report.summary.failed > 0) {
        throw new Error(`${report.summary.failed} tests failed in ${suiteName}`)
      }

      console.log(`\n✅ ${suiteName} suite passed!`)
    } catch (error) {
      console.error(`\n❌ ${suiteName} suite failed:`, error)
      process.exit(1)
    } finally {
      await this.cleanup()
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const pipeline = new CIPipeline()
  const command = process.argv[2]

  switch (command) {
    case "watch":
      pipeline.watch()
      break
    case "suite":
      const suiteName = process.argv[3]
      if (!suiteName) {
        console.error("Please specify a suite name")
        process.exit(1)
      }
      pipeline.runSuite(suiteName)
      break
    default:
      pipeline.run()
  }
}
