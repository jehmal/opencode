# Dynamic Height Sizing for DGMO TUI Panels

This document describes the dynamic height sizing system implemented for the DGMO TUI, which provides responsive panel sizing with configurable maximum limits and smooth transitions.

## Overview

The dynamic sizing system automatically adjusts panel heights based on content while respecting user-defined constraints. It provides:

- **Content-aware sizing**: Panels resize based on actual content height
- **Maximum height limits**: Configurable percentage and absolute limits
- **Smooth transitions**: Gradual size changes to avoid jarring UI updates
- **Multiple presets**: Pre-configured sizing profiles for different use cases
- **Edge case handling**: Robust behavior on small screens and edge conditions

## Architecture

### Core Components

1. **DynamicSizer** (`internal/layout/dynamic_sizing.go`)

   - Core sizing algorithm with configurable constraints
   - Smooth transition management
   - Content height calculation utilities

2. **DynamicMessagesComponent** (`internal/components/chat/dynamic_messages.go`)

   - Wraps the existing messages component with dynamic sizing
   - Calculates optimal height based on message content
   - Handles real-time content updates

3. **DynamicEditorComponent** (`internal/components/chat/dynamic_editor.go`)

   - Wraps the existing editor component with dynamic sizing
   - Responds to text input changes
   - Conservative sizing for better UX

4. **DynamicTUIModel** (`internal/tui/dynamic_tui.go`)
   - Complete TUI model with dynamic sizing integration
   - Command handling for sizing controls
   - Debug mode for development

## Configuration

### DynamicSizingConfig

```go
type DynamicSizingConfig struct {
    MaxHeightPercent float64 // Maximum height as percentage of screen (0.0-1.0)
    MinHeight        int     // Minimum height in lines
    MaxHeight        int     // Absolute maximum height (0 = no limit)
    ContentPadding   int     // Extra padding to add to content height
    SmoothTransition bool    // Enable gradual size changes
    TransitionStep   int     // Maximum change per update when transitioning
}
```

### Available Presets

- **compact**: 25% max, minimal padding, good for small screens
- **normal**: 30% max, balanced settings (default)
- **generous**: 40% max, more padding, good for large screens
- **fullscreen**: 80% max, maximum space utilization

## Usage

### Basic Integration

```go
// Create dynamic components
dynamicMessages := chat.CreateDynamicMessagesWithPreset(app, "normal")
dynamicEditor := chat.CreateDynamicEditorWithPreset(app, "compact")

// Enable/disable dynamic sizing
dynamicMessages.SetDynamicSizing(true)
dynamicEditor.SetDynamicSizing(true)

// Get optimal height for layout
messagesHeight := dynamicMessages.GetOptimalHeight(screenHeight - 10)
editorHeight := dynamicEditor.GetOptimalHeight(screenHeight / 4)
```

### Custom Configuration

```go
config := layout.DynamicSizingConfig{
    MaxHeightPercent: 0.4,  // 40% of screen height
    MinHeight:        5,    // Minimum 5 lines
    MaxHeight:        25,   // Maximum 25 lines absolute
    ContentPadding:   3,    // 3 lines of padding
    SmoothTransition: true, // Enable smooth transitions
    TransitionStep:   2,    // Change by max 2 lines per update
}

component := chat.NewDynamicMessagesComponent(app)
component.SetSizingConfig(config)
```

### Command Integration

The system includes keyboard commands for runtime control:

- `<leader>r`: Toggle dynamic sizing on/off
- `<leader>p`: Cycle through sizing presets

## Implementation Details

### Content Height Calculation

The system uses sophisticated content height calculation that considers:

1. **Word wrapping**: Calculates how text flows within available width
2. **Explicit newlines**: Handles paragraph breaks and formatting
3. **Message structure**: Accounts for headers, tool outputs, and formatting
4. **Performance**: Optimized for real-time updates

### Smooth Transitions

When enabled, smooth transitions prevent jarring size changes:

```go
func (ds *DynamicSizer) getSmoothedSize() int {
    if ds.currentSize == ds.targetSize {
        return ds.currentSize
    }

    diff := ds.targetSize - ds.currentSize
    step := ds.config.TransitionStep

    if diff > 0 {
        // Growing
        ds.currentSize += int(math.Min(float64(step), float64(diff)))
    } else {
        // Shrinking
        ds.currentSize -= int(math.Min(float64(step), float64(-diff)))
    }

    return ds.currentSize
}
```

