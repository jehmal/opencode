# Final Sub-Sessions Fix Implementation

## Problem Summary

The issue is that the task tool is being filtered out with the message `[SESSION] Tool filtered out: task`. This prevents sub-sessions from being created in normal mode.

## Root Cause

The `parentId` field in the session might be set to an empty string `""` or the string `"undefined"` instead of being actually `undefined`. This causes `isMainSession()` to return false, which filters out the task tool.

## Solution Implemented

### 1. Fixed isSubAgentSession Logic

Updated `agent-config.ts` to properly check for all falsy values:

```typescript
export function isSubAgentSession(
  _sessionId: string,
  parentId?: string,
): boolean {
  // Sub-agent sessions have a parent session ID
  // Check for actual value, not just undefined
  // Also check for string "undefined" which might come from serialization
  return (
    parentId !== undefined &&
    parentId !== null &&
    parentId !== "" &&
    parentId !== "undefined"
  )
}
```

### 2. Enhanced Logging

Added comprehensive logging to trace the issue:

```typescript
console.log("[AGENT-CONFIG] getAllowedTools:", {
  sessionId,
  parentId,
  parentIdType: typeof parentId,
  parentIdTruthy: !!parentId,
  parentIdLength: typeof parentId === "string" ? parentId.length : "N/A",
  isMainSession: isMain,
  willGetAllTools: isMain,
})
```

### 3. Session Tool Filtering

Added logging when tools are filtered:

```typescript
if (!isAllowed) {
  console.log("[SESSION] Tool filtered out:", toolName)
  continue // Skip tools that aren't allowed
}
```

## Testing Instructions

1. **Start OpenCode**: `dgmo run`

2. **Monitor Console Output**:

   - Look for `[AGENT-CONFIG] getAllowedTools:` logs
   - Check the `parentId` value and type
   - Verify `isMainSession: true` for main sessions
   - Confirm no `[SESSION] Tool filtered out: task` message

3. **Create a Task**:

   ```
   Create 3 agents to analyze this codebase
   ```

4. **Check Sub-Sessions**:

   - Press `/sub-session` in TUI
   - Should see the 3 created agents
   - Tree view should show hierarchy

5. **Verify Storage**:
   ```bash
   # Check for new sub-session files
   find ~/.local/share/opencode/project/*/storage/session/sub-sessions/ -name "*.json" -mmin -5
   ```

## Expected Console Output

```
[SESSION] Tool filtering check: {
  sessionID: "ses_xxx",
  parentID: undefined,
  parentIDType: "undefined",
  parentIDValue: "undefined",
  isMainSession: true
}

[AGENT-CONFIG] getAllowedTools: {
  sessionId: "ses_xxx",
  parentId: undefined,
  parentIdType: "undefined",
  parentIdTruthy: false,
  parentIdLength: "N/A",
  isMainSession: true,
  willGetAllTools: true
}

[AGENT-CONFIG] Main session detected, returning ALL_TOOLS including task

[SUB-SESSION DEBUG] Creating sub-session: { ... }
[SUB-SESSION DEBUG] Writing to: session/sub-sessions/ses_yyy
[SUB-SESSION DEBUG] Sub-session created successfully
```

## Verification Checklist

- [ ] No `[SESSION] Tool filtered out: task` message
- [ ] `isMainSession: true` in logs
- [ ] Sub-sessions created successfully
- [ ] Sub-sessions appear in /sub-session dialog
- [ ] Tree view shows parent-child relationships
- [ ] Files created in correct project directory

## If Issue Persists

1. **Check Session Creation**: Verify how the main session is created. It should use `Session.create()` without any parameters.

2. **Check Session Storage**: Look at the session info file to see if parentID is stored:

   ```bash
   jq . ~/.local/share/opencode/project/*/storage/session/info/ses_*.json | grep -A2 -B2 parentID
   ```

3. **Force Fix**: If parentID is incorrectly set, you can manually update the session:
   ```typescript
   // In session creation
   if (!parentID) {
     delete result.parentID // Ensure it's undefined, not empty string
   }
   ```

## Success Criteria

The fix is successful when:

1. Task tool is available without `/agents` command
2. Sub-sessions are created and stored
3. Sub-sessions appear in the TUI dialog
4. No error messages in console
5. Consistent behavior across sessions

This implementation ensures that main sessions are properly identified and receive all tools, including the task tool, enabling sub-session creation in normal mode.
