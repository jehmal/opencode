# Instructions for Next DGMO Parallel Agents Implementation Agent

You are continuing the implementation of DGMO's parallel agent execution system. The project is 25% complete with requirements gathered and initial implementation started. Your task is to complete the parallel agent system with tool filtering, sub-session storage, and inline task display.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode`
- Key Repositories:
  - `/opencode/packages/opencode` - TypeScript core
  - `/opencode/packages/tui` - Go TUI interface
- Architecture Doc: `/opencode/AGENTS.md`
- Related Systems: Session management, Tool filtering, WebSocket infrastructure

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "DGMO parallel agent execution implementation plan requirements"
2. Search: "DGMO agent mode tool filtering session-level"
3. Search: "DGMO sub-session storage AsyncGenerator"
4. Search: "continuation prompt template auto-continuation instructions"
5. Search: "DGMO Tasks UI implementation WebSocket real-time"

## Completed Components (DO NOT RECREATE)

✅ Requirements Gathering - 12 questions answered, full system design complete
✅ Implementation Plan - Created at `/CONTINUATION_DGMO_PARALLEL_AGENTS.md`
✅ Agent Config Module - Tool filtering logic in `/opencode/packages/opencode/src/config/agent-config.ts`
✅ Session Tool Filtering - Modified `/opencode/packages/opencode/src/session/index.ts` to filter tools
✅ Task Tool Enhancement - Updated `/opencode/packages/opencode/src/tool/task.ts` with agent mode
✅ Sub-Session Storage (Partial) - Started `/opencode/packages/opencode/src/session/sub-session.ts`

## Critical Files to Reference

1. Tool Filtering:

   - `/opencode/packages/opencode/src/session/index.ts:425` - Fixed to check parentID for sub-agents
   - `/opencode/packages/opencode/src/config/agent-config.ts` - Tool lists and filtering logic
   - `/opencode/packages/opencode/src/tool/task.ts:111` - Sets agent mode for sub-sessions

2. Sub-Session Management:

   - `/opencode/packages/opencode/src/session/sub-session.ts` - In progress, needs AsyncGenerator fix
   - `/opencode/packages/opencode/src/session/index.ts` - Session.list() returns AsyncGenerator

3. TUI Components:
   - `/opencode/packages/tui/internal/tui/tui.go` - Main TUI handler
   - `/opencode/packages/tui/internal/commands/command.go` - Command definitions

## Required Tasks (USE 4 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Fix Sub-Session Storage AsyncGenerator Issue

Fix the AsyncGenerator issue in sub-session.ts where Session.list() returns an AsyncGenerator instead of an array.

- Convert AsyncGenerator to array using `for await...of` loop
- Complete the SubSession namespace implementation
- Implement store(), list(), get(), delete() methods
- Add search functionality for sub-sessions
- Test with multiple parallel sub-sessions
  Location: `/opencode/packages/opencode/src/session/sub-session.ts`
  Dependencies: Session namespace, Storage namespace

### Sub-Agent 2: Create /sub-session Command in TUI

Implement the /sub-session command in the Go TUI for navigating stored sub-sessions.

- Create new command in commands/command.go
- Create SubSessionDialog component with dropdown list
- Show sub-sessions organized by date with agent names
- Implement Ctrl+B to return to parent session
- Add search/filter capability in dialog
  Location: `/opencode/packages/tui/internal/components/dialog/sub_session.go`
  Dependencies: Sub-session storage API, existing dialog patterns

### Sub-Agent 3: Implement Inline Task Display

Create inline task display in the main chat to show parallel agent execution.

- Modify chat rendering to include task status blocks
- Format: "Agent 1: [Task Description] [Status]"
- Stack multiple agents vertically
- Show completed tasks with ✓
- Real-time updates via WebSocket
  Location: `/opencode/packages/tui/internal/components/chat/task_display.go`
  Dependencies: WebSocket event system, chat rendering

### Sub-Agent 4: Implement Automatic Failure Handling

Add automatic failure detection and self-debugging for sub-agents.

- Monitor task tool execution for errors
- Detect common failure patterns
- Automatically create debug sub-agent on failure
- Pass error context to debug agent
- Limit retry attempts to prevent loops
  Location: `/opencode/packages/opencode/src/tool/task.ts`
  Dependencies: Task tool, error handling patterns

## Integration Requirements

1. Tool Filtering: Main DGMO must ALWAYS have all tools, sub-agents respect mode
2. MCP Tools: Always available regardless of mode (detected by underscore in name)
3. Vision: Always available regardless of mode
4. Sub-Sessions: Store parentID, agentName, task, status, timestamps
5. Navigation: Seamless switching between sessions with context preservation

## Technical Constraints

- Maximum 3 concurrent sub-agents
- Sub-sessions persist across restarts
- Tool filtering at session creation time (not runtime)
- WebSocket for real-time updates
- Backward compatible with existing sessions

## Success Criteria

1. Sub-sessions store and retrieve correctly with AsyncGenerator fixed
2. /sub-session command shows dropdown with all sub-sessions
3. Ctrl+B returns to parent session from sub-session
4. Inline tasks show in main chat with real-time updates
5. Completed tasks remain visible with checkmarks
6. Failed tasks automatically trigger debug agents
7. Tool filtering works correctly (read-only agents can't write)
8. MCP and vision tools always available
9. Main DGMO unrestricted regardless of mode
10. Performance: <100ms for task updates

## Testing Approach

After implementation:

1. Create 3 parallel agents with different modes
2. Verify tool restrictions work correctly
3. Test sub-session storage and retrieval
4. Navigate between sessions with /sub-session
5. Monitor inline task display updates
6. Trigger failures to test auto-debugging
7. Verify MCP tools always available
8. Test with 10+ sub-sessions for UI

## Known Issues & Solutions

- Issue: Session.list() returns AsyncGenerator not array
  Solution: Use `for await...of` to convert to array
- Issue: Tool filtering might affect MCP tools
  Solution: Check for underscore in tool name to allow MCP
- Issue: WebSocket disconnection loses task updates
  Solution: Implement reconnection with event replay

## Important Notes

- Tool filtering bug already fixed in session/index.ts (checks parentID)
- Agent mode defaults to "read-only" for safety
- Sub-sessions should be searchable by agent name and task
- Inline display should not block main chat interaction
- Remember: DGMO philosophy is developer-friendly and efficient

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to complete the implementation. Focus on creating a seamless parallel agent experience that enhances DGMO's already superior capabilities.
