# DGM Agent Integration

This directory contains the real DGM Agent integration that replaces the mock adapter.

## Overview

The integration consists of:

1. **adapter.py** - `DGMAgentAdapter` class that wraps the real DGM `AgenticSystem`
2. **bridge.py** - JSON-RPC bridge for TypeScript-Python communication
3. **test_adapter.py** - Direct test of the adapter functionality
4. **test_bridge.py** - Test of the JSON-RPC bridge

## DGMAgentAdapter

The adapter provides the following main methods:

### Core Methods

- `execute_task(task)` - Executes a coding task using the DGM agent
  - Creates a git-initialized workspace
  - Runs the AgenticSystem on the problem
  - Returns modified files and execution logs

- `get_agent_state(task_id)` - Retrieves the current state of an agent
  - Returns status, logs, current diff, and task info
  - Can return summary of all agents if no task_id provided

- `evolve_based_on_patterns(patterns)` - Triggers evolution based on observed patterns
  - Analyzes pattern types (error, performance, success)
  - Returns adaptations based on pattern analysis

### Helper Methods

- `cleanup_agent(task_id)` - Removes agent workspace and data
- `reset_agent(task_id)` - Resets workspace to initial state
- `get_agent_diff(task_id)` - Gets current diff for agent workspace
- `get_stats()` - Returns adapter statistics

## Task Format

Tasks should be provided in the following format:

```json
{
  "id": "unique_task_id",
  "description": "Problem statement for the agent",
  "files": {
    "filename.py": "initial file content",
    "folder/another.py": "content"
  },
  "test_description": "Optional description of how to test the solution"
}
```

## Integration with DGM

The adapter:
1. Imports `AgenticSystem` from `/dgm/coding_agent.py`
2. Creates isolated git workspaces for each task
3. Manages agent lifecycle and state tracking
4. Handles file operations and diff generation
5. Captures and returns agent logs from chat history

## Testing

Run the tests:

```bash
# Test adapter directly
python test_adapter.py

# Test JSON-RPC bridge
python test_bridge.py
```

## Notes

- Each task gets its own temporary git repository
- Workspaces are cleaned up when the adapter is destroyed
- The adapter tracks multiple concurrent agents
- Evolution mechanism is currently a placeholder for future enhancement