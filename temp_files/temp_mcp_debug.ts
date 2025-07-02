

// McpDebugCommand - Show debug information for MCP servers
const McpDebugCommand = cmd({
  command: "debug [server]",
  describe: "Show debug information and diagnostics for MCP servers",
  builder: (yargs) => {
    return yargs.positional("server", {
      describe: "MCP server name (optional, shows all if not specified)",
      type: "string"
    })
  },
  handler: async (argv) => {
    await App.provide(async (app) => {
      prompts.intro(`${UI.Style.TEXT_DIM}MCP Debug Information${UI.Style.TEXT_NORMAL}`)
      
      try {
        const { MCPDebug } = await import("../../mcp/debug")
        const clients = await MCP.clients()
        const servers = await McpConfig.listMcpServers()
        
        if (argv.server) {
          // Single server debug
          const config = await McpConfig.getMcpServer(argv.server)
          if (!config) {
            prompts.log.error(`Server '${argv.server}' not found`)
            prompts.outro("Use 'dgmo mcp list' to see available servers")
            return
          }
          
          prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT_BOLD}Debug info for ${argv.server}:${UI.Style.TEXT_NORMAL}`)
          
          // Server configuration
          prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT}Configuration:${UI.Style.TEXT_NORMAL}`)
          prompts.log.info(`  Type: ${config.type}`)
          prompts.log.info(`  Enabled: ${config.enabled}`)
          
          if (config.type === "local") {
            prompts.log.info(`  Command: ${config.command.join(" ")}`)
            if (config.environment) {
              prompts.log.info(`  Environment: ${Object.keys(config.environment).join(", ")}`)
            }
          } else {
            prompts.log.info(`  URL: ${config.url}`)
          }
          
          // Connection diagnostics
          const diagnostics = await MCPDebug.getDiagnostics(argv.server)
          prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT}Connection:${UI.Style.TEXT_NORMAL}`)
          prompts.log.info(`  Status: ${diagnostics.connected ? "Connected" : "Disconnected"}`)
          prompts.log.info(`  Last attempt: ${diagnostics.lastConnectionAttempt || "N/A"}`)
          prompts.log.info(`  Connection time: ${diagnostics.connectionTime || "N/A"}`)
          
          // Recent errors
          const errors = await MCPDebug.getRecentErrors(argv.server)
          if (errors.length > 0) {
            prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT}Recent errors:${UI.Style.TEXT_NORMAL}`)
            for (const error of errors.slice(0, 5)) {
              prompts.log.warn(`  ${error.timestamp}: ${error.message}`)
            }
          }
          
          // Performance metrics
          const metrics = await MCPDebug.getPerformanceMetrics(argv.server)
          if (metrics) {
            prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT}Performance:${UI.Style.TEXT_NORMAL}`)
            prompts.log.info(`  Average response time: ${metrics.avgResponseTime}ms`)
            prompts.log.info(`  Tool calls: ${metrics.toolCallCount}`)
            prompts.log.info(`  Resource accesses: ${metrics.resourceAccessCount}`)
          }
          
        } else {
          // All servers debug overview
          prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT_BOLD}MCP System Overview:${UI.Style.TEXT_NORMAL}`)
          
          let connectedCount = 0
          let totalErrors = 0
          
          for (const [name, config] of Object.entries(servers)) {
            const client = clients[name]
            const diagnostics = await MCPDebug.getDiagnostics(name)
            
            if (diagnostics.connected) connectedCount++
            
            const errors = await MCPDebug.getRecentErrors(name)
            totalErrors += errors.length
            
            const status = !config.enabled ? "⚫" : diagnostics.connected ? "✅" : "❌"
            prompts.log.info(`\n${status} ${UI.Style.TEXT_HIGHLIGHT}${name}${UI.Style.TEXT_NORMAL}`)
            
            if (errors.length > 0) {
              prompts.log.warn(`  Recent errors: ${errors.length}`)
              prompts.log.warn(`  Last error: ${errors[0].message}`)
            }
            
            if (diagnostics.connected) {
              const metrics = await MCPDebug.getPerformanceMetrics(name)
              if (metrics && metrics.avgResponseTime) {
                prompts.log.info(`  Avg response: ${metrics.avgResponseTime}ms`)
              }
            }
          }
          
          prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT}Summary:${UI.Style.TEXT_NORMAL}`)
          prompts.log.info(`  Servers: ${Object.keys(servers).length}`)
          prompts.log.info(`  Connected: ${connectedCount}`)
          prompts.log.info(`  Total errors: ${totalErrors}`)
        }
        
        prompts.outro("Debug information complete")
        
      } catch (error) {
        prompts.log.error("Failed to get debug information")
        if (error instanceof Error) {
          prompts.log.error(error.message)
        }
        prompts.outro("Check your MCP configuration")
      }
    })
  },
})
