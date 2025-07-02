

// McpHealthCommand - Overall MCP system health check
const McpHealthCommand = cmd({
  command: "health",
  describe: "Check overall MCP system health",
  handler: async (argv) => {
    await App.provide(async (app) => {
      prompts.intro(`${UI.Style.TEXT_DIM}MCP System Health Check${UI.Style.TEXT_NORMAL}`)
      
      try {
        const { MCPLifecycle } = await import("../../mcp/lifecycle")
        const { MCPDebug } = await import("../../mcp/debug")
        const clients = await MCP.clients()
        const servers = await McpConfig.listMcpServers()
        
        let totalServers = 0
        let enabledServers = 0
        let connectedServers = 0
        let errorCount = 0
        let warningCount = 0
        
        const serverHealthDetails: Array<{
          name: string
          enabled: boolean
          connected: boolean
          health: "healthy" | "warning" | "error"
          issues: string[]
        }> = []
        
        // Check each server
        for (const [name, config] of Object.entries(servers)) {
          totalServers++
          const issues: string[] = []
          let health: "healthy" | "warning" | "error" = "healthy"
          
          if (config.enabled) {
            enabledServers++
            
            const client = clients[name]
            const lifecycle = await MCPLifecycle.getConnectionState(name)
            
            if (client && lifecycle.connected) {
              connectedServers++
              
              // Check for recent errors
              const errors = await MCPDebug.getRecentErrors(name)
              if (errors.length > 10) {
                health = "error"
                errorCount++
                issues.push(`High error rate: ${errors.length} recent errors`)
              } else if (errors.length > 5) {
                health = "warning"
                warningCount++
                issues.push(`Moderate error rate: ${errors.length} recent errors`)
              }
              
              // Check performance
              const metrics = await MCPDebug.getPerformanceMetrics(name)
              if (metrics && metrics.avgResponseTime > 1000) {
                if (health !== "error") health = "warning"
                warningCount++
                issues.push(`Slow response time: ${metrics.avgResponseTime}ms avg`)
              }
              
              // Check reconnection count
              if (lifecycle.reconnectionCount > 5) {
                if (health !== "error") health = "warning"
                warningCount++
                issues.push(`Unstable connection: ${lifecycle.reconnectionCount} reconnections`)
              }
            } else {
              health = "error"
              errorCount++
              issues.push("Server not connected")
            }
          } else {
            issues.push("Server disabled")
          }
          
          serverHealthDetails.push({
            name,
            enabled: config.enabled,
            connected: !!clients[name],
            health,
            issues
          })
        }
        
        // Display overall health
        const overallHealth = errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "healthy"
        const healthIcon = overallHealth === "healthy" ? "✅" : overallHealth === "warning" ? "⚠️" : "❌"
        
        prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT_BOLD}Overall Health: ${healthIcon} ${overallHealth.toUpperCase()}${UI.Style.TEXT_NORMAL}`)
        
        // Summary statistics
        prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT}Summary:${UI.Style.TEXT_NORMAL}`)
        prompts.log.info(`  Total servers: ${totalServers}`)
        prompts.log.info(`  Enabled: ${enabledServers}`)
        prompts.log.info(`  Connected: ${connectedServers}/${enabledServers}`)
        prompts.log.info(`  Errors: ${errorCount}`)
        prompts.log.info(`  Warnings: ${warningCount}`)
        
        // Detailed server health
        prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT}Server Health:${UI.Style.TEXT_NORMAL}`)
        for (const server of serverHealthDetails) {
          const statusIcon = !server.enabled ? "⚫" : 
                           server.health === "healthy" ? "✅" :
                           server.health === "warning" ? "⚠️" : "❌"
          
          prompts.log.info(`\n${statusIcon} ${UI.Style.TEXT_HIGHLIGHT}${server.name}${UI.Style.TEXT_NORMAL}`)
          
          if (server.issues.length > 0) {
            for (const issue of server.issues) {
              const issueColor = issue.includes("error") ? UI.Style.TEXT_ERROR :
                               issue.includes("warning") || issue.includes("Slow") || issue.includes("Unstable") ? UI.Style.TEXT_WARN :
                               UI.Style.TEXT_DIM
              prompts.log.info(`  ${issueColor}• ${issue}${UI.Style.TEXT_NORMAL}`)
            }
          } else {
            prompts.log.info(`  ${UI.Style.TEXT_DIM}• No issues${UI.Style.TEXT_NORMAL}`)
          }
        }
        
        // Recommendations
        if (errorCount > 0 || warningCount > 0) {
          prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT}Recommendations:${UI.Style.TEXT_NORMAL}`)
          
          if (errorCount > 0) {
            prompts.log.warn("• Fix disconnected servers with 'dgmo mcp test' to diagnose issues")
            prompts.log.warn("• Check server logs with 'dgmo mcp logs [server] --level error'")
          }
          
          if (warningCount > 0) {
            prompts.log.info("• Review servers with high error rates using 'dgmo mcp debug [server]'")
            prompts.log.info("• Consider restarting servers with connection instability")
          }
        }
        
        prompts.outro("Health check complete")
        
      } catch (error) {
        prompts.log.error("Failed to check system health")
        if (error instanceof Error) {
          prompts.log.error(error.message)
        }
        prompts.outro("Check your MCP configuration")
      }
    })
  },
})
