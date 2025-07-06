import { cmd } from "./cmd"
import { MCP } from "../../mcp"
import { App } from "../../app/app"
import { Config } from "../../config/config"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import path from "path"
import fs from "fs/promises"
import { Global } from "../../global"
import type { Config as ConfigType } from "../../config/config"

export const McpCommand = cmd({
  command: "mcp",
  describe: "Manage MCP servers",
  builder: (yargs) =>
    yargs
      .command(McpListCommand)
      .command(McpAddCommand)
      .command(McpRemoveCommand)
      .command(McpEnableCommand)
      .command(McpDisableCommand)
      .command(McpStatusCommand)
      .command(McpTestCommand)
      .command(McpToolsCommand)
      .command(McpResourcesCommand)
      .command(McpDebugCommand)
      .command(McpLogsCommand)
      .command(McpHealthCommand)
      .demandCommand()
      .strict(),
  async handler() {},
})

export const McpListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list all MCP servers",
  async handler() {
    UI.empty()
    prompts.intro("MCP Servers " + UI.Style.TEXT_DIM + path.join("~", ".config", "dgmo", "config.json"))

    const configPath = path.join(Global.Path.config, "config.json")
    
    let config: any = {}
    try {
      const configContent = await fs.readFile(configPath, "utf-8")
      config = JSON.parse(configContent)
    } catch (error) {
      // If file doesn't exist, that's ok
    }

    const mcpServers = config.mcp || {}
    const serverEntries = Object.entries(mcpServers)
    
    if (serverEntries.length === 0) {
      prompts.log.info("No MCP servers configured")
      prompts.outro("Done")
      return
    }

    for (const [name, server] of serverEntries) {
      const serverConfig = server as ConfigType.Mcp
      const type = serverConfig.type
      const enabled = serverConfig.enabled !== false ? "[enabled]" : "[disabled]"
      const detail = serverConfig.type === "local" 
        ? serverConfig.command.join(" ")
        : serverConfig.url
      
      prompts.log.info(`●  ${name} ${UI.Style.TEXT_DIM}${type}${UI.Style.TEXT_NORMAL} ${enabled}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}${detail}`)
    }

    prompts.outro(`${serverEntries.length} MCP servers`)
  },
})

