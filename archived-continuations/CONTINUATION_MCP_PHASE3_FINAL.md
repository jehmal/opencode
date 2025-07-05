# Instructions for Next DGMO MCP Integration Agent - Phase 3 Final

You are continuing the implementation of DGMO Native MCP Integration. Phase 3 is 75% complete with all TypeScript errors fixed and core modules created. Your task is to complete the CLI command integration and finalize the project.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/`
- Key Repository: DGMO fork at `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/`
- MCP Module: `/opencode/packages/opencode/src/mcp/`
- CLI Commands: `/opencode/packages/opencode/src/cli/cmd/`
- Progress Snapshot: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/DGMO_MCP_PHASE3_PROGRESS.md`

## Memory Search Commands

First, retrieve the current project state and patterns:
1. Search: "DGMO MCP PHASE3 PROGRESS TypeScript fixes CLI integration"
2. Search: "MCP resources debug lifecycle module implementation patterns"
3. Search: "DGMO CLI command registration McpCommand builder pattern"
4. Search: "UI.Style TEXT_HIGHLIGHT_BOLD TEXT_DIM formatting patterns"
5. Search: "MCP.clients Promise handling filter tools by server prefix"

## Completed Components (DO NOT RECREATE)

### ✅ Phase 1 & 2: All Basic Commands
- `dgmo mcp list/ls` - Lists all MCP servers with status
- `dgmo mcp status` - Detailed health check for servers
- `dgmo mcp test` - Connection and tool validation
- `dgmo mcp tools` - Tool listing and inspection
- `dgmo mcp add` - Interactive server addition
- `dgmo mcp remove` - Safe server removal
- `dgmo mcp edit` - Edit existing configurations
- `dgmo mcp wizard` - Interactive setup wizard

### ✅ Phase 3: Core Modules Created
- `/opencode/packages/opencode/src/mcp/resources.ts` - MCPResources namespace
- `/opencode/packages/opencode/src/mcp/lifecycle.ts` - MCPLifecycle namespace
- `/opencode/packages/opencode/src/mcp/debug.ts` - MCPDebug namespace

### ✅ TypeScript Fixes Applied
- All duplicate exports removed
- Correct namespace usage (McpConfig, not new McpConfig())
- Proper Promise handling for MCP.clients()
- UI.Style constants fixed (TEXT_HIGHLIGHT_BOLD, TEXT_DIM, etc.)

## Critical Implementation Details

### MCP API Patterns:
```typescript
// Clients are a Promise
const clients = await MCP.clients()

// Tools are Record<string, Tool> with server prefix
const allTools = await MCP.tools()
const serverTools = Object.entries(allTools)
  .filter(([name]) => name.startsWith(serverId + "_"))

// McpConfig is a namespace
await McpConfig.listMcpServers()
await McpConfig.getMcpServer(name)
```

### UI Patterns:
```typescript
// No prompts variable needed - use imported prompts directly
import * as prompts from "@clack/prompts"

// Styling
`${UI.Style.TEXT_HIGHLIGHT_BOLD}${text}${UI.Style.TEXT_NORMAL}`
```

## Required Tasks (USE 2 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Complete CLI Command Integration
**Add the remaining MCP commands to mcp.ts**

1. **Add McpResourcesCommand** (partially started at line 1005):
   - Import MCPResources from resources module
   - List resources with filtering by server
   - Group by server for display
   - Show URI, description, mime type

2. **Add McpDebugCommand**:
   - Import MCPDebug from debug module
   - Show connection diagnostics
   - Display recent errors
   - Performance metrics

3. **Add McpLogsCommand**:
   - Show server logs using MCPDebug
   - Filter by server or show all
   - Support log level filtering

4. **Add McpHealthCommand**:
   - Overall system health check
   - Use MCPLifecycle for connection states
   - Summary of all server statuses

5. **Register all commands** in McpCommand builder:
   ```typescript
   .command(McpResourcesCommand)
   .command(McpDebugCommand)
   .command(McpLogsCommand)
   .command(McpHealthCommand)
   ```

Location: `/opencode/packages/opencode/src/cli/cmd/mcp.ts`
Dependencies: Import from resources.ts, lifecycle.ts, debug.ts

### Sub-Agent 2: Documentation and Testing
**Create comprehensive documentation**

1. **Update main README**:
   - Add MCP features section
   - List all available commands
   - Show example usage

2. **Create MCP_COMMANDS.md**:
   - Detailed documentation for each command
   - Examples with expected output
   - Common use cases

3. **Create integration tests**:
   - Test each command with mock data
   - Verify error handling
   - Check TypeScript compilation

4. **Update CLAUDE.md** if needed:
   - Add MCP-specific instructions
   - Document lint/typecheck requirements

Location: Various documentation files
Dependencies: Completed CLI implementation

## Integration Requirements

1. **Import Patterns**: Use dynamic imports for heavy modules:
   ```typescript
   const { MCPResources } = await import("../../mcp/resources")
   ```

2. **Error Handling**: Use try/catch with specific error messages

3. **UI Consistency**: Follow existing patterns from other commands

4. **Command Structure**: Each command needs:
   - `command` string with optional positional args
   - `describe` string
   - `builder` for yargs if has arguments
   - `async handler` using App.provide pattern

## Technical Constraints

- **File Editing**: Work on mcp.ts in parts to avoid corruption
- **No Breaking Changes**: Existing commands must continue working
- **TypeScript Strict**: Must pass `bun run typecheck`
- **UI Patterns**: Use prompts.log.* methods, not console.log

## Success Criteria

1. ✅ All 4 new commands added and working
2. ✅ Commands registered in McpCommand
3. ✅ `bun run typecheck` passes
4. ✅ `dgmo mcp resources` lists MCP resources
5. ✅ `dgmo mcp debug` shows diagnostics
6. ✅ `dgmo mcp logs` displays server logs
7. ✅ `dgmo mcp health` shows system status
8. ✅ Documentation is comprehensive
9. ✅ Integration tests pass

## Testing Approach

After implementation:
1. Run `bun run typecheck` - must pass
2. Test each new command individually
3. Test with mock MCP servers
4. Verify error handling with disconnected servers
5. Check UI output formatting

## Known Issues & Solutions

- Issue: Adding to mcp.ts can corrupt file if done all at once
  Solution: Add each command one at a time, save between edits

- Issue: MCPResources/Debug/Lifecycle not exported from index
  Solution: Use dynamic imports as shown above

- Issue: prompts variable confusion
  Solution: Use imported prompts directly, no const prompts = UI.empty()

## Important Notes

- **Priority**: Complete CLI integration first, then documentation
- **File Safety**: Edit mcp.ts carefully in small chunks
- **Import Style**: Use dynamic imports for new modules
- **Testing**: Manual testing is fine for now
- **Style**: Follow existing command patterns exactly
- Remember: The core modules are already created and working

Start by completing the McpResourcesCommand that was partially added, then proceed with the other commands. The foundation is solid - you just need to wire up the CLI interface to the existing modules.