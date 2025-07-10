# Instructions for Next DGMO Parallel Agents Implementation Agent

You are continuing the implementation of DGMO's parallel agent execution system. The project is 75% complete with core functionality implemented. Your task is to complete the remaining 25%: WebSocket real-time updates, Ctrl+B navigation, SDK integration fixes, and comprehensive testing.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode`
- Key Repositories:
  - `/opencode/packages/opencode` - TypeScript core
  - `/opencode/packages/tui` - Go TUI interface
- Architecture Doc: `/opencode/AGENTS.md`
- Related Systems: Session management, Tool filtering, WebSocket infrastructure, SDK integration

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "DGMO PARALLEL AGENTS IMPLEMENTATION 75% Complete"
2. Search: "PROJECT SNAPSHOT DGMSTT Tasks UI Implementation Complete WebSocket"
3. Search: "DGMO sub-session storage AsyncGenerator fixed"
4. Search: "WebSocket real-time updates task display event bridge"
5. Search: "opencode-sdk-go GetSession SetSession navigation"

## Completed Components (DO NOT RECREATE)

✅ AsyncGenerator Fix - Session.list() converted to array in sub-session.ts
✅ SubSession Namespace - Complete with store(), list(), get(), delete() methods
✅ Task Tool Integration - SubSession storage with status tracking
✅ /sub-session Command - Added to command registry with dialog
✅ Inline Task Display - Working via existing renderToolTitle()
✅ Automatic Failure Detection - Auto-debug with error analysis
✅ Tool Filtering Fix - Checks parentID for sub-agents
✅ Test Documentation - Created test-parallel-agents.md

## Critical Files to Reference

1. Sub-Session Storage:

   - `/opencode/packages/opencode/src/session/sub-session.ts` - Complete implementation
   - `/opencode/packages/opencode/src/tool/task.ts:34-42` - SubSession integration
   - `/opencode/packages/opencode/src/tool/task.ts:68-106` - Auto-debug logic

2. TUI Components:

   - `/opencode/packages/tui/internal/commands/command.go:84` - SubSessionCommand added
   - `/opencode/packages/tui/internal/components/dialog/subsession.go` - Dialog needs SDK fixes
   - `/opencode/packages/tui/internal/tui/tui.go:642-644` - Command handler added

3. Existing WebSocket Examples:
   - Memory shows Tasks UI already implemented WebSocket at port 5747
   - `/opencode/packages/opencode/src/events/task-events/server.ts` - May exist
   - `/opencode/packages/tui/internal/websocket/task_client.go` - May exist

## Required Tasks (USE 4 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Fix SDK Integration for Sub-Session Dialog

The subsession.go dialog has compilation issues due to missing SDK types.

- Check if opencode-sdk-go has SubSessionInfo type defined
- If not, modify dialog to use generic map[string]interface{} for now
- Fix imports: use actual SDK location (likely github.com/sst/opencode-sdk-go)
- Implement session switching using app.SetSession() correctly
- Test dialog compilation with `go build`

Location: `/opencode/packages/tui/internal/components/dialog/subsession.go`
Dependencies: opencode-sdk-go, app.App interface

### Sub-Agent 2: Implement WebSocket Real-time Updates

Create WebSocket infrastructure for real-time task status updates.

- Check if task-events already exist (memory suggests they do)
- If not, create `/opencode/packages/opencode/src/events/task-events.ts`
- Emit events: task-started, task-progress, task-completed, task-failed
- Modify task.ts to emit events during execution
- Create or verify WebSocket server on port 5747
- Ensure events include sessionID, taskID, status, progress

Location: `/opencode/packages/opencode/src/events/`
Dependencies: Bus system, WebSocket library, existing event patterns

### Sub-Agent 3: Implement Ctrl+B Navigation

Add keyboard handler for returning to parent session.

- In tui.go, add keyboard handler for "ctrl+b"
- Check current session for parentID
- If has parent, load parent session using SDK
- Update app state with parent session
- Show toast notification "Returned to parent session"
- Handle case where no parent exists

Location: `/opencode/packages/tui/internal/tui/tui.go`
Dependencies: Session loading, keyboard handling patterns

### Sub-Agent 4: Comprehensive Testing Suite

Create automated tests for parallel agent functionality.

- Create `/opencode/packages/opencode/test/parallel-agents.test.ts`
- Test AsyncGenerator fix in sub-session.ts
- Test SubSession CRUD operations
- Test task tool with auto-debug scenarios
- Test tool filtering for sub-agents (read-only vs all-tools)
- Verify MCP tools always available
- Mock Session.create() and Session.chat() for isolated testing

Location: `/opencode/packages/opencode/test/`
Dependencies: Testing framework, mocking utilities

## Integration Requirements

1. WebSocket Events: Must integrate with existing Bus system
2. SDK Types: SubSessionInfo might need to be defined if missing
3. Navigation: Must preserve chat history when switching sessions
4. Testing: Should not require actual API calls (use mocks)
5. Performance: WebSocket updates must be <100ms latency

## Technical Constraints

- Go SDK might not have all types we need (work around if needed)
- WebSocket server might already exist (check first)
- Keyboard handling must not conflict with existing shortcuts
- Tests must be isolated and not affect production storage

## Success Criteria

1. subsession.go compiles without errors
2. WebSocket events fire when tasks execute
3. Ctrl+B successfuly returns to parent session
4. All tests pass with >90% coverage
5. Tool filtering verified working in tests
6. MCP tools confirmed always available
7. No regression in existing functionality
8. Performance remains under 100ms for updates
9. Documentation updated with new features
10. Manual testing confirms all scenarios work

## Testing Approach

After implementation:

1. Run `bun test parallel-agents.test.ts`
2. Compile TUI with `go build ./cmd/tui`
3. Test WebSocket with multiple parallel agents
4. Verify Ctrl+B navigation in various scenarios
5. Check sub-session dialog displays correctly
6. Monitor WebSocket latency with dev tools
7. Test error scenarios and auto-recovery
8. Verify storage persistence across restarts

## Known Issues & Solutions

- Issue: SDK types might be missing
  Solution: Use generic types or create local interfaces

- Issue: WebSocket server might already exist
  Solution: Check first, reuse if available

- Issue: Dialog compilation errors
  Solution: Fix imports and use correct SDK path

- Issue: Test isolation
  Solution: Mock all external dependencies

## Important Notes

- WebSocket implementation might already exist (check memory)
- SDK is at github.com/sst/opencode-sdk-go (not local path)
- Preserve existing inline task display (don't recreate)
- Tool filtering already works (just needs testing)
- Remember: DGMO philosophy is developer-friendly and efficient

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to complete the implementation. Focus on fixing the SDK integration first as it blocks the dialog functionality.
