# Sub-Sessions Fix Implementation

## The Root Cause

The issue is that the TUI's `/sub-sessions` command is looking for sub-sessions of the CURRENT session, but when you're working in a session that was created by a task tool, you're already IN a sub-session. The parent session (where the task was initiated) is what has the sub-session records.

## Current Flow:
1. User is in Session A
2. User runs task tool → creates Session B (child of A)
3. SubSession record links A → B
4. User is now in Session B
5. User runs `/sub-sessions` → looks for children of B → finds nothing

## The Fix

The TUI needs to be smarter about finding sub-sessions:

```go
func (s *subSessionDialog) loadSubSessions() tea.Msg {
    currentSession := s.app.Session
    if currentSession == nil {
        return toast.NewErrorToast("No active session")
    }

    ctx := context.Background()
    var subSessions []map[string]interface{}
    
    // First, try to get sub-sessions of current session
    endpoint := fmt.Sprintf("/session/%s/sub-sessions", currentSession.ID)
    err := s.app.Client.Get(ctx, endpoint, nil, &subSessions)
    
    // If no sub-sessions found AND current session has a parent
    if (err != nil || len(subSessions) == 0) && currentSession.ParentID != "" {
        // Try to get siblings (other sub-sessions of the parent)
        parentEndpoint := fmt.Sprintf("/session/%s/sub-sessions", currentSession.ParentID)
        err = s.app.Client.Get(ctx, parentEndpoint, nil, &subSessions)
        
        if err == nil {
            // Add a note that these are siblings
            for i := range subSessions {
                subSessions[i]["_isSibling"] = true
            }
        }
    }
    
    // If still no sub-sessions, try the global list as fallback
    if len(subSessions) == 0 {
        fallbackEndpoint := "/sub-sessions"
        err = s.app.Client.Get(ctx, fallbackEndpoint, nil, &subSessions)
    }
    
    return subSessionsLoadedMsg{
        subSessions: subSessions,
        currentID:   currentSession.ID,
    }
}
```

## Quick Workaround

Until the TUI is fixed, users can:

1. **Navigate to the parent session first:**
   ```bash
   # Find the parent session that has sub-sessions
   bun run find-main-sessions.ts
   
   # Switch to that session
   export DGMO_SESSION_ID=ses_82a087408ffenwt06rlpalARbW
   dgmo
   
   # Now /sub-sessions will show the children
   ```

2. **Use the session manager script:**
   ```bash
   bun run session-manager.ts
   ```

## Proper Fix Implementation

The TUI should show:
1. Direct sub-sessions of current session (if any)
2. Sibling sub-sessions (if current session is a child)
3. Recent sub-sessions from any parent (as fallback)

This would make the `/sub-sessions` command more intuitive and useful regardless of which session the user is currently in.
