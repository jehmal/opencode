# How to Rebuild the TUI

Since there's an issue with the Go environment in the current shell, you'll need to rebuild the TUI manually.

## Option 1: Build on Windows (Recommended)

Open a Windows terminal (cmd or PowerShell) and run:

```bash
cd C:\Users\jehma\Desktop\AI\DGMSTT\opencode\packages\tui
go build -o dgmo.exe ./cmd/dgmo
```

## Option 2: Build in WSL

If the Go environment is working in a fresh WSL session:

```bash
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui
go build -o dgmo ./cmd/dgmo
```

## Option 3: Use go run directly

Instead of building, you can run directly:

```bash
cd packages/tui
go run ./cmd/dgmo
```

## What Changed

The changes are in these files:

1. `/packages/opencode/src/session/index.ts` - Encodes techniques in modelID
2. `/packages/tui/internal/components/chat/messages.go` - Adds prompting technique block
3. `/packages/tui/internal/components/chat/message.go` - New `renderPromptingTechnique` function

## Expected Result

After rebuilding and running, you should see:

```
┌─────────────────────────────────┐
│ Prompting • CoT                 │
│   Enhanced with chain-of-thought │
└─────────────────────────────────┘

[Your assistant message here...]
```

The prompting technique will appear as a styled block above the assistant's response, similar to how MCP tool calls are displayed.
