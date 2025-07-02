
// McpResourcesCommand - List available resources from MCP servers
const McpResourcesCommand: CommandDefinition = {
  command: "resources [server]",
  describe: "List available resources from MCP servers",
  builder: (yargs) => {
    return yargs.positional("server", {
      describe: "MCP server name (optional, lists all if not specified)",
      type: "string"
    })
  },
  handler: async (argv) => {
    await App.provide(async (app) => {
      prompts.intro(`${UI.Style.TEXT_DIM}Listing MCP resources...${UI.Style.TEXT_NORMAL}`)
      
      try {
        const { MCPResources } = await import("../../mcp/resources")
        const clients = await MCP.clients()
        const servers = await McpConfig.listMcpServers()
        
        if (argv.server) {
          // Single server resources
          const config = await McpConfig.getMcpServer(argv.server)
          if (!config) {
            prompts.log.error(`Server '${argv.server}' not found`)
            prompts.outro("Use 'dgmo mcp list' to see available servers")
            return
          }
          
          const client = clients[argv.server]
          if (!client) {
            prompts.log.warn(`Server '${argv.server}' is not connected`)
            prompts.outro("Check server status with 'dgmo mcp status'")
            return
          }
          
          const resources = await MCPResources.listResources(argv.server)
          if (resources.length === 0) {
            prompts.log.info(`No resources available from '${argv.server}'`)
          } else {
            prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT_BOLD}Resources from ${argv.server}:${UI.Style.TEXT_NORMAL}`)
            for (const resource of resources) {
              prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT}${resource.uri}${UI.Style.TEXT_NORMAL}`)
              if (resource.description) {
                prompts.log.info(`  ${resource.description}`)
              }
              if (resource.mimeType) {
                prompts.log.info(`  Type: ${resource.mimeType}`)
              }
            }
          }
        } else {
          // All servers resources
          let totalResources = 0
          for (const server of Object.keys(servers)) {
            const client = clients[server]
            if (!client) continue
            
            const resources = await MCPResources.listResources(server)
            if (resources.length > 0) {
              prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT_BOLD}${server}${UI.Style.TEXT_NORMAL} (${resources.length} resources)`)
              for (const resource of resources.slice(0, 3)) {
                prompts.log.info(`  ${resource.uri}`)
                if (resource.description) {
                  prompts.log.info(`    ${UI.Style.TEXT_DIM}${resource.description}${UI.Style.TEXT_NORMAL}`)
                }
              }
              if (resources.length > 3) {
                prompts.log.info(`  ... and ${resources.length - 3} more`)
              }
              totalResources += resources.length
            }
          }
          
          if (totalResources === 0) {
            prompts.log.info("No resources available from any connected servers")
          } else {
            prompts.log.info(`\n${UI.Style.TEXT_HIGHLIGHT}Total: ${totalResources} resources${UI.Style.TEXT_NORMAL}`)
          }
        }
        
        prompts.outro("Resource listing complete")
        
      } catch (error) {
        prompts.log.error("Failed to list resources")
        if (error instanceof Error) {
          prompts.log.error(error.message)
        }
        prompts.outro("Check your MCP server connections")
      }
    })
  },
}
