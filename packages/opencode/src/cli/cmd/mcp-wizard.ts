import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { Config } from "../../config/config"
import { Global } from "../../global"
import { experimental_createMCPClient } from "ai"
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio"
import path from "path"
import fs from "fs/promises"

export const McpWizardCommand = cmd({
  command: "wizard",
  describe: "interactive MCP server setup wizard",
  async handler() {
    UI.empty()
    prompts.intro("🧙 MCP Server Setup Wizard")

    prompts.log.info(
      "This wizard will help you set up an MCP server with connection testing",
    )

    // Step 1: Choose setup method
    const setupMethod = await prompts.select({
      message: "How would you like to set up your MCP server?",
      options: [
        { label: "📋 Use a template (recommended)", value: "template" },
        { label: "⚙️  Custom configuration", value: "custom" },
      ],
    })

    if (prompts.isCancel(setupMethod)) throw new UI.CancelledError()

    let serverConfig: Config.Mcp
    let serverName: string

    if (setupMethod === "template") {
      const result = await setupFromTemplate()
      if (!result) return
      serverConfig = result.config
      serverName = result.name
    } else {
      const result = await setupCustom()
      if (!result) return
      serverConfig = result.config
      serverName = result.name
    }

    // Step 2: Test connection
    prompts.log.step("Testing connection...")

    const testResult = await testConnection(serverName, serverConfig)

    if (!testResult.success) {
      prompts.log.error(`Connection test failed: ${testResult.error}`)

      const retry = await prompts.confirm({
        message: "Would you like to modify the configuration and try again?",
        initialValue: true,
      })

      if (prompts.isCancel(retry) || !retry) {
        prompts.outro("Setup cancelled")
        return
      }

      // Allow user to modify configuration
      const modifiedResult = await modifyConfiguration(serverConfig)
      if (!modifiedResult) return

      serverConfig = modifiedResult

      // Test again
      const retestResult = await testConnection(serverName, serverConfig)
      if (!retestResult.success) {
        prompts.log.error(`Connection test failed again: ${retestResult.error}`)
        prompts.outro("Setup failed - please check your configuration")
        return
      }
    }

    prompts.log.success("✅ Connection test passed!")

    // Step 3: Save configuration
    await saveConfiguration(serverName, serverConfig)

    prompts.log.success(
      `🎉 MCP server "${serverName}" has been configured successfully!`,
    )
    prompts.log.info("You can now use this server in your DGMO sessions")
    prompts.outro("Setup complete")
  },
})

interface ServerTemplate {
  name: string
  description: string
  config: {
    type: "local"
    command: string[]
    environment?: Record<string, string>
  }
  envVars?: { key: string; description: string; required: boolean }[]
}

const SERVER_TEMPLATES: ServerTemplate[] = [
  {
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
      { key: "QDRANT_URL", description: "Qdrant server URL", required: true },
    ],
  },
  {
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
  },
  {
    name: "Anthropic Tools",
    description: "Access Anthropic API through MCP",
    config: {
      type: "local",
      command: ["npx", "@modelcontextprotocol/server-anthropic"],
    },
    envVars: [
      {
        key: "ANTHROPIC_API_KEY",
        description: "Your Anthropic API key",
        required: true,
      },
    ],
  },
  {
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
  },
  {
    name: "Git Tools",
    description: "Git repository management tools",
    config: {
      type: "local",
      command: ["npx", "@modelcontextprotocol/server-git"],
    },
  },
  {
    name: "Web Search",
    description: "Web search capabilities",
    config: {
      type: "local",
      command: ["npx", "@modelcontextprotocol/server-brave-search"],
    },
    envVars: [
      {
        key: "BRAVE_API_KEY",
        description: "Your Brave Search API key",
        required: true,
      },
    ],
  },
]

