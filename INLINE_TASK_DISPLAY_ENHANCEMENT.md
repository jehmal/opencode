# Inline Task Display Enhancement

## Overview

The inline task display in OpenCode's chat view has been enhanced with beautiful visual elements inspired by Bubble Tea examples. When you create agents or run tasks, they now appear with:

- 🚀 **Task Icons** - Different icons for different task types
- ⠋ **Animated Spinners** - Smooth rotating spinners for running tasks
- █░░ **Progress Bars** - Gradient progress bars when progress is available
- ✓/✗ **Status Indicators** - Clear visual feedback for completed/failed tasks
- (2m 15s) **Elapsed Time** - Formatted duration display

## Visual Elements

### Task Icons

- 🔍 Search/find tasks
- 📝 Write/create tasks
- ✏️ Edit/modify tasks
- 🚀 Build/compile tasks
- 🧪 Test/verify tasks
- 🐛 Debug/fix tasks
- 📊 Analyze/review tasks
- 🎨 Design/style tasks
- 🚢 Deploy/release tasks
- 📚 Document tasks

### Tool Action Display

When tools are being invoked, you'll see:

- Icon + animated spinner + action description
- Example: `🚀 ⠙ Creating agent...`

### Task Status Display

For running tasks:

- `🚀 Agent 1: Task description ⠸ Running...`
- With progress: `📝 Agent 2: Writing code █████░░░ 75%`

For completed tasks:

- `✅ Agent 1: Task description ✓ Completed (2m 15s)`

For failed tasks:

- `❌ Agent 1: Task description ✗ Failed`

## Implementation Details

### New Components

1. **task_renderer.go** - Beautiful task rendering functions:

   - `GetSpinnerFrame()` - Returns animated spinner frames
   - `RenderTaskProgress()` - Creates gradient progress bars
   - `RenderTaskStatus()` - Formats task status lines
   - `RenderElapsedTime()` - Human-readable time formatting
   - `RenderTaskBox()` - Wraps tasks in styled boxes

2. **Enhanced message.go**:
   - `extractAgentNumber()` - Extracts agent numbers from descriptions
   - `getTaskIcon()` - Returns appropriate icons based on task type
   - `renderToolAction()` - Enhanced with spinners and styling
   - Task rendering now uses the new visual components

### Theme Integration

All colors are theme-aware using the OpenCode theme system:

- Primary colors for active elements
- Secondary colors for progress
- Success/Error colors for status
- Muted colors for elapsed time

## Usage

Simply run tasks as normal:

```
Create 3 agents to analyze this codebase
```

You'll see beautiful inline displays like:

```
🚀 ⠸ Creating agent...

🔍 Agent 1: Search agent ⠹ Running...
📊 Agent 2: Analyze agent ⠼ Running...
📝 Agent 3: Report agent ⠴ Running...
```

As tasks complete:

```
🔍 Agent 1: Search agent ✓ Completed (45s)
📊 Agent 2: Analyze agent ✓ Completed (1m 12s)
📝 Agent 3: Report agent ⠧ Running...
```

## Benefits

1. **Better Visual Feedback** - Clear indication of what's happening
2. **Professional Appearance** - Matches modern CLI tools like k9s
3. **Theme Support** - Works in both light and dark themes
4. **Smooth Animations** - Spinners update smoothly without flicker
5. **Informative Display** - Shows progress, time, and status clearly

## Technical Notes

- Spinner animation based on time for smooth updates
- Progress bars use gradient coloring
- All styling uses lipgloss for consistent rendering
- Theme-aware colors adapt to user preferences
- No external dependencies beyond existing packages

The enhancement maintains backward compatibility while providing a much more aesthetic and informative display of running tasks in the main chat view.
