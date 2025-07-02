

// McpLogsCommand - Show logs from MCP servers
const McpLogsCommand = cmd({
  command: "logs [server]",
  describe: "Display logs from MCP servers",
  builder: (yargs) => {
    return yargs
      .positional("server", {
        describe: "MCP server name (optional, shows all if not specified)",
        type: "string"
      })
      .option("level", {
        describe: "Filter by log level",
        type: "string",
        choices: ["error", "warn", "info", "debug"],
        default: "info"
      })
      .option("lines", {
        describe: "Number of log lines to show",
        type: "number",
        default: 50
      })
  },
  handler: async (argv) => {
    await App.provide(async (app) => {
      prompts.intro(`${UI.Style.TEXT_DIM}MCP Server Logs${UI.Style.TEXT_NORMAL}`)
      
      try {
        const { MCPDebug } = await import("../../mcp/debug")
        const servers = await McpConfig.listMcpServers()
        const logLevel = argv.level as string
        const maxLines = argv.lines as number
        
        if (argv.server) {
          // Single server logs
          const config = await McpConfig.getMcpServer(argv.server)
          if (!config) {
            prompts.log.error(`Server '${argv.server}' not found`)
            prompts.outro("Use 'dgmo mcp list' to see available servers")
            return
          }
          
          prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT_BOLD}Logs from ${argv.server}:${UI.Style.TEXT_NORMAL}`)
          prompts.log.info(`Filter: ${logLevel} | Max lines: ${maxLines}`)
          prompts.log.info(`${UI.Style.TEXT_DIM}${"─".repeat(60)}${UI.Style.TEXT_NORMAL}`)
          
          const logs = await MCPDebug.getServerLogs(argv.server, {
            level: logLevel,
            limit: maxLines
          })
          
          if (logs.length === 0) {
            prompts.log.info(`${UI.Style.TEXT_DIM}No logs found${UI.Style.TEXT_NORMAL}`)
          } else {
            for (const log of logs) {
              const levelColor = log.level === "error" ? UI.Style.TEXT_ERROR :
                               log.level === "warn" ? UI.Style.TEXT_WARN :
                               log.level === "debug" ? UI.Style.TEXT_DIM :
                               UI.Style.TEXT_NORMAL
              
              prompts.log.info(`${UI.Style.TEXT_DIM}${log.timestamp}${UI.Style.TEXT_NORMAL} ${levelColor}[${log.level.toUpperCase()}]${UI.Style.TEXT_NORMAL} ${log.message}`)
              
              if (log.data) {
                prompts.log.info(`  ${UI.Style.TEXT_DIM}Data: ${JSON.stringify(log.data)}${UI.Style.TEXT_NORMAL}`)
              }
            }
          }
          
        } else {
          // All servers logs (interleaved)
          prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT_BOLD}MCP System Logs:${UI.Style.TEXT_NORMAL}`)
          prompts.log.info(`Filter: ${logLevel} | Max lines per server: ${maxLines}`)
          prompts.log.info(`${UI.Style.TEXT_DIM}${"─".repeat(60)}${UI.Style.TEXT_NORMAL}`)
          
          let allLogs: Array<{
            server: string
            timestamp: string
            level: string
            message: string
            data?: any
          }> = []
          
          // Collect logs from all servers
          for (const server of Object.keys(servers)) {
            const logs = await MCPDebug.getServerLogs(server, {
              level: logLevel,
              limit: maxLines
            })
            
            allLogs.push(...logs.map(log => ({ ...log, server })))
          }
          
          // Sort by timestamp
          allLogs.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          
          // Take the most recent entries
          const recentLogs = allLogs.slice(-maxLines)
          
          if (recentLogs.length === 0) {
            prompts.log.info(`${UI.Style.TEXT_DIM}No logs found${UI.Style.TEXT_NORMAL}`)
          } else {
            for (const log of recentLogs) {
              const levelColor = log.level === "error" ? UI.Style.TEXT_ERROR :
                               log.level === "warn" ? UI.Style.TEXT_WARN :
                               log.level === "debug" ? UI.Style.TEXT_DIM :
                               UI.Style.TEXT_NORMAL
              
              prompts.log.info(`${UI.Style.TEXT_DIM}${log.timestamp}${UI.Style.TEXT_NORMAL} [${UI.Style.TEXT_HIGHLIGHT}${log.server}${UI.Style.TEXT_NORMAL}] ${levelColor}[${log.level.toUpperCase()}]${UI.Style.TEXT_NORMAL} ${log.message}`)
              
              if (log.data) {
                prompts.log.info(`  ${UI.Style.TEXT_DIM}Data: ${JSON.stringify(log.data)}${UI.Style.TEXT_NORMAL}`)
              }
            }
          }
        }
        
        prompts.outro("Log display complete")
        
      } catch (error) {
        prompts.log.error("Failed to retrieve logs")
        if (error instanceof Error) {
          prompts.log.error(error.message)
        }
        prompts.outro("Check your MCP configuration")
      }
    })
  },
})