export const McpAddCommand = cmd({
  command: "add",
  describe: "add a new MCP server",
  async handler() {
    UI.empty()
    prompts.intro("Add MCP server")

    const name = await prompts.text({
      message: "Server name",
      placeholder: "my-server",
      validate: (value) => {
        if (!value) return "Name is required"
        if (!/^[a-zA-Z0-9-_]+$/.test(value))
          return "Name must contain only letters, numbers, hyphens, and underscores"
      },
    })

    if (prompts.isCancel(name)) throw new UI.CancelledError()

    const type = await prompts.select({
      message: "Server type",
      options: [
        {
          label: "Local (subprocess)",
          value: "local",
          hint: "Run an MCP server as a subprocess",
        },
        {
          label: "Remote (WebSocket)",
          value: "remote",
          hint: "Connect to a remote MCP server",
        },
      ],
    })

    if (prompts.isCancel(type)) throw new UI.CancelledError()

    let serverConfig: ConfigType.Mcp

    if (type === "local") {
      const command = await prompts.text({
        message: "Command to run",
        placeholder: "npx my-mcp-server",
        validate: (value) => {
          if (!value) return "Command is required"
        },
      })

      if (prompts.isCancel(command)) throw new UI.CancelledError()

      const envVars = await prompts.text({
        message: "Environment variables (optional)",
        placeholder: "KEY1=value1 KEY2=value2",
      })

      if (prompts.isCancel(envVars)) throw new UI.CancelledError()

      const environment: Record<string, string> = {}
      if (envVars) {
        const pairs = envVars.split(/\s+/)
        for (const pair of pairs) {
          const [key, value] = pair.split("=")
          if (key && value) {
            environment[key] = value
          }
        }
      }

      serverConfig = {
        type: "local",
        command: command.split(/\s+/),
        environment: Object.keys(environment).length > 0 ? environment : undefined,
      }
    } else {
      const url = await prompts.text({
        message: "WebSocket URL",
        placeholder: "ws://localhost:3000",
        validate: (value) => {
          if (!value) return "URL is required"
          if (!value.startsWith("ws://") && !value.startsWith("wss://"))
            return "URL must start with ws:// or wss://"
        },
      })

      if (prompts.isCancel(url)) throw new UI.CancelledError()

      serverConfig = {
        type: "remote",
        url,
      }
    }

    const configPath = path.join(Global.Path.config, "config.json")

    let config: any = {}
    try {
      const configContent = await fs.readFile(configPath, "utf-8")
      config = JSON.parse(configContent)
    } catch (error) {
      // If file doesn't exist, that's ok
    }

    if (!config.mcp) {
      config.mcp = {}
    }

    if (config.mcp[name]) {
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

    config.mcp[name] = serverConfig

    await fs.mkdir(path.dirname(configPath), { recursive: true })
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))

    prompts.log.success(`Added MCP server "${name}"`)

    const testNow = await prompts.confirm({
      message: "Test connection now?",
      initialValue: true,
    })

    if (prompts.isCancel(testNow)) throw new UI.CancelledError()

    if (testNow) {
      prompts.log.info("Testing connection...")
      try {
        await App.provide({ cwd: process.cwd() }, async () => {
          const clients = await MCP.clients()
          const client = clients[name]
          if (!client) {
            throw new Error("Failed to connect")
          }
          const tools = await client.tools()
          prompts.log.success(`Connected! Found ${Object.keys(tools).length} tools`)
        })
      } catch (error) {
        prompts.log.error(`Failed to connect: ${error}`)
      }
    }

    prompts.outro("Done")
  },
})

export const McpRemoveCommand = cmd({
  command: "remove [server]",
  aliases: ["rm"],
  describe: "remove an MCP server",
  builder: (yargs) =>
    yargs.positional("server", {
      describe: "name of the MCP server to remove",
      type: "string",
    }),
  async handler(args) {
    const serverNameArg = args.server as string | undefined
    UI.empty()
    prompts.intro("Remove MCP server")

    const configPath = path.join(Global.Path.config, "config.json")

    let config: any = {}
    try {
      const configContent = await fs.readFile(configPath, "utf-8")
      config = JSON.parse(configContent)
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        prompts.log.error("No configuration file found")
        prompts.outro("Failed")
        return
      }
      throw error
    }

    const mcpServers = config.mcp || {}
    const serverNames = Object.keys(mcpServers)

    if (serverNames.length === 0) {
      prompts.log.error("No MCP servers configured")
      prompts.outro("Failed")
      return
    }

    let name: string
    
    if (serverNameArg) {
      // Use the provided server name
      if (!mcpServers[serverNameArg]) {
        prompts.log.error(`Server "${serverNameArg}" not found`)
        prompts.outro("Failed")
        return
      }
      name = serverNameArg
    } else {
      // Interactive selection
      const selected = await prompts.select({
        message: "Select server to remove",
        options: serverNames.map((serverName) => {
          const server = mcpServers[serverName] as Config.Mcp
          const type = server.type
          const detail =
            server.type === "local" ? server.command.join(" ") : server.url
          return {
            label: `${serverName} ${UI.Style.TEXT_DIM}(${type}: ${detail})`,
            value: serverName,
          }
        }),
      })

      if (prompts.isCancel(selected)) throw new UI.CancelledError()
      name = selected
    }

    const confirm = await prompts.confirm({
      message: `Remove server "${name}"?`,
      initialValue: false,
    })

    if (prompts.isCancel(confirm)) throw new UI.CancelledError()

    if (!confirm) {
      prompts.outro("Cancelled")
      return
    }

    delete config.mcp[name]

    await fs.writeFile(configPath, JSON.stringify(config, null, 2))

    prompts.log.success(`Removed MCP server "${name}"`)
    prompts.outro("Done")
  },
})

