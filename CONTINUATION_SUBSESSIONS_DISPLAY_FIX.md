# Instructions for Next OpenCode Sub-Sessions Display Fix Agent

You are continuing the implementation of fixing sub-sessions display in OpenCode DGMSTT. The project is 90% complete with sub-sessions being created and stored correctly. Your task is to fix the TUI dialog display issue so sub-sessions appear when using `/sub-session` command.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode`
- Key Repositories:
  - TypeScript Backend: `/packages/opencode/`
  - Go TUI Frontend: `/packages/tui/`
- Architecture Doc: See PROJECT SNAPSHOT in Qdrant memory
- Related Systems: Task tool, SubSession storage, TUI dialog, Session API

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "PROJECT SNAPSHOT OpenCode DGMSTT Sub-Sessions Display Issue Deep Investigation"
2. Search: "sub-session implementation technical details storage API endpoints"
3. Search: "OpenCode Sub-Sessions Display Fix Strategy"
4. Search: "Go TUI dialog subsession implementation tree view"
5. Search: "session context project directories tool filtering"

## Completed Components (DO NOT RECREATE)

✅ Task Tool Implementation - Creates sub-sessions with correct parentID
✅ Sub-Session Storage System - Files stored correctly in JSON format
✅ Server API Endpoints - All endpoints properly implemented
✅ Agent Configuration - DEFAULT_MODE is "all-tools", task tool available
✅ Tool Filtering Fix - Main sessions get all tools including task
✅ Session Creation - Session.create(parentID) works correctly
✅ Sub-Session Creation - SubSession.create() stores files and indexes
✅ Debug Logging - Added to trace execution flow

## Critical Files to Reference

1. Sub-Session Storage:

   - `/packages/opencode/src/session/sub-session.ts` - Storage implementation
   - `/packages/opencode/src/tool/task.ts` - Creates sub-sessions (line 41)
   - Storage path: `~/.local/share/opencode/project/*/storage/session/sub-sessions/`
   - Index path: `~/.local/share/opencode/project/*/storage/session/sub-session-index/`

2. Server Endpoints:

   - `/packages/opencode/src/server/server.ts` - API endpoints (lines 463-586)
   - GET `/session/:id/sub-sessions` - Retrieves sub-sessions for parent

3. TUI Dialog:

   - `/packages/tui/internal/components/dialog/subsession.go` - Dialog implementation
   - Line 119: Makes HTTP call to get sub-sessions
   - Line 140: Fallback to show ALL sub-sessions if none found

4. Configuration:
   - `/packages/opencode/src/config/agent-config.ts` - Tool filtering logic
   - Lines 65-68: Fixed to handle empty string parentId

## Required Tasks (USE 3 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Debug Session Context Mismatch

The TUI might be using a different session ID than the one that created sub-sessions.

- Add logging to TUI dialog to show which session ID is being used
- Compare with actual session files in storage
- Verify the TUI is passing the correct current session ID
- Check if session switching is causing context loss
- Add debug output to show session hierarchy
  Location: `/packages/tui/internal/components/dialog/subsession.go`
  Dependencies: Current session context from app.Session

### Sub-Agent 2: Fix Server Endpoint Response

The server might not be returning sub-sessions correctly.

- Add comprehensive error handling to server endpoint
- Log the full request/response cycle
- Verify SubSession.getByParent() returns correct data
- Check if project directory mismatch affects retrieval
- Test endpoint directly with curl to isolate issue
  Location: `/packages/opencode/src/server/server.ts` (lines 483-495)
  Dependencies: SubSession namespace, Storage module

### Sub-Agent 3: Enhance TUI Dialog Display

The dialog might be receiving data but not displaying it.

- Add debug logging to show received sub-sessions
- Verify the dialog's tree building logic
- Check if the fallback mechanism is interfering
- Ensure proper type conversion from HTTP response
- Add visual indicators for debugging
  Location: `/packages/tui/internal/components/dialog/subsession.go`
  Dependencies: Bubbletea framework, HTTP client

## Integration Requirements

1. **Session Consistency**: Ensure TUI uses same session ID as storage
2. **Project Directory**: All components must use same project path
3. **Error Visibility**: Any failures must be logged clearly
4. **Real-time Updates**: Dialog should refresh when new sub-sessions created
5. **Type Safety**: Proper conversion between Go and TypeScript types

## Technical Constraints

- **Multiple Project Dirs**: Handle `mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode` correctly
- **Session ID Format**: Maintain `ses_[timestamp][random]` format
- **Storage Format**: Keep existing JSON structure
- **API Compatibility**: No changes to API contracts
- **Go/TypeScript Bridge**: Handle type conversions properly

## Success Criteria

1. Sub-sessions appear in `/sub-session` dialog immediately
2. Tree view shows parent-child relationships
3. No "No sub-sessions found" when sub-sessions exist
4. Clicking sub-session shows its content
5. Works for all new sessions created
6. Debug logs show correct session context
7. No errors in console or logs
8. Performance under 200ms for display
9. Consistent behavior across sessions
10. Works after server restart

## Testing Approach

After implementation:

1. Start fresh dgmo session
2. Create task: "Create 3 agents to test sub-sessions"
3. Immediately open `/sub-session` - should show 3 agents
4. Check console for debug messages
5. Verify tree structure displays
6. Test clicking on sub-sessions
7. Restart and verify persistence
8. Create another task and verify updates

## Known Issues & Solutions

- Issue: Sub-sessions created but not displayed
  Solution: Session context mismatch - ensure correct session ID used

- Issue: Multiple project directories exist
  Solution: Use consistent project path resolution

- Issue: Fallback shows old sub-sessions
  Solution: Fix primary retrieval so fallback isn't triggered

- Issue: Type conversion errors
  Solution: Properly handle Go/TypeScript type differences

## Important Notes

- Sub-sessions ARE being created correctly (verified in storage)
- Index files ARE being created with correct parent mapping
- The issue is specifically in the retrieval/display pipeline
- Task tool executes and creates sub-sessions successfuly
- Storage system is working - this is a display issue only
- Remember: Don't recreate working components, focus on the display fix

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to debug the session context mismatch and fix the display issue. Focus on making sub-sessions appear in the dialog when created.