async function setupFromTemplate(): Promise<{
  config: Config.Mcp
  name: string
} | null> {
  const template = await prompts.select({
    message: "Choose a server template:",
    options: SERVER_TEMPLATES.map((t) => ({
      label: `${t.name} - ${t.description}`,
      value: t,
    })),
  })

  if (prompts.isCancel(template)) return null

  const serverName = await prompts.text({
    message: "Server name:",
    placeholder: template.name.toLowerCase().replace(/\s+/g, "-"),
    validate: (value) => {
      if (!value) return "Server name is required"
      if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
        return "Server name can only contain letters, numbers, hyphens, and underscores"
      }
      return undefined
    },
  })

  if (prompts.isCancel(serverName)) return null

  let config = { ...template.config }

  // Handle environment variables
  if (template.envVars && template.envVars.length > 0) {
    prompts.log.info("This template requires environment variables:")

    const environment: Record<string, string> = { ...config.environment }

    for (const envVar of template.envVars) {
      const currentValue = environment[envVar.key] || ""

      const value = await prompts.text({
        message: `${envVar.key} (${envVar.description}):`,
        placeholder:
          currentValue || (envVar.required ? "Required" : "Optional"),
        initialValue: currentValue,
        validate: (value) => {
          if (envVar.required && !value) {
            return `${envVar.key} is required`
          }
          return undefined
        },
      })

      if (prompts.isCancel(value)) return null

      if (value) {
        environment[envVar.key] = value
      }
    }

    config.environment = environment
  }

  const enabled = await prompts.confirm({
    message: "Enable server immediately?",
    initialValue: true,
  })

  if (prompts.isCancel(enabled)) return null

  let finalConfig: Config.Mcp = config
  if (!enabled) {
    finalConfig = { ...config, enabled: false }
  }

  return { config: finalConfig, name: serverName }
}

async function setupCustom(): Promise<{
  config: Config.Mcp
  name: string
} | null> {
  const serverName = await prompts.text({
    message: "Server name:",
    placeholder: "my-server",
    validate: (value) => {
      if (!value) return "Server name is required"
      if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
        return "Server name can only contain letters, numbers, hyphens, and underscores"
      }
      return undefined
    },
  })

  if (prompts.isCancel(serverName)) return null

  const type = await prompts.select({
    message: "Server type:",
    options: [
      { label: "Local (command)", value: "local" },
      { label: "Remote (URL)", value: "remote" },
    ],
  })

  if (prompts.isCancel(type)) return null

  let serverConfig: Config.Mcp

  if (type === "local") {
    const commandStr = await prompts.text({
      message: "Command to run:",
      placeholder: "npx @modelcontextprotocol/server-name",
      validate: (value) => {
        if (!value) return "Command is required"
        return undefined
      },
    })

    if (prompts.isCancel(commandStr)) return null

    const command = commandStr.trim().split(/\s+/)

    const envVars = await prompts.text({
      message: "Environment variables (optional):",
      placeholder: "KEY1=value1 KEY2=value2",
    })

    if (prompts.isCancel(envVars)) return null

    const environment: Record<string, string> = {}
    if (envVars) {
      const pairs = envVars.trim().split(/\s+/)
      for (const pair of pairs) {
        const [key, ...valueParts] = pair.split("=")
        if (key && valueParts.length > 0) {
          environment[key] = valueParts.join("=")
        }
      }
    }

    serverConfig = {
      type: "local",
      command,
      ...(Object.keys(environment).length > 0 && { environment }),
    }
  } else {
    const url = await prompts.text({
      message: "Server URL:",
      placeholder: "https://api.example.com/mcp",
      validate: (value) => {
        if (!value) return "URL is required"
        try {
          new URL(value)
          return undefined
        } catch {
          return "Invalid URL"
        }
      },
    })

    if (prompts.isCancel(url)) return null

    serverConfig = {
      type: "remote",
      url,
    }
  }

  const enabled = await prompts.confirm({
    message: "Enable server immediately?",
    initialValue: true,
  })

  if (prompts.isCancel(enabled)) return null

  if (!enabled) {
    serverConfig.enabled = false
  }

  return { config: serverConfig, name: serverName }
}