export const McpEnableCommand = cmd({
  command: "enable [server]",
  describe: "enable an MCP server",
  builder: (yargs) =>
    yargs.positional("server", {
      describe: "name of the MCP server to enable",
      type: "string",
    }),
  async handler(args) {
    await toggleMcpServer(true, args.server as string | undefined)
  },
})

export const McpDisableCommand = cmd({
  command: "disable [server]",
  describe: "disable an MCP server",
  builder: (yargs) =>
    yargs.positional("server", {
      describe: "name of the MCP server to disable",
      type: "string",
    }),
  async handler(args) {
    await toggleMcpServer(false, args.server as string | undefined)
  },
})

async function toggleMcpServer(enable: boolean, serverNameArg?: string) {
  UI.empty()
  prompts.intro(`${enable ? "Enable" : "Disable"} MCP server`)

  const configPath = path.join(Global.Path.config, "config.json")

  let config: any = {}
  try {
    const configContent = await fs.readFile(configPath, "utf-8")
    config = JSON.parse(configContent)
  } catch (error) {
    if ((error as any).code === "ENOENT") {
      prompts.log.error("No configuration file found")
      prompts.outro("Failed")
      return
    }
    throw error
  }

  const mcpServers = config.mcp || {}
  
  let name: string
  
  if (serverNameArg) {
    // Use the provided server name
    if (!mcpServers[serverNameArg]) {
      prompts.log.error(`Server "${serverNameArg}" not found`)
      prompts.outro("Failed")
      return
    }
    
    const server = mcpServers[serverNameArg] as Config.Mcp
    const isEnabled = server.enabled !== false
    
    if (enable && isEnabled) {
      prompts.log.warn(`Server "${serverNameArg}" is already enabled`)
      prompts.outro("No change needed")
      return
    }
    
    if (!enable && !isEnabled) {
      prompts.log.warn(`Server "${serverNameArg}" is already disabled`)
      prompts.outro("No change needed")
      return
    }
    
    name = serverNameArg
  } else {
    // Interactive selection
    const serverNames = Object.keys(mcpServers).filter((name) => {
      const server = mcpServers[name] as Config.Mcp
      return enable ? server.enabled === false : server.enabled !== false
    })

    if (serverNames.length === 0) {
      prompts.log.error(`No MCP servers to ${enable ? "enable" : "disable"}`)
      prompts.outro("Failed")
      return
    }

    const selected = await prompts.select({
      message: `Select server to ${enable ? "enable" : "disable"}`,
      options: serverNames.map((serverName) => {
        const server = mcpServers[serverName] as Config.Mcp
        const type = server.type
        const detail =
          server.type === "local" ? server.command.join(" ") : server.url
        return {
          label: `${serverName} ${UI.Style.TEXT_DIM}(${type}: ${detail})`,
          value: serverName,
        }
      }),
    })

    if (prompts.isCancel(selected)) throw new UI.CancelledError()
    name = selected
  }

  if (enable) {
    delete config.mcp[name].enabled
  } else {
    config.mcp[name].enabled = false
  }

  await fs.writeFile(configPath, JSON.stringify(config, null, 2))

  prompts.log.success(`${enable ? "Enabled" : "Disabled"} MCP server "${name}"`)
  prompts.outro("Done")
}

