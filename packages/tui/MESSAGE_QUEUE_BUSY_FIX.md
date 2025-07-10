# Message Queue "Session is Busy" Error Fix

## Problem Description

The TUI was experiencing "Session is busy" errors when processing queued messages, even though the assistant message appeared to be complete. This was causing messages to fail to send after being queued.

## Root Cause

There was a timing mismatch between:

1. **TUI's busy detection**: Uses `message.Metadata.Time.Completed > 0` to determine if the assistant is done
2. **Backend's busy state**: Uses a `pending` map that's only cleared when the entire `Session.chat()` function completes via `Symbol.dispose`

The backend's busy state is managed differently:
- When `Session.chat()` is called, it acquires a lock via `lock(sessionID)` 
- This adds the session to the `pending` map
- The session remains busy until the entire function completes and the lock is disposed
- Only then is `Session.Event.Idle` published

## Timeline of Events

1. User sends message → Backend marks session as busy
2. Assistant starts responding → Session still busy
3. Assistant finishes, `Time.Completed` is set → Session still busy
4. TUI sees `Time.Completed > 0`, tries to process queue → **ERROR: Session still busy**
5. Backend `chat()` function completes → Session finally not busy

## Solution

### 1. Increased Queue Processing Delay

Changed the delay from 100ms to 500ms to give the backend time to clear its busy state:

```go
// Before
tea.Tick(100*time.Millisecond, func(t time.Time) tea.Msg {
    return app.QueuedSendMsg{...}
})

// After  
tea.Tick(500*time.Millisecond, func(t time.Time) tea.Msg {
    return app.QueuedSendMsg{...}
})
```

### 2. Added Retry Logic with Exponential Backoff

In `SendChatMessage()`, added specific handling for busy errors:

```go
maxRetries := 3
retryDelay := 500 * time.Millisecond

for i := 0; i < maxRetries; i++ {
    _, err = a.Client.Session.Chat(ctx, ...)
    
    if err == nil {
        break // Success
    }
    
    // Check if it's a busy error
    if strings.Contains(err.Error(), "is busy") {
        if i < maxRetries-1 {
            slog.Info("Session is busy, retrying...", "attempt", i+1)
            time.Sleep(retryDelay)
            retryDelay *= 2 // Exponential backoff
            continue
        }
    }
    break
}
```

## Why This Works

1. The 500ms initial delay gives the backend time to complete cleanup in most cases
2. If the backend is still busy, the retry logic catches it and waits longer
3. Exponential backoff (500ms → 1s → 2s) handles edge cases where cleanup takes longer

## Future Improvements

1. **Listen for Session.Idle event**: The backend publishes this event when the session is truly not busy
2. **Better busy state synchronization**: Backend could set a flag when truly idle, not just when `Time.Completed` is set
3. **Configurable delays**: Make the delays configurable based on system performance

## Testing

To test this fix:

1. Send a message to the assistant
2. While the assistant is responding, type another message and press Enter
3. The message should be queued with a toast notification
4. When the assistant finishes, the queued message should be sent automatically
5. No "Session is busy" error should appear

## Related Files

- `/packages/tui/internal/tui/tui.go` - Queue processing logic
- `/packages/tui/internal/app/app.go` - SendChatMessage with retry logic
- `/packages/opencode/src/session/index.ts` - Backend busy state management