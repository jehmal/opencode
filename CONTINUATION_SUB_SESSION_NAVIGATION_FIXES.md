# Instructions for Next OpenCode Sub-Session Navigation Fix Agent

You are continuing the refinement of sub-session navigation for OpenCode DGMSTT. The navigation is 90% complete and functional, but has two critical issues that need fixing. Your task is to resolve the rendering and filtering problems.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode`
- Key Repositories:
  - Backend: `/packages/opencode` (TypeScript/Bun)
  - Frontend: `/packages/tui` (Go/Bubble Tea)
- Navigation Implementation: Complete in `app.go`, `tui.go`, `subsession.go`
- Testing: Run `dgmo` normally from project directory

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "PROJECT SNAPSHOT OpenCode DGMSTT Sub-Session Navigation 90% Complete rendering"
2. Search: "DGMO Sub-Sessions Complete Debugging Journey Bubble Tea Init"
3. Search: "sub-session filtering loadSubSessions strategy before navigation"
4. Search: "Bubble Tea modal refresh repaint rendering update"
5. Search: "SUCCESS PATTERN TUI navigation keyboard refresh"

## Completed Components (DO NOT RECREATE)

✅ Session State Management - Navigation stack, type tracking, methods all working
✅ Enter Key Navigation - Loads sub-sessions with messages successfuly
✅ Ctrl+B Navigation - Logic works, switches sessions correctly
✅ Sibling Navigation - Ctrl+B+. and Ctrl+B+, implemented
✅ Debug Logging - [NAV] logs throughout navigation flow
✅ Nil Pointer Fixes - Session checks prevent crashes
✅ Message Loading - Full context switches properly
✅ Toast Notifications - Success messages appear

## Critical Files to Reference

### Navigation Implementation:

- `/packages/tui/internal/app/app.go` - Lines 41-43, 487-565 (navigation state)
- `/packages/tui/internal/tui/tui.go` - Lines 257-273, 412-425 (Ctrl+B handler)
- `/packages/tui/internal/components/dialog/subsession.go` - Lines 167-199 (commented Strategy 3)

### Bubble Tea Patterns:

- `/packages/tui/internal/components/dialog/session.go` - Reference for working dialog
- `/packages/tui/internal/tui/tui.go` - Main update loop for refresh patterns
- `/packages/tui/internal/components/modal/modal.go` - Modal rendering patterns

## Required Tasks (USE 2 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Fix TUI Rendering After Navigation

**Issue**: Ctrl+B navigation works but screen doesn't update until terminal resize

**Thought**: Navigation changes app state but doesn't trigger UI refresh
**Action**: Find how Bubble Tea refreshes after state changes
**Expected**: Add refresh command after SessionSwitchedMsg

- Study how other state changes trigger refreshes
- Check if we need to return a Cmd for repaint
- Look for tea.WindowSizeMsg or similar refresh patterns
- Test with explicit refresh commands
  Location: `/packages/tui/internal/tui/tui.go` lines 412-425
  Dependencies: Bubble Tea refresh patterns

### Sub-Agent 2: Restore Sub-Session Filtering

**Issue**: Dialog shows ALL sub-sessions instead of session-specific ones

**Thought**: Strategy 3 was commented out, but original filtering worked
**Action**: Understand why it was showing all before navigation changes
**Expected**: Show only children of current session

- Check git history for how it worked before
- Understand why Strategy 3 was added
- Implement proper parent-child filtering
- Remove or fix the fallback logic
  Location: `/packages/tui/internal/components/dialog/subsession.go` lines 124-200
  Dependencies: Session parent-child relationships

## Integration Requirements

1. **Rendering Fix**: Must refresh immediately after navigation
2. **Filtering Fix**: Must show only relevant sub-sessions
3. **No Regressions**: Keep all working navigation features
4. **Performance**: Refresh should be instant, no flicker

## Technical Constraints

- Bubble Tea Framework: May need specific Cmd for refresh
- Session Relationships: ParentID field determines filtering
- Backward Compatibility: Don't break existing navigation
- User Experience: Smooth, instant updates required

## Success Criteria

1. Ctrl+B navigation updates screen immediately
2. No terminal resize needed for refresh
3. Sub-session dialog shows only children of current session
4. No ALL sub-sessions fallback unless necessary
5. Navigation remains fast (<100ms)
6. No visual glitches or flicker
7. Debug logs show proper filtering
8. All existing features still work
9. Clean code with comments
10. Test coverage for edge cases

## Testing Approach

After implementation:

1. Test Ctrl+B navigation without resize
2. Verify immediate screen update
3. Open /sub-session in main session
4. Confirm only direct children shown
5. Navigate to sub-session
6. Open /sub-session again
7. Verify siblings shown (if any)
8. Test rapid navigation
9. Check debug logs
10. Verify no regressions

## Known Issues & Solutions

- Issue: Bubble Tea View() called frequently
  Solution: Ensure state changes trigger proper refresh
- Issue: Original filtering was working
  Solution: Check what changed, restore original logic
- Issue: Terminal resize triggers refresh
  Solution: Find what resize does, replicate it

## Important Notes

- Navigation logic is correct, only rendering/filtering broken
- Before changes, sub-session filtering worked properly
- Ctrl+B functionality is good, just needs UI refresh
- Debug logs ([NAV]) will help trace issues
- Remember: The core implementation is solid

Start by searching memory for the mentioned queries to understand Bubble Tea refresh patterns and original filtering logic, then launch your sub-agents to fix both issues in parallel. Focus on minimal changes that restore proper behavior.

## ReAct Implementation Pattern

For each fix:

1. **Thought**: Analyze why current behavior differs from expected
2. **Action**: Implement targeted fix based on analysis
3. **Observation**: Test the change immediately
4. **Thought**: Determine if fix is complete or needs adjustment
5. **Action**: Refine based on observation
6. **Observation**: Verify final behavior matches requirements

## Hierarchical Task Structure

```
Main Task: Fix Navigation Rendering and Filtering
├── Rendering Fix (Sub-Agent 1)
│   ├── Analyze Bubble Tea refresh patterns
│   ├── Implement refresh after navigation
│   └── Test immediate UI updates
└── Filtering Fix (Sub-Agent 2)
    ├── Restore original filtering logic
    ├── Remove/fix Strategy 3 fallback
    └── Test parent-child relationships
```

The navigation implementation is solid - these are just UI polish issues that will complete the feature.
