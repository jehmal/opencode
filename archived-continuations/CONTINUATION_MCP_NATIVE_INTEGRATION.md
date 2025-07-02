# Instructions for Next DGMO MCP Integration Agent

You are continuing the implementation of DGMO Native MCP Integration. The project is 95% complete with DGMO fully functional and MCP support partially implemented. Your task is to enhance the existing MCP foundation with native management commands and advanced features.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/`
- Key Repository: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/`
- Architecture Doc: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/web/src/content/docs/docs/mcp-servers.mdx`
- Related Systems: AI SDK MCP client, existing DGMO CLI framework, configuration system

## Memory Search Commands

First, retrieve the current project state and patterns:
1. Search: "DGMO PROJECT SNAPSHOT - MCP Integration Analysis Complete"
2. Search: "DGMO branding completion success"
3. Search: "CLI command patterns and structure"
4. Search: "Configuration management architecture"
5. Search: "TypeScript AI SDK integration patterns"

## Completed Components (DO NOT RECREATE)

✅ DGMO Core System - Full functionality with branding complete
✅ Basic MCP Infrastructure - Client, config schemas, session integration
✅ MCP Documentation - User-facing docs with examples
✅ Session Integration - MCP tools automatically available to LLM
✅ Error Handling - Proper MCP error capture and logging
✅ Configuration Schema - Zod validation for local/remote servers
✅ Performance Tracking - Basic MCP tool execution metrics
✅ Go TUI Branding - Complete DGMO branding across all components

## Critical Files to Reference

1. MCP Core Infrastructure:
   - `/opencode/packages/opencode/src/mcp/index.ts` - Existing MCP client implementation
   - `/opencode/packages/opencode/src/config/config.ts` - MCP configuration schemas (lines 29-65)
   - `/opencode/packages/opencode/src/session/index.ts` - MCP tool integration (lines 477-511)

2. CLI Command Framework:
   - `/opencode/packages/opencode/src/cli/cmd/auth.ts` - Reference for command structure
   - `/opencode/packages/opencode/src/cli/cmd/models.ts` - Reference for list commands
   - `/opencode/packages/opencode/src/cli/cmd/evolve.ts` - Reference for analysis commands
   - `/opencode/packages/opencode/src/index.ts` - Main CLI entry point for command registration

3. Configuration Management:
   - `/opencode/packages/opencode/src/config/config.ts` - Configuration loading and validation
   - `/opencode/packages/opencode/config.schema.json` - JSON schema for validation

## Required Tasks (USE 4 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: MCP Management Commands
Implement comprehensive MCP CLI commands for server management
- Create `/opencode/packages/opencode/src/cli/cmd/mcp.ts` with subcommands:
  - `dgmo mcp list` - Show all configured MCP servers with status
  - `dgmo mcp status [server]` - Check health and connection status of servers
  - `dgmo mcp test [server]` - Validate server connection and tool availability
  - `dgmo mcp tools [server]` - List available tools from specific server
- Add proper error handling and user-friendly output formatting
- Integrate with existing MCP.clients() and MCP.tools() functions
- Include loading states and proper status indicators
Location: `/opencode/packages/opencode/src/cli/cmd/mcp.ts`
Dependencies: Existing MCP namespace, CLI framework patterns

### Sub-Agent 2: Enhanced Configuration Management
Extend MCP configuration system with dynamic management
- Add configuration validation functions to `/opencode/packages/opencode/src/mcp/config.ts`
- Implement `dgmo mcp add` and `dgmo mcp remove` commands for dynamic server management
- Create MCP server templates for popular servers (Qdrant, GitHub, file system)
- Add interactive setup wizard for common MCP server configurations
- Implement configuration file hot-reload when MCP settings change
- Add server connectivity testing during configuration
Location: `/opencode/packages/opencode/src/mcp/config.ts` and extend CLI commands
Dependencies: Config schema, file system operations, user interaction prompts

### Sub-Agent 3: MCP Resource Support and Advanced Features
Extend beyond tools to support MCP resources and advanced capabilities
- Implement MCP resource access in `/opencode/packages/opencode/src/mcp/resources.ts`
- Add `dgmo mcp resources [server]` command to list and access MCP resources
- Implement MCP server lifecycle management with reconnection logic
- Add MCP server health monitoring with automatic reconnection
- Create MCP debugging tools: `dgmo mcp debug [server]` with connection diagnostics
- Implement MCP server log aggregation and viewing
Location: `/opencode/packages/opencode/src/mcp/resources.ts` and extend existing MCP module
Dependencies: AI SDK MCP resource APIs, logging system, health check patterns

### Sub-Agent 4: Performance Integration and Developer Experience
Integrate MCP with DGMO's performance system and improve developer experience
- Extend SessionPerformance system to include MCP server metrics
- Create MCP performance dashboard: `dgmo mcp metrics` command
- Add MCP tool execution optimization suggestions
- Implement MCP server recommendation system based on usage patterns
- Create comprehensive MCP troubleshooting: `dgmo mcp doctor` command
- Add MCP tool inspection with detailed parameter and response analysis
- Integrate MCP metrics with DGMO evolution system for self-improvement
Location: Extend existing performance system and create MCP analytics
Dependencies: SessionPerformance module, metrics collection, evolution integration

## Integration Requirements

1. **CLI Command Registration**: All new MCP commands must be registered in `/opencode/packages/opencode/src/index.ts`
2. **Configuration Compatibility**: Maintain backward compatibility with existing MCP configuration format
3. **Error Handling**: Use existing NamedError patterns and logging infrastructure
4. **User Interface**: Follow DGMO branding and CLI output formatting standards
5. **Performance Tracking**: Integrate with existing SessionPerformance system

## Technical Constraints

- **Backward Compatibility**: Do not break existing MCP server configurations
- **AI SDK Integration**: Use existing `ai` package MCP clients, do not replace core functionality
- **TypeScript Compliance**: Maintain strict TypeScript typing throughout
- **CLI Framework**: Follow existing yargs command patterns and error handling
- **Configuration Schema**: Extend existing Zod schemas, do not replace them
- **DGMO Branding**: All output and documentation must use DGMO branding consistently

## Success Criteria

1. `dgmo mcp list` shows all configured servers with connection status
2. `dgmo mcp add` allows interactive setup of new MCP servers
3. `dgmo mcp test [server]` validates server connectivity and reports issues
4. `dgmo mcp tools` displays available tools from all or specific servers
5. `dgmo mcp resources` provides access to MCP resources beyond tools
6. `dgmo mcp metrics` shows performance analytics for MCP server usage
7. `dgmo mcp doctor` provides comprehensive troubleshooting information
8. All MCP servers maintain existing functionality while gaining new management features
9. MCP integration includes proper performance tracking in evolution system
10. Documentation is updated to reflect new native MCP management capabilities

## Testing Approach

After implementation:
1. Test `dgmo mcp list` with existing configuration from documentation examples
2. Verify `dgmo mcp add` can configure Qdrant MCP server interactively
3. Test `dgmo mcp test` reports proper connectivity status for valid/invalid servers
4. Validate `dgmo mcp tools` displays tools from multiple configured servers
5. Ensure existing MCP functionality continues working without regression
6. Test MCP server hot-reload when configuration changes
7. Verify MCP metrics integration with existing performance system
8. Test error handling for disconnected or failing MCP servers

## Known Issues & Solutions

- Issue: MCP servers may have startup delays affecting immediate tool availability
  Solution: Implement retry logic with exponential backoff and user feedback
- Issue: MCP server configurations may contain sensitive credentials
  Solution: Add credential masking in status displays and secure storage patterns
- Issue: Multiple MCP servers with same tool names may cause conflicts
  Solution: Use server prefixing (server_toolname) as already implemented in existing code

## Important Notes

- **Existing MCP Infrastructure**: Build upon the solid foundation already present, don't replace it
- **AI SDK Compatibility**: Leverage existing `experimental_createMCPClient` and transport systems
- **Configuration Management**: MCP configs are already in `/opencode/packages/opencode/src/config/config.ts` lines 175-178
- **Tool Integration**: MCP tools are already automatically available in sessions via lines 477-511 in session/index.ts
- **Performance System**: Extend existing SessionPerformance tracking to include MCP server metrics
- Remember: DGMO philosophy is self-improvement through comprehensive tooling and analytics

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to implement native MCP management capabilities. The foundation is solid - now we need native command-line management and advanced features to make MCP a first-class citizen in DGMO.