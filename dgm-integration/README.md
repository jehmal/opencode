# DGM Integration Module

This module provides a lightweight bridge between OpenCode and DGM (Diagnostic Generative Model) for self-improving AI tools.

## Overview

The DGM Integration module consists of three main components:

1. **DGM Bridge** - Handles TypeScript to Python communication
2. **Performance Tracker** - Tracks tool execution metrics
3. **Tool Sync** - Manages tool improvements and deployments

## Architecture

```
OpenCode (TypeScript)
    ↓
DGM Integration Layer
    ├── Performance Tracking
    ├── JSON-RPC Bridge
    └── Tool Synchronization
    ↓
DGM Agent (Python)
```

## Key Features

- **Minimal Dependencies**: No RabbitMQ, Redis, or complex infrastructure required
- **Simple Communication**: Uses JSON-RPC over stdin/stdout
- **Performance Tracking**: Monitors tool success rates and execution times
- **Evolution Engine**: Analyzes usage patterns to suggest improvements
- **Safe Deployment**: Manual approval workflow for improvements

## Installation

```bash
# Install TypeScript dependencies
npm install

# Install Python dependencies (in DGM environment)
cd python
pip install -r requirements.txt
```

## Usage

```typescript
import { DGMBridge, PerformanceTracker, ToolSync } from '@opencode/dgm-integration';

// Configure
const config = {
  enabled: true,
  pythonPath: './dgm/venv/bin/python',
  agentPath: './dgm/coding_agent.py',
  evolutionSchedule: 'weekly',
  trackingLevel: 'standard',
  autoApprove: false
};

// Initialize
const bridge = new DGMBridge(config);
const tracker = new PerformanceTracker();
const toolSync = new ToolSync();

// Track tool execution
await tracker.track({
  toolName: 'bash',
  executionTime: 1.23,
  success: true,
  timestamp: new Date(),
  sessionId: 'session-123'
});

// Get patterns and evolve
const patterns = await tracker.getUsagePatterns();
const improvements = await bridge.evolve(patterns);

// Save for review
for (const improvement of improvements) {
  await toolSync.saveExperimentalImprovement(improvement);
}
```

## Components Extracted

### From `/protocol/`
- Basic JSON-RPC communication protocol
- Simplified type definitions
- Error handling patterns

### From `/dgm/`
- `coding_agent.py` - Core agent logic (referenced, not copied)
- `llm_withtools.py` - LLM integration (referenced, not copied)
- Tool interfaces from `tools/`

### From `/shared/types/`
- Simplified type definitions
- Cross-language type conversion utilities

### Simplifications Made

1. **Removed Complex Dependencies**:
   - No RabbitMQ message queuing
   - No Redis caching
   - No complex event systems
   - No orchestration layers

2. **Simplified Communication**:
   - Direct subprocess communication
   - JSON-RPC over stdin/stdout
   - Synchronous request/response pattern

3. **Streamlined Types**:
   - Only essential type definitions
   - Removed unnecessary abstractions
   - Focused on tool execution needs

4. **Direct Integration**:
   - No intermediate services
   - Direct Python subprocess spawning
   - Simple file-based storage

## Integration Points

### OpenCode Side
```typescript
// In OpenCode tool execution
import { PerformanceTracker } from '@opencode/dgm-integration';

const tracker = new PerformanceTracker();

// After tool execution
await tracker.track({
  toolName: tool.name,
  executionTime: endTime - startTime,
  success: !error,
  errorType: error?.type,
  timestamp: new Date(),
  sessionId: session.id
});
```

### Evolution Workflow
1. Performance data collected automatically
2. Run evolution manually or on schedule
3. Review suggested improvements
4. Test improvements in experimental environment
5. Approve and deploy successful improvements

## File Structure

```
dgm-integration/
├── src/
│   ├── index.ts          # Main exports
│   ├── types.ts          # Type definitions
│   ├── dgm-bridge.ts     # Python bridge
│   ├── performance.ts    # Metrics tracking
│   └── tool-sync.ts      # Tool management
├── python/
│   ├── bridge.py         # Python server
│   ├── adapter.py        # DGM adapter
│   └── tool_wrapper.py   # Simplified tools
├── examples/
│   └── basic-usage.ts    # Usage example
├── package.json
├── tsconfig.json
└── README.md
```

## Future Enhancements

1. **Automatic Testing**: Sandbox environment for testing improvements
2. **Rollback Support**: Automatic rollback on performance degradation
3. **Multi-version Support**: A/B testing of tool versions
4. **User Feedback**: Incorporate user satisfaction metrics
5. **Advanced Analytics**: More sophisticated pattern analysis