# Debugging Sub-Sessions Not Appearing

## Current Situation

1. Task tool is available (no filtering)
2. Tasks execute and show output (poems appear)
3. But sub-sessions don't appear in `/sub-session` dialog
4. No debug logs from SubSession.create appear

## Diagnosis

The issue appears to be that the task tool is executing but not creating sub-sessions. This could be because:

1. **Different Task Implementation**: There might be multiple task tool implementations
2. **Error in SubSession.create**: Silent failure preventing storage
3. **Project Directory Mismatch**: Sub-sessions created in wrong directory

## Immediate Actions

### 1. Add More Logging

Add console.log at the very start of task execution to verify it's being called:

```typescript
async execute(params, ctx) {
  console.log("[TASK] Task tool executed with params:", params)
  console.log("[TASK] Context sessionID:", ctx.sessionID)
  // ... rest of code
}
```

### 2. Check for Errors

Wrap SubSession.create in try-catch:

```typescript
try {
  await SubSession.create(
    ctx.sessionID,
    subSession.id,
    `Agent ${params.description}`,
    params.prompt,
  )
  console.log("[TASK] SubSession.create succeeded")
} catch (error) {
  console.error("[TASK] SubSession.create failed:", error)
}
```

### 3. Verify Storage Path

Add logging to Storage.writeJSON to see where files are being written:

```typescript
console.log("[STORAGE] Writing to project:", state().dir)
```

## Testing Steps

1. Restart dgmo
2. Create a simple task: "Write a haiku"
3. Watch console for:
   - `[TASK] Task tool executed`
   - `[SUB-SESSION DEBUG] Creating sub-session`
   - Any error messages
4. Check `/sub-session` dialog

## Alternative Solution

If sub-sessions still don't appear, we may need to:

1. Check if there are multiple task tool implementations
2. Verify the tool registration in Provider.tools()
3. Ensure the correct task.ts is being loaded

The key is to trace the execution flow from task invocation to sub-session storage.
