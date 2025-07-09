# How to Build and Run DGMO with Prompting UI Changes

## Current Situation

The Go environment has issues with package imports. However, based on the vector memory, here's what you need to do:

## Option 1: Use Existing Binary (Quickest)

The existing binary at `packages/tui/dgmo` was built on Jul 7 22:34, which is AFTER our prompting UI changes were made. You can try using it:

```bash
# From the opencode directory
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode
bun run src/index.ts
```

This should show the prompting technique indicators.

## Option 2: Build in a Fresh Environment

### On Windows (Recommended):

1. Open a new Command Prompt or PowerShell
2. Navigate to the TUI directory:
   ```cmd
   cd C:\Users\jehma\Desktop\AI\DGMSTT\opencode\packages\tui
   ```
3. Build the binary:
   ```cmd
   go build -o dgmo.exe cmd/dgmo/main.go
   ```

### On WSL (if Go is working):

1. Open a new terminal
2. Navigate and build:
   ```bash
   cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui
   go build -o dgmo cmd/dgmo/main.go
   ```

## Important: How DGMO Works

According to the vector memory, DGMO must be launched through the opencode CLI, not directly:

1. The TUI binary expects to be launched via: `bun run src/index.ts` from the opencode directory
2. Running the binary directly will exit silently
3. The wrapper handles environment setup and project root detection

## What You Should See

After building (or using the existing binary) and running through opencode:

```
┌─────────────────────────────────┐
│ Prompting • CoT                 │
│   Enhanced with chain-of-thought │
└─────────────────────────────────┘

[Assistant's response text...]
```

## Verification Steps

1. Start the opencode server:

   ```bash
   cd packages/opencode
   bun run src/index.ts
   ```

2. In another terminal, run dgmo:

   ```bash
   dgmo
   ```

3. Send a message and look for the prompting technique block above the assistant's response

## Note on Current Binary

The binary dated Jul 7 22:34 likely already includes the prompting UI changes since they were implemented around that time. You might not need to rebuild at all!
