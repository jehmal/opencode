import { z } from "zod"
import { Log } from "../../../src/util/log"
import { NamedError } from "../../../src/util/error"
import { TestEnvironment } from "./TestEnvironment"
import { MCPTestClient } from "./MCPTestClient"
import { AssertionHelpers } from "./AssertionHelpers"

export namespace TestRunner {
  const log = Log.create({ service: "test-runner" })

  export const TestFailed = NamedError.create(
    "TestFailed",
    z.object({
      testName: z.string(),
      reason: z.string(),
      details: z.any().optional(),
    }),
  )

  export const TestSuiteFailed = NamedError.create(
    "TestSuiteFailed",
    z.object({
      suiteName: z.string(),
      failedTests: z.array(z.string()),
      totalTests: z.number(),
    }),
  )

  export interface TestCase {
    name: string
    description?: string
    timeout?: number
    skip?: boolean
    only?: boolean
    setup?: () => Promise<void> | void
    teardown?: () => Promise<void> | void
    test: (context: TestContext) => Promise<void> | void
  }

  export interface TestSuite {
    name: string
    description?: string
    timeout?: number
    skip?: boolean
    only?: boolean
    beforeAll?: () => Promise<void> | void
    afterAll?: () => Promise<void> | void
    beforeEach?: () => Promise<void> | void
    afterEach?: () => Promise<void> | void
    tests: TestCase[]
  }

  export interface TestContext {
    environment: TestEnvironment.Instance
    client: MCPTestClient.Instance
    assert: typeof AssertionHelpers
    log: ReturnType<typeof Log.create>
    timeout: (ms: number) => void
    skip: (reason?: string) => void
  }

  export interface TestResult {
    name: string
    status: "passed" | "failed" | "skipped"
    duration: number
    error?: Error
    logs?: string[]
  }

  export interface SuiteResult {
    name: string
    status: "passed" | "failed" | "skipped"
    duration: number
    tests: TestResult[]
    passed: number
    failed: number
    skipped: number
  }

  export interface RunOptions {
    timeout?: number
    parallel?: boolean
    maxConcurrency?: number
    filter?: string | RegExp
    verbose?: boolean
    bail?: boolean
    retries?: number
  }

  export class Runner {
    private suites: TestSuite[] = []
    private environment?: TestEnvironment.Instance
    private options: RunOptions

    constructor(options: RunOptions = {}) {
      this.options = {
        timeout: 30000,
        parallel: false,
        maxConcurrency: 4,
        verbose: false,
        bail: false,
        retries: 0,
        ...options,
      }
    }

    addSuite(suite: TestSuite): void {
      this.suites.push(suite)
    }

    addTest(test: TestCase, suiteName = "default"): void {
      let suite = this.suites.find((s) => s.name === suiteName)
      if (!suite) {
        suite = { name: suiteName, tests: [] }
        this.suites.push(suite)
      }
      suite.tests.push(test)
    }

    async run(): Promise<SuiteResult[]> {
      log.info("starting test run", {
        suites: this.suites.length,
        options: this.options,
      })

      const results: SuiteResult[] = []

      try {
        this.environment = await TestEnvironment.create()

        const suitesToRun = this.filterSuites()

        if (this.options.parallel) {
          const chunks = this.chunkSuites(
            suitesToRun,
            this.options.maxConcurrency!,
          )
          for (const chunk of chunks) {
            const chunkResults = await Promise.all(
              chunk.map((suite) => this.runSuite(suite)),
            )
            results.push(...chunkResults)

            if (
              this.options.bail &&
              chunkResults.some((r) => r.status === "failed")
            ) {
              break
            }
          }
        } else {
          for (const suite of suitesToRun) {
            const result = await this.runSuite(suite)
            results.push(result)

            if (this.options.bail && result.status === "failed") {
              break
            }
          }
        }
      } finally {
        if (this.environment) {
          await this.environment.cleanup()
        }
      }

      this.logSummary(results)
      return results
    }

    private filterSuites(): TestSuite[] {
      let suites = this.suites

      // Handle 'only' flag
      const onlySuites = suites.filter((s) => s.only)
      if (onlySuites.length > 0) {
        suites = onlySuites
      }

      // Handle skip flag
      suites = suites.filter((s) => !s.skip)

      // Apply filter
      if (this.options.filter) {
        const filter =
          typeof this.options.filter === "string"
            ? new RegExp(this.options.filter, "i")
            : this.options.filter
        suites = suites.filter((s) => filter.test(s.name))
      }

      return suites
    }

    private chunkSuites(suites: TestSuite[], chunkSize: number): TestSuite[][] {
      const chunks: TestSuite[][] = []
      for (let i = 0; i < suites.length; i += chunkSize) {
        chunks.push(suites.slice(i, i + chunkSize))
      }
      return chunks
    }

