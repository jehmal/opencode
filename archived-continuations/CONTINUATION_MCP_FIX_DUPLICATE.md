# Instructions for Next DGMO MCP Integration Agent - Fix Duplicate Command Error

You are continuing the DGMO MCP Native Integration project. Phase 3 is 100% complete but has a critical error: duplicate McpDebugCommand declarations causing TypeScript compilation failure. Your task is to fix this error while preserving all functionality.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/`
- Key File with Error: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/cli/cmd/mcp.ts`
- Error: "McpDebugCommand" has already been declared at line 1503 (originally at line 289)
- File Size: ~1500+ lines (work in parts to avoid corruption)

## Memory Search Commands

First, retrieve the current project state and patterns:
1. Search: "DGMO MCP NATIVE INTEGRATION Phase 3 Complete 100%"
2. Search: "McpDebugCommand Show debug information diagnostics MCP servers"
3. Search: "Working on large files in parts prevents corruption"
4. Search: "mcp.ts file 1005 lines append commands one at a time"
5. Search: "TypeScript duplicate declaration error resolution patterns"

## Critical Error Details

```
error: "McpDebugCommand" has already been declared
    at /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/cli/cmd/mcp.ts:1503:7
note: "McpDebugCommand" was originally declared here
    at /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/cli/cmd/mcp.ts:289:7
```

## File Structure Breakdown

The mcp.ts file currently contains:
1. Lines 1-70: Imports and helper functions
2. Lines 55-75: McpCommand export with command registration
3. Lines 76-288: Original commands (list, status, test, tools, add, remove, edit)
4. **Line 289: First McpDebugCommand declaration (WRONG LOCATION)**
5. Lines 290-1094: McpResourcesCommand (at end of file)
6. Lines 1095-1502: Other commands
7. **Line 1503: Second McpDebugCommand declaration (DUPLICATE)**

## Completed Components (DO NOT RECREATE)

✅ All 12 MCP commands are implemented:
- McpListCommand (list/ls)
- McpStatusCommand (status)
- McpTestCommand (test)
- McpToolsCommand (tools)
- McpAddCommand (add)
- McpRemoveCommand (remove)
- McpEditCommand (edit)
- McpWizardCommand (wizard)
- McpResourcesCommand (resources)
- McpDebugCommand (debug) - DUPLICATED
- McpLogsCommand (logs)
- McpHealthCommand (health)

## Required Tasks (USE INCREMENTAL APPROACH)

### Task 1: Analyze the File Structure
```bash
# Check line numbers of all command declarations
grep -n "const Mcp.*Command = cmd" /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/cli/cmd/mcp.ts

# Check the McpCommand registration
grep -n -A 15 "export const McpCommand = cmd" /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/cli/cmd/mcp.ts
```

### Task 2: Remove Duplicate Declaration
**CRITICAL**: There are TWO McpDebugCommand declarations:
1. First at line 289 (incorrectly placed early in file)
2. Second at line 1503 (likely the correct one at end of file)

**Solution Steps**:
1. Read lines 280-300 to verify first declaration
2. Read lines 1495-1510 to verify second declaration
3. Compare both implementations
4. Remove the FIRST declaration (line 289) as it's in wrong position
5. Keep the SECOND declaration (line 1503) as it follows the pattern

### Task 3: Fix Command Order
The correct order should be:
1. All original commands (list, status, test, tools, add, remove, edit)
2. Then all new Phase 3 commands at the END:
   - McpResourcesCommand
   - McpDebugCommand (only one!)
   - McpLogsCommand
   - McpHealthCommand

## Implementation Approach

```typescript
// STEP 1: Use filesystem MCP to read around line 289
filesystem:read_file with head=300, tail=270 to see context

// STEP 2: Identify the exact lines of first McpDebugCommand
// It likely starts with:
const McpDebugCommand = cmd({
  command: "debug [server]",
  ...
})

// STEP 3: Remove ONLY the first occurrence
// Use filesystem:edit_file to delete lines containing first declaration

// STEP 4: Verify second declaration is intact at end of file
filesystem:read_file with tail=200 to check end of file

// STEP 5: Run typecheck to confirm fix
```

## Technical Constraints

- **File Size**: mcp.ts is ~1500+ lines - edit carefully
- **Preservation**: Keep all command functionality intact
- **Order**: Maintain logical command order in file
- **Registration**: Ensure McpCommand builder has all commands registered once

## Success Criteria

1. ✅ Only ONE McpDebugCommand declaration exists
2. ✅ `bun run typecheck` passes with 0 errors
3. ✅ All 12 commands remain registered in McpCommand
4. ✅ Commands are in logical order in the file
5. ✅ No functionality is lost

## Testing Approach

After fixing:
1. Run `bun run typecheck` - must show 0 errors
2. Run `dgmo mcp --help` - should list all commands
3. Test `dgmo mcp debug` - should work correctly
4. Verify all other commands still function

## Known Issues & Solutions

- Issue: Duplicate declaration at line 289 and 1503
  Solution: Remove first occurrence at line 289

- Issue: File corruption when editing large files
  Solution: Use targeted line edits, not full file replacement

- Issue: Commands might be registered twice
  Solution: Check McpCommand builder has each command only once

## Important Notes

- The error is caused by commands being inserted at wrong positions during Phase 3
- McpDebugCommand was accidentally added twice - once early in file, once at end
- The pattern is: original commands first, then new commands at end
- Use filesystem MCP for precise edits to avoid corruption
- Test after EACH edit to ensure no new errors

## File Safety Protocol

1. Always read the specific lines before editing
2. Make one change at a time
3. Use line-specific edits, not search-replace
4. Verify the edit worked correctly
5. Run typecheck after each change

Start by examining lines 280-300 and 1495-1510 to understand both McpDebugCommand declarations, then remove the first one at line 289. The file should have been structured with all new commands at the end, not interspersed.