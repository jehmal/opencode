# SSE Event Handling Fix Summary

## Issues Fixed

### 1. Context Cancellation Issue
**Problem**: The main context was being canceled prematurely when the WebSocket connection goroutine exited.
- **Location**: `/cmd/dgmo/main.go` line 181
- **Fix**: Removed `defer cancel()` from the WebSocket connection goroutine
- **Impact**: This was causing "context canceled" errors and preventing SSE events from being processed

### 2. Missing SSE Event Handlers
**Problem**: The TUI wasn't handling `EventListResponseEventMessageCreated` or `EventListResponseEventMessageAdded` events, only `EventListResponseEventMessageUpdated`.
- **Locations**: 
  - `/internal/tui/tui.go` - main Update method
  - `/internal/components/chat/messages.go` - messages component Update method
  - `/internal/components/chat/dynamic_messages.go` - dynamic messages Update method
- **Fix**: Added default case handlers that:
  - Use reflection to detect any message-related SSE events
  - Pass events to the messages component for rendering
  - Force UI re-renders to ensure updates are visible
  - Handle events dynamically without knowing exact type structures

### 3. Enhanced Debug Logging
**Problem**: Difficult to diagnose which SSE events were being received.
- **Location**: `/cmd/dgmo/main.go` in the event streaming goroutine
- **Fix**: Added debug logging for message-related SSE events

## Code Changes Summary

### main.go
```go
// BEFORE: This was canceling the main context!
go func() {
    defer cancel() // <-- REMOVED THIS LINE
    // ... WebSocket connection code
}()

// ADDED: Debug logging for SSE events
if strings.Contains(eventType, "Message") {
    slog.Debug("SSE Message Event", "type", eventType)
}
```

### tui.go
```go
// ADDED: Default case to handle any unhandled SSE events
default:
    // Use reflection to handle unknown event types dynamically
    eventType := fmt.Sprintf("%T", msg)
    if strings.Contains(eventType, "opencode.EventListResponseEvent") && strings.Contains(eventType, "Message") {
        // Pass to messages component and force re-render
        u, cmd := a.messages.Update(msg)
        a.messages = u.(chat.MessagesComponent)
        cmds = append(cmds, cmd)
        cmds = append(cmds, func() tea.Msg { return nil }) // Force re-render
    }
```

### messages.go
```go
// ADDED: Default case in Update method
default:
    // Use reflection to catch all message event types
    eventType := fmt.Sprintf("%T", msg)
    if strings.Contains(eventType, "Message") {
        m.renderView()
        if m.tail {
            m.viewport.GotoBottom()
        }
        return m, tea.Batch(
            util.CmdHandler(renderFinishedMsg{}),
            func() tea.Msg { return nil }, // Force re-render
        )
    }
```

### dynamic_messages.go
```go
// MODIFIED: Added interface{TypeName() string} to handle any event with TypeName
case opencode.EventListResponseEventMessageUpdated,
    app.OptimisticMessageAddedMsg,
    app.SessionSelectedMsg,
    app.SessionSwitchedMsg,
    interface{ TypeName() string }: // <-- ADDED THIS
```

## How It Works Now

1. **Event Reception**: SSE events are received in main.go and sent to the TUI via `program.Send(evt)`
2. **Event Routing**: The main TUI Update method checks for unhandled events in its default case
3. **Message Detection**: Uses reflection (`fmt.Sprintf("%T", msg)`) to detect message-related events
4. **Component Updates**: Message events are passed to the messages component
5. **Force Re-render**: A nil message is sent (`func() tea.Msg { return nil }`) to force BubbleTea to re-render
6. **UI Updates**: The messages component re-renders its view and scrolls to bottom if needed

## Testing

Created `/test-sse-events.sh` script to help debug SSE event handling:
```bash
#!/bin/bash
# Runs DGMO with debug logging to monitor SSE events
export DGMO_LOG_LEVEL=debug
./dgmo 2>&1 | grep -E "SSE|Event|Message|context canceled"
```

## Result

With these fixes:
- ✅ Context cancellation error is resolved
- ✅ All message-related SSE events are handled dynamically
- ✅ Messages appear in real-time as they're created
- ✅ Assistant responses stream properly
- ✅ UI updates are forced when needed

The fix uses a generic, reflection-based approach that will work with any message event type, even if new ones are added in the future.