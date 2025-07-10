# Real-Time Message Rendering Fix for DGMO TUI

## Problem Statement

Messages from Claude were not appearing in real-time in the TUI. Users had to press a key or move the mouse to see new content, even though the messages were being received via SSE (Server-Sent Events).

## Root Cause Analysis

### Event Flow
1. **SSE Events arrive** → Sent to TUI via `program.Send()` in `main.go`
2. **TUI Update method** → Receives event and updates the Messages array
3. **Messages component** → Receives event and calls `renderView()`
4. **Missing step** → No trigger for BubbleTea to re-render the UI

### The Issue
The messages component was returning `util.CmdHandler(renderFinishedMsg{})`, which is handled internally by the component itself. This doesn't trigger BubbleTea to call the main `View()` method, so the screen doesn't update.

## The Solution

Return a `nil` message as part of a `tea.Batch()` command. This forces BubbleTea to re-render the entire UI.

### Before (Not Working)
```go
case opencode.EventListResponseEventMessageUpdated:
    m.renderView()
    if m.tail {
        m.viewport.GotoBottom()
    }
    // This only updates internally, doesn't trigger UI re-render
    return m, util.CmdHandler(renderFinishedMsg{})
```

### After (Working)
```go
case opencode.EventListResponseEventMessageUpdated:
    m.renderView()
    if m.tail {
        m.viewport.GotoBottom()
    }
    // Return a batch of commands to ensure UI updates
    // The nil command forces BubbleTea to re-render the entire UI
    return m, tea.Batch(
        util.CmdHandler(renderFinishedMsg{}),
        func() tea.Msg { return nil }, // Force re-render
    )
```

## Why This Works

1. **BubbleTea's Rendering Cycle**:
   - BubbleTea only re-renders when a command returns a message
   - Returning `nil` as a message is a valid way to trigger a re-render
   - The `tea.Batch()` allows us to return multiple commands

2. **The `nil` Message Trick**:
   - When BubbleTea receives any message (including `nil`), it calls `Update()`
   - After `Update()`, it always calls `View()` to re-render
   - This ensures the UI reflects the latest state

## Files Modified

1. `/packages/tui/internal/components/chat/messages.go`:
   - Updated `app.OptimisticMessageAddedMsg` handler
   - Updated `opencode.EventListResponseEventMessageUpdated` handler
   - Both now return a batch command with a nil message

## Testing

1. Build the TUI: `cd packages/tui && go build -o dgmo cmd/dgmo/main.go`
2. Run the opencode server: `cd packages/opencode && npm run dev`
3. Run the TUI: `./dgmo`
4. Send a message and observe real-time streaming

## Alternative Solutions Considered

1. **Using `tea.WindowSizeMsg`**: Would work but semantically incorrect
2. **Custom refresh message**: More complex, requires additional message types
3. **Timer-based refresh**: Inefficient, causes unnecessary re-renders
4. **Direct viewport manipulation**: Breaks component encapsulation

The chosen solution is the simplest and most idiomatic for BubbleTea applications.

## Performance Impact

Minimal - the re-render only happens when new message content arrives, exactly when we need it. The viewport component efficiently handles content updates without flickering.

## Future Improvements

Consider implementing a more sophisticated rendering pipeline that:
1. Batches multiple rapid updates
2. Uses dirty tracking to minimize re-renders
3. Implements virtual scrolling for very long conversations

But for now, this simple fix solves the immediate problem effectively.