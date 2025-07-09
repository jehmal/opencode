# Prompting Techniques UI Integration

This document describes the prompting techniques visibility features added to the DGMO TUI chat interface.

## Features Implemented

### 1. Prompting Techniques Indicator

- **Location**: Above the editor input area
- **Display**: Shows active techniques (e.g., "● CoT • ToT • Iterative")
- **Selection Mode Indicator**:
  - ● Green dot for automatic selection
  - ◐ Yellow half-circle for manual selection
  - ◑ Blue half-circle for hybrid mode
- **Confidence Score**: Shows overall confidence percentage

### 2. Message Technique Metadata

- **Location**: In message timestamps
- **Display**: Shows techniques used for each assistant message
- **Format**: "CoT • ToT • Iterative • (timestamp)"

### 3. Technique Details Panel

- **Toggle**: Press `Ctrl+T` to show/hide
- **Position**: Right side panel (50% screen width)
- **Contents**:
  - Selection mode and description
  - Active techniques with icons
  - Available techniques grouped by category
  - Performance statistics (usage count, success rate, latency)
- **Navigation**: Scrollable viewport for long content

### 4. WebSocket Event Integration

- **Events Handled**:
  - `prompting.technique.applied`: When a technique is used
  - `prompting.technique.state`: State updates
  - `prompting.technique.performance`: Performance metrics

## File Structure

```
packages/tui/
├── internal/
│   ├── prompting/
│   │   ├── types.go          # Data structures and types
│   │   ├── indicator.go      # Technique indicator component
│   │   └── panel.go          # Technique details panel
│   ├── components/
│   │   └── chat/
│   │       └── message.go    # Updated to show technique metadata
│   ├── websocket/
│   │   └── prompting_events.go # WebSocket event handlers
│   └── tui/
│       └── tui.go            # Main TUI integration
```

## Usage

1. **View Active Techniques**: Look at the indicator above the input area
2. **Toggle Details Panel**: Press `Ctrl+T` to see all available techniques and stats
3. **Check Message Techniques**: Look at message timestamps to see which techniques were used

## Dark Theme Integration

All components use the existing theme system:

- `theme.CurrentTheme()` for color consistency
- Adaptive colors for light/dark mode support
- Consistent styling with existing UI elements

## Future Enhancements

1. **Manual Technique Selection**: UI for manually selecting techniques
2. **Technique Filtering**: Filter messages by techniques used
3. **Performance Visualization**: Charts for technique performance over time
4. **Technique Recommendations**: Show suggested techniques based on task type
