# Diagnosis Guide: /continue Command Flow

## Overview
The `/continue` command flow has been enhanced with comprehensive debug logging to trace the issue where the prompt is generated but no new session is created.

## Debug Logging Added

### 1. Command Trigger (`ContinuationPromptCommand`)
- Logs when command is triggered with session ID and timestamp
- Shows initial toast notification

### 2. Server Response (`ContinuationPromptCompletedMsg`) 
- Logs the task ID received from server
- Logs server task ID field (if any)
- Logs prompt length to confirm generation
- Stores task ID in `continuationTaskID` for matching

### 3. Task Events
- **TaskStartedMsg**: Logs all task start events with task ID and session ID
- **TaskProgressMsg**: Logs progress for continuation tasks
- **TaskCompletedMsg**: Logs ALL task completions with:
  - Task ID
  - Session ID  
  - Waiting task ID (what we're looking for)
  - Whether IDs match
  - Success status

### 4. Timeout Fallback
- After 30 seconds, if no TaskCompletedMsg received
- Creates session anyway with warning toast
- Prevents indefinite waiting

## Potential Issues to Check

### 1. Task ID Mismatch
The server might be sending a different task ID format than what the TUI expects:
- TUI generates: `continuation-{sessionID}-{timestamp}`
- Server might send: Different format or no task ID

### 2. Session Filtering
Task events might be filtered by session ID:
- If task has wrong session ID, it gets ignored
- Check if task.SessionID matches current session

### 3. WebSocket Connection
- Task events come through WebSocket
- If connection is broken, no events received
- Check connection status logs

### 4. Server Not Emitting Events
- Server might not emit TaskCompletedMsg
- Or might emit with wrong event name

## How to Debug

1. Run the debug build:
   ```bash
   ./dgmo-debug 2>&1 | tee debug.log
   ```

2. Type `/continue` and watch logs

3. Look for these patterns:
   - Is task ID consistent between response and events?
   - Are TaskStartedMsg/TaskCompletedMsg received?
   - Do session IDs match?
   - Does timeout occur?

4. Check the full debug.log for:
   ```bash
   grep "CONTINUATION DEBUG" debug.log
   ```

## Expected Flow

1. Command triggered → Toast shown
2. HTTP request sent → Response received with task ID
3. Task ID and prompt stored
4. TaskStartedMsg received (optional)
5. TaskProgressMsg received (optional)
6. TaskCompletedMsg received → IDs match
7. New session created → Prompt sent

## If Timeout Occurs

The 30-second fallback will:
1. Log timeout warning
2. Create session anyway
3. Send the prompt
4. Show warning toast

This ensures the feature works even if events are missing.