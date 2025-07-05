# Sub-Sessions Mode Explanation

## The Real Issue: Agent Mode Defaults to "read-only"

Your debug output shows the actual issue:

```
isMainSession: false,
willGetAllTools: false,
[AGENT-CONFIG] Session mode: read-only
[AGENT-CONFIG] Returning tools: 5 tools, includes task: false
```

## Why This Happens

1. **Sub-sessions are created with `read-only` mode by default** (line 49 in task.ts)
2. **Read-only mode doesn't include the task tool** to prevent infinite recursion
3. **Main sessions get all tools**, but sub-sessions don't

## How to Create Sub-Sessions with Task Tool Access

### Option 1: Specify agent mode when creating tasks

Instead of:

```
Create 3 agents to test something
```

Use:

```
Create 3 agents to test something with agentMode: all-tools
```

### Option 2: Modify the default

Change line 49 in `/packages/opencode/src/tool/task.ts`:

```typescript
// From:
const mode = params.agentMode || "read-only"

// To:
const mode = params.agentMode || "all-tools"
```

## Design Rationale

The system defaults to `read-only` for sub-sessions to:

- Prevent infinite agent creation loops
- Limit sub-agent capabilities for safety
- Follow the principle of least privilege

If you want sub-agents to create their own sub-agents, you must explicitly grant them `all-tools` mode.

## Testing

To test sub-sessions appearing in the dialog:

1. Create a task with the current default (read-only mode)
2. The sub-session will appear in `/sub-session` dialog
3. It just won't be able to create its own sub-sessions unless given all-tools mode

The sub-sessions display is working correctly - the debug output proves it!