export const McpStatusCommand = cmd({
  command: "status [server]",
  describe: "show detailed MCP server status",
  builder: (yargs) =>
    yargs.positional("server", {
      describe: "specific server to check status (optional)",
      type: "string",
    }),
  async handler(args) {
    UI.empty()
    const serverName = args.server as string | undefined

    if (serverName) {
      prompts.intro(`MCP Server Status: ${serverName}`)
    } else {
      prompts.intro("MCP Server Status")
    }

    try {
      await App.provide({ cwd: process.cwd() }, async () => {
        const clients = await MCP.clients()
        const config = await Config.get()
        const mcpServers = config.mcp || {}

      if (serverName) {
        // Show status for specific server
        if (!mcpServers[serverName]) {
          prompts.log.error(`Server "${serverName}" not found in configuration`)
          prompts.outro("Failed")
          return
        }

        const server = mcpServers[serverName]
        const client = clients[serverName]
        const isConnected = !!client

        prompts.log.info(
          `${UI.Style.TEXT_HIGHLIGHT_BOLD}${serverName}${UI.Style.TEXT_NORMAL}`,
        )
        prompts.log.info(`  Type: ${server.type}`)
        prompts.log.info(
          `  Enabled: ${server.enabled !== false ? "✅ Yes" : "❌ No"}`,
        )
        prompts.log.info(
          `  Status: ${isConnected ? "✅ Connected" : "❌ Disconnected"}`,
        )

        if (server.type === "local") {
          prompts.log.info(`  Command: ${server.command.join(" ")}`)
          if (server.environment) {
            prompts.log.info(
              `  Environment: ${Object.entries(server.environment)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")}`,
            )
          }
        } else {
          prompts.log.info(`  URL: ${server.url}`)
        }

        if (isConnected) {
          try {
            const tools = await client.tools()
            prompts.log.info(`  Tools: ${Object.keys(tools).length} available`)
          } catch (error) {
            prompts.log.warn(`  Tools: Error loading (${error})`)
          }
        }
      } else {
        // Show status for all servers
        const serverEntries = Object.entries(mcpServers)

        if (serverEntries.length === 0) {
          prompts.log.info("No MCP servers configured")
        } else {
          for (const [name, server] of serverEntries) {
            const client = clients[name]
            const isConnected = !!client
            const isEnabled = server.enabled !== false

            let statusIcon = "❌"
            if (isEnabled && isConnected) statusIcon = "✅"
            else if (!isEnabled) statusIcon = "⚫"
            else if (isEnabled && !isConnected) statusIcon = "⚠️"

            const typeLabel = server.type === "local" ? "local" : "remote"
            const detail =
              server.type === "local" ? server.command.join(" ") : server.url

            prompts.log.info(
              `${statusIcon} ${name} ${UI.Style.TEXT_DIM}${typeLabel}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}${detail}${UI.Style.TEXT_NORMAL}`,
            )
          }

          const connectedCount = Object.keys(clients).length
          const totalCount = serverEntries.length
          prompts.log.info(
            `\n${connectedCount}/${totalCount} servers connected`,
          )
        }
      }

      prompts.outro("Done")
      })
    } catch (error) {
      prompts.log.error(`Failed to get server status: ${error}`)
      prompts.outro("Failed")
    }
  },
})

export const McpTestCommand = cmd({
  command: "test [server]",
  describe: "test MCP server connections",
  builder: (yargs) =>
    yargs.positional("server", {
      describe: "specific server to test (optional)",
      type: "string",
    }),
  async handler(args) {
    UI.empty()
    const serverName = args.server as string | undefined

    if (serverName) {
      prompts.intro(`Testing MCP Server: ${serverName}`)
    } else {
      prompts.intro("Testing MCP Servers")
    }

    try {
      await App.provide({ cwd: process.cwd() }, async () => {
        const config = await Config.get()
        const mcpServers = config.mcp || {}

        let serversToTest: [string, Config.Mcp][] = []

        if (serverName) {
          if (!mcpServers[serverName]) {
            prompts.log.error(`Server "${serverName}" not found`)
            prompts.outro("Failed")
            return
          }
          serversToTest = [[serverName, mcpServers[serverName]]]
        } else {
          serversToTest = Object.entries(mcpServers).filter(
            ([_, server]) => server.enabled !== false,
          )
        }

        let passedTests = 0
        const totalTests = serversToTest.length

        for (const [name, server] of serversToTest) {
          prompts.log.info(
            `\n${UI.Style.TEXT_HIGHLIGHT_BOLD}${name}${UI.Style.TEXT_NORMAL}`,
          )

          try {
            prompts.log.info("  🔄 Connecting...")
            const clients = await MCP.clients()
            const client = clients[name]

            if (!client) {
              throw new Error("Failed to establish connection")
            }

            prompts.log.success("  ✅ Connected")

            prompts.log.info("  🔄 Loading tools...")
            const tools = await client.tools()
            prompts.log.success(`  ✅ Tools: ${Object.keys(tools).length} available`)

            passedTests++
          } catch (error) {
            prompts.log.error(`  ❌ Failed: ${error}`)
          }
        }

        prompts.log.info(
          `\n${UI.Style.TEXT_HIGHLIGHT_BOLD}Test Results${UI.Style.TEXT_NORMAL}`,
        )
        prompts.log.info(`Passed: ${passedTests}/${totalTests} servers`)

        if (passedTests === totalTests) {
          prompts.outro("All tests passed")
        } else {
          prompts.outro("Some tests failed")
        }
      })
    } catch (error) {
      prompts.log.error(`Failed to test servers: ${error}`)
      prompts.outro("Failed")
    }
  },
})

