# Instructions for Next OpenCode Sub-Sessions Fix Agent

You are continuing the debugging of OpenCode DGMSTT sub-sessions display issue. The project is 95% investigated with root causes identified. Your task is to implement the fix so sub-sessions display correctly in the TUI.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode`
- Key Repositories:
  - TypeScript Backend: `/packages/opencode/`
  - Go TUI Frontend: `/packages/tui/`
  - Storage Location: `~/.local/share/opencode/project/*/storage/`
- Architecture Doc: See PROJECT SNAPSHOT in Qdrant memory
- Related Systems: Task tool, SubSession storage, TUI dialog, Agent config

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "PROJECT SNAPSHOT OpenCode DGMSTT Sub-Sessions Display Issue Deep Investigation"
2. Search: "sub-session implementation technical details storage API endpoints"
3. Search: "agent mode task tool sub-sessions configuration"
4. Search: "Go TUI client HTTP calls pattern SDK"
5. Search: "continuation prompt template"

## Completed Components (DO NOT RECREATE)

✅ Task Tool Implementation - Creates sub-sessions with /agents command
✅ Sub-Session Storage System - JSON storage working correctly
✅ Server API Endpoints - All endpoints properly implemented
✅ Go TUI Dialog - Shows sub-sessions (but finds none)
✅ Agent Config Module - Has logic for main sessions to get all tools
✅ Tree View UI - Hierarchical display implemented
✅ Default Mode Change - Changed to "all-tools" (but didn't fix issue)

## Critical Files to Reference

1. Task Tool & Sub-Sessions:

   - `/packages/opencode/src/tool/task.ts` - Creates sub-sessions (line 50)
   - `/packages/opencode/src/session/sub-session.ts` - Storage implementation
   - `/packages/opencode/src/config/agent-config.ts` - Tool filtering logic

2. Session Management:

   - `/packages/opencode/src/session/index.ts` - Main session logic (line 438)
   - `/packages/opencode/src/server/server.ts` - API endpoints (lines 463-586)

3. Go TUI:
   - `/packages/tui/internal/components/dialog/subsession.go` - Dialog implementation
   - `/packages/tui/internal/app/app.go` - Session management

## Required Tasks (USE 4 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Session Context Debugger

**Thought**: Multiple project directories exist. Need to verify which one is active and if session IDs match.
**Action**: Debug session context and storage paths

- Add logging to identify active project directory
- Verify session ID format and consistency
- Check if SubSession.create() is actually being called
- Trace why no index files exist for current sessions
- Compare session context between normal mode and /agents mode
  **Observation**: Identify exact mismatch between session contexts
  Location: `/packages/opencode/src/session/` and storage paths
  Dependencies: File system access, logging

### Sub-Agent 2: Task Tool Execution Tracer

**Thought**: Task executes (JSON visible) but may not create sub-sessions. Need execution trace.
**Action**: Add comprehensive logging to task tool flow

- Log when task tool is invoked with parameters
- Log SubSession.create() calls with all arguments
- Log any errors in sub-session creation
- Verify session ID passed to SubSession.create()
- Check if task tool has correct permissions
  **Observation**: Pinpoint where sub-session creation fails
  Location: `/packages/opencode/src/tool/task.ts`
  Dependencies: Logging, error handling

### Sub-Agent 3: Storage Path Resolver

**Thought**: Sub-sessions exist but in wrong project directory. Need to fix path resolution.
**Action**: Implement proper project directory resolution

- Investigate why multiple project directories exist
- Ensure consistent project hash calculation
- Verify storage paths match between write and read
- Fix any path normalization issues
- Test with different working directories
  **Observation**: Ensure all components use same storage location
  Location: `/packages/opencode/src/storage/storage.ts` and `/packages/opencode/src/app/app.ts`
  Dependencies: Path resolution, project identification

### Sub-Agent 4: Agent Mode Enforcer

**Thought**: Main sessions should have all tools but something prevents it. Need to enforce properly.
**Action**: Fix agent mode enforcement for main sessions

- Verify isMainSession() logic is correct
- Check why DEFAULT_MODE change didn't work
- Ensure parentID is passed correctly
- Force main sessions to have task tool
- Add diagnostic logging for tool filtering
  **Observation**: Ensure task tool is available in normal usage
  Location: `/packages/opencode/src/config/agent-config.ts` and `/packages/opencode/src/session/index.ts`
  Dependencies: Session identification, tool filtering

## Integration Requirements

1. **Session Consistency**: All components must use same session ID format
2. **Storage Unity**: All components must use same project directory
3. **Tool Availability**: Task tool must be available without /agents
4. **Error Visibility**: Any failures must be logged clearly
5. **Backward Compatibility**: Don't break existing sub-sessions

## Technical Constraints

- **Project Directories**: Handle multiple project paths gracefully
- **Session IDs**: Maintain consistent format (ses\_[timestamp][random])
- **Storage Format**: Keep existing JSON structure
- **API Compatibility**: No changes to API contracts
- **Performance**: Sub-session lookup must be fast

## Success Criteria

1. Sub-sessions created in normal chat (without /agents)
2. /sub-session dialog shows current sub-sessions
3. Tree view displays parent-child relationships
4. No duplicate project directories created
5. Task tool available by default
6. Clear error messages if creation fails
7. Existing January sub-sessions still accessible
8. Performance under 100ms for lookups
9. No regression in other features
10. Works across different working directories

## Testing Approach

After implementation:

1. Start fresh dgmo session
2. Create task without /agents: "Create 3 agents to analyze this code"
3. Open /sub-session - should show 3 sub-sessions
4. Verify tree structure displays correctly
5. Test session switching (if implemented)
6. Check storage has correct files
7. Verify no duplicate directories created
8. Test with different working paths

## Known Issues & Solutions

- Issue: Multiple project directories (mnt-c-Users-jehma-Desktop-AI-DGMSTT vs -opencode)
  Solution: Normalize project path calculation, use consistent working directory

- Issue: Session IDs have different prefixes (ses_82a vs ses_836)
  Solution: This is timestamp-based and correct, ensure lookup uses current session

- Issue: Task tool not available in default mode
  Solution: Already changed DEFAULT_MODE, but check why it's not effective

- Issue: User sees JSON output when task executes
  Solution: This might be debug output, ensure clean user experience

## Important Notes

- Sub-sessions WORK with /agents command (proves core functionality is correct)
- Storage system is functioning (old sub-sessions exist and are found)
- The issue is specific to session context and tool availability
- User feedback confirms tasks execute but sub-sessions don't appear
- Tree view and UI components are ready, just need data
- Remember: Don't over-complicate - the system works, just not in default mode

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to trace execution and fix the session context issues. Focus on making sub-sessions work in normal usage without requiring /agents command.
