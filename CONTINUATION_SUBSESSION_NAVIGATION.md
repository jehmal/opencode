# Instructions for Next OpenCode DGMSTT Sub-Session Navigation Agent

You are continuing the implementation of sub-session navigation features for OpenCode DGMSTT. The project is 95% complete with sub-sessions fully functional and viewable in the TUI dialog. Your task is to implement seamless navigation between sessions and sub-sessions using keyboard shortcuts.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode`
- Key Repositories:
  - Backend: `/packages/opencode` (TypeScript/Bun)
  - Frontend: `/packages/tui` (Go/Bubble Tea)
- Architecture Doc: `/docs/PERFORMANCE_INTEGRATION.md`
- Related Systems: Session management, Sub-session storage, TUI framework

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "PROJECT SNAPSHOT OpenCode DGMSTT sub-sessions navigation TUI 2025-07"
2. Search: "DGMO Sub-Sessions Complete Debugging Journey session logic"
3. Search: "SUCCESS PATTERN session switching TUI navigation keyboard"
4. Search: "ERROR SOLUTION bubble tea modal dialog initialization"
5. Search: "ARCHITECTURE DECISIONS session management hierarchical"

## Completed Components (DO NOT RECREATE)

✅ Sub-Session Storage System - Full CRUD operations with parent-child relationships
✅ Task Tool Implementation - Creates sub-sessions with proper parentID
✅ Server API Endpoints - All sub-session endpoints working
✅ TUI Sub-Session Dialog - Shows tree view with status indicators
✅ Session Creation - Properly sets parentID for hierarchy
✅ Go Build Fixed - Removed SDK type conversion issues
✅ Debug Logging - Comprehensive logging throughout system
✅ Tree View Display - Hierarchical visualization working

## Critical Files to Reference

### Session Management:

- `/packages/opencode/src/session/index.ts` - Core session logic (lines 425-450 for tool filtering)
- `/packages/opencode/src/session/sub-session.ts` - Sub-session storage namespace
- `/packages/opencode/src/session/message.ts` - Message handling

### TUI Components:

- `/packages/tui/internal/components/dialog/subsession.go` - Sub-session dialog (lines 150-200)
- `/packages/tui/internal/components/dialog/session.go` - Session dialog for reference
- `/packages/tui/internal/tui/tui.go` - Main TUI update/view logic
- `/packages/tui/internal/app/app.go` - App state management

### Key Integration Points:

- `/packages/tui/cmd/dgmo/main.go` - Command registration
- `/packages/opencode/src/server/server.ts` - API endpoints (lines 800-900)

## Required Tasks (USE 4 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Session State Management

Implement session context switching and state preservation

- Study how regular sessions work in `session.go` dialog
- Create `sessionStack` to track navigation history
- Implement `pushSession()` and `popSession()` methods
- Add `currentSessionType` field (main/sub)
- Store parent-child relationships for navigation
  Location: `/packages/tui/internal/app/app.go`
  Dependencies: Session types, state management

### Sub-Agent 2: Enter Key Navigation

Implement Enter key to load sub-session as current session

- In `subsession.go`, handle Enter key in Update()
- Load sub-session messages and metadata
- Switch TUI view to show sub-session content
- Update app state with new session context
- Preserve navigation breadcrumbs
  Location: `/packages/tui/internal/components/dialog/subsession.go`
  Dependencies: Message loading, view switching

### Sub-Agent 3: Ctrl+B Navigation

Implement back navigation and sub-session quick access

- Add global key handler for Ctrl+B in main TUI
- If in sub-session: return to parent session
- If in main session: enter last viewed sub-session
- Handle edge cases (no parent, no sub-sessions)
- Update view and reload appropriate messages
  Location: `/packages/tui/internal/tui/tui.go`
  Dependencies: Session stack, view updates

### Sub-Agent 4: Multi-Sub-Session Navigation

Implement Ctrl+B+. and Ctrl+B+, for sibling navigation

- Track sub-session order within parent
- Implement circular navigation (wrap around)
- Handle Ctrl+B followed by . or , keys
- Update current sub-session index
- Preload adjacent sub-sessions for performance
  Location: `/packages/tui/internal/tui/keybindings.go` (create if needed)
  Dependencies: Sub-session ordering, state tracking

## Integration Requirements

1. Session State Consistency: Ensure messages, metadata, and context switch together
2. Navigation History: Maintain stack for proper back navigation
3. Performance: Preload adjacent sub-sessions for instant switching
4. Visual Feedback: Show current location in session hierarchy
5. Error Handling: Graceful fallbacks for missing sessions

## Technical Constraints

- Bubble Tea Framework: View() can be called before Init() - use constructor initialization
- Session IDs: Use exact IDs from storage, maintain parent-child relationships
- Message Loading: Must load from correct storage path
- Key Bindings: Respect existing shortcuts, use tea.KeyMsg patterns
- State Updates: All navigation must update app.Session and app.Messages

## Success Criteria

1. Enter key loads sub-session with all messages displayed
2. Ctrl+B returns to parent from sub-session
3. Ctrl+B from main enters last viewed sub-session
4. Ctrl+B+. navigates to next sibling sub-session
5. Ctrl+B+, navigates to previous sibling sub-session
6. Navigation preserves message history and context
7. Visual indicators show current session type
8. Performance: <100ms for session switches
9. No crashes or data loss during navigation
10. Breadcrumb trail shows navigation path

## Testing Approach

After implementation:

1. Create main session with 3+ sub-sessions using task tool
2. Test Enter key navigation into each sub-session
3. Verify Ctrl+B returns to correct parent
4. Test sibling navigation with wrap-around
5. Verify message persistence across switches
6. Test edge cases (single sub-session, deeply nested)
7. Performance test with 50+ sub-sessions
8. Verify no memory leaks during navigation

## Known Issues & Solutions

- Issue: Bubble Tea dialogs may not call Init()
  Solution: Initialize in constructor like ModelDialog
- Issue: Session switching requires type conversion
  Solution: Use simplified approach, update state directly
- Issue: Multiple project directories
  Solution: Use consistent project hash calculation

## Important Notes

- Session navigation mirrors regular session switching logic
- Sub-sessions are full sessions with parentID set
- Use existing patterns from session.go dialog
- Keyboard shortcuts must be responsive (<50ms)
- Remember: The system already works, we're adding navigation

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to complete the implementation. Focus on reusing existing session switching patterns while adding the hierarchical navigation capabilities.

## ReAct Implementation Pattern

For each navigation action:

1. **Thought**: Analyze current session context and navigation request
2. **Action**: Execute session switch or navigation command
3. **Observation**: Verify new session loaded with correct messages
4. **Thought**: Determine if additional updates needed (breadcrumbs, state)
5. **Action**: Update UI components and state
6. **Observation**: Confirm visual feedback matches navigation

## Hierarchical Task Structure

```
Main Task: Sub-Session Navigation
├── State Management (Sub-Agent 1)
│   ├── Session Stack Implementation
│   ├── Context Preservation
│   └── History Tracking
├── Enter Navigation (Sub-Agent 2)
│   ├── Key Handler
│   ├── Session Loading
│   └── View Switching
├── Back Navigation (Sub-Agent 3)
│   ├── Ctrl+B Handler
│   ├── Parent/Child Logic
│   └── Quick Access
└── Sibling Navigation (Sub-Agent 4)
    ├── Order Tracking
    ├── Circular Navigation
    └── Preloading
```

## Prompt Chain Sequence

1. Analyze existing session navigation → 2. Design state management → 3. Implement key handlers → 4. Add navigation logic → 5. Integrate with TUI → 6. Test and refine

The navigation should feel as natural as regular session switching, with the added power of hierarchical movement through the session tree.
