# Continuation Prompt Flow Fix Summary

## Issue
The continuation prompt flow had a race condition where:
1. `/continue` command made HTTP request to server
2. Server started generating prompt and emitted task events
3. HTTP request completed (but generation might still be running)
4. New session was created immediately
5. Task events might still be coming for the old session, appearing in the new session

## Solution
Track the continuation prompt generation task and only create the new session when we receive the `TaskCompletedMsg` for that specific task.

## Implementation Changes

### 1. Modified `appModel` struct in `tui.go`
Added two new fields:
```go
continuationTaskID   string // Track active continuation prompt task ID
continuationPrompt   string // Store the continuation prompt until task completes
```

### 2. Updated `ContinuationPromptCommand` handler
- Extract task ID from server response (if available)
- Store task ID and prompt for later use
- Don't create new session immediately
- Return `ContinuationPromptCompletedMsg` with task ID

### 3. Modified `ContinuationPromptCompletedMsg` handler
- Store the task ID and prompt in appModel
- Show progress toast instead of creating session
- Clear tracking on error

### 4. Enhanced `TaskCompletedMsg` handler
- Check if the completed task matches `continuationTaskID`
- If yes, now create the new session and send the prompt
- Clear continuation tracking after session creation
- Existing session filtering logic remains for other tasks

### 5. Server changes in `server.ts`
- Include `taskId` in the response JSON
- Updated response schema to include optional `taskId` field

## Flow Sequence

### Before (Race Condition):
```
/continue → HTTP request → Response (prompt) → Create session immediately
                        ↘ Task events → May appear in new session ❌
```

### After (Fixed):
```
/continue → HTTP request → Response (prompt + taskID) → Store and wait
                        ↘ Task events → Handled in old session ✓
                                     ↘ TaskCompleted → Create new session ✓
```

## Benefits

1. **No Race Condition**: New session is created only after task completion
2. **Clean Event Association**: Task progress events stay with the old session
3. **Better User Experience**: Clear indication of when handoff actually occurs
4. **Robust Error Handling**: Proper cleanup on failure
5. **Future Proof**: Can easily extend to show more detailed progress

## Testing

To verify the fix:
1. Start a session and have a conversation
2. Use `/continue` command
3. Observe progress toasts during generation
4. Verify new session is created only after "Task Complete" notification
5. Check that no task events appear in the new session

The fix ensures proper sequencing and prevents confusion about which session task events belong to.