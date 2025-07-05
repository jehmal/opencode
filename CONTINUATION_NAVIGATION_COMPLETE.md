# Instructions for Next OpenCode Sub-Session Navigation Enhancement Agent

You are continuing the enhancement of sub-session navigation for OpenCode DGMSTT. The core navigation is 100% complete and working. Your task is to add polish, optimize performance, and handle edge cases.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode`
- Key Repositories:
  - Backend: `/packages/opencode` (TypeScript/Bun)
  - Frontend: `/packages/tui` (Go/Bubble Tea)
- Navigation Implementation: Complete in `app.go`, `tui.go`, `subsession.go`
- Testing Guide: `/test-navigation.sh`

## Memory Search Commands

First, retrieve the implementation details:

1. Search: "PROJECT MILESTONE OpenCode Sub-Session Navigation Core Implementation"
2. Search: "sub-session navigation keyboard shortcuts implementation"
3. Search: "SUCCESS PATTERN session switching TUI navigation"
4. Search: "Bubble Tea modal dialogs Init constructor pattern"

## Completed Components (DO NOT RECREATE)

✅ Session State Management - Navigation stack, type tracking, helper methods
✅ Enter Key Navigation - Loads sub-session from dialog with messages
✅ Ctrl+B Back Navigation - Parent/child navigation with smart returns
✅ Sibling Navigation - Ctrl+B+. and Ctrl+B+, with circular wrap
✅ Message Loading - Full session context switches properly
✅ Error Handling - Toast messages for all error cases
✅ Visual Indicators - Breadcrumbs show current context
✅ Build System - Compiles successfully without errors
✅ Documentation - User guide and test instructions

## Optional Enhancement Tasks

### Task 1: Loading State Indicators

- Add `SessionLoadingMsg` type
- Show spinner/progress during session switch
- Disable navigation during loading
- Handle timeout scenarios

### Task 2: Performance Optimization

- Cache session metadata to avoid repeated API calls
- Preload adjacent sibling sessions
- Implement lazy message loading for large sessions
- Add debouncing for rapid navigation

### Task 3: Visual Polish

- Add navigation history indicator (stack depth)
- Show keyboard hints in status bar
- Animate session transitions
- Add session type icons

### Task 4: Advanced Navigation

- Ctrl+B+B for navigation history dialog
- Number keys for quick sibling access (1-9)
- Bookmark frequently accessed sessions
- Search within navigation history

### Task 5: Persistence

- Save navigation state to disk
- Restore last session on startup
- Remember navigation preferences
- Export/import navigation paths

## Testing Approach

1. Run existing tests with `test-navigation.sh`
2. Add stress tests for rapid navigation
3. Test with 50+ sub-sessions
4. Verify memory usage stays reasonable
5. Test error recovery scenarios

## Known Edge Cases

- Session deleted while in navigation stack
- Circular references in session hierarchy
- Network timeout during session load
- Concurrent navigation requests
- Very deep session nesting (10+ levels)

## Important Notes

- Core functionality is complete and working
- Focus on user experience improvements
- Maintain backward compatibility
- Keep performance under 100ms
- All enhancements are optional

Start by testing the current implementation to understand the user experience, then choose which enhancements would provide the most value. The navigation system is fully functional, so any work is purely additive.
