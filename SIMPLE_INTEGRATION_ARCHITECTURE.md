# Simple OpenCode + DGM Integration Architecture

## Goal
Create a self-improving OpenCode CLI that uses DGM's evolutionary algorithms to enhance its coding capabilities over time based on real usage patterns.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenCode CLI (User Interface)            │
│  - Command input/output                                      │
│  - Tool execution                                            │
│  - Performance tracking                                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                    Integration Layer                         │
│  - Performance Monitor (tracks success/failure)              │
│  - DGM Bridge (TypeScript ↔ Python communication)           │
│  - Tool Registry (shared tool implementations)              │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                 DGM Evolution Engine                         │
│  - Analyzes usage patterns                                  │
│  - Evolves tool implementations                             │
│  - Tests improvements                                       │
│  - Deploys better versions                                  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Enhanced OpenCode CLI
- **Location**: `/opencode/packages/opencode/`
- **Changes**: Add performance tracking and DGM integration hooks
- **Key Files**:
  - `src/tool/tool.ts` - Add performance metrics
  - `src/session/session.ts` - Track usage patterns
  - `src/dgm-integration.ts` - NEW: DGM bridge interface

### 2. DGM Integration Module
- **Location**: `/opencode/packages/dgm-integration/` (NEW)
- **Purpose**: Lightweight bridge between OpenCode and DGM
- **Components**:
  ```
  dgm-integration/
  ├── package.json
  ├── src/
  │   ├── index.ts          # Main integration entry
  │   ├── performance.ts    # Performance tracking
  │   ├── dgm-bridge.ts     # Python subprocess management
  │   └── tool-sync.ts      # Tool synchronization
  └── python/
      ├── bridge.py         # Python side of bridge
      ├── adapter.py        # DGM adapter (simplified)
      └── requirements.txt
  ```

### 3. Simplified DGM Agent
- **Location**: `/dgm/` (existing, minimal changes)
- **Use**: Subset of DGM focused on tool improvement
- **Key Files**:
  - `coding_agent.py` - Core agent logic
  - `llm_withtools.py` - LLM integration
  - `tools/` - Tool implementations to evolve

## Implementation Phases

### Phase 1: Basic Integration (Week 1)
1. Create `dgm-integration` package in OpenCode
2. Add performance tracking to OpenCode tools
3. Create Python bridge for DGM communication
4. Test basic TypeScript → Python → TypeScript flow

### Phase 2: Usage Tracking (Week 2)
1. Implement performance metrics collection
2. Store usage patterns (success/failure/time)
3. Create simple analytics dashboard
4. Add configuration for tracking preferences

### Phase 3: Evolution Loop (Week 3)
1. Connect DGM agent to analyze patterns
2. Implement tool improvement suggestions
3. Create test harness for improvements
4. Add manual approval workflow

### Phase 4: Auto-Enhancement (Week 4)
1. Background evolution process
2. Automatic deployment of improvements
3. Rollback mechanism for failures
4. User notification system

## Key Design Decisions

### 1. Subprocess Architecture
```typescript
// OpenCode TypeScript
class DGMBridge {
  private dgmProcess: ChildProcess;
  
  async evolve(patterns: UsagePattern[]): Promise<Improvement[]> {
    // Send to Python DGM via JSON-RPC
    return await this.call('evolve', { patterns });
  }
}
```

```python
# DGM Python
class OpenCodeAdapter:
    def evolve(self, patterns: List[Dict]) -> List[Dict]:
        # Analyze patterns
        # Generate improvements
        # Return suggestions
```

### 2. Tool Synchronization
- OpenCode tools remain primary interface
- DGM provides improved implementations
- Gradual replacement based on performance
- Fallback to original if issues arise

### 3. Performance Metrics
```typescript
interface ToolMetrics {
  toolName: string;
  executionTime: number;
  success: boolean;
  errorType?: string;
  userSatisfaction?: number; // Future: user feedback
}
```

### 4. Evolution Triggers
- Manual: `opencode evolve` command
- Scheduled: Daily/weekly background process
- Threshold: After N tool executions
- Event: On repeated failures

## File Structure Changes

```
DGMSTT/
├── opencode/                    # Forked OpenCode
│   └── packages/
│       ├── opencode/           # Main CLI (minimal changes)
│       └── dgm-integration/    # NEW: Integration package
├── dgm/                        # Existing DGM (minimal changes)
└── shared-tools/               # NEW: Evolved tool storage
    ├── approved/              # Production-ready tools
    └── experimental/          # Testing new versions
```

## Configuration

```typescript
// opencode.config.json
{
  "dgm": {
    "enabled": true,
    "evolutionSchedule": "weekly",
    "trackingLevel": "detailed",
    "autoApprove": false,
    "pythonPath": "./dgm/venv/bin/python",
    "agentPath": "./dgm/coding_agent.py"
  }
}
```

## Benefits of This Approach

1. **Minimal Disruption**: OpenCode works normally, DGM enhances in background
2. **Gradual Improvement**: Tools evolve based on actual usage
3. **User Control**: Manual approval before deploying improvements
4. **Simple Architecture**: No complex microservices needed
5. **Leverages Existing Code**: Uses working DGM and OpenCode components

## Next Steps

1. Create `dgm-integration` package structure
2. Implement basic performance tracking
3. Create simple Python bridge
4. Test with one tool (e.g., bash execution)
5. Iterate based on results