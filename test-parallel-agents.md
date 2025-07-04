# Test Script for DGMO Parallel Agent Execution

## Test 1: Basic Parallel Agent Execution

Run this in DGMO to test parallel execution with different modes:

```
I need you to use the task tool to create 3 parallel agents:

1. First agent (read-only mode): Analyze the structure of the opencode project and list all the main directories
2. Second agent (all-tools mode): Create a file called test-parallel.txt with the content "Parallel agent test successful!"
3. Third agent (read-only mode): Search for all TypeScript files that contain the word "SubSession"

Please execute all three tasks in parallel.
```

## Test 2: Sub-Session Storage

After running Test 1, use the `/sub-session` command to:

1. View all created sub-sessions
2. Navigate to each sub-session
3. Use Ctrl+B to return to parent

## Test 3: Automatic Failure Recovery

Test the auto-debug feature:

```
Use the task tool to create an agent that tries to read a non-existent file at /tmp/this-file-does-not-exist.txt
```

This should trigger the automatic debug agent.

## Test 4: Tool Filtering Verification

```
Create two parallel agents:
1. Read-only agent: Try to create a file (should fail)
2. All-tools agent: Create a file successfully
```

## Test 5: MCP and Vision Tools

```
Create a read-only agent that uses an MCP tool (if any are configured) to verify they're always available regardless of mode.
```

## Expected Results

1. **Parallel Execution**: All three agents should execute simultaneously, with their progress shown inline in the chat
2. **Sub-Session Storage**: The `/sub-session` command should show all created sub-sessions with their status
3. **Auto-Debug**: Failed tasks should automatically trigger a debug agent
4. **Tool Filtering**: Read-only agents should not have access to write/edit/bash tools
5. **MCP Tools**: Should be available in all modes

## Verification Commands

After testing, you can verify the sub-sessions are stored by checking:

- Storage location: `~/.opencode/session/sub-sessions/`
- Index files: `~/.opencode/session/sub-session-index/`
