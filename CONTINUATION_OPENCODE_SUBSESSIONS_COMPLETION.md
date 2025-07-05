# Instructions for Next OpenCode DGMSTT Sub-Sessions Agent

You are continuing the implementation of OpenCode DGMSTT sub-sessions feature. The project is 90% complete with working storage, API endpoints, and basic TUI integration. Your task is to complete the remaining 10% by implementing SDK regeneration, full session switching, and visual improvements.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode`
- Key Repositories:
  - TypeScript Backend: `/packages/opencode/`
  - Go TUI Frontend: `/packages/tui/`
  - SDK Generation: `/packages/opencode/src/server/server.ts`
- Architecture Doc: See PROJECT SNAPSHOT in Qdrant memory
- Related Systems: Hono API, Go TUI, opencode-sdk-go

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "PROJECT SNAPSHOT OpenCode DGMSTT Sub-Sessions July 2025"
2. Search: "sub-session implementation technical details"
3. Search: "Go TUI client HTTP calls pattern"
4. Search: "SDK generation opencode"
5. Search: "continuation prompt template"

## Completed Components (DO NOT RECREATE)

✅ Task Tool Implementation - Full parallel agent execution with modes
✅ Sub-Session Storage System - JSON storage with parent indexes
✅ Server API Endpoints - All CRUD operations for sub-sessions
✅ Go TUI Basic Integration - Direct HTTP calls working
✅ Configuration Updates - Task tool in ALL_TOOLS list
✅ MCP Tool Naming Fix - Correct servername_toolname pattern
✅ Fallback Logic - Shows all sub-sessions when current has none

## Critical Files to Reference

1. Sub-Session System:

   - `/packages/opencode/src/session/sub-session.ts` - Storage implementation
   - `/packages/opencode/src/tool/task.ts` - Task tool creating sub-sessions
   - `/packages/opencode/src/server/server.ts` - API endpoints (lines 463-579)

2. Go TUI Integration:

   - `/packages/tui/internal/components/dialog/subsession.go` - Current implementation
   - `/packages/tui/internal/app/app.go` - Session management
   - `/packages/tui/cmd/dgmo/main.go` - Client initialization

3. SDK Related:
   - `/packages/opencode/src/server/server.ts` - OpenAPI specs
   - `github.com/sst/opencode-sdk-go` - Current SDK package

## Required Tasks (USE 4 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: SDK Regeneration Specialist

**Thought**: The SDK lacks native sub-session methods, forcing direct HTTP calls. Need to regenerate SDK with proper types.
**Action**: Implement SDK generation pipeline

- Research how the opencode-sdk-go is generated from server.ts OpenAPI specs
- Find or create the SDK generation script (likely using openapi-generator or similar)
- Ensure all sub-session endpoints are properly annotated with OpenAPI schemas
- Generate new SDK with SubSession service methods
- Update go.mod to use local SDK for testing
  **Observation**: Check that new methods like `client.SubSession.GetByParent()` exist
  Location: `/packages/opencode/scripts/` or similar
  Dependencies: OpenAPI spec in server.ts, SDK generation tool

### Sub-Agent 2: Full Session Switching Implementation

**Thought**: Current implementation shows success toast but doesn't actually switch sessions. Need complete implementation.
**Action**: Implement proper session switching in TUI

- Study how ModelDialog switches models (reference pattern)
- Update `switchToSession()` in subsession.go to:
  - Load the selected session using SDK/HTTP
  - Update `s.app.Session` with new session data
  - Load messages for the new session
  - Trigger UI refresh to show new session
  - Handle parent/child session relationships
- Add session context indicator in UI
- Implement Ctrl+B for parent navigation
  **Observation**: User can navigate between sessions seamlessly
  Location: `/packages/tui/internal/components/dialog/subsession.go`
  Dependencies: Session loading logic, UI refresh mechanism

### Sub-Agent 3: Visual Sub-Session Tree View

**Thought**: Current list view doesn't show parent-child relationships clearly. Need tree visualization.
**Action**: Create hierarchical tree view for sub-sessions

- Design tree structure showing:
  - Parent session at root
  - Sub-sessions as children with indentation
  - Status indicators (▶ running, ✓ completed, ✗ failed)
  - Task descriptions and timestamps
- Implement collapsible/expandable nodes
- Add visual connectors between parent and children
- Show current session highlight
- Add breadcrumb navigation at top
  **Observation**: Clear visual hierarchy of session relationships
  Location: `/packages/tui/internal/components/dialog/subsession.go`
  Dependencies: Tree rendering logic, TUI components

### Sub-Agent 4: Integration Testing & Documentation

**Thought**: Need comprehensive tests and docs for the complete feature.
**Action**: Create test suite and documentation

- Write integration tests for:
  - Sub-session creation via task tool
  - API endpoint responses
  - TUI navigation flow
  - Session switching scenarios
- Create user documentation:
  - How to use task tool for parallel agents
  - Navigating sub-sessions in TUI
  - Understanding session hierarchy
- Add inline code documentation
- Create example workflows
  **Observation**: Full test coverage and clear documentation
  Location: `/packages/opencode/test/` and `/docs/`
  Dependencies: All implemented features

## Integration Requirements

1. SDK Integration: New SDK must maintain backward compatibility
2. Session State: Ensure session switching preserves message history
3. UI Consistency: Tree view must follow existing TUI patterns
4. Performance: Session switching must be <200ms
5. Error Handling: Graceful fallbacks for missing sessions

## Technical Constraints

- Go SDK Generation: Must use same tool as original SDK
- TUI Framework: Bubbletea constraints for rendering
- Storage Format: Maintain existing JSON structure
- API Compatibility: No breaking changes to endpoints

## Success Criteria

1. SDK has native SubSession service with all methods
2. Full session switching works in TUI
3. Tree view shows clear parent-child relationships
4. All sub-sessions are navigable
5. Ctrl+B returns to parent session
6. Performance <200ms for all operations
7. Integration tests pass
8. Documentation is complete
9. No regression in existing features
10. TypeScript diagnostics resolved

## Testing Approach

After implementation:

1. Create task with 3 sub-agents
2. Navigate to /sub-session in TUI
3. Verify tree view shows hierarchy
4. Test switching between sessions
5. Verify Ctrl+B parent navigation
6. Test with nested sub-sessions
7. Benchmark performance
8. Run full test suite

## Known Issues & Solutions

- Issue: TypeScript diagnostics show false positives
  Solution: Run `bun run typecheck` to verify actual errors
- Issue: Session context mismatch
  Solution: Fallback logic already implemented, enhance with tree view
- Issue: SDK doesn't have sub-session methods
  Solution: Regenerate SDK with proper OpenAPI annotations

## Important Notes

- The storage system works perfectly - don't modify it
- API endpoints are complete - just need SDK generation
- Direct HTTP calls work but native SDK is cleaner
- Tree view should be intuitive like file explorers
- Remember: Main goal is better sub-session navigation

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to complete the implementation. Focus on SDK regeneration first as it unblocks other improvements.