export const McpToolsCommand = cmd({
  command: "tools [server]",
  describe: "list and inspect MCP tools",
  builder: (yargs) =>
    yargs.positional("server", {
      describe: "specific server to show tools for (optional)",
      type: "string",
    }),
  async handler(args) {
    UI.empty()
    const serverName = args.server as string | undefined

    if (serverName) {
      prompts.intro(`MCP Tools: ${serverName}`)
    } else {
      prompts.intro("MCP Tools")
    }

    try {
      await App.provide({ cwd: process.cwd() }, async () => {
        const clients = await MCP.clients()
        const allTools = await MCP.tools()

        if (serverName) {
        // Show tools for specific server
        const client = clients[serverName]
        if (!client) {
          prompts.log.error(`Server "${serverName}" not connected`)
          prompts.outro("Failed")
          return
        }

        try {
          const tools = await client.tools()
          const toolEntries = Object.entries(tools)

          if (toolEntries.length === 0) {
            prompts.log.info("No tools available")
          } else {
            for (const [toolName, tool] of toolEntries) {
              prompts.log.info(
                `\n${UI.Style.TEXT_HIGHLIGHT_BOLD}${toolName}${UI.Style.TEXT_NORMAL}`,
              )
              if (tool.description) {
                prompts.log.info(`  ${tool.description}`)
              }
              if (tool.inputSchema) {
                prompts.log.info(
                  `  ${UI.Style.TEXT_DIM}Parameters: ${JSON.stringify(tool.inputSchema)}${UI.Style.TEXT_NORMAL}`,
                )
              }
            }
          }

          prompts.outro(`${toolEntries.length} tools`)
        } catch (error) {
          prompts.log.error(`Failed to load tools: ${error}`)
          prompts.outro("Failed")
        }
      } else {
        // Show tools from all connected servers
        const toolsByServer: Record<string, string[]> = {}
        let totalTools = 0

        for (const [toolName, tool] of Object.entries(allTools)) {
          const serverPrefix = toolName.split("_")[0]
          if (!toolsByServer[serverPrefix]) {
            toolsByServer[serverPrefix] = []
          }
          toolsByServer[serverPrefix].push(toolName)
          totalTools++
        }

        if (totalTools === 0) {
          prompts.log.info("No tools available from any server")
        } else {
          for (const [server, toolNames] of Object.entries(toolsByServer)) {
            prompts.log.info(
              `\n${UI.Style.TEXT_HIGHLIGHT_BOLD}${server}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${toolNames.length} tools)${UI.Style.TEXT_NORMAL}`,
            )
            for (const toolName of toolNames.slice(0, 5)) {
              const tool = allTools[toolName]
              prompts.log.info(
                `  ${toolName}${tool.description ? ` - ${tool.description}` : ""}`,
              )
            }
            if (toolNames.length > 5) {
              prompts.log.info(
                `  ${UI.Style.TEXT_DIM}... and ${toolNames.length - 5} more${UI.Style.TEXT_NORMAL}`,
              )
            }
          }

          prompts.log.info(
            `\n${totalTools} total tools from ${Object.keys(toolsByServer).length} servers`,
          )
        }

        prompts.outro("Done")
      }
      })
    } catch (error) {
      prompts.log.error(`Failed to list tools: ${error}`)
      prompts.outro("Failed")
    }
  },
})

