# Sub-Sessions Troubleshooting Summary

## Overview
The issue is that sub-sessions created by the task tool are not showing up in the `/sub-sessions` command modal in the DGMSTT app.

## Current Architecture

### 1. Sub-Session Creation Flow
- **Task Tool** (`task.ts`) creates sub-sessions when executing agent tasks
- Sub-sessions are stored in two places:
  - Individual sub-session files: `session/sub-sessions/{sessionId}`
  - Parent index files: `session/sub-session-index/{parentSessionId}`

### 2. HTTP Endpoints (Server-side)
The server properly exposes these endpoints:
- `GET /session/:id/sub-sessions` - Get sub-sessions for a specific parent
- `GET /sub-sessions` - Get all sub-sessions
- `GET /sub-session/:id` - Get specific sub-session details
- `GET /sub-sessions/search?q=query` - Search sub-sessions

### 3. TUI Implementation
The TUI (`subsession.go`) attempts to fetch sub-sessions via:
```go
endpoint := fmt.Sprintf("/session/%s/sub-sessions", currentSession.ID)
err := s.app.Client.Get(ctx, endpoint, nil, &subSessions)
```

## Identified Issues

### 1. Storage Location Mismatch
From the trace output, we see that sub-sessions were found in:
```
/home/jehma/.local/share/opencode/User/workspaceStorage/mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode/dgmo/sessions/
```

This suggests the storage is using OpenCode's workspace storage rather than the app's designated storage location.

### 2. Session Context
The TUI might be using a different session context than where sub-sessions are being created. The task tool creates sub-sessions linked to the current session, but the TUI might be looking at a different session.

### 3. Storage Key Format
The storage keys might not match between creation and retrieval:
- Creation: `session/sub-sessions/{id}`
- Retrieval: Looking in wrong location or with wrong key format

## Solutions

### 1. Immediate Fix - Diagnostic Scripts
Run these scripts to diagnose the issue:

```bash
# 1. Run the comprehensive diagnostic
bun run diagnose-subsessions.ts

# 2. Test HTTP endpoints directly
bun run test-http-endpoints.ts

# 3. Monitor task execution in real-time
bun run trace-subsessions.ts
```

### 2. Code Fixes Needed

#### A. Update Task Tool Debug Logging
The task tool already has extensive logging. Ensure it's writing to the correct storage location.

#### B. Fix Storage Path Resolution
Ensure all components use the same storage path:
```typescript
const appInfo = App.info()
const storagePath = appInfo.path.data
```

#### C. Verify Session ID Consistency
Add logging to verify the session ID is consistent between:
- Task tool execution context
- TUI current session
- Storage keys

### 3. Testing Procedure

1. **Clear existing data** (optional):
   ```bash
   rm -rf ~/.local/share/opencode/User/workspaceStorage/*/dgmo/sessions/sub-*
   ```

2. **Start DGMO with debug logging**:
   ```bash
   DEBUG=* dgmo
   ```

3. **Create test agents**:
   ```
   Create 2 agents to test sub-session tracking
   ```

4. **Check sub-sessions**:
   ```
   /sub-sessions
   ```

5. **Run diagnostics**:
   ```bash
   bun run diagnose-subsessions.ts
   ```

## Root Cause Analysis

The most likely root cause is that the storage location for sub-sessions is not consistent between:
1. Where the task tool writes them
2. Where the SubSession module reads them
3. Where the TUI expects to find them

The OpenCode workspace storage path includes the project directory in its path, which might cause issues when the app is run from different locations.

## Recommended Fix

1. **Standardize storage location**: Ensure all components use `App.info().path.data` consistently
2. **Add storage verification**: Add checks to verify sub-sessions are being written to the expected location
3. **Improve error handling**: Add better error messages when sub-sessions can't be found
4. **Add fallback logic**: If no sub-sessions found for current session, check all sub-sessions as a fallback

## Next Steps

1. Run the diagnostic scripts to gather more information
2. Check the actual storage paths being used
3. Verify the session IDs match between task creation and TUI retrieval
4. Consider adding a storage migration if paths have changed