async function testConnection(
  name: string,
  config: Config.Mcp,
): Promise<{ success: boolean; error?: string }> {
  try {
    let client: Awaited<ReturnType<typeof experimental_createMCPClient>>

    if (config.type === "local") {
      const [cmd, ...args] = config.command
      client = await experimental_createMCPClient({
        name,
        transport: new Experimental_StdioMCPTransport({
          stderr: "ignore",
          command: cmd,
          args,
          env: {
            ...process.env,
            ...(cmd === "dgmo" ? { BUN_BE_BUN: "1" } : {}),
            ...config.environment,
          },
        }),
      })
    } else {
      client = await experimental_createMCPClient({
        name,
        transport: {
          type: "sse",
          url: config.url,
        },
      })
    }

    // Test basic functionality
    await client.tools()

    // Clean up
    client.close()

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

async function modifyConfiguration(
  config: Config.Mcp,
): Promise<Config.Mcp | null> {
  prompts.log.info("Current configuration:")

  if (config.type === "local") {
    prompts.log.info(`Command: ${config.command.join(" ")}`)
    if (config.environment) {
      prompts.log.info(
        `Environment: ${Object.entries(config.environment)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")}`,
      )
    }
  } else {
    prompts.log.info(`URL: ${config.url}`)
  }

  const whatToModify = await prompts.select({
    message: "What would you like to modify?",
    options:
      config.type === "local"
        ? [
            { label: "Command", value: "command" },
            { label: "Environment variables", value: "environment" },
            { label: "Cancel", value: "cancel" },
          ]
        : [
            { label: "URL", value: "url" },
            { label: "Cancel", value: "cancel" },
          ],
  })

  if (prompts.isCancel(whatToModify) || whatToModify === "cancel") return null

  const newConfig = { ...config }

  if (whatToModify === "command" && config.type === "local") {
    const commandStr = await prompts.text({
      message: "New command:",
      initialValue: config.command.join(" "),
      validate: (value) => {
        if (!value) return "Command is required"
        return undefined
      },
    })

    if (prompts.isCancel(commandStr)) return null
    if (newConfig.type === "local") {
      newConfig.command = commandStr.trim().split(/\\s+/)
    }
  }

  if (whatToModify === "environment" && config.type === "local") {
    const currentEnv = config.environment
      ? Object.entries(config.environment)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")
      : ""

    const envVars = await prompts.text({
      message: "Environment variables:",
      initialValue: currentEnv,
      placeholder: "KEY1=value1 KEY2=value2",
    })

    if (prompts.isCancel(envVars)) return null

    const environment: Record<string, string> = {}
    if (envVars) {
      const pairs = envVars.trim().split(/\s+/)
      for (const pair of pairs) {
        const [key, ...valueParts] = pair.split("=")
        if (key && valueParts.length > 0) {
          environment[key] = valueParts.join("=")
        }
      }
    }
    if (newConfig.type === "local") {
      newConfig.environment = environment
    }
  }

  if (whatToModify === "url" && config.type === "remote") {
    const url = await prompts.text({
      message: "New URL:",
      initialValue: config.url,
      validate: (value) => {
        if (!value) return "URL is required"
        try {
          new URL(value)
          return undefined
        } catch {
          return "Invalid URL"
        }
      },
    })

    if (prompts.isCancel(url)) return null
    if (newConfig.type === "remote") {
      newConfig.url = url
    }
  }

  return newConfig
}

async function saveConfiguration(
  name: string,
  config: Config.Mcp,
): Promise<void> {
  const configPath = path.join(Global.Path.config, "config.json")

  // Ensure config directory exists
  await fs.mkdir(Global.Path.config, { recursive: true })

  let existingConfig: any = {}
  try {
    const configContent = await fs.readFile(configPath, "utf-8")
    existingConfig = JSON.parse(configContent)
  } catch (error) {
    if ((error as any).code !== "ENOENT") {
      throw error
    }
  }

  if (!existingConfig.mcp) {
    existingConfig.mcp = {}
  }

  if (existingConfig.mcp[name]) {
    const overwrite = await prompts.confirm({
      message: `Server "${name}" already exists. Overwrite?`,
      initialValue: false,
    })

    if (prompts.isCancel(overwrite)) throw new UI.CancelledError()

    if (!overwrite) {
      prompts.outro("Cancelled")
      return
    }
  }

  existingConfig.mcp[name] = config

  await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2))
}