export const McpResourcesCommand = cmd({
  command: "resources [server]",
  describe: "list available MCP resources",
  builder: (yargs) =>
    yargs.positional("server", {
      describe: "specific server to show resources for (optional)",
      type: "string",
    }),
  async handler(args) {
    UI.empty()
    const serverName = args.server as string | undefined

    if (serverName) {
      prompts.intro(`MCP Resources: ${serverName}`)
    } else {
      prompts.intro("MCP Resources")
    }

    try {
      const clients = await MCP.clients()

      if (serverName) {
        // Show resources for specific server
        const client = clients[serverName]
        if (!client) {
          prompts.log.error(`Server "${serverName}" not connected`)
          prompts.outro("Failed")
          return
        }

        try {
          // Try to get resources if the client supports it
          const resources = (await (client as any).resources?.()) || []

          if (resources.length === 0) {
            prompts.log.info("No resources available")
          } else {
            for (const resource of resources) {
              prompts.log.info(
                `${UI.Style.TEXT_HIGHLIGHT_BOLD}${resource.uri || resource.name}${UI.Style.TEXT_NORMAL}`,
              )
              if (resource.description) {
                prompts.log.info(`  ${resource.description}`)
              }
              if (resource.mimeType) {
                prompts.log.info(
                  `  ${UI.Style.TEXT_DIM}Type: ${resource.mimeType}${UI.Style.TEXT_NORMAL}`,
                )
              }
            }
          }

          prompts.outro(`${resources.length} resources`)
        } catch (error) {
          prompts.log.warn("Resources not supported by this server")
          prompts.outro("Not supported")
        }
      } else {
        // Show resources from all servers
        let totalResources = 0
        let serversWithResources = 0

        for (const [name, client] of Object.entries(clients)) {
          try {
            const resources = (await (client as any).resources?.()) || []

            if (resources.length > 0) {
              serversWithResources++
              prompts.log.info(
                `\n${UI.Style.TEXT_HIGHLIGHT_BOLD}${name}${UI.Style.TEXT_NORMAL} ${UI.Style.TEXT_DIM}(${resources.length} resources)${UI.Style.TEXT_NORMAL}`,
              )

              for (const resource of resources.slice(0, 5)) {
                prompts.log.info(
                  `  ${resource.uri || resource.name}${resource.description ? ` - ${resource.description}` : ""}`,
                )
                totalResources++
              }

              if (resources.length > 5) {
                prompts.log.info(
                  `  ${UI.Style.TEXT_DIM}... and ${resources.length - 5} more${UI.Style.TEXT_NORMAL}`,
                )
                totalResources += resources.length - 5
              }
            }
          } catch (error) {
            // Server doesn't support resources, skip silently
          }
        }

        if (totalResources === 0) {
          prompts.log.info("No resources available from any server")
        } else {
          prompts.log.info(
            `\n${totalResources} total resources from ${serversWithResources} servers`,
          )
        }

        prompts.outro("Done")
      }
    } catch (error) {
      prompts.log.error(`Failed to list resources: ${error}`)
      prompts.outro("Failed")
    }
  },
})

