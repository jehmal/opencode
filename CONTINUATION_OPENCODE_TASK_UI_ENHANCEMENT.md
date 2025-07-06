# Instructions for Next OpenCode Task UI Enhancement Agent

You are continuing the implementation of professional task display UI for OpenCode TUI. The project is 75% complete with basic task display working. Your task is to enhance the UI with Bubble Tea components for real-time progress visualization.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode`
- Key Repositories:
  - OpenCode TUI: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui`
  - Bubble Tea Examples: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/bubbletea/examples`
- Architecture Doc: See memory snapshots for TUI architecture
- Related Systems: WebSocket task events on port 5747, existing task.go structures

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "PROJECT SNAPSHOT OpenCode Tasks UI Implementation Complete"
2. Search: "TECHNICAL SOLUTION task display real-time updates WebSocket"
3. Search: "SUCCESS PATTERN Bubble Tea component integration"
4. Search: "ERROR RESOLVED TUI rendering performance"
5. Search: "ARCHITECTURE DECISIONS task panel layout responsive"

## Completed Components (DO NOT RECREATE)

✅ WebSocket Task Event System - Full bidirectional communication

- TypeScript server emits TaskStarted/Progress/Completed/Failed events
- Go WebSocket client receives and converts to Bubble Tea messages
- Automatic reconnection with heartbeat monitoring
- Event types defined in task.go and task-events.ts

✅ Basic Task Display - Currently shows "Agent 1: [activity]" as plain text

- Inline display in main chat area
- Updates with task progress messages
- Simple text format without visual enhancements

✅ Task Data Structures - Complete type definitions

- TaskInfo struct with all necessary fields
- TaskStatus enum (Pending/Running/Completed/Failed)
- Message types for Bubble Tea updates

✅ TUI Layout System - Responsive flex layout

- Main chat area takes primary space
- Support for overlay components
- Theme-aware styling system

## Critical Files to Reference

1. Task System Core:

   - `/opencode/packages/tui/internal/app/tasks.go` - Task types and messages
   - `/opencode/packages/tui/internal/websocket/task_client.go` - WebSocket client
   - `/opencode/packages/opencode/src/events/task-events/server.ts` - Event server

2. Bubble Tea Examples:

   - `/bubbletea/examples/realtime/main.go` - Real-time updates pattern
   - `/bubbletea/examples/spinners/main.go` - Multiple spinner styles
   - `/bubbletea/examples/stopwatch/main.go` - Elapsed time display
   - `/bubbletea/examples/progress-animated/main.go` - Progress bars

3. TUI Components:
   - `/opencode/packages/tui/internal/components/list/list.go` - List component pattern
   - `/opencode/packages/tui/internal/styles/styles.go` - Styling system
   - `/opencode/packages/tui/internal/theme/theme.go` - Theme integration

## Required Tasks (USE 4 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Task List Component

Create a sophisticated task list component that displays multiple concurrent tasks

- Study list.go component pattern for scrollable lists
- Implement TaskListModel with methods: Init(), Update(), View()
- Support up to 10 concurrent tasks with overflow scrolling
- Each task item shows: spinner + agent name + description + elapsed time
- Use lipgloss for professional styling with borders and padding
- Integrate theme colors for consistency
  Location: `/opencode/packages/tui/internal/components/tasks/tasklist.go`
  Dependencies: bubbles/spinner, bubbles/stopwatch, lipgloss

### Sub-Agent 2: Task Item Renderer

Create individual task item components with visual indicators

- Implement TaskItemModel for single task display
- Integrate spinner from bubbles/spinner (use Dot or MiniDot style)
- Add progress bar using bubbles/progress for tasks with progress
- Show elapsed time using stopwatch pattern (format: "2m 15s")
- Status-based styling: blue for running, green for completed, red for failed
- Smooth transitions between states
  Location: `/opencode/packages/tui/internal/components/tasks/taskitem.go`
  Dependencies: Real-time update patterns from realtime example

### Sub-Agent 3: Task Panel Integration

Integrate the task display into the main TUI layout

- Modify app.go to include TaskListModel in main app state
- Update View() to render tasks in dedicated panel area
- Position tasks panel on right side (30% width) or bottom (25% height)
- Make panel toggleable with Ctrl+T shortcut
- Ensure responsive layout adjusts when panel is shown/hidden
- Connect WebSocket task messages to update task list
  Location: Modify `/opencode/packages/tui/internal/app/app.go`
  Dependencies: Existing layout system, overlay patterns

### Sub-Agent 4: Visual Polish and Animations

Add professional visual enhancements and smooth animations

- Implement smooth fade-in for new tasks
- Add subtle pulse animation for active tasks
- Create gradient backgrounds for task items
- Add icons/emojis for task types (🔍 search, 📝 edit, 🚀 build)
- Implement color-coded progress bars (blue→green on completion)
- Add subtle shadows and rounded corners using lipgloss
  Location: `/opencode/packages/tui/internal/components/tasks/styles.go`
  Dependencies: Theme system, lipgloss advanced styling

## Integration Requirements

1. WebSocket Integration: Connect existing task_client.go messages to update TaskListModel
2. Theme Consistency: Use theme.Manager for all colors and styles
3. Performance: Limit redraws using Bubble Tea's built-in optimization
4. Accessibility: Ensure keyboard navigation works (Tab to focus panel, arrows to scroll)
5. State Management: Tasks persist across panel toggle, clear completed after 30s

## Technical Constraints

- Bubble Tea Version: Use patterns compatible with current version
- No External Dependencies: Only use bubbles components already available
- Terminal Compatibility: Must work in standard terminals (no special Unicode)
- Performance Target: Smooth updates with <50ms latency
- Memory Usage: Efficient task cleanup to prevent memory leaks

## Success Criteria

1. Professional appearance matching modern CLI tools (like k9s, lazygit)
2. Real-time updates show within 100ms of WebSocket event
3. Smooth animations without terminal flicker
4. Support for 10+ concurrent tasks without performance degradation
5. Intuitive keyboard shortcuts for panel control
6. Clear visual distinction between task states
7. Elapsed time updates every second for running tasks
8. Progress bars animate smoothly from 0-100%
9. Completed tasks fade out gracefully after 30 seconds
10. Panel state persists across application restarts

## Testing Approach

After implementation:

1. Launch OpenCode TUI and trigger multiple parallel agents
2. Verify spinners animate smoothly for all running tasks
3. Check progress bars update in real-time
4. Confirm elapsed timers increment correctly
5. Test panel toggle with Ctrl+T during active tasks
6. Verify completed tasks show success state and fade out
7. Test with 10+ concurrent tasks for performance
8. Check theme switching updates task panel colors

## Known Issues & Solutions

- Issue: Terminal flicker during updates
  Solution: Use Bubble Tea's batched updates and avoid full redraws

- Issue: WebSocket messages may arrive out of order
  Solution: Use task ID to update correct item, ignore duplicate events

- Issue: Spinner animation may lag with many tasks
  Solution: Use single ticker for all spinners, update in batch

## Important Notes

- Follow Bubble Tea's Model-Update-View pattern strictly
- Use channels for WebSocket→UI communication (see realtime example)
- Leverage lipgloss's style inheritance for consistent theming
- Keep task history in memory for potential task log feature
- Remember: Professional appearance is key - study k9s and lazygit for inspiration

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to complete the implementation. Focus on creating a visually stunning and highly functional task display that elevates OpenCode's user experience to professional standards.
