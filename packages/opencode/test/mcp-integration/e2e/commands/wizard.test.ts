import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { McpWizardCommand } from "../../../../src/cli/cmd/mcp-wizard"
import { MockMCPServer } from "../../mocks/shared/utils"
import { Config } from "../../../../src/config/config"
import { Global } from "../../../../src/global"
import * as prompts from "@clack/prompts"
import fs from "fs/promises"
import path from "path"
import { experimental_createMCPClient } from "ai"

describe("MCP Wizard Command", () => {
  let mockConfigDir: string
  let originalConfigPath: string
  let mockPrompts: any

  beforeEach(async () => {
    // Create temporary config directory
    mockConfigDir = path.join(process.cwd(), "test-config-" + Date.now())
    await fs.mkdir(mockConfigDir, { recursive: true })

    // Store original config path and override
    originalConfigPath = Global.Path.config
    Global.Path.config = mockConfigDir

    // Mock prompts module
    mockPrompts = {
      intro: mock(() => {}),
      outro: mock(() => {}),
      log: {
        info: mock(() => {}),
        step: mock(() => {}),
        success: mock(() => {}),
        error: mock(() => {}),
      },
      select: mock(),
      text: mock(),
      confirm: mock(),
      isCancel: mock(() => false),
    }

    // Replace prompts functions
    Object.assign(prompts, mockPrompts)
  })

  afterEach(async () => {
    // Restore original config path
    Global.Path.config = originalConfigPath

    // Clean up test config directory
    try {
      await fs.rm(mockConfigDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe("Template-based Setup Flow", () => {
    test("should complete template setup with Qdrant server", async () => {
      // Mock user selections for template flow
      mockPrompts.select
        .mockReturnValueOnce("template") // Setup method
        .mockReturnValueOnce({
          name: "Qdrant Vector Database",
          description: "Vector database for AI memory and search",
          config: {
            type: "local",
            command: ["npx", "@modelcontextprotocol/server-qdrant"],
            environment: {
              QDRANT_URL: "http://localhost:6333",
            },
          },
          envVars: [
            {
              key: "QDRANT_URL",
              description: "Qdrant server URL",
              required: true,
            },
          ],
        })

      mockPrompts.text
        .mockReturnValueOnce("test-qdrant") // Server name
        .mockReturnValueOnce("http://localhost:6333") // QDRANT_URL

      mockPrompts.confirm
        .mockReturnValueOnce(true) // Enable server
        .mockReturnValueOnce(false) // Don't overwrite (if exists)

      // Mock successful connection test
      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      // Verify prompts were called correctly
      expect(mockPrompts.intro).toHaveBeenCalledWith(
        "🧙 MCP Server Setup Wizard",
      )
      expect(mockPrompts.select).toHaveBeenCalledTimes(2)
      expect(mockPrompts.text).toHaveBeenCalledTimes(2)
      expect(mockPrompts.confirm).toHaveBeenCalledTimes(1)

      // Verify configuration was saved
      const configPath = path.join(mockConfigDir, "config.json")
      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      expect(config.mcp["test-qdrant"]).toEqual({
        type: "local",
        command: ["npx", "@modelcontextprotocol/server-qdrant"],
        environment: {
          QDRANT_URL: "http://localhost:6333",
        },
      })
    })

    test("should handle template setup with OpenAI server", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "OpenAI Tools",
        description: "Access OpenAI API through MCP",
        config: {
          type: "local",
          command: ["npx", "@modelcontextprotocol/server-openai"],
        },
        envVars: [
          {
            key: "OPENAI_API_KEY",
            description: "Your OpenAI API key",
            required: true,
          },
        ],
      })

      mockPrompts.text
        .mockReturnValueOnce("openai-server")
        .mockReturnValueOnce("sk-test-key-123")

      mockPrompts.confirm.mockReturnValueOnce(true)

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      const configPath = path.join(mockConfigDir, "config.json")
      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      expect(config.mcp["openai-server"]).toEqual({
        type: "local",
        command: ["npx", "@modelcontextprotocol/server-openai"],
        environment: {
          OPENAI_API_KEY: "sk-test-key-123",
        },
      })
    })

    test("should handle template with no environment variables", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Git Tools",
        description: "Git repository management tools",
        config: {
          type: "local",
          command: ["npx", "@modelcontextprotocol/server-git"],
        },
      })

      mockPrompts.text.mockReturnValueOnce("git-server")
      mockPrompts.confirm.mockReturnValueOnce(true)

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      const configPath = path.join(mockConfigDir, "config.json")
      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      expect(config.mcp["git-server"]).toEqual({
        type: "local",
        command: ["npx", "@modelcontextprotocol/server-git"],
      })
    })
  })

  describe("Custom Configuration Flow", () => {
    test("should complete custom local server setup", async () => {
      mockPrompts.select
        .mockReturnValueOnce("custom") // Setup method
        .mockReturnValueOnce("local") // Server type

      mockPrompts.text
        .mockReturnValueOnce("custom-server") // Server name
        .mockReturnValueOnce("node custom-server.js") // Command
        .mockReturnValueOnce("PORT=3000 DEBUG=true") // Environment variables

      mockPrompts.confirm.mockReturnValueOnce(true) // Enable server

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      const configPath = path.join(mockConfigDir, "config.json")
      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      expect(config.mcp["custom-server"]).toEqual({
        type: "local",
        command: ["node", "custom-server.js"],
        environment: {
          PORT: "3000",
          DEBUG: "true",
        },
      })
    })

    test("should complete custom remote server setup", async () => {
      mockPrompts.select
        .mockReturnValueOnce("custom")
        .mockReturnValueOnce("remote")

      mockPrompts.text
        .mockReturnValueOnce("remote-server")
        .mockReturnValueOnce("https://api.example.com/mcp")

      mockPrompts.confirm.mockReturnValueOnce(false) // Disable server

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      const configPath = path.join(mockConfigDir, "config.json")
      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      expect(config.mcp["remote-server"]).toEqual({
        type: "remote",
        url: "https://api.example.com/mcp",
        enabled: false,
      })
    })

    test("should handle custom setup with no environment variables", async () => {
      mockPrompts.select
        .mockReturnValueOnce("custom")
        .mockReturnValueOnce("local")

      mockPrompts.text
        .mockReturnValueOnce("simple-server")
        .mockReturnValueOnce("python server.py")
        .mockReturnValueOnce("") // No environment variables

      mockPrompts.confirm.mockReturnValueOnce(true)

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      const configPath = path.join(mockConfigDir, "config.json")
      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      expect(config.mcp["simple-server"]).toEqual({
        type: "local",
        command: ["python", "server.py"],
      })
    })
  })

  describe("Connection Testing Integration", () => {
    test("should handle successful connection test", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: { type: "local", command: ["echo", "test"] },
      })
      mockPrompts.text.mockReturnValueOnce("test-server")
      mockPrompts.confirm.mockReturnValueOnce(true)

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      expect(mockPrompts.log.step).toHaveBeenCalledWith("Testing connection...")
      expect(mockPrompts.log.success).toHaveBeenCalledWith(
        "✅ Connection test passed!",
      )
    })

    test("should handle connection test failure with retry", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: { type: "local", command: ["invalid-command"] },
      })
      mockPrompts.text.mockReturnValueOnce("test-server")
      mockPrompts.confirm
        .mockReturnValueOnce(true) // Enable server
        .mockReturnValueOnce(true) // Retry after failure

      mockPrompts.select.mockReturnValueOnce("command") // Modify command

      mockPrompts.text.mockReturnValueOnce("echo test") // New command

      // First call fails, second succeeds
      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }

      let callCount = 0
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => {
          callCount++
          if (callCount === 1) {
            throw new Error("Connection failed")
          }
          return Promise.resolve(mockClient)
        }),
      }))

      await McpWizardCommand.handler()

      expect(mockPrompts.log.error).toHaveBeenCalledWith(
        "Connection test failed: Connection failed",
      )
      expect(mockPrompts.confirm).toHaveBeenCalledWith({
        message: "Would you like to modify the configuration and try again?",
        initialValue: true,
      })
      expect(mockPrompts.log.success).toHaveBeenCalledWith(
        "✅ Connection test passed!",
      )
    })

    test("should handle connection test failure without retry", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: { type: "local", command: ["invalid-command"] },
      })
      mockPrompts.text.mockReturnValueOnce("test-server")
      mockPrompts.confirm
        .mockReturnValueOnce(true) // Enable server
        .mockReturnValueOnce(false) // Don't retry

      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => {
          throw new Error("Connection failed")
        }),
      }))

      await McpWizardCommand.handler()

      expect(mockPrompts.log.error).toHaveBeenCalledWith(
        "Connection test failed: Connection failed",
      )
      expect(mockPrompts.outro).toHaveBeenCalledWith("Setup cancelled")
    })
  })

  describe("Configuration Modification", () => {
    test("should modify command in local configuration", async () => {
      mockPrompts.select
        .mockReturnValueOnce("template")
        .mockReturnValueOnce({
          name: "Test Server",
          config: { type: "local", command: ["invalid-command"] },
        })
        .mockReturnValueOnce("command") // What to modify

      mockPrompts.text
        .mockReturnValueOnce("test-server")
        .mockReturnValueOnce("echo test") // New command

      mockPrompts.confirm
        .mockReturnValueOnce(true) // Enable server
        .mockReturnValueOnce(true) // Retry after failure

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }

      let callCount = 0
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => {
          callCount++
          if (callCount === 1) {
            throw new Error("Connection failed")
          }
          return Promise.resolve(mockClient)
        }),
      }))

      await McpWizardCommand.handler()

      const configPath = path.join(mockConfigDir, "config.json")
      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      expect(config.mcp["test-server"].command).toEqual(["echo", "test"])
    })

    test("should modify environment variables in local configuration", async () => {
      mockPrompts.select
        .mockReturnValueOnce("template")
        .mockReturnValueOnce({
          name: "Test Server",
          config: {
            type: "local",
            command: ["echo", "test"],
            environment: { OLD_VAR: "old_value" },
          },
        })
        .mockReturnValueOnce("environment") // What to modify

      mockPrompts.text
        .mockReturnValueOnce("test-server")
        .mockReturnValueOnce("NEW_VAR=new_value PORT=3000") // New environment

      mockPrompts.confirm
        .mockReturnValueOnce(true) // Enable server
        .mockReturnValueOnce(true) // Retry after failure

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }

      let callCount = 0
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => {
          callCount++
          if (callCount === 1) {
            throw new Error("Connection failed")
          }
          return Promise.resolve(mockClient)
        }),
      }))

      await McpWizardCommand.handler()

      const configPath = path.join(mockConfigDir, "config.json")
      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      expect(config.mcp["test-server"].environment).toEqual({
        NEW_VAR: "new_value",
        PORT: "3000",
      })
    })

    test("should modify URL in remote configuration", async () => {
      mockPrompts.select
        .mockReturnValueOnce("custom")
        .mockReturnValueOnce("remote")
        .mockReturnValueOnce("url") // What to modify

      mockPrompts.text
        .mockReturnValueOnce("remote-server")
        .mockReturnValueOnce("https://invalid.example.com")
        .mockReturnValueOnce("https://valid.example.com") // New URL

      mockPrompts.confirm
        .mockReturnValueOnce(true) // Enable server
        .mockReturnValueOnce(true) // Retry after failure

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }

      let callCount = 0
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => {
          callCount++
          if (callCount === 1) {
            throw new Error("Connection failed")
          }
          return Promise.resolve(mockClient)
        }),
      }))

      await McpWizardCommand.handler()

      const configPath = path.join(mockConfigDir, "config.json")
      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      expect(config.mcp["remote-server"].url).toBe("https://valid.example.com")
    })
  })

  describe("Error Recovery Workflows", () => {
    test("should handle user cancellation during template selection", async () => {
      mockPrompts.isCancel.mockReturnValue(true)
      mockPrompts.select.mockReturnValueOnce("template")

      await expect(McpWizardCommand.handler()).rejects.toThrow()
    })

    test("should handle user cancellation during server name input", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: { type: "local", command: ["echo", "test"] },
      })

      mockPrompts.isCancel.mockReturnValue(true)
      mockPrompts.text.mockReturnValueOnce("test-server")

      await expect(McpWizardCommand.handler()).rejects.toThrow()
    })

    test("should handle invalid server name validation", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: { type: "local", command: ["echo", "test"] },
      })

      // Test validation function
      const validator = mockPrompts.text.mock.calls[0]?.[0]?.validate
      expect(validator).toBeDefined()
      expect(validator("")).toBe("Server name is required")
      expect(validator("invalid name!")).toBe(
        "Server name can only contain letters, numbers, hyphens, and underscores",
      )
      expect(validator("valid-name")).toBeUndefined()
    })

    test("should handle invalid URL validation in custom remote setup", async () => {
      mockPrompts.select
        .mockReturnValueOnce("custom")
        .mockReturnValueOnce("remote")

      mockPrompts.text.mockReturnValueOnce("remote-server")

      // Test URL validation
      const urlValidator = mockPrompts.text.mock.calls[1]?.[0]?.validate
      expect(urlValidator).toBeDefined()
      expect(urlValidator("")).toBe("URL is required")
      expect(urlValidator("invalid-url")).toBe("Invalid URL")
      expect(urlValidator("https://valid.example.com")).toBeUndefined()
    })

    test("should handle repeated connection failures", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: { type: "local", command: ["invalid-command"] },
      })
      mockPrompts.text.mockReturnValueOnce("test-server")
      mockPrompts.confirm
        .mockReturnValueOnce(true) // Enable server
        .mockReturnValueOnce(true) // Retry after failure

      mockPrompts.select.mockReturnValueOnce("command") // Modify command
      mockPrompts.text.mockReturnValueOnce("still-invalid-command") // Still invalid

      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => {
          throw new Error("Still failing")
        }),
      }))

      await McpWizardCommand.handler()

      expect(mockPrompts.log.error).toHaveBeenCalledWith(
        "Connection test failed again: Still failing",
      )
      expect(mockPrompts.outro).toHaveBeenCalledWith(
        "Setup failed - please check your configuration",
      )
    })
  })

  describe("Configuration Saving", () => {
    test("should create new config file if none exists", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: { type: "local", command: ["echo", "test"] },
      })
      mockPrompts.text.mockReturnValueOnce("test-server")
      mockPrompts.confirm.mockReturnValueOnce(true)

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      const configPath = path.join(mockConfigDir, "config.json")
      expect(await fs.access(configPath)).resolves.toBeUndefined()

      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)
      expect(config.mcp).toBeDefined()
      expect(config.mcp["test-server"]).toBeDefined()
    })

    test("should merge with existing config file", async () => {
      // Create existing config
      const configPath = path.join(mockConfigDir, "config.json")
      const existingConfig = {
        mcp: {
          "existing-server": {
            type: "local",
            command: ["existing", "command"],
          },
        },
        other: "settings",
      }
      await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2))

      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: { type: "local", command: ["echo", "test"] },
      })
      mockPrompts.text.mockReturnValueOnce("new-server")
      mockPrompts.confirm.mockReturnValueOnce(true)

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      expect(config.other).toBe("settings")
      expect(config.mcp["existing-server"]).toEqual({
        type: "local",
        command: ["existing", "command"],
      })
      expect(config.mcp["new-server"]).toBeDefined()
    })

    test("should handle server name conflicts with overwrite confirmation", async () => {
      // Create existing config with same server name
      const configPath = path.join(mockConfigDir, "config.json")
      const existingConfig = {
        mcp: {
          "test-server": {
            type: "local",
            command: ["old", "command"],
          },
        },
      }
      await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2))

      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: { type: "local", command: ["echo", "test"] },
      })
      mockPrompts.text.mockReturnValueOnce("test-server")
      mockPrompts.confirm
        .mockReturnValueOnce(true) // Enable server
        .mockReturnValueOnce(true) // Overwrite existing

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      expect(config.mcp["test-server"].command).toEqual(["echo", "test"])
    })

    test("should handle server name conflicts with overwrite rejection", async () => {
      // Create existing config with same server name
      const configPath = path.join(mockConfigDir, "config.json")
      const existingConfig = {
        mcp: {
          "test-server": {
            type: "local",
            command: ["old", "command"],
          },
        },
      }
      await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2))

      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: { type: "local", command: ["echo", "test"] },
      })
      mockPrompts.text.mockReturnValueOnce("test-server")
      mockPrompts.confirm
        .mockReturnValueOnce(true) // Enable server
        .mockReturnValueOnce(false) // Don't overwrite

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      // Should remain unchanged
      expect(config.mcp["test-server"].command).toEqual(["old", "command"])
      expect(mockPrompts.outro).toHaveBeenCalledWith("Cancelled")
    })
  })

  describe("Server Template Selection", () => {
    test("should provide all available server templates", async () => {
      mockPrompts.select.mockReturnValueOnce("template")

      const templateOptions = mockPrompts.select.mock.calls[1]?.[0]?.options
      expect(templateOptions).toBeDefined()
      expect(templateOptions.length).toBeGreaterThan(0)

      const templateNames = templateOptions.map((opt: any) => opt.value.name)
      expect(templateNames).toContain("Qdrant Vector Database")
      expect(templateNames).toContain("OpenAI Tools")
      expect(templateNames).toContain("Anthropic Tools")
      expect(templateNames).toContain("File System Tools")
      expect(templateNames).toContain("Git Tools")
      expect(templateNames).toContain("Web Search")
    })

    test("should handle template with complex environment variables", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "File System Tools",
        description: "Enhanced file system operations",
        config: {
          type: "local",
          command: ["npx", "@modelcontextprotocol/server-filesystem"],
          environment: {
            ALLOWED_DIRECTORIES: process.cwd(),
          },
        },
        envVars: [
          {
            key: "ALLOWED_DIRECTORIES",
            description: "Comma-separated list of allowed directories",
            required: true,
          },
        ],
      })

      mockPrompts.text
        .mockReturnValueOnce("filesystem-server")
        .mockReturnValueOnce("/home/user,/tmp,/var/log")

      mockPrompts.confirm.mockReturnValueOnce(true)

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      const configPath = path.join(mockConfigDir, "config.json")
      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      expect(
        config.mcp["filesystem-server"].environment.ALLOWED_DIRECTORIES,
      ).toBe("/home/user,/tmp,/var/log")
    })
  })

  describe("Environment Variable Collection", () => {
    test("should handle required environment variable validation", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: { type: "local", command: ["echo", "test"] },
        envVars: [
          {
            key: "REQUIRED_VAR",
            description: "Required variable",
            required: true,
          },
        ],
      })

      mockPrompts.text.mockReturnValueOnce("test-server")

      // Test required validation
      const envValidator = mockPrompts.text.mock.calls[1]?.[0]?.validate
      expect(envValidator).toBeDefined()
      expect(envValidator("")).toBe("REQUIRED_VAR is required")
      expect(envValidator("some-value")).toBeUndefined()
    })

    test("should handle optional environment variables", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: { type: "local", command: ["echo", "test"] },
        envVars: [
          {
            key: "OPTIONAL_VAR",
            description: "Optional variable",
            required: false,
          },
        ],
      })

      mockPrompts.text
        .mockReturnValueOnce("test-server")
        .mockReturnValueOnce("") // Empty optional value

      mockPrompts.confirm.mockReturnValueOnce(true)

      const mockClient = {
        tools: mock(() => Promise.resolve({ tools: [] })),
        close: mock(() => {}),
      }
      mock.module("ai", () => ({
        experimental_createMCPClient: mock(() => Promise.resolve(mockClient)),
      }))

      await McpWizardCommand.handler()

      const configPath = path.join(mockConfigDir, "config.json")
      const configContent = await fs.readFile(configPath, "utf-8")
      const config = JSON.parse(configContent)

      // Should not include empty optional variables
      expect(config.mcp["test-server"].environment).toBeUndefined()
    })

    test("should preserve existing environment variable values", async () => {
      mockPrompts.select.mockReturnValueOnce("template").mockReturnValueOnce({
        name: "Test Server",
        config: {
          type: "local",
          command: ["echo", "test"],
          environment: { EXISTING_VAR: "existing_value" },
        },
        envVars: [
          {
            key: "EXISTING_VAR",
            description: "Existing variable",
            required: true,
          },
        ],
      })

      mockPrompts.text.mockReturnValueOnce("test-server")

      // Should show existing value as initial value
      const envPrompt = mockPrompts.text.mock.calls[1]?.[0]
      expect(envPrompt.initialValue).toBe("existing_value")
    })
  })
})
