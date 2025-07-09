package chat

import (
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/layout"
)

// DynamicEditorComponent extends EditorComponent with dynamic sizing capabilities
type DynamicEditorComponent interface {
	EditorComponent
	// GetOptimalHeight returns the optimal height for current content
	GetOptimalHeight(maxHeight int) int
	// SetDynamicSizing enables/disables dynamic sizing
	SetDynamicSizing(enabled bool)
	// GetContentHeight returns the actual content height
	GetContentHeight() int
	// SetSizingConfig updates the dynamic sizing configuration
	SetSizingConfig(config layout.DynamicSizingConfig)
	// GetEditorSizingInfo returns information about the current editor sizing state
	GetEditorSizingInfo() map[string]interface{}
}

// dynamicEditorComponent wraps the existing editor component with dynamic sizing
type dynamicEditorComponent struct {
	EditorComponent
	app           *app.App
	sizer         *layout.DynamicSizer
	enabled       bool
	lastUpdate    time.Time
	contentHeight int
	screenWidth   int
	screenHeight  int
}

// NewDynamicEditorComponent creates a new dynamic editor component
func NewDynamicEditorComponent(app *app.App) DynamicEditorComponent {
	baseComponent := NewEditorComponent(app)

	// Use a more conservative config for editor (smaller max height)
	config := layout.DynamicSizingConfig{
		MaxHeightPercent: 0.2,  // 20% of screen height max
		MinHeight:        3,    // Minimum 3 lines
		MaxHeight:        15,   // Maximum 15 lines absolute
		ContentPadding:   2,    // 2 lines of padding
		SmoothTransition: true, // Enable smooth transitions
		TransitionStep:   1,    // Change by max 1 line per update (more subtle)
	}

	return &dynamicEditorComponent{
		EditorComponent: baseComponent,
		app:             app,
		sizer:           layout.NewDynamicSizer(config),
		enabled:         true,
		lastUpdate:      time.Now(),
	}
}

// GetOptimalHeight calculates the optimal height for the current content
func (de *dynamicEditorComponent) GetOptimalHeight(maxHeight int) int {
	if !de.enabled {
		return 5 // Default editor height
	}

	// Calculate content height based on current input
	contentHeight := de.calculateEditorHeight()
	de.contentHeight = contentHeight

	// Use the dynamic sizer to get optimal height
	return de.sizer.CalculateSize(contentHeight, de.screenHeight, de.screenWidth)
}

// SetDynamicSizing enables or disables dynamic sizing
func (de *dynamicEditorComponent) SetDynamicSizing(enabled bool) {
	de.enabled = enabled
}

// GetContentHeight returns the current content height
func (de *dynamicEditorComponent) GetContentHeight() int {
	return de.contentHeight
}

// SetSizingConfig updates the dynamic sizing configuration
func (de *dynamicEditorComponent) SetSizingConfig(config layout.DynamicSizingConfig) {
	de.sizer.UpdateConfig(config)
}

// SetSize overrides the base SetSize to track screen dimensions
func (de *dynamicEditorComponent) SetSize(width, height int) tea.Cmd {
	de.screenWidth = width
	de.screenHeight = height

	if de.enabled {
		// Calculate optimal height and use that instead
		optimalHeight := de.GetOptimalHeight(height)
		return de.EditorComponent.SetSize(width, optimalHeight)
	}

	return de.EditorComponent.SetSize(width, height)
}

// Update wraps the base Update to handle dynamic sizing
func (de *dynamicEditorComponent) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	// Update the base component
	updated, cmd := de.EditorComponent.Update(msg)
	de.EditorComponent = updated.(EditorComponent)
	cmds = append(cmds, cmd)

	// Handle dynamic sizing updates for text input changes
	switch msg := msg.(type) {
	case tea.KeyPressMsg:
		// Only resize on content-changing keys
		if de.enabled && de.isContentChangingKey(msg) {
			de.lastUpdate = time.Now()

			// Add a small delay to batch rapid keystrokes
			cmds = append(cmds, tea.Tick(50*time.Millisecond, func(t time.Time) tea.Msg {
				return editorSizeUpdateMsg{timestamp: de.lastUpdate}
			}))
		}

	case editorSizeUpdateMsg:
		// Only process if this is the latest update
		if msg.timestamp.Equal(de.lastUpdate) && de.enabled {
			optimalHeight := de.GetOptimalHeight(de.screenHeight)
			cmd := de.EditorComponent.SetSize(de.screenWidth, optimalHeight)
			cmds = append(cmds, cmd)
		}
	}

	return de, tea.Batch(cmds...)
}

// calculateEditorHeight estimates the height needed for the current editor content
func (de *dynamicEditorComponent) calculateEditorHeight() int {
	if de.EditorComponent == nil {
		return 3 // Default minimum
	}

	// Get the current value from the editor
	value := de.EditorComponent.Value()
	if value == "" {
		return 3 // Minimum height for empty editor
	}

	// Calculate height considering word wrapping
	containerWidth := layout.Current.Container.Width
	if containerWidth <= 0 {
		containerWidth = 80 // Fallback width
	}

	// Account for editor padding/borders
	effectiveWidth := containerWidth - 4

	height := layout.CalculateContentHeightWithWidth(value, effectiveWidth)

	// Ensure minimum height
	if height < 3 {
		height = 3
	}

	return height
}

// isContentChangingKey determines if a key press changes the content
func (de *dynamicEditorComponent) isContentChangingKey(msg tea.KeyPressMsg) bool {
	key := msg.String()

	// Keys that change content
	contentKeys := map[string]bool{
		"backspace": true,
		"delete":    true,
		"enter":     true,
		"ctrl+u":    true, // Clear line
		"ctrl+k":    true, // Kill line
		"ctrl+w":    true, // Delete word
		"ctrl+v":    true, // Paste
		"ctrl+y":    true, // Yank
	}

	// Check for printable characters
	if len(msg.Text) > 0 {
		return true
	}

	return contentKeys[key]
}

// editorSizeUpdateMsg is sent to trigger size recalculation for editor
type editorSizeUpdateMsg struct {
	timestamp time.Time
}

// CreateDynamicEditorWithPreset creates a dynamic editor component with a preset configuration
func CreateDynamicEditorWithPreset(app *app.App, presetName string) DynamicEditorComponent {
	component := NewDynamicEditorComponent(app)

	if config, exists := layout.GetPreset(presetName); exists {
		// Adjust config for editor use (smaller max heights)
		if config.MaxHeightPercent > 0.25 {
			config.MaxHeightPercent = 0.25 // Cap at 25%
		}
		if config.MaxHeight == 0 || config.MaxHeight > 20 {
			config.MaxHeight = 20 // Cap absolute height at 20 lines
		}
		component.SetSizingConfig(config)
	}

	return component
}

// GetEditorSizingInfo returns information about the current editor sizing state
func (de *dynamicEditorComponent) GetEditorSizingInfo() map[string]interface{} {
	return map[string]interface{}{
		"enabled":         de.enabled,
		"contentHeight":   de.contentHeight,
		"currentSize":     de.sizer.GetCurrentSize(),
		"targetSize":      de.sizer.GetTargetSize(),
		"isTransitioning": de.sizer.IsTransitioning(),
		"screenWidth":     de.screenWidth,
		"screenHeight":    de.screenHeight,
		"currentValue":    de.EditorComponent.Value(),
	}
}
