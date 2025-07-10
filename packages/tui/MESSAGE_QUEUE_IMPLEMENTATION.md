# Message Queue Implementation

## Overview

The TUI chat now includes a message queueing system that automatically queues messages when the assistant is busy processing a previous message. This eliminates the "assistant is still busy" error and provides a better user experience.

## How It Works

1. **Automatic Queuing**: When you send a message while the assistant is busy, it's automatically added to a queue
2. **Visual Feedback**: The editor shows the queue count (e.g., "2 queued") in the hint line
3. **Auto-Processing**: As soon as the assistant finishes the current message, the next queued message is automatically sent
4. **Toast Notifications**: You receive notifications when messages are queued and when they're being processed

## Implementation Details

### Components Modified

1. **appModel struct** (`internal/tui/tui.go`):
   - Added `messageQueue []app.SendMsg` to store queued messages
   - Added `queueMutex sync.Mutex` for thread-safe access

2. **SendMsg handling** (`internal/tui/tui.go`):
   - Checks if assistant is busy using `app.IsBusy()`
   - Queues message if busy, sends immediately if not

3. **Message completion handling** (`internal/tui/tui.go`):
   - After each message update, checks if assistant is no longer busy
   - Automatically sends the next queued message if available

4. **Editor component** (`internal/components/chat/editor.go`):
   - Added `queueCount` field and `SetQueueCount()` method
   - Shows queue count in hint line: "enter send | 2 queued"

5. **Session switching**:
   - Queue is cleared when switching between sessions to prevent confusion

## User Experience

- **No more errors**: Messages are queued instead of rejected
- **Clear feedback**: You always know how many messages are waiting
- **Automatic processing**: No manual intervention needed
- **Session isolation**: Queue is cleared when switching sessions

## Technical Benefits

- Thread-safe implementation using mutex
- No blocking of UI thread
- Minimal performance impact
- Clean integration with existing codebase