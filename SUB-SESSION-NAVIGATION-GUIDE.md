# Sub-Session Navigation Guide

## Overview

OpenCode DGMSTT now supports seamless navigation between main sessions and sub-sessions using keyboard shortcuts. This feature allows you to quickly switch between parent and child sessions, navigate between sibling sub-sessions, and maintain a navigation history.

## Key Features

### 1. **Enter Key Navigation**

- In the sub-session dialog (`/sub-session`), press **Enter** on any sub-session to load it
- The sub-session becomes the active session with all its messages
- The modal closes automatically after switching
- A success toast confirms the switch

### 2. **Ctrl+B Back Navigation**

- **From a sub-session**: Returns to the parent session
- **From a main session**: Returns to the last viewed sub-session (if any)
- Shows an info message if there's nowhere to navigate

### 3. **Sibling Navigation (Ctrl+B+. and Ctrl+B+,)**

- When in a sub-session with siblings:
  - **Ctrl+B then .** (period): Navigate to the next sibling
  - **Ctrl+B then ,** (comma): Navigate to the previous sibling
- Navigation wraps around (last → first, first → last)
- Only works when in a sub-session that has siblings

## Navigation State

The system tracks:

- **Session Stack**: History of visited sessions for back navigation
- **Current Session Type**: Whether you're in a "main" or "sub" session
- **Last Viewed Sub-Session**: For quick return from main session

## Visual Indicators

### In Sub-Session Dialog

- **Breadcrumb**: Shows current session context
  - `📁 Main Session: [title]` when in main session
  - `📁 Sub-Session: [title]` when in sub-session
- **Tree View**: Hierarchical display of sub-sessions
- **Status Icons**:
  - `▶` Running
  - `✓` Completed
  - `✗` Failed

## Usage Examples

### Example 1: Exploring Sub-Sessions

1. Create sub-sessions: `Create 3 agents to analyze code`
2. Open dialog: `/sub-session`
3. Press **Enter** on "Agent 1" → Loads that sub-session
4. Press **Ctrl+B** → Returns to main session
5. Press **Ctrl+B** again → Returns to "Agent 1"

### Example 2: Navigating Siblings

1. While in "Agent 1" sub-session
2. Press **Ctrl+B** then **.** → Switches to "Agent 2"
3. Press **Ctrl+B** then **.** → Switches to "Agent 3"
4. Press **Ctrl+B** then **.** → Wraps to "Agent 1"
5. Press **Ctrl+B** then **,** → Goes back to "Agent 3"

## Technical Details

### Implementation

- Navigation state stored in `app.App` struct
- Session switching loads both session metadata and messages
- Uses existing HTTP endpoints (no SDK changes required)
- Bubble Tea framework handles keyboard events

### Performance

- Session switching: ~100-200ms
- Messages loaded asynchronously
- Navigation history kept in memory
- No persistent storage of navigation state

## Limitations

1. Navigation state is not persisted between app restarts
2. Session stack has no size limit (could grow large in long sessions)
3. No visual indication of navigation history depth
4. Cannot navigate directly to grandparent sessions

## Troubleshooting

### "No parent session or sub-session to navigate to"

- You're in a main session with no sub-session history
- Create and view a sub-session first

### "Not in a sub-session" (for sibling navigation)

- Sibling navigation only works in sub-sessions
- Navigate to a sub-session first using Enter key

### "No sibling sub-sessions"

- The current sub-session has no siblings
- Only child of its parent session

## Future Enhancements

1. **Visual Navigation Path**: Show breadcrumb trail in main UI
2. **Navigation History Dialog**: View and jump to any previous session
3. **Keyboard Shortcut Customization**: Configure navigation keys
4. **Session Bookmarks**: Mark sessions for quick access
5. **Smart Navigation**: AI-suggested next sessions based on context
