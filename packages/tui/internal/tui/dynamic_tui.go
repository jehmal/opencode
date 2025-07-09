package tui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/components/chat"
	"github.com/sst/dgmo/internal/layout"
	"github.com/sst/dgmo/internal/styles"
)

// DynamicTUIConfig holds configuration for dynamic TUI behavior
type DynamicTUIConfig struct {
	EnableDynamicSizing bool
	MessagesPreset      string
	EditorPreset        string
	UpdateInterval      time.Duration
	DebugMode           bool
}

// DefaultDynamicTUIConfig returns sensible defaults
func DefaultDynamicTUIConfig() DynamicTUIConfig {
	return DynamicTUIConfig{
		EnableDynamicSizing: true,
		MessagesPreset:      "normal",
		EditorPreset:        "compact",
		UpdateInterval:      100 * time.Millisecond,
		DebugMode:           false,
	}
}

// DynamicAppModel extends the base appModel with dynamic sizing capabilities
type DynamicAppModel struct {
	*appModel
	config          DynamicTUIConfig
	dynamicMessages chat.DynamicMessagesComponent
	dynamicEditor   chat.DynamicEditorComponent
	lastSizeUpdate  time.Time
	sizingDebugInfo string
}

// NewDynamicModel creates a new dynamic TUI model
func NewDynamicModel(app *app.App, config DynamicTUIConfig) tea.Model {
	// Create the base model
	baseModel := NewModel(app).(*appModel)

	// Create dynamic components
	dynamicMessages := chat.CreateDynamicMessagesWithPreset(app, config.MessagesPreset)
	dynamicEditor := chat.CreateDynamicEditorWithPreset(app, config.EditorPreset)

	// Enable/disable dynamic sizing based on config
	dynamicMessages.SetDynamicSizing(config.EnableDynamicSizing)
	dynamicEditor.SetDynamicSizing(config.EnableDynamicSizing)

	return &DynamicAppModel{
		appModel:        baseModel,
		config:          config,
		dynamicMessages: dynamicMessages,
		dynamicEditor:   dynamicEditor,
		lastSizeUpdate:  time.Now(),
	}
}

// Update handles dynamic sizing updates
func (dam *DynamicAppModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	// Handle dynamic sizing specific messages
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		// Update base model first
		updated, cmd := dam.appModel.Update(msg)
		dam.appModel = updated.(*appModel)
		cmds = append(cmds, cmd)

		// Update dynamic components with optimal sizing
		if dam.config.EnableDynamicSizing {
			dam.updateDynamicSizing()
		}

		return dam, tea.Batch(cmds...)

	case DynamicSizingToggleMsg:
		dam.config.EnableDynamicSizing = !dam.config.EnableDynamicSizing
		dam.dynamicMessages.SetDynamicSizing(dam.config.EnableDynamicSizing)
		dam.dynamicEditor.SetDynamicSizing(dam.config.EnableDynamicSizing)

		statusMsg := "Dynamic sizing enabled"
		if !dam.config.EnableDynamicSizing {
			statusMsg = "Dynamic sizing disabled"
		}

		return dam, func() tea.Msg {
			return statusMsg
		}

	case DynamicSizingPresetMsg:
		if preset, exists := layout.GetPreset(msg.PresetName); exists {
			dam.dynamicMessages.SetSizingConfig(preset)

			// Adjust preset for editor
			editorPreset := preset
			if preset.MaxHeightPercent > 0.25 {
				editorPreset.MaxHeightPercent = 0.25
			} else {
				editorPreset.MaxHeightPercent = preset.MaxHeightPercent
			}
			if editorPreset.MaxHeight == 0 || editorPreset.MaxHeight > 20 {
				editorPreset.MaxHeight = 20
			}
			dam.dynamicEditor.SetSizingConfig(editorPreset)

			return dam, func() tea.Msg {
				return fmt.Sprintf("Applied sizing preset: %s", msg.PresetName)
			}
		}

		return dam, func() tea.Msg {
			return fmt.Sprintf("Unknown preset: %s", msg.PresetName)
		}
	}

	// Update dynamic components
	if dam.config.EnableDynamicSizing {
		// Update messages component
		updatedMessages, cmd := dam.dynamicMessages.Update(msg)
		dam.dynamicMessages = updatedMessages.(chat.DynamicMessagesComponent)
		cmds = append(cmds, cmd)

		// Update editor component
		updatedEditor, cmd := dam.dynamicEditor.Update(msg)
		dam.dynamicEditor = updatedEditor.(chat.DynamicEditorComponent)
		cmds = append(cmds, cmd)

		// Replace the base components with dynamic ones
		dam.appModel.messages = dam.dynamicMessages
		dam.appModel.editor = dam.dynamicEditor
	}

	// Update base model
	updated, cmd := dam.appModel.Update(msg)
	dam.appModel = updated.(*appModel)
	cmds = append(cmds, cmd)

	// Update debug info if enabled
	if dam.config.DebugMode {
		dam.updateDebugInfo()
	}

	return dam, tea.Batch(cmds...)
}

