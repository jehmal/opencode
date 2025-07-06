# Task System Data Flow Review

## Overview

The task system in DGMO uses a hierarchical session architecture where sub-agents execute in isolated sub-sessions and communicate results back to the main session through multiple channels.

## Complete Data Flow Architecture

### 1. Task Initiation (Main Session → Sub-Session)

```
User Request → Main Agent → task tool invocation
                              ↓
                         SubSession.create()
                              ↓
                    Creates isolated sub-session
                              ↓
                    Emits task.started event
```

### 2. Sub-Session Execution

```
Sub-Session Agent:
  - Has its own session ID
  - Isolated context (can't see parent messages)
  - Tool access based on agentMode parameter
  - Executes the prompt independently
  - All messages stored in sub-session storage
```

### 3. Real-Time Progress Updates (WebSocket Channel)

```
Sub-Agent Activity → Bus Events → WebSocket Server (5747) → TUI Client
                         ↓
                  task.progress events
                  (tool counts, progress %)
```

### 4. Result Storage (Persistent Channel)

```
Sub-Agent Completion → SubSession.complete() → Storage
                            ↓
                    Stores in file system:
                    - session/sub-sessions/{id}.json
                    - session/sub-session-index/{parentId}.json
```

### 5. Result Return to Main Session

```
Task Tool Returns:
{
  metadata: {
    title: task description,
    summary: tool invocations
  },
  output: final text response
}
```

## Detailed Component Analysis

### A. Task Tool (`/tool/task.ts`)

- **Creates sub-session**: New isolated session with parent reference
- **Subscribes to events**: Monitors sub-session message stream
- **Calculates progress**: Based on tool invocations (25% → 90%)
- **Returns results**: Extracts final text output from sub-session

### B. Sub-Session Storage (`/session/sub-session.ts`)

- **Persistent storage**: JSON files in project storage directory
- **Parent indexing**: Maps parent sessions to their sub-sessions
- **Status tracking**: pending → running → completed/failed
- **Summary storage**: First 200 chars of output

### C. Event System (`/events/task-events.ts`)

- **Bus integration**: Pub/sub for real-time updates
- **Event types**:
  - `task.started`: Initial task creation
  - `task.progress`: Tool completion updates
  - `task.completed`: Final success state
  - `task.failed`: Error state
- **WebSocket broadcast**: Real-time to all connected clients

### D. WebSocket Architecture

```
TypeScript Side:
- TaskEventServer on port 5747
- Subscribes to Bus events
- Broadcasts to all connected clients

Go TUI Side:
- TaskClient connects to ws://localhost:5747
- Updates UI in real-time
- Shows dynamic status messages
```

### E. Result Aggregation

The main session receives sub-agent results through:

1. **Immediate Return**: Task tool returns output directly
2. **Storage Query**: Can query SubSession.getByParent()
3. **Event Stream**: Real-time updates via WebSocket
4. **UI Display**: Shows inline in chat as tool result

## Key Design Decisions

### 1. Isolation

- Sub-sessions can't access parent session data
- Clean context for each agent
- Prevents information leakage

### 2. Tool Filtering

- `agentMode` parameter controls tool access
- "read-only": Safe tools only (read, grep, glob, etc.)
- "all-tools": Full access including write/edit/bash

### 3. Progress Tracking

- Based on tool invocations, not time
- Starts at 25% when running
- Increases as tools complete
- Maxes at 90% (100% on completion)

### 4. Error Handling

- Failed tasks marked in storage
- Auto-debug agents spawn on failure
- Error messages preserved

## Data Persistence

### Storage Locations

```
~/.local/share/opencode/project/{hash}/storage/
├── session/
│   ├── sub-sessions/
│   │   ├── session_abc123.json  # Sub-session data
│   │   └── session_def456.json
│   └── sub-session-index/
│       └── session_main789.json  # Parent → children mapping
```

### Sub-Session Info Structure

```json
{
  "id": "session_abc123",
  "parentSessionId": "session_main789",
  "agentName": "Agent 1",
  "taskDescription": "Analyze codebase",
  "status": "completed",
  "createdAt": 1704067200000,
  "startedAt": 1704067201000,
  "completedAt": 1704067260000,
  "summary": "Found 15 TypeScript files..."
}
```

## Information Flow Summary

1. **Execution**: Main → Sub-session (isolated)
2. **Progress**: Sub → Main (WebSocket events)
3. **Results**: Sub → Main (return value + storage)
4. **Display**: Main shows inline + TUI shows real-time

The architecture ensures:

- Clean separation of concerns
- Real-time feedback
- Persistent results
- Error recovery
- Scalable parallel execution
