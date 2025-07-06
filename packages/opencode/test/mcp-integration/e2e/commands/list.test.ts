import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"
import os from "os"

describe("mcp list command", () => {
  let tempConfigDir: string
  let configPath: string
  let originalHome: string | undefined

  beforeEach(async () => {
    // Create temporary config directory
    tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), "dgmo-test-"))
    configPath = path.join(tempConfigDir, "config.json")

    // Mock home directory for path display tests
    originalHome = process.env.HOME
    process.env.HOME = "/mock/home"
  })

  afterEach(async () => {
    // Cleanup
    await fs.rm(tempConfigDir, { recursive: true, force: true })
    if (originalHome !== undefined) {
      process.env.HOME = originalHome
    } else {
      delete process.env.HOME
    }
  })

  describe("empty configuration scenarios", () => {
    it("should handle missing config file gracefully", async () => {
      const result = await runMcpListCommand(tempConfigDir)

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain("No configuration file found")
      expect(result.output).toContain("0 MCP servers")
    })

    it("should handle empty config file", async () => {
      await fs.writeFile(configPath, "{}")

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain("No MCP servers configured")
      expect(result.output).toContain("0 MCP servers")
    })

    it("should handle config with empty mcp section", async () => {
      const config = { mcp: {} }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain("No MCP servers configured")
      expect(result.output).toContain("0 MCP servers")
    })
  })

  describe("single server configurations", () => {
    it("should display local server correctly", async () => {
      const config = {
        mcp: {
          "test-local": {
            type: "local",
            command: ["node", "server.js"],
            environment: {
              NODE_ENV: "test",
            },
          },
        },
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain("test-local")
      expect(result.output).toContain("local")
      expect(result.output).toContain("[enabled]")
      expect(result.output).toContain("node server.js")
      expect(result.output).toContain("1 MCP servers")
    })

    it("should display remote server correctly", async () => {
      const config = {
        mcp: {
          "test-remote": {
            type: "remote",
            url: "https://api.example.com/mcp",
          },
        },
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain("test-remote")
      expect(result.output).toContain("remote")
      expect(result.output).toContain("[enabled]")
      expect(result.output).toContain("https://api.example.com/mcp")
      expect(result.output).toContain("1 MCP servers")
    })

    it("should display disabled server correctly", async () => {
      const config = {
        mcp: {
          "disabled-server": {
            type: "local",
            command: ["node", "server.js"],
            enabled: false,
          },
        },
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain("disabled-server")
      expect(result.output).toContain("[disabled]")
      expect(result.output).toContain("1 MCP servers")
    })
  })

  describe("multiple server configurations", () => {
    it("should display multiple servers with different types", async () => {
      const config = {
        mcp: {
          "local-server": {
            type: "local",
            command: ["npx", "@modelcontextprotocol/server-filesystem", "/tmp"],
          },
          "remote-server": {
            type: "remote",
            url: "wss://api.example.com/mcp",
          },
          "disabled-server": {
            type: "local",
            command: ["node", "disabled.js"],
            enabled: false,
          },
        },
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain("local-server")
      expect(result.output).toContain("remote-server")
      expect(result.output).toContain("disabled-server")
      expect(result.output).toContain("3 MCP servers")

      // Check status indicators
      expect(result.output).toMatch(/local-server.*\[enabled\]/)
      expect(result.output).toMatch(/remote-server.*\[enabled\]/)
      expect(result.output).toMatch(/disabled-server.*\[disabled\]/)
    })

    it("should handle servers with complex commands", async () => {
      const config = {
        mcp: {
          "complex-server": {
            type: "local",
            command: [
              "python",
              "-m",
              "mcp_server",
              "--config",
              "/path/to/config.json",
              "--verbose",
            ],
            environment: {
              PYTHONPATH: "/custom/path",
              DEBUG: "true",
            },
          },
        },
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain("complex-server")
      expect(result.output).toContain(
        "python -m mcp_server --config /path/to/config.json --verbose",
      )
    })
  })

  describe("path display functionality", () => {
    it("should replace home directory with ~ in config path", async () => {
      // Create config in mock home directory
      const homeConfigDir = "/mock/home/.config/dgmo"
      const homeConfigPath = path.join(homeConfigDir, "config.json")

      // Mock the config path to be in home directory
      const originalConfigPath = configPath
      configPath = homeConfigPath

      const config = { mcp: {} }
      await fs.mkdir(homeConfigDir, { recursive: true })
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(path.dirname(homeConfigDir))

      expect(result.output).toContain("~/.config/dgmo/config.json")
      expect(result.output).not.toContain("/mock/home/.config/dgmo/config.json")

      // Cleanup
      await fs.rm(path.dirname(homeConfigDir), { recursive: true, force: true })
      configPath = originalConfigPath
    })

    it("should display full path when not in home directory", async () => {
      const config = { mcp: {} }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.output).toContain(configPath)
      expect(result.output).not.toContain("~")
    })
  })

  describe("invalid configuration handling", () => {
    it("should handle malformed JSON gracefully", async () => {
      await fs.writeFile(configPath, "{ invalid json }")

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.exitCode).not.toBe(0)
      expect(result.output).toContain("error") // Should contain some error indication
    })

    it("should handle missing required fields", async () => {
      const config = {
        mcp: {
          "invalid-server": {
            // Missing type field
            command: ["node", "server.js"],
          },
        },
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(tempConfigDir)

      // Should still attempt to display what it can
      expect(result.output).toContain("invalid-server")
    })

    it("should handle servers with invalid types", async () => {
      const config = {
        mcp: {
          "invalid-type-server": {
            type: "invalid-type",
            command: ["node", "server.js"],
          },
        },
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.output).toContain("invalid-type-server")
    })
  })

  describe("display formatting validation", () => {
    it("should format output consistently", async () => {
      const config = {
        mcp: {
          "server-1": {
            type: "local",
            command: ["node", "server1.js"],
          },
          "server-2": {
            type: "remote",
            url: "https://server2.example.com",
          },
        },
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(tempConfigDir)

      // Check that output follows expected format patterns
      const lines = result.output.split("\n").filter((line) => line.trim())

      // Should have intro line with config path
      expect(
        lines.some(
          (line) => line.includes("MCP Servers") && line.includes(configPath),
        ),
      ).toBe(true)

      // Should have server entries
      expect(
        lines.some(
          (line) => line.includes("server-1") && line.includes("local"),
        ),
      ).toBe(true)
      expect(
        lines.some(
          (line) => line.includes("server-2") && line.includes("remote"),
        ),
      ).toBe(true)

      // Should have summary line
      expect(lines.some((line) => line.includes("2 MCP servers"))).toBe(true)
    })

    it("should handle long server names and commands gracefully", async () => {
      const config = {
        mcp: {
          "very-long-server-name-that-might-cause-formatting-issues": {
            type: "local",
            command: [
              "python",
              "-m",
              "very.long.module.name.that.might.cause.issues",
              "--with",
              "many",
              "arguments",
              "--and",
              "flags",
            ],
          },
        },
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain(
        "very-long-server-name-that-might-cause-formatting-issues",
      )
    })
  })

  describe("edge cases", () => {
    it("should handle config file with only whitespace", async () => {
      await fs.writeFile(configPath, "   \n  \t  \n   ")

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.exitCode).not.toBe(0)
    })

    it("should handle config directory without read permissions", async () => {
      // This test might be platform-specific
      if (process.platform !== "win32") {
        await fs.chmod(tempConfigDir, 0o000)

        const result = await runMcpListCommand(tempConfigDir)

        expect(result.exitCode).not.toBe(0)

        // Restore permissions for cleanup
        await fs.chmod(tempConfigDir, 0o755)
      }
    })

    it("should handle very large config files", async () => {
      const config = { mcp: {} }

      // Create a config with many servers
      for (let i = 0; i < 100; i++) {
        config.mcp[`server-${i}`] = {
          type: "local",
          command: ["node", `server-${i}.js`],
        }
      }

      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runMcpListCommand(tempConfigDir)

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain("100 MCP servers")
    })
  })
})

// Helper function to run the mcp list command
async function runMcpListCommand(
  configDir: string,
): Promise<{ exitCode: number; output: string; error: string }> {
  return new Promise((resolve) => {
    const env = { ...process.env, DGMO_CONFIG_DIR: configDir }
    const child = spawn("bun", ["run", "src/index.ts", "mcp", "list"], {
      cwd: "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode",
      env,
      stdio: ["pipe", "pipe", "pipe"],
    })

    let output = ""
    let error = ""

    child.stdout?.on("data", (data) => {
      output += data.toString()
    })

    child.stderr?.on("data", (data) => {
      error += data.toString()
    })

    child.on("close", (code) => {
      resolve({
        exitCode: code || 0,
        output: output + error, // Combine for easier testing
        error,
      })
    })

    child.on("error", (err) => {
      resolve({
        exitCode: 1,
        output: "",
        error: err.message,
      })
    })
  })
}
