package chat

import (
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/layout"
	"github.com/sst/opencode-sdk-go"
)

// DynamicMessagesComponent extends MessagesComponent with dynamic sizing capabilities
type DynamicMessagesComponent interface {
	MessagesComponent
	// GetOptimalHeight returns the optimal height for current content
	GetOptimalHeight(maxHeight int) int
	// SetDynamicSizing enables/disables dynamic sizing
	SetDynamicSizing(enabled bool)
	// GetContentHeight returns the actual content height
	GetContentHeight() int
	// SetSizingConfig updates the dynamic sizing configuration
	SetSizingConfig(config layout.DynamicSizingConfig)
	// GetSizingInfo returns information about the current sizing state
	GetSizingInfo() map[string]interface{}
}

// dynamicMessagesComponent wraps the existing messages component with dynamic sizing
type dynamicMessagesComponent struct {
	MessagesComponent
	app           *app.App
	sizer         *layout.DynamicSizer
	enabled       bool
	lastUpdate    time.Time
	contentHeight int
	screenWidth   int
	screenHeight  int
}

// NewDynamicMessagesComponent creates a new dynamic messages component
func NewDynamicMessagesComponent(app *app.App) DynamicMessagesComponent {
	baseComponent := NewMessagesComponent(app)
	config := layout.DefaultDynamicSizingConfig()

	return &dynamicMessagesComponent{
		MessagesComponent: baseComponent,
		app:               app,
		sizer:             layout.NewDynamicSizer(config),
		enabled:           true,
		lastUpdate:        time.Now(),
	}
}

// GetOptimalHeight calculates the optimal height for the current content
func (dm *dynamicMessagesComponent) GetOptimalHeight(maxHeight int) int {
	if !dm.enabled {
		return maxHeight
	}

	// Calculate content height based on current messages
	contentHeight := dm.calculateMessagesHeight()
	dm.contentHeight = contentHeight

	// Use the dynamic sizer to get optimal height
	return dm.sizer.CalculateSize(contentHeight, dm.screenHeight, dm.screenWidth)
}

// SetDynamicSizing enables or disables dynamic sizing
func (dm *dynamicMessagesComponent) SetDynamicSizing(enabled bool) {
	dm.enabled = enabled
}

// GetContentHeight returns the current content height
func (dm *dynamicMessagesComponent) GetContentHeight() int {
	return dm.contentHeight
}

// SetSizingConfig updates the dynamic sizing configuration
func (dm *dynamicMessagesComponent) SetSizingConfig(config layout.DynamicSizingConfig) {
	dm.sizer.UpdateConfig(config)
}

// SetSize overrides the base SetSize to track screen dimensions
func (dm *dynamicMessagesComponent) SetSize(width, height int) tea.Cmd {
	dm.screenWidth = width
	dm.screenHeight = height

	if dm.enabled {
		// Calculate optimal height and use that instead
		optimalHeight := dm.GetOptimalHeight(height)
		return dm.MessagesComponent.SetSize(width, optimalHeight)
	}

	return dm.MessagesComponent.SetSize(width, height)
}

// Update wraps the base Update to handle dynamic sizing
func (dm *dynamicMessagesComponent) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	// Update the base component
	updated, cmd := dm.MessagesComponent.Update(msg)
	dm.MessagesComponent = updated.(MessagesComponent)
	cmds = append(cmds, cmd)

	// Handle dynamic sizing updates
	switch msg.(type) {
	case opencode.EventListResponseEventMessageUpdated,
		app.OptimisticMessageAddedMsg,
		app.SessionSelectedMsg,
		app.SessionSwitchedMsg,
		// Add handling for any message event that implements TypeName
		interface{ TypeName() string }:

		if dm.enabled {
			// Recalculate size when content changes
			dm.lastUpdate = time.Now()

			// Add a small delay to batch rapid updates
			cmds = append(cmds, tea.Tick(100*time.Millisecond, func(t time.Time) tea.Msg {
				return dynamicSizeUpdateMsg{timestamp: dm.lastUpdate}
			}))
		}

	case dynamicSizeUpdateMsg:
		// Only process if this is the latest update
		if msg.(dynamicSizeUpdateMsg).timestamp.Equal(dm.lastUpdate) && dm.enabled {
			optimalHeight := dm.GetOptimalHeight(dm.screenHeight)
			cmd := dm.MessagesComponent.SetSize(dm.screenWidth, optimalHeight)
			cmds = append(cmds, cmd)
		}
	}

	return dm, tea.Batch(cmds...)
}

// calculateMessagesHeight estimates the height needed for all messages
func (dm *dynamicMessagesComponent) calculateMessagesHeight() int {
	if dm.app == nil || len(dm.app.Messages) == 0 {
		return 0
	}

	totalHeight := 0
	containerWidth := layout.Current.Container.Width

	for _, message := range dm.app.Messages {
		messageHeight := dm.calculateMessageHeight(message, containerWidth)
		totalHeight += messageHeight

		// Add spacing between messages
		totalHeight += 1
	}

	return totalHeight
}

// calculateMessageHeight estimates the height of a single message
func (dm *dynamicMessagesComponent) calculateMessageHeight(message opencode.Message, width int) int {
	height := 0

	// Add header height (role + timestamp)
	height += 2

	// Calculate content height for each part
	for _, part := range message.Parts {
		switch part := part.AsUnion().(type) {
		case opencode.TextPart:
			textHeight := layout.CalculateContentHeightWithWidth(part.Text, width-4) // Account for padding
			height += textHeight

		case opencode.ToolInvocationPart:
			// Tool invocation blocks are typically 3-5 lines
			height += 4
		}
	}

	// Add minimum height for very short messages
	if height < 3 {
		height = 3
	}

	return height
}

// dynamicSizeUpdateMsg is sent to trigger size recalculation
type dynamicSizeUpdateMsg struct {
	timestamp time.Time
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// CreateDynamicMessagesWithPreset creates a dynamic messages component with a preset configuration
func CreateDynamicMessagesWithPreset(app *app.App, presetName string) DynamicMessagesComponent {
	component := NewDynamicMessagesComponent(app)

	if config, exists := layout.GetPreset(presetName); exists {
		component.SetSizingConfig(config)
	}

	return component
}

// GetSizingInfo returns information about the current sizing state
func (dm *dynamicMessagesComponent) GetSizingInfo() map[string]interface{} {
	return map[string]interface{}{
		"enabled":         dm.enabled,
		"contentHeight":   dm.contentHeight,
		"currentSize":     dm.sizer.GetCurrentSize(),
		"targetSize":      dm.sizer.GetTargetSize(),
		"isTransitioning": dm.sizer.IsTransitioning(),
		"screenWidth":     dm.screenWidth,
		"screenHeight":    dm.screenHeight,
	}
}