    private async runSuite(suite: TestSuite): Promise<SuiteResult> {
      const startTime = Date.now()
      log.info("running suite", { name: suite.name })

      const result: SuiteResult = {
        name: suite.name,
        status: "passed",
        duration: 0,
        tests: [],
        passed: 0,
        failed: 0,
        skipped: 0,
      }

      if (suite.skip) {
        result.status = "skipped"
        result.duration = Date.now() - startTime
        return result
      }

      try {
        // Suite setup
        if (suite.beforeAll) {
          await this.withTimeout(
            suite.beforeAll,
            suite.timeout || this.options.timeout!,
          )
        }

        // Filter and run tests
        const testsToRun = this.filterTests(suite.tests)

        for (const test of testsToRun) {
          const testResult = await this.runTest(test, suite)
          result.tests.push(testResult)

          switch (testResult.status) {
            case "passed":
              result.passed++
              break
            case "failed":
              result.failed++
              break
            case "skipped":
              result.skipped++
              break
          }

          if (this.options.bail && testResult.status === "failed") {
            break
          }
        }

        // Suite teardown
        if (suite.afterAll) {
          await this.withTimeout(
            suite.afterAll,
            suite.timeout || this.options.timeout!,
          )
        }

        result.status = result.failed > 0 ? "failed" : "passed"
      } catch (error) {
        log.error("suite failed", { name: suite.name, error })
        result.status = "failed"
      }

      result.duration = Date.now() - startTime
      return result
    }

    private filterTests(tests: TestCase[]): TestCase[] {
      let filteredTests = tests

      // Handle 'only' flag
      const onlyTests = tests.filter((t) => t.only)
      if (onlyTests.length > 0) {
        filteredTests = onlyTests
      }

      // Handle skip flag
      filteredTests = filteredTests.filter((t) => !t.skip)

      return filteredTests
    }

    private async runTest(
      test: TestCase,
      suite: TestSuite,
    ): Promise<TestResult> {
      const startTime = Date.now()
      log.info("running test", { name: test.name, suite: suite.name })

      const result: TestResult = {
        name: test.name,
        status: "passed",
        duration: 0,
      }

      if (test.skip) {
        result.status = "skipped"
        result.duration = Date.now() - startTime
        return result
      }

      let attempt = 0
      const maxAttempts = (this.options.retries || 0) + 1

      while (attempt < maxAttempts) {
        try {
          // Test setup
          if (suite.beforeEach) {
            await this.withTimeout(
              suite.beforeEach,
              suite.timeout || this.options.timeout!,
            )
          }
          if (test.setup) {
            await this.withTimeout(
              test.setup,
              test.timeout || this.options.timeout!,
            )
          }

          // Create test context
          const client = await MCPTestClient.create(this.environment!)
          const context: TestContext = {
            environment: this.environment!,
            client,
            assert: AssertionHelpers,
            log: Log.create({ service: `test:${test.name}` }),
            timeout: (ms: number) => {
              /* TODO: implement timeout override */
            },
            skip: (reason?: string) => {
              throw new Error(`Test skipped: ${reason || "no reason"}`)
            },
          }

          // Run test
          await this.withTimeout(
            () => test.test(context),
            test.timeout || suite.timeout || this.options.timeout!,
          )

          // Test teardown
          if (test.teardown) {
            await this.withTimeout(
              test.teardown,
              test.timeout || this.options.timeout!,
            )
          }
          if (suite.afterEach) {
            await this.withTimeout(
              suite.afterEach,
              suite.timeout || this.options.timeout!,
            )
          }

          await client.cleanup()
          result.status = "passed"
          break
        } catch (error) {
          attempt++
          log.warn("test attempt failed", {
            name: test.name,
            attempt,
            maxAttempts,
            error: error instanceof Error ? error.message : String(error),
          })

          if (attempt >= maxAttempts) {
            result.status = "failed"
            result.error =
              error instanceof Error ? error : new Error(String(error))
          } else {
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
          }
        }
      }

      result.duration = Date.now() - startTime
      return result
    }

    private async withTimeout<T>(
      fn: () => Promise<T> | T,
      timeoutMs: number,
    ): Promise<T> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`))
        }, timeoutMs)

        Promise.resolve(fn())
          .then(resolve)
          .catch(reject)
          .finally(() => clearTimeout(timer))
      })
    }

    private logSummary(results: SuiteResult[]): void {
      const totalSuites = results.length
      const passedSuites = results.filter((r) => r.status === "passed").length
      const failedSuites = results.filter((r) => r.status === "failed").length
      const skippedSuites = results.filter((r) => r.status === "skipped").length

      const totalTests = results.reduce((sum, r) => sum + r.tests.length, 0)
      const passedTests = results.reduce((sum, r) => sum + r.passed, 0)
      const failedTests = results.reduce((sum, r) => sum + r.failed, 0)
      const skippedTests = results.reduce((sum, r) => sum + r.skipped, 0)

      const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

      log.info("test run complete", {
        suites: {
          total: totalSuites,
          passed: passedSuites,
          failed: failedSuites,
          skipped: skippedSuites,
        },
        tests: {
          total: totalTests,
          passed: passedTests,
          failed: failedTests,
          skipped: skippedTests,
        },
        duration: totalDuration,
      })

      if (this.options.verbose) {
        for (const suite of results) {
          log.info(`suite: ${suite.name}`, {
            status: suite.status,
            duration: suite.duration,
            tests: suite.tests.length,
          })

          for (const test of suite.tests) {
            if (test.status === "failed" && test.error) {
              log.error(`  test: ${test.name}`, {
                status: test.status,
                duration: test.duration,
                error: test.error.message,
              })
            } else {
              log.info(`  test: ${test.name}`, {
                status: test.status,
                duration: test.duration,
              })
            }
          }
        }
      }
    }
  }

  export function createRunner(options?: RunOptions): Runner {
    return new Runner(options)
  }

  export function suite(
    config: Omit<TestSuite, "tests"> & { tests?: TestCase[] },
  ): TestSuite {
    return {
      tests: [],
      ...config,
    }
  }

  export function test(config: TestCase): TestCase {
    return config
  }
}
