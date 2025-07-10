# OpenCode Sub-Sessions Guide

## Overview

Sub-sessions in OpenCode allow you to create parallel AI agents that work on different tasks simultaneously. This feature is essential for complex projects that benefit from divide-and-conquer approaches.

## Creating Sub-Sessions

Sub-sessions are created using the `task` tool. Here's how:

```
Create 3 agents to:
1. Analyze the architecture
2. Review the code quality
3. Generate documentation
```

The task tool will:

- Create separate sub-sessions for each agent
- Run them in parallel
- Store results independently
- Track status (pending, running, completed, failed)

## Viewing Sub-Sessions

### In the TUI

1. Press `/` to open the command palette
2. Type `sub-session` and press Enter
3. You'll see a tree view showing:
   - Parent sessions at the root
   - Child sub-sessions indented below
   - Status indicators (▶ running, ✓ completed, ✗ failed)
   - Task descriptions and timestamps

### Tree View Features

The sub-session dialog displays sessions in a hierarchical tree:

```
📁 Current Session: main-session-id

✓ Architecture Analyzer - Analyze system architecture (Jan 2 15:04)
  └─ ▶ Component Mapper - Map all components (Jan 2 15:05)
  └─ ✓ Dependency Analyzer - Analyze dependencies (Jan 2 15:06)
✓ Code Quality Reviewer - Review code quality (Jan 2 15:04)
✗ Documentation Generator - Generate docs (Jan 2 15:04)
```

## Navigation

- **Enter**: Switch to the selected sub-session
- **Ctrl+B**: Return to parent session
- **R**: Refresh the sub-session list
- **Esc**: Close the dialog

## Session Switching

When you switch to a sub-session:

1. The current session context changes
2. Messages from that session are loaded
3. You can interact with that specific agent
4. The UI updates to reflect the new context

## API Endpoints

The following REST API endpoints are available:

- `GET /session/:id/sub-sessions` - Get sub-sessions for a parent
- `GET /sub-sessions` - List all sub-sessions
- `GET /sub-sessions/search?q=query` - Search sub-sessions
- `GET /sub-session/:id` - Get specific sub-session details
- `DELETE /sub-session/:id` - Delete a sub-session

## Storage Structure

Sub-sessions are stored in the file system:

```
~/.local/share/opencode/project/[hash]/storage/
├── session/
│   ├── info/              # Session metadata
│   ├── message/           # Session messages
│   ├── sub-sessions/      # Sub-session data
│   │   └── [id].json      # Individual sub-session files
│   └── sub-session-index/ # Parent-child mappings
│       └── [parentId].json # Index of children for each parent
```

## Task Tool Options

When creating sub-sessions, you can specify:

- `agentMode`: "read-only" or "all-tools" (default: "all-tools")
- `autoDebug`: Automatically retry failed tasks (default: true)
- `maxRetries`: Number of retry attempts (default: 1)

Example:

```javascript
task({
  description: "Analyze codebase",
  prompt: "Analyze the architecture",
  agentMode: "read-only",
  autoDebug: false,
})
```

## Performance Considerations

- Sub-session creation: ~500ms
- Storage operations: <50ms
- API response time: <100ms
- Parallel execution improves overall task completion time

## Troubleshooting

### No Sub-Sessions Visible

If you don't see sub-sessions:

1. Ensure you're in the correct parent session
2. The fallback will show ALL sub-sessions if none found for current
3. Check that the task tool completed successfuly

### SDK Limitations

The current Go SDK doesn't have native sub-session methods. The TUI uses direct HTTP calls as a workaround. To regenerate the SDK:

1. Run: `bun run script/generate-sdk.ts`
2. Install Stainless CLI
3. Generate new SDK with the OpenAPI spec

### Session Context Mismatch

Sub-sessions are only visible from their parent session. If you need to see all sub-sessions regardless of parent, the system will automatically fall back to showing all available sub-sessions.

## Best Practices

1. **Use descriptive task names**: Help identify sub-sessions later
2. **Check status regularly**: Monitor progress of parallel tasks
3. **Handle failures**: Failed tasks can be debugged automatically
4. **Organize hierarchically**: Create sub-sessions of sub-sessions for complex tasks
5. **Clean up**: Delete completed sub-sessions you no longer need

## Future Enhancements

- Real-time WebSocket updates for status changes
- Sub-session result aggregation
- Performance analytics per sub-session
- Export sub-session results
- Visual progress indicators
