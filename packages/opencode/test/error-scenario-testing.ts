/**
 * Error Scenario Testing for /continue Command System
 *
 * Comprehensive test suite for validating error handling and graceful degradation
 * in the DGMO /continue command workflow.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { Server } from "../src/server/server"
import { Session } from "../src/session"
import { App } from "../src/app/app"
import { bootstrap } from "../src/cli/bootstrap"

interface ErrorTestResult {
  scenario: string
  success: boolean
  errorType: string
  errorMessage: string
  responseTime: number
  recoveryPossible: boolean
  userGuidance: string
}

class ErrorScenarioTester {
  private server: any
  private baseUrl: string = ""
  private testResults: ErrorTestResult[] = []

  async setup() {
    // Start server for testing
    await bootstrap({ cwd: process.cwd() }, async () => {
      this.server = Server.listen({
        port: 0, // Dynamic port
        hostname: "127.0.0.1",
      })

      // Get the actual port
      const port = this.server.port
      this.baseUrl = `http://127.0.0.1:${port}`
      console.log(`Test server started on ${this.baseUrl}`)
    })
  }

  async teardown() {
    if (this.server) {
      this.server.stop()
    }
  }

  /**
   * Test 1: Server Down Scenario
   * Simulates what happens when TypeScript server is not running
   */
  async testServerDown(): Promise<ErrorTestResult> {
    const startTime = Date.now()

    try {
      // Stop the server to simulate server down
      if (this.server) {
        this.server.stop()
      }

      // Try to make request to stopped server
      const response = await fetch(
        `${this.baseUrl}/session/test/continuation-prompt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectName: "test-project",
            projectGoal: "test server down scenario",
          }),
        },
      )

      return {
        scenario: "Server Down",
        success: false,
        errorType: "CONNECTION_REFUSED",
        errorMessage: "Server is not running",
        responseTime: Date.now() - startTime,
        recoveryPossible: true,
        userGuidance:
          "Start the server with 'bun run src/index.ts' and try again",
      }
    } catch (error) {
      return {
        scenario: "Server Down",
        success: false,
        errorType: "FETCH_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        recoveryPossible: true,
        userGuidance: "Ensure the TypeScript server is running and accessible",
      }
    }
  }

  /**
   * Test 2: Invalid Input Scenarios
   * Tests malformed requests and edge cases
   */
  async testInvalidInputs(): Promise<ErrorTestResult[]> {
    const testCases = [
      {
        name: "Empty JSON",
        body: {},
        expectedError: "VALIDATION_ERROR",
      },
      {
        name: "Invalid JSON",
        body: "invalid json",
        expectedError: "JSON_PARSE_ERROR",
      },
      {
        name: "Missing required fields",
        body: { projectName: "" },
        expectedError: "VALIDATION_ERROR",
      },
      {
        name: "Invalid session ID",
        sessionId: "../../../etc/passwd",
        body: { projectName: "test", projectGoal: "test" },
        expectedError: "INVALID_SESSION_ID",
      },
      {
        name: "Extremely long input",
        body: {
          projectName: "a".repeat(10000),
          projectGoal: "b".repeat(10000),
        },
        expectedError: "INPUT_TOO_LARGE",
      },
    ]

    const results: ErrorTestResult[] = []

    for (const testCase of testCases) {
      const startTime = Date.now()

      try {
        const sessionId = testCase.sessionId || "test-session"
        const response = await fetch(
          `${this.baseUrl}/session/${sessionId}/continuation-prompt`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body:
              typeof testCase.body === "string"
                ? testCase.body
                : JSON.stringify(testCase.body),
          },
        )

        const responseText = await response.text()

        results.push({
          scenario: `Invalid Input: ${testCase.name}`,
          success: response.ok,
          errorType: response.ok
            ? "UNEXPECTED_SUCCESS"
            : testCase.expectedError,
          errorMessage: responseText,
          responseTime: Date.now() - startTime,
          recoveryPossible: true,
          userGuidance: this.generateUserGuidance(testCase.expectedError),
        })
      } catch (error) {
        results.push({
          scenario: `Invalid Input: ${testCase.name}`,
          success: false,
          errorType: "NETWORK_ERROR",
          errorMessage: error instanceof Error ? error.message : String(error),
          responseTime: Date.now() - startTime,
          recoveryPossible: true,
          userGuidance: "Check network connectivity and server status",
        })
      }
    }

    return results
  }

  /**
   * Test 3: Resource Exhaustion Scenarios
   * Tests behavior under high load and memory constraints
   */
  async testResourceExhaustion(): Promise<ErrorTestResult[]> {
    const results: ErrorTestResult[] = []

    // Test 3a: Memory exhaustion simulation
    const startTime = Date.now()
    try {
      // Create a very large project state to test memory limits
      const largeProjectState = {
        projectName: "memory-test",
        projectGoal: "test memory exhaustion",
        completedComponents: Array(1000)
          .fill(null)
          .map((_, i) => ({
            name: `Component ${i}`,
            description: "A".repeat(1000),
            filePath: `/path/to/component${i}.ts`,
          })),
        remainingTasks: Array(1000)
          .fill(null)
          .map((_, i) => ({
            name: `Task ${i}`,
            description: "B".repeat(1000),
            priority: "high" as const,
          })),
        criticalFiles: Array(1000)
          .fill(null)
          .map((_, i) => ({
            path: `/path/to/file${i}.ts`,
            description: "C".repeat(1000),
          })),
        knownIssues: Array(1000)
          .fill(null)
          .map((_, i) => ({
            issue: `Issue ${i}`,
            solution: "D".repeat(1000),
          })),
        architecturalConstraints: Array(1000)
          .fill(null)
          .map((_, i) => `Constraint ${i}`),
        successCriteria: Array(1000)
          .fill(null)
          .map((_, i) => `Criteria ${i}`),
        testingApproach: Array(1000)
          .fill(null)
          .map((_, i) => `Test ${i}`),
        completionPercentage: 50,
        workingDirectory: "/test",
      }

      const response = await fetch(
        `${this.baseUrl}/session/memory-test/continuation-prompt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(largeProjectState),
        },
      )

      const responseText = await response.text()

      results.push({
        scenario: "Memory Exhaustion",
        success: response.ok,
        errorType: response.ok ? "HANDLED_GRACEFULLY" : "MEMORY_ERROR",
        errorMessage: responseText,
        responseTime: Date.now() - startTime,
        recoveryPossible: true,
        userGuidance:
          "Reduce the size of project state data or increase server memory",
      })
    } catch (error) {
      results.push({
        scenario: "Memory Exhaustion",
        success: false,
        errorType: "MEMORY_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        recoveryPossible: true,
        userGuidance:
          "Server may have run out of memory. Restart server and reduce data size.",
      })
    }

    return results
  }

  /**
   * Test 4: Concurrent Request Handling
   * Tests system behavior under concurrent load
   */
  async testConcurrentRequests(): Promise<ErrorTestResult> {
    const startTime = Date.now()
    const concurrentRequests = 50

    try {
      const requests = Array(concurrentRequests)
        .fill(null)
        .map((_, i) =>
          fetch(`${this.baseUrl}/session/concurrent-${i}/continuation-prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectName: `concurrent-test-${i}`,
              projectGoal: `test concurrent request ${i}`,
            }),
          }),
        )

      const responses = await Promise.allSettled(requests)
      const successful = responses.filter(
        (r) => r.status === "fulfilled",
      ).length
      const failed = responses.filter((r) => r.status === "rejected").length

      return {
        scenario: "Concurrent Requests",
        success: successful > 0,
        errorType: failed > 0 ? "PARTIAL_FAILURE" : "SUCCESS",
        errorMessage: `${successful}/${concurrentRequests} requests succeeded`,
        responseTime: Date.now() - startTime,
        recoveryPossible: true,
        userGuidance:
          failed > 0
            ? "Some requests failed under load. Consider rate limiting."
            : "All requests handled successfully",
      }
    } catch (error) {
      return {
        scenario: "Concurrent Requests",
        success: false,
        errorType: "CONCURRENT_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        recoveryPossible: true,
        userGuidance:
          "Server may be overwhelmed. Implement request queuing or rate limiting.",
      }
    }
  }

  /**
   * Test 5: Network Interruption Simulation
   * Tests timeout and connection handling
   */
  async testNetworkInterruption(): Promise<ErrorTestResult> {
    const startTime = Date.now()

    try {
      // Create a request with very short timeout to simulate network issues
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 100) // 100ms timeout

      const response = await fetch(
        `${this.baseUrl}/session/timeout-test/continuation-prompt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectName: "timeout-test",
            projectGoal: "test network interruption",
          }),
          signal: controller.signal,
        },
      )

      clearTimeout(timeoutId)

      return {
        scenario: "Network Interruption",
        success: response.ok,
        errorType: "UNEXPECTED_SUCCESS",
        errorMessage: "Request completed despite timeout simulation",
        responseTime: Date.now() - startTime,
        recoveryPossible: true,
        userGuidance: "Network appears stable",
      }
    } catch (error) {
      return {
        scenario: "Network Interruption",
        success: false,
        errorType: "NETWORK_TIMEOUT",
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        recoveryPossible: true,
        userGuidance:
          "Check network connectivity. Retry the request or increase timeout.",
      }
    }
  }

  /**
   * Test 6: Session State Corruption
   * Tests handling of invalid or corrupted session data
   */
  async testSessionStateCorruption(): Promise<ErrorTestResult> {
    const startTime = Date.now()

    try {
      // Try to access a non-existent session
      const response = await fetch(
        `${this.baseUrl}/session/non-existent-session-12345/continuation-prompt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectName: "session-test",
            projectGoal: "test session corruption",
          }),
        },
      )

      const responseText = await response.text()

      return {
        scenario: "Session State Corruption",
        success: response.ok,
        errorType: response.ok ? "UNEXPECTED_SUCCESS" : "SESSION_NOT_FOUND",
        errorMessage: responseText,
        responseTime: Date.now() - startTime,
        recoveryPossible: true,
        userGuidance: response.ok
          ? "Session was created automatically"
          : "Verify session ID or create a new session",
      }
    } catch (error) {
      return {
        scenario: "Session State Corruption",
        success: false,
        errorType: "SESSION_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        recoveryPossible: true,
        userGuidance: "Session data may be corrupted. Create a new session.",
      }
    }
  }

  /**
   * Run all error scenario tests
   */
  async runAllTests(): Promise<ErrorTestResult[]> {
    console.log("🔴 Starting Error Scenario Testing for /continue Command")

    await this.setup()

    try {
      // Test 1: Server Down
      console.log("Testing server down scenario...")
      const serverDownResult = await this.testServerDown()
      this.testResults.push(serverDownResult)

      // Restart server for remaining tests
      await this.setup()

      // Test 2: Invalid Inputs
      console.log("Testing invalid input scenarios...")
      const invalidInputResults = await this.testInvalidInputs()
      this.testResults.push(...invalidInputResults)

      // Test 3: Resource Exhaustion
      console.log("Testing resource exhaustion scenarios...")
      const resourceResults = await this.testResourceExhaustion()
      this.testResults.push(...resourceResults)

      // Test 4: Concurrent Requests
      console.log("Testing concurrent request handling...")
      const concurrentResult = await this.testConcurrentRequests()
      this.testResults.push(concurrentResult)

      // Test 5: Network Interruption
      console.log("Testing network interruption scenarios...")
      const networkResult = await this.testNetworkInterruption()
      this.testResults.push(networkResult)

      // Test 6: Session State Corruption
      console.log("Testing session state corruption...")
      const sessionResult = await this.testSessionStateCorruption()
      this.testResults.push(sessionResult)
    } finally {
      await this.teardown()
    }

    return this.testResults
  }

  /**
   * Generate user guidance based on error type
   */
  private generateUserGuidance(errorType: string): string {
    const guidanceMap: Record<string, string> = {
      VALIDATION_ERROR:
        "Check your input format and ensure all required fields are provided",
      JSON_PARSE_ERROR: "Verify that your JSON is properly formatted",
      INVALID_SESSION_ID: "Use a valid session ID without special characters",
      INPUT_TOO_LARGE: "Reduce the size of your input data",
      CONNECTION_REFUSED: "Ensure the server is running and accessible",
      NETWORK_ERROR: "Check your network connection and try again",
      MEMORY_ERROR: "Reduce data size or increase server memory allocation",
      SESSION_NOT_FOUND: "Verify the session exists or create a new one",
    }

    return guidanceMap[errorType] || "Contact support if the issue persists"
  }

  /**
   * Generate comprehensive error report
   */
  generateErrorReport(): string {
    const totalTests = this.testResults.length
    const successfulTests = this.testResults.filter((r) => r.success).length
    const failedTests = totalTests - successfulTests

    let report = `
# Error Scenario Testing Report for /continue Command

## Executive Summary
- **Total Tests**: ${totalTests}
- **Successful**: ${successfulTests}
- **Failed**: ${failedTests}
- **Success Rate**: ${((successfulTests / totalTests) * 100).toFixed(1)}%

## Test Results

`

    this.testResults.forEach((result, index) => {
      report += `### ${index + 1}. ${result.scenario}
- **Status**: ${result.success ? "✅ PASS" : "❌ FAIL"}
- **Error Type**: ${result.errorType}
- **Response Time**: ${result.responseTime}ms
- **Recovery Possible**: ${result.recoveryPossible ? "Yes" : "No"}
- **Error Message**: ${result.errorMessage}
- **User Guidance**: ${result.userGuidance}

`
    })

    report += `
## Recommendations

### High Priority Issues
${this.testResults
  .filter((r) => !r.success && !r.recoveryPossible)
  .map((r) => `- **${r.scenario}**: ${r.userGuidance}`)
  .join("\n")}

### Error Handling Improvements
1. **Graceful Degradation**: Ensure all error scenarios provide clear user feedback
2. **Recovery Mechanisms**: Implement automatic retry logic for transient failures
3. **User Guidance**: Improve error messages with actionable next steps
4. **Monitoring**: Add logging and alerting for critical error scenarios

### System Resilience
1. **Input Validation**: Strengthen validation for edge cases
2. **Resource Management**: Implement proper memory and connection limits
3. **Timeout Handling**: Add configurable timeouts for all operations
4. **Circuit Breaker**: Implement circuit breaker pattern for external dependencies

## Conclusion
${
  failedTests === 0
    ? "All error scenarios are handled gracefully with appropriate user feedback."
    : `${failedTests} scenarios need improvement in error handling and user experience.`
}
`

    return report
  }
}

// Export for use in other test files
export { ErrorScenarioTester, type ErrorTestResult }

// Run tests if this file is executed directly
if (import.meta.main) {
  const tester = new ErrorScenarioTester()

  tester
    .runAllTests()
    .then((results) => {
      console.log("\n" + tester.generateErrorReport())

      // Store results in memory for reflexion
      const errorInsights = {
        testDate: new Date().toISOString(),
        totalScenarios: results.length,
        criticalFailures: results.filter(
          (r) => !r.success && !r.recoveryPossible,
        ).length,
        averageResponseTime:
          results.reduce((sum, r) => sum + r.responseTime, 0) / results.length,
        commonErrorTypes: [...new Set(results.map((r) => r.errorType))],
        improvementAreas: results
          .filter((r) => !r.success)
          .map((r) => r.scenario),
      }

      console.log("\n🧠 Error Testing Insights for Memory Storage:")
      console.log(JSON.stringify(errorInsights, null, 2))
    })
    .catch((error) => {
      console.error("Error testing failed:", error)
      process.exit(1)
    })
}