// View renders the dynamic TUI
func (dam *DynamicAppModel) View() string {
	baseView := dam.appModel.View()

	// Add debug info if enabled
	if dam.config.DebugMode && dam.sizingDebugInfo != "" {
		debugStyle := styles.NewStyle().
			Foreground(compat.AdaptiveColor{Light: lipgloss.Color("240"), Dark: lipgloss.Color("240")}).
			Background(compat.AdaptiveColor{Light: lipgloss.Color("235"), Dark: lipgloss.Color("235")}).
			Padding(0, 1)

		debugView := debugStyle.Render(dam.sizingDebugInfo)
		baseView = lipgloss.JoinVertical(lipgloss.Left, baseView, debugView)
	}

	return baseView
}

// updateDynamicSizing recalculates and applies optimal sizing
func (dam *DynamicAppModel) updateDynamicSizing() {
	if !dam.config.EnableDynamicSizing {
		return
	}

	// Get current screen dimensions
	screenHeight := dam.appModel.height
	screenWidth := dam.appModel.width

	// Calculate optimal heights
	messagesOptimalHeight := dam.dynamicMessages.GetOptimalHeight(screenHeight - 10) // Leave room for editor and status
	editorOptimalHeight := dam.dynamicEditor.GetOptimalHeight(screenHeight / 4)      // Max 25% of screen

	// Ensure we don't exceed screen height
	totalHeight := messagesOptimalHeight + editorOptimalHeight + 2 // +2 for status bar
	if totalHeight > screenHeight {
		// Prioritize editor, reduce messages height
		messagesOptimalHeight = screenHeight - editorOptimalHeight - 2
		if messagesOptimalHeight < 5 {
			messagesOptimalHeight = 5
			editorOptimalHeight = screenHeight - messagesOptimalHeight - 2
		}
	}

	// Apply the calculated sizes
	dam.dynamicMessages.SetSize(screenWidth, messagesOptimalHeight)
	dam.dynamicEditor.SetSize(min(screenWidth, 80), editorOptimalHeight)

	dam.lastSizeUpdate = time.Now()
}

// updateDebugInfo updates the debug information display
func (dam *DynamicAppModel) updateDebugInfo() {
	if !dam.config.DebugMode {
		return
	}

	messagesInfo := dam.dynamicMessages.GetSizingInfo()
	editorInfo := dam.dynamicEditor.GetEditorSizingInfo()

	debugLines := []string{
		fmt.Sprintf("Dynamic Sizing: %v", dam.config.EnableDynamicSizing),
		fmt.Sprintf("Messages: %d→%d (content: %d)",
			messagesInfo["currentSize"], messagesInfo["targetSize"], messagesInfo["contentHeight"]),
		fmt.Sprintf("Editor: %d→%d (content: %d)",
			editorInfo["currentSize"], editorInfo["targetSize"], editorInfo["contentHeight"]),
		fmt.Sprintf("Screen: %dx%d", dam.appModel.width, dam.appModel.height),
	}

	dam.sizingDebugInfo = strings.Join(debugLines, " | ")
}

// Dynamic sizing message types
type DynamicSizingToggleMsg struct{}
type DynamicSizingPresetMsg struct {
	PresetName string
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// CreateDynamicTUIWithPresets creates a dynamic TUI with specific presets
func CreateDynamicTUIWithPresets(app *app.App, messagesPreset, editorPreset string) tea.Model {
	config := DefaultDynamicTUIConfig()
	config.MessagesPreset = messagesPreset
	config.EditorPreset = editorPreset
	return NewDynamicModel(app, config)
}

// CreateCompactDynamicTUI creates a TUI optimized for smaller screens
func CreateCompactDynamicTUI(app *app.App) tea.Model {
	return CreateDynamicTUIWithPresets(app, "compact", "compact")
}

// CreateGenerousDynamicTUI creates a TUI optimized for larger screens
func CreateGenerousDynamicTUI(app *app.App) tea.Model {
	return CreateDynamicTUIWithPresets(app, "generous", "normal")
}

// ToggleDynamicSizing returns a command to toggle dynamic sizing
func ToggleDynamicSizing() tea.Cmd {
	return func() tea.Msg {
		return DynamicSizingToggleMsg{}
	}
}

// SetDynamicSizingPreset returns a command to set a sizing preset
func SetDynamicSizingPreset(presetName string) tea.Cmd {
	return func() tea.Msg {
		return DynamicSizingPresetMsg{PresetName: presetName}
	}
}
