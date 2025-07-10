# Improved Session Busy Error Fix

## Problem Analysis

The "Session is busy" error occurs due to a timing mismatch between:

1. **Frontend Detection**: TUI checks `message.Metadata.Time.Completed > 0` to determine if the assistant is done
2. **Backend State**: Backend maintains a `pending` map that's only cleared after the entire `Session.chat()` function completes

### Root Cause Timeline

1. User sends message → Backend marks session as busy (adds to `pending` map)
2. Assistant starts responding → Session remains busy
3. Assistant finishes, `Time.Completed` is set → Session STILL busy
4. TUI sees completion, tries to process queue → **ERROR: Session is busy**
5. Backend finishes cleanup, publishes `Session.Event.Idle` → Session finally idle

## Solution Implementation

### 1. Activity-Based Waiting

Instead of relying on a fixed delay after `Time.Completed`, we now track message update activity:

```go
// Track when we last received ANY message update
a.sessionActivityMutex.Lock()
a.lastMessageUpdateTime = time.Now()
a.sessionActivityMutex.Unlock()
```

### 2. Smart Queue Processing

The `createQueueProcessCommand` method waits for a "quiet period" where no message updates are received:

```go
const quietPeriod = 800 * time.Millisecond
const maxWaitTime = 5 * time.Second

// Wait for session activity to stop
for {
    timeSinceLastUpdate := time.Since(a.lastMessageUpdateTime)
    
    if timeSinceLastUpdate >= quietPeriod {
        // Session is likely idle now
        break
    }
    
    if time.Since(startTime) >= maxWaitTime {
        // Safety: don't wait forever
        break
    }
    
    time.Sleep(100 * time.Millisecond)
}
```

### 3. Enhanced Retry Logic

Increased retry attempts and delays in `SendChatMessage`:

- Retries: 3 → 5 attempts
- Initial delay: 500ms → 1000ms
- Backoff multiplier: 2x → 1.5x (gentler progression)

## Why This Works Better

1. **Activity-Based**: Waits for actual backend activity to cease, not just a timestamp
2. **Dynamic Timing**: Adapts to different response lengths and processing times
3. **Failsafe Mechanisms**: Maximum wait time prevents infinite waiting
4. **Better Retry Strategy**: More attempts with gentler backoff for edge cases

## Testing Scenarios

1. **Basic Queue Test**:
   - Send a message
   - While assistant is typing, send another message
   - Second message should queue and send automatically after quiet period

2. **Rapid Fire Test**:
   - Queue multiple messages quickly
   - All should process sequentially without errors

3. **Long Response Test**:
   - Send a message that generates a very long response
   - Queue another message during the response
   - Should wait for all updates to finish before processing

## Configuration

Key timing parameters (can be adjusted if needed):

- `quietPeriod`: 800ms - How long to wait after last update
- `maxWaitTime`: 5s - Maximum time to wait before forcing send
- `checkInterval`: 100ms - How often to check activity status

## Benefits Over Previous Solution

1. **More Reliable**: Doesn't depend on guessing backend timing
2. **Adaptive**: Works with responses of any length
3. **Debuggable**: Logs help understand what's happening
4. **Graceful Degradation**: Falls back to sending after max wait time

## Future Improvements

If the backend adds a proper `session.idle` event to the SSE stream, we could:

1. Listen for this event directly
2. Remove the activity tracking logic
3. Process queue immediately on idle event

This would be the ideal solution but requires backend changes.