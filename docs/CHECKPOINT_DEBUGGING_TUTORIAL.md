# DGMO Checkpoint System: Implementation and Debugging Tutorial

## Table of Contents

1. [Overview](#overview)
2. [Architecture Understanding](#architecture-understanding)
3. [Implementation Guide](#implementation-guide)
4. [Debugging Methodology](#debugging-methodology)
5. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
6. [Testing Strategies](#testing-strategies)
7. [Quick Reference](#quick-reference)

## Overview

This tutorial documents the complete implementation and debugging process for the DGMO checkpoint system, transforming our trial-and-error experience into a systematic guide for future feature implementations.

### What We Built

A checkpoint system that:

- Automatically saves session state after each assistant response
- Allows users to revert to previous states via `/revert` command
- Integrates TypeScript server with Go TUI client
- Uses file-based storage with optional Git integration

### Key Learning

The most critical lesson: **In Bubble Tea applications, dialog Init() methods must be explicitly called to execute initial commands.**

## Architecture Understanding

### System Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Go TUI Client │────▶│ TypeScript Server│────▶│  File Storage   │
│   (Bubble Tea)  │     │  (Bun + Hono)   │     │ (~/.local/...)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                         │
        ▼                        ▼                         ▼
   /revert command         HTTP endpoints            Checkpoint files
   Dialog system          Port: dynamic              JSON format
   CheckpointService      /session/{id}/...         Git integration
```

### File Structure

```
packages/
├── opencode/src/
│   ├── checkpoint/
│   │   └── checkpoint-manager.ts    # Core checkpoint logic
│   ├── server/
│   │   └── server.ts               # HTTP endpoints
│   └── session/
│       └── index.ts                # Auto-checkpoint trigger
└── tui/
    ├── cmd/dgmo/main.go           # Entry point
    ├── internal/app/
    │   ├── app.go                 # App initialization
    │   └── checkpoint_client.go   # HTTP client
    └── internal/components/dialog/
        └── revert.go              # Revert dialog UI
```

## Implementation Guide

### Step 1: Server-Side Implementation

#### 1.1 Create Checkpoint Manager (TypeScript)

```typescript
// packages/opencode/src/checkpoint/checkpoint-manager.ts
export namespace CheckpointManager {
  export async function createCheckpoint(
    sessionId: string,
    messageId: string,
    description?: string,
  ): Promise<CheckpointInfo> {
    // 1. Get session messages up to this point
    const messages = await Session.messages(sessionId)

    // 2. Create checkpoint info
    const checkpoint: CheckpointInfo = {
      id: Identifier.ascending("checkpoint"),
      sessionId,
      messageId,
      timestamp: Date.now(),
      description,
      // ... other fields
    }

    // 3. Store checkpoint
    await Storage.writeJSON(`checkpoint/${checkpoint.id}`, checkpoint)

    // 4. Link to session
    await Storage.writeJSON(
      `session/checkpoint/${sessionId}/${checkpoint.id}`,
      { checkpointId: checkpoint.id, messageId, timestamp },
    )

    return checkpoint
  }

  export async function listCheckpoints(
    sessionId: string,
  ): Promise<CheckpointInfo[]> {
    const checkpoints: CheckpointInfo[] = []

    // Read all checkpoint references for session
    for await (const file of Storage.list(`session/checkpoint/${sessionId}`)) {
      const ref = await Storage.readJSON<{ checkpointId: string }>(file)
      const checkpoint = await Storage.readJSON<CheckpointInfo>(
        `checkpoint/${ref.checkpointId}`,
      )
      checkpoints.push(checkpoint)
    }

    return checkpoints.sort((a, b) => b.timestamp - a.timestamp)
  }
}
```

#### 1.2 Add Auto-Checkpoint Trigger

```typescript
// packages/opencode/src/session/index.ts
// In the message completion handler
if (next.role === "assistant" && !session.parentID) {
  try {
    const { CheckpointManager } = await import(
      "../checkpoint/checkpoint-manager"
    )
    await CheckpointManager.createCheckpoint(
      input.sessionID,
      next.id,
      description,
    )
    log.info("Auto-checkpoint created")
  } catch (error) {
    log.error("Failed to create checkpoint", { error })
  }
}
```

#### 1.3 Create HTTP Endpoints

```typescript
// packages/opencode/src/server/server.ts
.get(
  "/session/:id/checkpoints",
  async (c) => {
    const sessionId = c.req.param("id")
    try {
      const checkpoints = await CheckpointManager.listCheckpoints(sessionId)
      return c.json(checkpoints)
    } catch (error) {
      log.error("Failed to list checkpoints", { error })
      return c.json([])
    }
  }
)
```

### Step 2: Client-Side Implementation

#### 2.1 Create Checkpoint Service (Go)

```go
// packages/tui/internal/app/checkpoint_client.go
type CheckpointService struct {
    baseURL string  // IMPORTANT: Use baseURL, not hardcoded port
}

func NewCheckpointService(baseURL string) *CheckpointService {
    return &CheckpointService{baseURL: baseURL}
}

func (s *CheckpointService) ListCheckpoints(
    ctx context.Context,
    sessionID string
) ([]Checkpoint, error) {
    url := fmt.Sprintf("%s/session/%s/checkpoints", s.baseURL, sessionID)

    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }

    // Make request and decode response
    // ...
}
```

#### 2.2 Pass Configuration Through Component Chain

```go
// packages/tui/cmd/dgmo/main.go
url := os.Getenv("DGMO_SERVER")
app_, err := app.New(ctx, version, appInfo, httpClient, url)

// packages/tui/internal/app/app.go
func New(
    ctx context.Context,
    version string,
    appInfo opencode.App,
    httpClient *opencode.Client,
    baseURL string,  // Add this parameter
) (*App, error) {
    // ...
    app := &App{
        // ...
        CheckpointService: NewCheckpointService(baseURL),
    }
}
```

#### 2.3 Create Revert Dialog (CRITICAL PART)

```go
// packages/tui/internal/components/dialog/revert.go
type revertDialog struct {
    app      *app.App
    list     list.List[checkpointItem]
    loading  bool
    // ...
}

func (d *revertDialog) Init() tea.Cmd {
    return d.loadCheckpoints()  // Returns the command to load data
}

func (d *revertDialog) loadCheckpoints() tea.Cmd {
    return func() tea.Msg {
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()

        checkpoints, err := d.app.CheckpointService.ListCheckpoints(
            ctx,
            d.app.Session.ID
        )
        if err != nil {
            return checkpointLoadErrorMsg{err: err}
        }

        return checkpointLoadedMsg{checkpoints: checkpoints}
    }
}

// Handle the loaded data in Update
func (d *revertDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case checkpointLoadedMsg:
        d.loading = false
        d.checkpoints = msg.checkpoints
        // Update list items
        // ...
    }
}
```

#### 2.4 Initialize Dialog Correctly (THE CRITICAL FIX)

```go
// packages/tui/internal/tui/tui.go
// When handling the /revert command
revertDialog := dialog.NewRevertDialog(a.app)
a.modal = revertDialog
cmds = append(cmds, revertDialog.Init())  // THIS IS CRITICAL!
```

## Debugging Methodology

### 1. Systematic Verification Approach

When implementing a feature that doesn't work as expected, follow this systematic approach:

#### Level 1: Verify Data Layer

```bash
# Check if data exists in storage
ls ~/.local/share/dgmo/project/unified/storage/checkpoint/
ls ~/.local/share/dgmo/project/unified/storage/session/checkpoint/{SESSION_ID}/

# Count checkpoints for a session
ls ~/.local/share/dgmo/project/unified/storage/session/checkpoint/{SESSION_ID}/ | wc -l
```

#### Level 2: Test Server Endpoints

```bash
# Find server port
ps aux | grep dgmo
cat /proc/{PID}/environ | tr '\0' '\n' | grep DGMO_SERVER

# Test endpoint directly
wget -qO- "http://127.0.0.1:{PORT}/session/{SESSION_ID}/checkpoints" | jq length
```

#### Level 3: Add Debug Logging

```go
// File-based logging for TUI (stderr often not visible)
func addDebugLog(message string, data map[string]interface{}) {
    debugFile, _ := os.OpenFile("/tmp/debug.log",
        os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
    if debugFile != nil {
        defer debugFile.Close()
        fmt.Fprintf(debugFile, "[%s] %s\n",
            time.Now().Format(time.RFC3339), message)
        for k, v := range data {
            fmt.Fprintf(debugFile, "  %s: %v\n", k, v)
        }
    }
}
```

### 2. Common Debug Points

Add logging at these critical points:

1. Dialog creation (`NewRevertDialog`)
2. Dialog initialization (`Init()`)
3. Command execution (`loadCheckpoints()`)
4. HTTP request creation
5. Response handling
6. Message processing in `Update()`

### 3. Debug Checklist

- [ ] Is the data actually stored? (Check filesystem)
- [ ] Does the server endpoint work? (Test with curl/wget)
- [ ] Is the dialog's Init() being called? (Check for command execution)
- [ ] Is the correct server URL being used? (Check environment variables)
- [ ] Are there multiple server instances? (Check processes)
- [ ] Is the response being decoded correctly? (Log response size/content)

## Common Pitfalls and Solutions

### Pitfall 1: Dialog Shows "Loading..." Forever

**Symptom**: Dialog opens but never loads data

**Cause**: Init() method not called

**Solution**:

```go
// WRONG
dialog := NewMyDialog(params)
a.modal = dialog

// CORRECT
dialog := NewMyDialog(params)
a.modal = dialog
cmds = append(cmds, dialog.Init())  // Execute initial command
```

### Pitfall 2: Hardcoded Ports

**Symptom**: Works in development, fails in production

**Cause**: Server port changes between runs

**Solution**:

```go
// WRONG
url := fmt.Sprintf("http://localhost:5747/...")

// CORRECT
url := fmt.Sprintf("%s/...", s.baseURL)
// Where baseURL comes from DGMO_SERVER environment variable
```

### Pitfall 3: Multiple Server Instances

**Symptom**: Data appears and disappears

**Cause**: Multiple terminals spawn multiple servers

**Solution**:

```bash
# Check for multiple servers
ps aux | grep "bun.*serve"
lsof -i -P -n | grep LISTEN | grep bun

# Kill extra servers
kill {PID}
```

### Pitfall 4: Silent Failures

**Symptom**: No error messages but feature doesn't work

**Cause**: TUI hides stderr output

**Solution**: Use file-based logging

```go
// At start of each major function
debugLog("/tmp/component_debug.log", "Function called", map[string]interface{}{
    "sessionID": sessionID,
    "timestamp": time.Now(),
})
```

## Testing Strategies

### 1. Unit Testing the Checkpoint Service

```go
func TestCheckpointService_ListCheckpoints(t *testing.T) {
    // Mock HTTP server
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Return test data
        json.NewEncoder(w).Encode([]Checkpoint{
            {ID: "test1", Description: "Test checkpoint"},
        })
    }))
    defer server.Close()

    service := NewCheckpointService(server.URL)
    checkpoints, err := service.ListCheckpoints(context.Background(), "test-session")

    assert.NoError(t, err)
    assert.Len(t, checkpoints, 1)
}
```

### 2. Integration Testing

```bash
#!/bin/bash
# test_checkpoints.sh

SESSION_ID="ses_8130a7908ffeinHyRDvELThrEK"
SERVER_URL="http://127.0.0.1:45721"

echo "Testing checkpoint system..."

# 1. Create checkpoint via API
curl -X POST "$SERVER_URL/session/$SESSION_ID/checkpoint" \
  -H "Content-Type: application/json" \
  -d '{"description": "Test checkpoint"}'

# 2. List checkpoints
CHECKPOINTS=$(curl -s "$SERVER_URL/session/$SESSION_ID/checkpoints")
COUNT=$(echo "$CHECKPOINTS" | jq length)

echo "Found $COUNT checkpoints"

# 3. Verify in storage
STORAGE_COUNT=$(ls ~/.local/share/dgmo/project/unified/storage/session/checkpoint/$SESSION_ID/ | wc -l)
echo "Storage has $STORAGE_COUNT checkpoint files"

if [ "$COUNT" -eq "$STORAGE_COUNT" ]; then
    echo "✓ Checkpoint system working correctly"
else
    echo "✗ Mismatch between API and storage"
fi
```

### 3. Manual Testing Checklist

- [ ] Start fresh dgmo session
- [ ] Make some file changes
- [ ] Check `/revert` shows checkpoints
- [ ] Select a checkpoint and verify revert works
- [ ] Restart dgmo and verify checkpoints persist
- [ ] Test with multiple sessions

## Quick Reference

### Essential Commands

```bash
# Find dgmo server port
cat /proc/$(pgrep -n dgmo)/environ | tr '\0' '\n' | grep DGMO_SERVER

# Test checkpoint endpoint
wget -qO- "http://127.0.0.1:{PORT}/session/{SESSION_ID}/checkpoints" | jq

# Watch debug logs
tail -f /tmp/*debug*.log

# Count checkpoints for session
ls ~/.local/share/dgmo/project/unified/storage/session/checkpoint/{SESSION_ID}/ | wc -l
```

### Key File Locations

- **Storage**: `~/.local/share/dgmo/project/unified/storage/`
- **Checkpoints**: `storage/checkpoint/chk_*.json`
- **Session Links**: `storage/session/checkpoint/{sessionId}/`
- **Debug Logs**: `/tmp/*debug*.log`

### Architecture Decisions

1. **File-based storage**: Simple, reliable, no external dependencies
2. **Dynamic ports**: Allows multiple instances, requires baseURL passing
3. **Auto-checkpoints**: After each assistant response for safety
4. **Bubble Tea dialogs**: Require explicit Init() call for commands

### Debugging Flowchart

```
Problem: Feature not working
    │
    ├─▶ Data exists in storage?
    │   ├─ No ─▶ Check creation logic
    │   └─ Yes ─▶ Continue
    │
    ├─▶ Server endpoint works?
    │   ├─ No ─▶ Check server logs, port
    │   └─ Yes ─▶ Continue
    │
    ├─▶ Client making request?
    │   ├─ No ─▶ Check Init() called
    │   └─ Yes ─▶ Continue
    │
    └─▶ Response processed?
        ├─ No ─▶ Check Update() handler
        └─ Yes ─▶ Check UI rendering
```

## Conclusion

The checkpoint system implementation taught us valuable lessons about:

1. The importance of understanding framework patterns (Bubble Tea's Init)
2. The value of systematic debugging approaches
3. The need for file-based logging in TUI applications
4. The complexity of distributed system debugging

By following this guide, future implementations can avoid the trial-and-error process we went through and implement similar features correctly the first time.

Remember: **Always call Init() on Bubble Tea dialogs that need to load data!**
