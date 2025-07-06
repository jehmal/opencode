## Instructions for Next Parallel Agent System Enhancement Agent

You are continuing the implementation of the parallel agent execution system. The project is 95% complete with true parallel execution working. Your task is to fix agent naming and execution timing display.

### Project Context

- Working Directory: /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode
- Key Repositories: opencode TypeScript server with Bun runtime
- Architecture Doc: src/session/parallel-agents.ts
- Related Systems: task.ts, sub-session.ts, server.ts WebSocket integration

### Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "PROJECT SNAPSHOT Parallel Agent System Enhancement naming_and_timing_fixes_needed"
2. Search: "parallel agent execution WebSocket progress updates"
3. Search: "task tool creates actual sub-sessions"
4. Search: "Agent 1 current activity display format"
5. Search: "continuation prompt template parallel execution"

### Completed Components (DO NOT RECREATE)

✅ Parallel Execution - True concurrent sub-agent execution via task tool
✅ WebSocket Integration - Real-time progress updates during execution
✅ Sub-Session Storage - Persistent storage of agent execution history
✅ Progress Display - Live updates showing "Agent 1: [current activity]"
✅ Error Handling - Automatic debug agent spawning on failures
✅ Task Tool Enhancement - Supports parallel invocations in single message
✅ /sub-session Command - Navigation to view agent histories
✅ Context Isolation - Each agent has independent context

### Critical Files to Reference

1. Task Execution:
   - src/tool/task.ts - Main task tool implementation
   - src/tool/task.ts.backup - Reference for original implementation
   - src/session/parallel-agents.ts - Parallel execution logic
2. Progress Display:

   - src/server/server.ts - WebSocket server for progress updates
   - src/events/task-events.ts - Event system for task progress
   - src/events/task-events/server.ts - Server-side event handling

3. Sub-Session Management:
   - src/session/sub-session.ts - Sub-session storage and retrieval
   - src/session/index.ts - Main session management
   - src/session/performance.ts - Performance tracking integration

### Required Tasks (USE 3 SUB-AGENTS IN PARALLEL)

#### Sub-Agent 1: Fix Agent Naming Display

The current system shows all agents as "Agent 1". Fix this to display the task description instead.

- Locate where "Agent 1" is hardcoded in the progress display system
- Change to use the `description` parameter from task invocation
- Ensure the display shows just the task name without "Agent" prefix
- Test with multiple parallel agents to verify unique names
  Location: src/session/parallel-agents.ts, src/events/task-events.ts
  Dependencies: WebSocket event system, task description parameter

#### Sub-Agent 2: Implement Accurate Execution Timing

The timer currently shows "0s" for all agents. Implement real execution time tracking.

- Add start timestamp when agent begins execution
- Calculate elapsed time during execution
- Update progress display to show actual elapsed seconds
- Ensure timing persists in sub-session storage
- Format as "Xs" for seconds, "Xm Ys" for minutes
  Location: src/session/parallel-agents.ts, src/tool/task.ts
  Dependencies: Performance tracking system, sub-session storage

#### Sub-Agent 3: Clean Display Format Integration

Ensure the new naming and timing integrate cleanly with existing UI.

- Remove "Agent" prefix from all displays
- Show format: "[Task Description]: [Current Activity] (Xs)"
- Verify WebSocket updates maintain new format
- Test with various task descriptions for edge cases
- Ensure backward compatibility with existing sub-sessions
  Location: src/events/task-events.ts, src/server/server.ts
  Dependencies: WebSocket server, UI display system

### Integration Requirements

1. WebSocket events must include both task description and timing
2. Sub-session storage must persist execution duration
3. Progress updates should show real-time elapsed seconds
4. Display format should be consistent across all views
5. Backward compatibility with existing sub-sessions

### Technical Constraints

- Maintain WebSocket message format compatibility
- Don't break existing /sub-session navigation
- Keep performance overhead minimal (<10ms)
- Preserve error handling and debug agent spawning
- Use existing performance tracking infrastructure

### Success Criteria

1. Each parallel agent shows its task description (not "Agent 1")
2. No "Agent" prefix appears in the display
3. Execution timer shows actual elapsed time (not "0s")
4. Timer updates in real-time during execution
5. Sub-sessions store and display execution duration
6. Multiple parallel agents show unique names and timers
7. WebSocket updates maintain new format consistently
8. Existing functionality remains unaffected
9. Performance impact is negligible
10. Clean, professional display format

### Testing Approach

After implementation:

1. Create 3 parallel agents with different task names
2. Verify each shows unique task description
3. Confirm timers increment in real-time
4. Check sub-session storage includes duration
5. Test /sub-session navigation shows saved times
6. Verify error handling still spawns debug agents
7. Performance test with 10+ parallel agents
8. Regression test existing commands

### Known Issues & Solutions

- Issue: WebSocket messages may need format update
  Solution: Add fields while maintaining backward compatibility
- Issue: Timer might reset on WebSocket reconnect
  Solution: Store start time in sub-session immediately
- Issue: Long task descriptions might overflow display
  Solution: Truncate to reasonable length with ellipsis

### Important Notes

- The parallel execution system is working correctly
- Only the display naming and timing need fixes
- Focus on clean, minimal changes to existing code
- Maintain the real-time update experience
- Remember: Users want to see task names, not "Agent 1"

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to complete the implementation. Focus on making the display informative and professional while maintaining all existing functionality.