### Edge Case Handling

The system handles various edge cases:

- **Zero screen height**: Falls back to minimum height
- **Very small screens**: Respects screen constraints
- **Empty content**: Uses minimum height
- **Rapid updates**: Debounces frequent changes

## Performance Considerations

### Optimization Strategies

1. **Debounced Updates**: Rapid content changes are batched to avoid excessive recalculation
2. **Cached Calculations**: Content height calculations are cached when possible
3. **Incremental Transitions**: Smooth transitions use small steps to maintain responsiveness
4. **Selective Updates**: Only recalculates when content actually changes

### Benchmarks

```
BenchmarkDynamicSizing-8                 1000000      1.2 μs/op
BenchmarkContentHeightCalculation-8       500000      2.8 μs/op
```

## Testing

The system includes comprehensive tests covering:

- Basic sizing calculations
- Smooth transition behavior
- All preset configurations
- Content height calculation accuracy
- Edge case handling
- Performance benchmarks

Run tests with:

```bash
go test ./internal/layout -v
```

## Integration with Existing TUI

### Current Status

The dynamic sizing system is implemented as wrapper components that extend the existing TUI components. This approach:

- ✅ Maintains backward compatibility
- ✅ Allows gradual adoption
- ✅ Preserves existing functionality
- ⚠️ Requires manual integration for full benefits

### Integration Steps

1. **Replace Components**: Swap existing components with dynamic versions
2. **Update Layout Logic**: Modify the main TUI layout to use dynamic heights
3. **Add Command Handlers**: Integrate sizing commands into the command system
4. **Configure Presets**: Set up appropriate presets for different use cases

### Example Integration

```go
// In tui.go, replace static components
func NewModel(app *app.App) tea.Model {
    // Instead of:
    // messages := chat.NewMessagesComponent(app)
    // editor := chat.NewEditorComponent(app)

    // Use:
    messages := chat.CreateDynamicMessagesWithPreset(app, "normal")
    editor := chat.CreateDynamicEditorWithPreset(app, "compact")

    // ... rest of initialization
}

// Update the chat() method to use dynamic sizing
func (a appModel) chat(width int, align lipgloss.Position) string {
    // Calculate optimal heights
    messagesHeight := a.dynamicMessages.GetOptimalHeight(a.height - 10)
    editorHeight := a.dynamicEditor.GetOptimalHeight(a.height / 4)

    // Use calculated heights in layout
    mainLayout := layout.Render(
        layout.FlexOptions{
            Direction: layout.Column,
            Width:     a.width,
            Height:    a.height,
        },
        layout.FlexItem{
            View:      messagesView,
            FixedSize: messagesHeight,
        },
        layout.FlexItem{
            View:      editorView,
            FixedSize: editorHeight,
        },
    )

    return mainLayout
}
```

## Future Enhancements

### Planned Features

1. **Adaptive Presets**: Automatically adjust presets based on screen size
2. **User Preferences**: Save and restore user sizing preferences
3. **Animation Easing**: More sophisticated transition animations
4. **Content-Type Awareness**: Different sizing strategies for different content types
5. **Multi-Panel Coordination**: Coordinate sizing across multiple panels

### Potential Improvements

1. **GPU Acceleration**: Use hardware acceleration for smooth animations
2. **Predictive Sizing**: Anticipate size changes based on typing patterns
3. **Accessibility**: Enhanced support for screen readers and accessibility tools
4. **Mobile Support**: Optimizations for mobile terminal environments

## Troubleshooting

### Common Issues

1. **Jerky Transitions**: Increase transition step size or disable smooth transitions
2. **Too Small/Large**: Adjust min/max height constraints or percentage limits
3. **Performance Issues**: Reduce transition frequency or disable dynamic sizing
4. **Layout Conflicts**: Ensure parent containers can accommodate dynamic sizing

### Debug Mode

Enable debug mode to see sizing information:

```go
config := DefaultDynamicTUIConfig()
config.DebugMode = true
model := NewDynamicModel(app, config)
```

Debug mode displays:

- Current and target sizes
- Content height calculations
- Screen dimensions
- Transition status

## Conclusion

The dynamic sizing system provides a significant improvement to the DGMO TUI user experience by automatically adapting panel sizes to content while maintaining performance and usability. The modular design allows for gradual adoption and customization based on specific needs.

For questions or contributions, please refer to the main DGMO documentation or submit issues through the project's issue tracker.
