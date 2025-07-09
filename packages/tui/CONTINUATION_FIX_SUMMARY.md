# Continuation Prompt Race Condition Fix

## Problem
The `/continue` command was experiencing a race condition where the `TaskCompletedMsg` WebSocket event would arrive before the TUI had set the `continuationTaskID`, causing the event to be ignored and the timeout recovery mechanism to kick in after 30 seconds.

## Root Cause
1. Server emits task events (`task.started`, `task.progress`, `task.completed`) immediately when processing the continuation prompt request
2. TUI only sets `continuationTaskID` AFTER receiving and processing the HTTP response
3. If the `TaskCompletedMsg` arrives via WebSocket before the HTTP response is processed, it's ignored because `continuationTaskID` is still empty

## Solution
Added a pending event storage mechanism:

1. **Early Event Detection**: When a `TaskCompletedMsg` arrives for a continuation task (identified by `continuation-` prefix) but `continuationTaskID` is empty, store it in `pendingContinuationCompletion`

2. **Deferred Processing**: When the HTTP response arrives and sets `continuationTaskID`, check if there's a pending completion event that matches. If so, process it immediately.

3. **Cleanup**: Clear the pending event storage when processing completes or on timeout

## Code Changes

### 1. Added pending storage field to appModel struct:
```go
pendingContinuationCompletion *app.TaskCompletedMsg // Store early-arriving continuation task completion
```

### 2. Modified TaskCompletedMsg handler to store early events:
```go
// Check if this is a continuation task but we don't have the ID yet
if strings.HasPrefix(msg.TaskID, "continuation-") && a.continuationTaskID == "" {
    // Store this event for later processing
    msgCopy := msg // Make a copy
    a.pendingContinuationCompletion = &msgCopy
    return a, nil
}
```

### 3. Modified ContinuationPromptCompletedMsg handler to check for pending events:
```go
// Check if we already received the task completion event
if a.pendingContinuationCompletion != nil && a.pendingContinuationCompletion.TaskID == msg.TaskID {
    // Process the pending completion immediately
    pendingMsg := *a.pendingContinuationCompletion
    a.pendingContinuationCompletion = nil
    
    // Trigger the completion handling by sending the message again
    cmds = append(cmds, func() tea.Msg { return pendingMsg })
}
```

### 4. Added debug logging in task_client.go:
```go
// DEBUG: Log all incoming events
slog.Debug("[TASK_CLIENT] Received event", 
    "type", event.Type,
    "dataLength", len(event.Data))

// DEBUG: Log task.completed details
slog.Info("[TASK_CLIENT] task.completed event", 
    "taskID", data.TaskID,
    "sessionID", data.SessionID,
    "isContinuation", strings.HasPrefix(data.TaskID, "continuation-"),
    "success", data.Success,
    "duration", data.Duration)
```

## Testing
Created test scripts to verify the fix:
- `test-continue-events.js` - WebSocket event monitor
- `test-continuation-api.sh` - API endpoint tester
- `test-race-condition.sh` - Race condition verification

## Result
The race condition is now handled gracefully. Continuation task completion events that arrive before the HTTP response are stored and processed once the task ID is known, eliminating the need for timeout recovery in most cases.