export const McpDebugCommand = cmd({
  command: "debug [server]",
  describe: "show debug information and diagnostics",
  builder: (yargs) =>
    yargs.positional("server", {
      describe: "specific server to debug (optional)",
      type: "string",
    }),
  async handler(args) {
    UI.empty()
    const serverName = args.server as string | undefined

    if (serverName) {
      prompts.intro(`MCP Debug: ${serverName}`)
    } else {
      prompts.intro("MCP Debug Information")
    }

    try {
      const config = await Config.get()
      const mcpServers = config.mcp || {}

      if (serverName) {
        if (!mcpServers[serverName]) {
          prompts.log.error(`Server "${serverName}" not found`)
          prompts.outro("Failed")
          return
        }

        const server = mcpServers[serverName]
        prompts.log.info(
          `${UI.Style.TEXT_HIGHLIGHT_BOLD}Configuration${UI.Style.TEXT_NORMAL}`,
        )
        prompts.log.info(`  Name: ${serverName}`)
        prompts.log.info(`  Type: ${server.type}`)
        prompts.log.info(`  Enabled: ${server.enabled !== false}`)

        if (server.type === "local") {
          prompts.log.info(`  Command: ${server.command.join(" ")}`)
          if (server.environment) {
            prompts.log.info(`  Environment:`)
            for (const [key, value] of Object.entries(server.environment)) {
              prompts.log.info(`    ${key}=${value}`)
            }
          }
        } else {
          prompts.log.info(`  URL: ${server.url}`)
        }

        // Add more debug info here as needed
      } else {
        prompts.log.info(
          `${UI.Style.TEXT_HIGHLIGHT_BOLD}Global Configuration${UI.Style.TEXT_NORMAL}`,
        )
        prompts.log.info(`  Config path: ${path.join(Global.Path.config, "config.json")}`)
        prompts.log.info(`  Total servers: ${Object.keys(mcpServers).length}`)
        prompts.log.info(
          `  Enabled servers: ${Object.values(mcpServers).filter((s) => s.enabled !== false).length}`,
        )
      }

      prompts.outro("Done")
    } catch (error) {
      prompts.log.error(`Failed to get debug info: ${error}`)
      prompts.outro("Failed")
    }
  },
})

export const McpLogsCommand = cmd({
  command: "logs [server]",
  describe: "show MCP server logs",
  builder: (yargs) =>
    yargs.positional("server", {
      describe: "specific server to show logs for (optional)",
      type: "string",
    }),
  async handler(args) {
    UI.empty()
    const serverName = args.server as string | undefined

    if (serverName) {
      prompts.intro(`MCP Logs: ${serverName}`)
    } else {
      prompts.intro("MCP Server Logs")
    }

    // This is a placeholder - actual log implementation would depend on how logs are stored
    prompts.log.info("Log viewing not yet implemented")
    prompts.outro("Done")
  },
})

export const McpHealthCommand = cmd({
  command: "health",
  describe: "check overall MCP system health",
  async handler() {
    UI.empty()
    prompts.intro("MCP System Health Check")

    try {
      await App.provide({ cwd: process.cwd() }, async () => {
        const config = await Config.get()
        const mcpServers = config.mcp || {}
        const clients = await MCP.clients()

        const totalServers = Object.keys(mcpServers).length
        const enabledServers = Object.values(mcpServers).filter(
          (s) => s.enabled !== false,
        ).length
        const connectedServers = Object.keys(clients).length

        prompts.log.info(
          `${UI.Style.TEXT_HIGHLIGHT_BOLD}System Status${UI.Style.TEXT_NORMAL}`,
        )
        prompts.log.info(`  Total servers: ${totalServers}`)
        prompts.log.info(`  Enabled servers: ${enabledServers}`)
        prompts.log.info(`  Connected servers: ${connectedServers}`)

        if (connectedServers === enabledServers) {
          prompts.log.success("\n✅ All enabled servers are connected")
        } else if (connectedServers === 0) {
          prompts.log.error("\n❌ No servers are connected")
        } else {
          prompts.log.warn(
            `\n⚠️  Only ${connectedServers}/${enabledServers} enabled servers are connected`,
          )
        }

        prompts.outro("Health check complete")
      })
    } catch (error) {
      prompts.log.error(`Failed to check health: ${error}`)
      prompts.outro("Failed")
    }
  },
})