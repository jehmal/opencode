# Instructions for Next DGMO MCP Integration Agent - Phase 3

You are continuing the implementation of DGMO Native MCP Integration. Phase 2 (Enhanced Configuration Management) is 95% complete with minor TypeScript errors to fix. Your task is to fix Phase 2 issues and implement Phase 3: MCP Resource Support and Advanced Features.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/`
- Key Repository: DGMO fork at `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/`
- MCP Module: `/opencode/packages/opencode/src/mcp/`
- CLI Commands: `/opencode/packages/opencode/src/cli/cmd/`
- Phase 2 Summary: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/CONTINUATION_MCP_PHASE2_SUMMARY.md`

## Memory Search Commands

First, retrieve the current project state and patterns:
1. Search: "DGMO MCP PHASE2 Configuration Management TypeScript errors duplicate exports"
2. Search: "MCP Resource Support implementation patterns AI SDK"
3. Search: "DGMO performance tracking SessionPerformance metrics integration"
4. Search: "MCP server lifecycle management reconnection health monitoring"
5. Search: "TypeScript strict mode error handling patterns DGMO"

## Completed Components (DO NOT RECREATE)

### ✅ Phase 1: MCP Management Commands Foundation
- `dgmo mcp list/ls` - Lists all MCP servers with status
- `dgmo mcp status` - Detailed health check for servers
- `dgmo mcp test` - Connection and tool validation
- `dgmo mcp tools` - Tool listing and inspection
- Professional CLI interface with color coding

### ✅ Phase 2: Enhanced Configuration Management (95% - needs fixes)
- `dgmo mcp add` - Interactive server addition with templates
- `dgmo mcp remove` - Safe server removal with confirmation
- `dgmo mcp edit` - Edit existing configurations (has duplicate exports)
- `dgmo mcp wizard` - Interactive setup wizard for new users
- Hot-reload functionality in MCP module
- MCPConfigManager with full CRUD operations

## Critical Files to Fix (PRIORITY)

1. **mcp.ts Duplicate Exports**:
   - `/opencode/packages/opencode/src/cli/cmd/mcp.ts` - Has 6 duplicate McpEditCommand exports
   - Keep ONLY the last complete implementation
   - Fix import issues (MCPResources, MCPLifecycle, MCPDebug)

2. **TypeScript Errors**:
   - `/opencode/packages/opencode/src/cli/cmd/mcp-wizard.ts` - Fix type errors
   - `/opencode/packages/opencode/tests/mcp-hot-reload.test.ts` - Fix test types
   - Remove unused imports across all files

## Required Tasks - Phase 3 (USE 3 SUB-AGENTS)

### Sub-Agent 1: Fix Phase 2 TypeScript Issues
**URGENT - Do this first before Phase 3**
- Remove all duplicate McpEditCommand exports from mcp.ts (keep only one)
- Fix TypeScript errors in mcp-wizard.ts:
  - Line 229: Add proper type for env object
  - Line 241: Fix async validation function type
  - Remove unused imports (lines 4, 9, 10)
- Fix test file type issues in mcp-hot-reload.test.ts
- Ensure `bun run typecheck` passes without errors
Location: Multiple files listed above
Dependencies: None - this unblocks everything else

### Sub-Agent 2: MCP Resource Support Implementation
Implement comprehensive MCP resource access beyond just tools
- Create `/opencode/packages/opencode/src/mcp/resources.ts`:
  - Implement resource listing from MCP servers
  - Add resource content retrieval
  - Support resource URIs and metadata
  - Handle resource type variations (text, binary, structured)
- Add `dgmo mcp resources [server]` command:
  - List all available resources
  - Filter by resource type or pattern
  - Display resource metadata
  - Support resource content preview
- Integrate with existing MCP client infrastructure
Location: `/opencode/packages/opencode/src/mcp/resources.ts` and extend CLI
Dependencies: AI SDK MCP resource APIs, existing MCP client

### Sub-Agent 3: MCP Advanced Features & Monitoring
Implement server lifecycle, health monitoring, and debugging tools
- Create `/opencode/packages/opencode/src/mcp/lifecycle.ts`:
  - Automatic reconnection with exponential backoff
  - Connection health monitoring
  - Server state management (connected, reconnecting, failed)
  - Event-based status updates
- Create `/opencode/packages/opencode/src/mcp/debug.ts`:
  - Connection diagnostics
  - Request/response logging
  - Performance profiling
  - Error analysis and suggestions
- Add CLI commands:
  - `dgmo mcp debug [server]` - Connection diagnostics
  - `dgmo mcp logs [server]` - View server logs
  - `dgmo mcp health` - Overall MCP system health
Location: New lifecycle.ts and debug.ts modules
Dependencies: Existing MCP infrastructure, logging system

## Integration Requirements

1. **Fix First**: Resolve ALL TypeScript errors before proceeding with new features
2. **Backward Compatibility**: Maintain existing MCP configuration format
3. **Error Handling**: Use existing NamedError patterns consistently
4. **Performance**: Integrate with SessionPerformance for metrics
5. **CLI Standards**: Follow DGMO branding and output formatting

## Technical Constraints

- **TypeScript Strict Mode**: All code must pass `bun run typecheck`
- **No Breaking Changes**: Existing MCP functionality must continue working
- **AI SDK Patterns**: Use experimental_createMCPClient patterns
- **Module Structure**: Follow existing file organization patterns
- **Test Coverage**: Add tests for new functionality

## Success Criteria

1. ✅ All TypeScript errors from Phase 2 are resolved
2. ✅ `bun run typecheck` passes without errors
3. ✅ No duplicate command exports in mcp.ts
4. ✅ `dgmo mcp resources` lists and accesses MCP resources
5. ✅ Resource content can be retrieved and displayed
6. ✅ MCP servers automatically reconnect on failure
7. ✅ `dgmo mcp debug` provides useful diagnostics
8. ✅ `dgmo mcp health` shows system-wide MCP status
9. ✅ All existing Phase 1 & 2 commands continue working

## Testing Approach

After fixing TypeScript errors:
1. Run `bun run typecheck` - must pass completely
2. Test all Phase 2 commands still work correctly
3. Test `dgmo mcp resources` with various server types
4. Simulate server disconnections to test reconnection
5. Use `dgmo mcp debug` to diagnose connection issues
6. Verify performance metrics are collected properly

## Known Issues & Solutions

- Issue: mcp.ts has 6 duplicate McpEditCommand exports
  Solution: Keep only the last complete implementation (around line 1784)
- Issue: mcp-wizard.ts has type errors with env object and validation
  Solution: Add proper types and fix async validation return type
- Issue: Test files use incorrect type assertions
  Solution: Use proper TypeScript index signatures for dynamic objects

## Important Notes

- **Priority**: Fix TypeScript errors FIRST - nothing works until compilation succeeds
- **Duplicate Exports**: The mcp.ts file was corrupted by a replace_all operation
- **Resource API**: MCP resources are different from tools - they're content providers
- **Lifecycle Management**: Critical for production reliability
- **Debug Tools**: Essential for troubleshooting MCP server issues
- Remember: Clean code that compiles is better than features that don't run

Start by fixing the TypeScript errors to unblock development, then implement Phase 3 features. The foundation from Phase 1 & 2 is solid once the compilation issues are resolved.