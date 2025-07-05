# Optimal Instructions for Fixing Sub-Session Navigation Issues

## Problem Summary

1. Sub-session dialog shows ALL sub-sessions instead of filtered ones
2. Ctrl+B doesn't return to parent session from sub-session
3. Navigation state (CurrentSessionType) may not be properly initialized

## Systematic Debugging Approach (Using ReAct Pattern)

### Phase 1: Diagnose Navigation State Issues

**Thought 1**: CurrentSessionType is likely not being set when the app starts or when sessions are loaded.

**Action 1**: Add debug logging to trace navigation state

```go
// In app.go, add to SwitchToSession method:
slog.Debug("[NAV] Switching session",
    "from", a.Session.ID if a.Session != nil else "nil",
    "to", sessionID,
    "currentType", a.CurrentSessionType,
    "parentID", session.ParentID)
```

**Action 2**: Initialize CurrentSessionType in app startup

```go
// In app.go New() function, after creating app:
if app.Session != nil && app.Session.ParentID != "" {
    app.CurrentSessionType = "sub"
} else {
    app.CurrentSessionType = "main"
}
```

**Observation**: Check logs to see if CurrentSessionType is being set correctly.

### Phase 2: Fix Sub-Session Dialog Filtering

**Thought 2**: The loadSubSessions fallback logic is too aggressive, always showing all sub-sessions.

**Action 3**: Modify loadSubSessions to be more selective

```go
// In subsession.go, modify loadSubSessions():
// Remove or comment out the "Strategy 3" that fetches ALL sub-sessions
// Only keep strategies 1 and 2 (direct children and siblings)
```

**Action 4**: Add debug to understand why direct children aren't found

```go
// Add after API call for direct children:
slog.Debug("[SUB-SESSION] Direct children search",
    "sessionID", currentSession.ID,
    "found", len(directChildren),
    "error", err)
```

### Phase 3: Fix Ctrl+B Navigation

**Thought 3**: Session.ParentID might not be populated correctly in the Session struct.

**Action 5**: Debug Session structure when loaded

```go
// In tui.go, add to SessionSwitchedMsg handler:
slog.Debug("[NAV] Session switched",
    "id", msg.Session.ID,
    "title", msg.Session.Title,
    "parentID", msg.Session.ParentID,
    "type", a.app.CurrentSessionType)
```

**Action 6**: Ensure ParentID is preserved during session loading

```go
// In app.go LoadSession, after finding session:
slog.Debug("[NAV] Loaded session",
    "id", session.ID,
    "parentID", session.ParentID)
```

### Phase 4: Complete Fix Implementation

**Thought 4**: Once we understand the root causes, implement targeted fixes.

**Action 7**: Fix the core issues based on observations:

1. **If CurrentSessionType not initialized**:

   - Set it when app starts based on current session
   - Update it properly in SwitchToSession

2. **If ParentID missing**:

   - Check if API returns ParentID
   - Ensure it's mapped correctly from JSON

3. **If sub-session filtering broken**:
   - Remove aggressive fallback
   - Show empty state if no relevant sub-sessions

## Step-by-Step Implementation Plan

### 1. Add Debug Logging First

```bash
# Add logging to these locations:
- app.go: SwitchToSession method (line ~550)
- app.go: LoadSession method (line ~520)
- tui.go: Ctrl+B handler (line ~260)
- tui.go: SessionSwitchedMsg handler (line ~415)
- subsession.go: loadSubSessions (line ~130)
```

### 2. Fix Navigation State Initialization

```go
// In app.go New() function, after line ~120:
// Initialize navigation state
if app.Session != nil {
    if app.Session.ParentID != "" {
        app.CurrentSessionType = "sub"
        // Also need to find and set the parent in stack
    } else {
        app.CurrentSessionType = "main"
    }
}
```

### 3. Fix Sub-Session Dialog

```go
// In subsession.go loadSubSessions():
// Comment out lines 167-199 (Strategy 3 - fetch all)
// This will show only relevant sub-sessions
```

### 4. Verify Session Structure

```go
// Check if opencode.Session has ParentID field
// If not, might need to get it from the sub-session data
```

### 5. Test Each Fix

1. Build and run with debug logging
2. Create sub-sessions
3. Check logs for CurrentSessionType values
4. Verify ParentID is populated
5. Test Ctrl+B navigation
6. Verify dialog shows only relevant sub-sessions

## Expected Outcomes

After implementing these fixes:

1. Sub-session dialog shows only children of current session
2. Ctrl+B returns to parent when in sub-session
3. Ctrl+B returns to last sub-session when in main
4. Navigation state properly tracked
5. Debug logs show clear state transitions

## Verification Steps

1. **Test basic navigation**:

   - Load a sub-session with Enter
   - Check CurrentSessionType is "sub"
   - Press Ctrl+B
   - Verify return to parent

2. **Test dialog filtering**:

   - In main session, open /sub-session
   - Should see only direct children
   - Not all sub-sessions in system

3. **Check edge cases**:
   - Start app in sub-session
   - Navigation state should initialize correctly

## Key Code Locations

- `app.go:552-555` - CurrentSessionType setting
- `tui.go:241-273` - Ctrl+B handler
- `subsession.go:124-200` - loadSubSessions logic
- `app.go:87-120` - App initialization

Focus on understanding WHY the state isn't set before making changes. The debug logging will reveal the root cause.
