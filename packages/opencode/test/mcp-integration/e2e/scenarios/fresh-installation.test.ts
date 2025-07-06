import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { TestRunner } from "../../framework/TestRunner"
import type { TestEnvironment, CommandResult } from "../utils/types"
import { promises as fs } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("Fresh Installation Scenarios", () => {
  let testEnv: TestEnvironment
  let runner: TestRunner.Runner

  beforeEach(async () => {
    runner = TestRunner.createRunner({
      timeout: 60000,
      verbose: true,
    })
  })

  afterEach(async () => {
    if (testEnv) {
      await testEnv.cleanup()
    }
  })

  const freshInstallationSuite = TestRunner.suite({
    name: "Fresh Installation",
    description:
      "Test fresh installation scenarios with no existing configuration",
    timeout: 60000,
    tests: [
      TestRunner.test({
        name: "should handle no config file exists",
        description: "Test behavior when no configuration file exists",
        async test({ environment, client, assert, log }) {
          testEnv = environment

          // Ensure no config file exists
          const configExists = await fs
            .access(environment.configPath)
            .then(() => true)
            .catch(() => false)
          assert.false(configExists, "Config file should not exist initially")

          // Run mcp list command
          const result = await client.executeCommand("mcp", ["list"])

          assert.equals(
            result.exitCode,
            0,
            "Command should succeed even with no config",
          )
          assert.contains(
            result.stdout,
            "No MCP servers configured",
            "Should indicate no servers configured",
          )

          log.info("Fresh installation list command completed", { result })
        },
      }),

      TestRunner.test({
        name: "should handle empty config file",
        description: "Test behavior when config file exists but is empty",
        async test({ environment, client, assert, log }) {
          testEnv = environment

          // Create empty config file
          await fs.writeFile(environment.configPath, "")

          const result = await client.executeCommand("mcp", ["list"])

          assert.equals(
            result.exitCode,
            0,
            "Command should handle empty config gracefully",
          )
          assert.contains(
            result.stdout,
            "No MCP servers configured",
            "Should indicate no servers configured",
          )

          log.info("Empty config file handled", { result })
        },
      }),

      TestRunner.test({
        name: "should handle malformed JSON config",
        description: "Test behavior when config file contains invalid JSON",
        async test({ environment, client, assert, log }) {
          testEnv = environment

          // Create malformed config file
          await fs.writeFile(environment.configPath, "{ invalid json")

          const result = await client.executeCommand("mcp", ["list"])

          // Should either recover gracefully or provide clear error
          if (result.exitCode !== 0) {
            assert.contains(
              result.stderr,
              "configuration",
              "Error should mention configuration issue",
            )
          } else {
            assert.contains(
              result.stdout,
              "No MCP servers configured",
              "Should recover gracefully",
            )
          }

          log.info("Malformed JSON config handled", { result })
        },
      }),

      TestRunner.test({
        name: "should create default configuration on first server addition",
        description:
          "Test that adding first server creates proper config structure",
        async test({ environment, client, assert, log }) {
          testEnv = environment

          // Ensure no config exists
          const configExists = await fs
            .access(environment.configPath)
            .then(() => true)
            .catch(() => false)
          assert.false(configExists, "Config file should not exist initially")

          // Add first server
          const result = await client.executeCommand("mcp", [
            "add",
            "test-server",
            "--command",
            "node",
            "--args",
            "server.js",
            "--cwd",
            "/tmp",
          ])

          assert.equals(
            result.exitCode,
            0,
            "First server addition should succeed",
          )
          assert.contains(
            result.stdout,
            "added successfully",
            "Should confirm server addition",
          )

          // Verify config file was created
          const configExistsAfter = await fs
            .access(environment.configPath)
            .then(() => true)
            .catch(() => false)
          assert.true(configExistsAfter, "Config file should be created")

          // Verify config structure
          const configContent = await fs.readFile(
            environment.configPath,
            "utf-8",
          )
          const config = JSON.parse(configContent)

          assert.true(
            config.mcp !== undefined,
            "Config should have mcp section",
          )
          assert.true(
            config.mcp["test-server"] !== undefined,
            "Config should contain added server",
          )
          assert.equals(
            config.mcp["test-server"].command,
            "node",
            "Server command should be correct",
          )

          log.info("Default configuration created", { config })
        },
      }),

      TestRunner.test({
        name: "should run wizard on fresh installation",
        description: "Test wizard functionality with no existing configuration",
        async test({ environment, client, assert, log }) {
          testEnv = environment

          // Mock wizard inputs
          const wizardInputs = [
            "test-wizard-server", // Server name
            "node", // Command
            "wizard-server.js", // Args
            "/tmp", // Working directory
            "y", // Confirm
          ]

          const result = await client.executeCommandWithInput(
            "mcp",
            ["wizard"],
            wizardInputs,
          )

          assert.equals(
            result.exitCode,
            0,
            "Wizard should complete successfully",
          )
          assert.contains(
            result.stdout,
            "Configuration saved",
            "Should confirm configuration saved",
          )

          // Verify server was added
          const listResult = await client.executeCommand("mcp", ["list"])
          assert.contains(
            listResult.stdout,
            "test-wizard-server",
            "Server should appear in list",
          )

          log.info("Wizard completed on fresh installation", { result })
        },
      }),

      TestRunner.test({
        name: "should create config directory if it doesn't exist",
        description:
          "Test that config directory is created when it doesn't exist",
        async test({ environment, client, assert, log }) {
          testEnv = environment

          // Remove config directory
          await fs.rm(environment.configDir, { recursive: true, force: true })

          // Verify directory doesn't exist
          const dirExists = await fs
            .access(environment.configDir)
            .then(() => true)
            .catch(() => false)
          assert.false(dirExists, "Config directory should not exist")

          // Add server (should create directory)
          const result = await client.executeCommand("mcp", [
            "add",
            "test-server",
            "--command",
            "node",
            "--args",
            "server.js",
          ])

          assert.equals(
            result.exitCode,
            0,
            "Command should succeed and create directory",
          )

          // Verify directory was created
          const dirExistsAfter = await fs
            .access(environment.configDir)
            .then(() => true)
            .catch(() => false)
          assert.true(dirExistsAfter, "Config directory should be created")

          // Verify config file exists
          const configExists = await fs
            .access(environment.configPath)
            .then(() => true)
            .catch(() => false)
          assert.true(configExists, "Config file should be created")

          log.info("Config directory created automatically", {
            configDir: environment.configDir,
          })
        },
      }),

      TestRunner.test({
        name: "should handle permission errors gracefully",
        description:
          "Test behavior when config directory has permission issues",
        async test({ environment, client, assert, log }) {
          testEnv = environment

          // Create config directory with restricted permissions (Unix only)
          if (process.platform !== "win32") {
            await fs.mkdir(environment.configDir, { recursive: true })
            await fs.chmod(environment.configDir, 0o444) // Read-only

            const result = await client.executeCommand("mcp", [
              "add",
              "test-server",
              "--command",
              "node",
              "--args",
              "server.js",
            ])

            // Should fail with permission error
            assert.notEquals(
              result.exitCode,
              0,
              "Command should fail with permission error",
            )
            assert.contains(
              result.stderr,
              "permission",
              "Error should mention permission issue",
            )

            // Restore permissions for cleanup
            await fs.chmod(environment.configDir, 0o755)
          } else {
            log.info("Skipping permission test on Windows")
          }
        },
      }),

      TestRunner.test({
        name: "should validate server configuration on first add",
        description:
          "Test that server configuration is validated when adding first server",
        async test({ environment, client, assert, log }) {
          testEnv = environment

          // Try to add server with invalid configuration
          const result = await client.executeCommand("mcp", [
            "add",
            "invalid-server",
            "--command",
            "", // Empty command should be invalid
            "--args",
            "server.js",
          ])

          assert.notEquals(
            result.exitCode,
            0,
            "Command should fail with invalid configuration",
          )
          assert.contains(
            result.stderr,
            "command",
            "Error should mention command issue",
          )

          // Verify no config file was created
          const configExists = await fs
            .access(environment.configPath)
            .then(() => true)
            .catch(() => false)
          assert.false(
            configExists,
            "Config file should not be created for invalid server",
          )

          log.info("Invalid server configuration rejected", { result })
        },
      }),

      TestRunner.test({
        name: "should handle concurrent first installations",
        description:
          "Test behavior when multiple processes try to create config simultaneously",
        async test({ environment, client, assert, log }) {
          testEnv = environment

          // Start multiple add commands simultaneously
          const promises = [
            client.executeCommand("mcp", [
              "add",
              "server1",
              "--command",
              "node",
              "--args",
              "s1.js",
            ]),
            client.executeCommand("mcp", [
              "add",
              "server2",
              "--command",
              "node",
              "--args",
              "s2.js",
            ]),
            client.executeCommand("mcp", [
              "add",
              "server3",
              "--command",
              "node",
              "--args",
              "s3.js",
            ]),
          ]

          const results = await Promise.all(promises)

          // At least one should succeed
          const successCount = results.filter((r) => r.exitCode === 0).length
          assert.greaterThan(
            successCount,
            0,
            "At least one command should succeed",
          )

          // Verify final config state
          const listResult = await client.executeCommand("mcp", ["list"])
          assert.equals(
            listResult.exitCode,
            0,
            "List command should work after concurrent adds",
          )

          log.info("Concurrent installation handled", {
            results: results.map((r) => ({
              exitCode: r.exitCode,
              success: r.success,
            })),
            successCount,
          })
        },
      }),

      TestRunner.test({
        name: "should preserve config file permissions",
        description:
          "Test that config file is created with appropriate permissions",
        async test({ environment, client, assert, log }) {
          testEnv = environment

          // Add server to create config
          const result = await client.executeCommand("mcp", [
            "add",
            "test-server",
            "--command",
            "node",
            "--args",
            "server.js",
          ])

          assert.equals(result.exitCode, 0, "Server addition should succeed")

          // Check file permissions (Unix only)
          if (process.platform !== "win32") {
            const stats = await fs.stat(environment.configPath)
            const mode = stats.mode & parseInt("777", 8)

            // Should be readable/writable by owner, readable by group/others
            assert.equals(
              mode,
              parseInt("644", 8),
              "Config file should have 644 permissions",
            )
          }

          log.info("Config file permissions verified", {
            configPath: environment.configPath,
          })
        },
      }),
    ],
  })

  runner.addSuite(freshInstallationSuite)

  test("run fresh installation scenarios", async () => {
    const results = await runner.run()

    const failedSuites = results.filter((r) => r.status === "failed")
    if (failedSuites.length > 0) {
      const failedTests = failedSuites.flatMap((s) =>
        s.tests
          .filter((t) => t.status === "failed")
          .map((t) => `${s.name}:${t.name}`),
      )
      throw new Error(`Failed tests: ${failedTests.join(", ")}`)
    }

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.status === "passed")).toBe(true)
  })
})
