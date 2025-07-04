# Parallel Agents Implementation Status

## Current State

1. **`/agent` command** ✅ - Successfully implemented in the TUI

   - Users can select between "read-only" and "all-tools" modes
   - Dialog works and shows options correctly

2. **Task Tool** ⚠️ - Exists but temporarily disabled

   - The task tool is implemented in `/packages/opencode/src/tool/task.ts`
   - Currently commented out in provider.ts due to a runtime error
   - Error: `TypeError: undefined is not an object (evaluating 'Provider.AuthError')`
   - This appears to be a circular dependency or module loading issue

3. **System Prompts** ✅ - Updated with parallel agent instructions
   - Added clear instructions for using task tools
   - Emphasized not to simulate agents with bash commands

## The Issue

When users request parallel agents (e.g., "use your sub agents to create 3 poems"), DGMO currently:

- Simulates agents by writing files sequentially
- Uses bash commands instead of the actual task tool
- Doesn't create real sub-sessions

## Why This Happens

1. The task tool is commented out in the provider, so DGMO doesn't have access to it
2. DGMO falls back to simulating the behavior with available tools
3. No actual parallel execution occurs

## Temporary Workaround

Until the task tool import issue is resolved, users can:

1. Use the `/agent` command to set the desired mode
2. Manually create multiple prompts for different perspectives
3. Run them sequentially (not ideal but functional)

## Next Steps

To fully enable parallel agents:

1. Resolve the circular dependency issue with Provider.AuthError
2. Re-enable TaskTool in provider.ts
3. Test that DGMO properly uses the task tool for parallel requests
4. Verify sub-sessions are created and accessible via `/sub-session`

## Technical Details

The error occurs because:

- `Provider.AuthError` is accessed before it's fully initialized
- This suggests a circular import between provider and session modules
- The task tool import triggers this circular dependency

Potential solutions:

1. Refactor the Provider.AuthError to a separate module
2. Use dynamic imports for the task tool
3. Restructure the module dependencies to avoid circularity
