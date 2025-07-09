# DGM Integration Package

This package provides the integration layer between DGMO (OpenCode) and DGM (Dynamic Graph Memory) through a TypeScript-Python bridge for Phase 1 integration.

## Features

- **JSON-RPC Communication**: Full JSON-RPC 2.0 client implementation with @open-rpc/client
- **Type Safety**: Zod schemas for runtime validation and type inference
- **Process Management**: Automatic Python subprocess lifecycle management
- **Error Handling**: Comprehensive error handling with configurable retries
- **Performance Tracking**: Built-in metrics and performance monitoring
- **Tool Synchronization**: Sync tool definitions between OpenCode and DGM
- **TypeScript Support**: Full TypeScript support with strict mode enabled

## Architecture

```
OpenCode (TypeScript)
    ↓
dgm-bridge.ts (subprocess management)
    ↓ JSON-RPC
bridge.py (Python receiver)
    ↓
adapter.py (DGM simplification layer)
    ↓
DGM Core
```

## Usage

```typescript
import { DGMBridge } from "@opencode/dgm-integration"
import { PerformanceTracker } from "@opencode/dgm-integration/performance"

// Initialize bridge
const bridge = new DGMBridge()
await bridge.initialize()

// Track performance
const tracker = new PerformanceTracker()
const metric = tracker.startOperation("memory-search")

// Use DGM
const result = await bridge.searchMemory("TypeScript performance tips")
metric.end()

// Get performance report
const report = tracker.getReport()
```

## Python Requirements

The Python side requires:

- Python 3.8+
- Dependencies listed in `python/requirements.txt`

Install with:

```bash
pip install -r python/requirements.txt
```

## Development

```bash
# Run TypeScript tests
bun test

# Type checking
bun run typecheck

# Development mode
bun run dev
```
