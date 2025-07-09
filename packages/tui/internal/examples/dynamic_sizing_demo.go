package examples

import (
	"context"
	"fmt"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/components/chat"
	"github.com/sst/dgmo/internal/layout"
	"github.com/sst/dgmo/internal/tui"
)

// DynamicSizingDemo demonstrates the dynamic sizing capabilities
type DynamicSizingDemo struct {
	app             *app.App
	dynamicMessages chat.DynamicMessagesComponent
	dynamicEditor   chat.DynamicEditorComponent
	width, height   int
	currentPreset   string
	presets         []string
	presetIndex     int
}

// NewDynamicSizingDemo creates a new demo instance
func NewDynamicSizingDemo(app *app.App) *DynamicSizingDemo {
	presets := []string{"compact", "normal", "generous", "fullscreen"}

	return &DynamicSizingDemo{
		app:             app,
		dynamicMessages: chat.CreateDynamicMessagesWithPreset(app, "normal"),
		dynamicEditor:   chat.CreateDynamicEditorWithPreset(app, "compact"),
		currentPreset:   "normal",
		presets:         presets,
		presetIndex:     1, // Start with "normal"
	}
}

func (d *DynamicSizingDemo) Init() tea.Cmd {
	var cmds []tea.Cmd
	cmds = append(cmds, d.dynamicMessages.Init())
	cmds = append(cmds, d.dynamicEditor.Init())
	return tea.Batch(cmds...)
}

func (d *DynamicSizingDemo) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		d.width, d.height = msg.Width, msg.Height

		// Update layout info
		layout.Current = &layout.LayoutInfo{
			Viewport: layout.Dimensions{
				Width:  d.width,
				Height: d.height,
			},
			Container: layout.Dimensions{
				Width: min(d.width, 80),
			},
		}

		// Calculate optimal sizes
		messagesHeight := d.dynamicMessages.GetOptimalHeight(d.height - 10)
		editorHeight := d.dynamicEditor.GetOptimalHeight(d.height / 4)

		// Apply sizes
		cmds = append(cmds, d.dynamicMessages.SetSize(d.width, messagesHeight))
		cmds = append(cmds, d.dynamicEditor.SetSize(min(d.width, 80), editorHeight))

	case tea.KeyPressMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return d, tea.Quit
		case "p":
			// Cycle through presets
			d.presetIndex = (d.presetIndex + 1) % len(d.presets)
			d.currentPreset = d.presets[d.presetIndex]

			if config, exists := layout.GetPreset(d.currentPreset); exists {
				d.dynamicMessages.SetSizingConfig(config)

				// Adjust for editor
				editorConfig := config
				editorConfig.MaxHeightPercent = min(config.MaxHeightPercent, 0.25)
				if editorConfig.MaxHeight == 0 || editorConfig.MaxHeight > 20 {
					editorConfig.MaxHeight = 20
				}
				d.dynamicEditor.SetSizingConfig(editorConfig)

				// Recalculate sizes
				messagesHeight := d.dynamicMessages.GetOptimalHeight(d.height - 10)
				editorHeight := d.dynamicEditor.GetOptimalHeight(d.height / 4)

				cmds = append(cmds, d.dynamicMessages.SetSize(d.width, messagesHeight))
				cmds = append(cmds, d.dynamicEditor.SetSize(min(d.width, 80), editorHeight))
			}
		case "t":
			// Toggle dynamic sizing
			enabled := !d.isDynamicSizingEnabled()
			d.dynamicMessages.SetDynamicSizing(enabled)
			d.dynamicEditor.SetDynamicSizing(enabled)
		case "d":
			// Show debug info
			return d, func() tea.Msg {
				return debugInfoMsg{
					messages: d.dynamicMessages.GetSizingInfo(),
					editor:   d.dynamicEditor.GetEditorSizingInfo(),
				}
			}
		}

	case debugInfoMsg:
		// Handle debug info display (could show in status or toast)
		fmt.Printf("Debug Info - Messages: %+v, Editor: %+v\n", msg.messages, msg.editor)
	}

	// Update components
	updated, cmd := d.dynamicMessages.Update(msg)
	d.dynamicMessages = updated.(chat.DynamicMessagesComponent)
	cmds = append(cmds, cmd)

	updated, cmd = d.dynamicEditor.Update(msg)
	d.dynamicEditor = updated.(chat.DynamicEditorComponent)
	cmds = append(cmds, cmd)

	return d, tea.Batch(cmds...)
}

func (d *DynamicSizingDemo) View() string {
	if d.width == 0 {
		return "Initializing dynamic sizing demo..."
	}

	// Create header
	header := fmt.Sprintf("Dynamic Sizing Demo - Preset: %s (Press 'p' to cycle, 't' to toggle, 'd' for debug, 'q' to quit)",
		d.currentPreset)

	// Get component views
	messagesView := d.dynamicMessages.View()
	editorView := d.dynamicEditor.View()

	// Create layout using the flex system
	mainLayout := layout.Render(
		layout.FlexOptions{
			Direction: layout.Column,
			Width:     d.width,
			Height:    d.height - 2, // Leave room for header
		},
		layout.FlexItem{
			View: messagesView,
			Grow: true,
		},
		layout.FlexItem{
			View:      editorView,
			FixedSize: d.dynamicEditor.GetContentHeight(),
		},
	)

	return header + "\n" + mainLayout
}

func (d *DynamicSizingDemo) isDynamicSizingEnabled() bool {
	info := d.dynamicMessages.GetSizingInfo()
	if enabled, ok := info["enabled"].(bool); ok {
		return enabled
	}
	return true // Default to enabled
}

// Helper message types
type debugInfoMsg struct {
	messages map[string]interface{}
	editor   map[string]interface{}
}

// Helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// RunDynamicSizingDemo runs the dynamic sizing demonstration
func RunDynamicSizingDemo(app *app.App) error {
	demo := NewDynamicSizingDemo(app)

	program := tea.NewProgram(
		demo,
		tea.WithKeyboardEnhancements(),
		tea.WithMouseCellMotion(),
	)

	_, err := program.Run()
	return err
}

// IntegrateWithExistingTUI shows how to integrate dynamic sizing with the existing TUI
func IntegrateWithExistingTUI(app *app.App) tea.Model {
	// This function demonstrates how to modify the existing TUI to use dynamic sizing

	// Step 1: Create dynamic components
	dynamicMessages := chat.CreateDynamicMessagesWithPreset(app, "normal")
	dynamicEditor := chat.CreateDynamicEditorWithPreset(app, "compact")

	// Step 2: Create the base TUI model
	baseModel := tui.NewModel(app).(*tui.appModel)

	// Step 3: Replace the components (this would require modifying the appModel struct)
	// baseModel.messages = dynamicMessages
	// baseModel.editor = dynamicEditor

	// For now, return the base model with a note about integration
	// In a real implementation, you would:
	// 1. Modify the appModel struct to support dynamic components
	// 2. Update the chat() method to use dynamic sizing
	// 3. Add command handlers for dynamic sizing controls

	return baseModel
}

// GetDynamicSizingStats returns statistics about dynamic sizing performance
func GetDynamicSizingStats(messages chat.DynamicMessagesComponent, editor chat.DynamicEditorComponent) map[string]interface{} {
	return map[string]interface{}{
		"messages":  messages.GetSizingInfo(),
		"editor":    editor.GetEditorSizingInfo(),
		"timestamp": tea.Time{},
	}
}
