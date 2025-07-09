package dialog

import (
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/layout"
)

// CheckpointInfo represents a checkpoint
type CheckpointInfo struct {
	ID           string `json:"id"`
	SessionID    string `json:"sessionId"`
	MessageID    string `json:"messageId"`
	Timestamp    int64  `json:"timestamp"`
	Description  string `json:"description"`
	MessageCount int    `json:"messageCount"`
	FileCount    int    `json:"fileCount"`
}

// RevertDialog interface for the checkpoint revert dialog
type RevertDialog interface {
	layout.Modal
}

// revertDialog is the implementation
type revertDialog struct {
	app         *app.App
	checkpoints []CheckpointInfo
	loading     bool
	error       string
	width       int
	height      int
}

// NewRevertDialog creates a new revert dialog
func NewRevertDialog(app *app.App) RevertDialog {
	d := &revertDialog{
		app:     app,
		loading: false,
		error:   "Checkpoint functionality not yet implemented",
	}
	return d
}

// Init initializes the dialog
func (d *revertDialog) Init() tea.Cmd {
	return nil
}

// Update handles tea messages
func (d *revertDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc", "ctrl+c":
			return d, func() tea.Msg { return CloseModalMsg{} }
		}
	}
	return d, nil
}

// View renders the dialog
func (d *revertDialog) View() string {
	// Create dialog content
	content := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#ff0000")).
		Render("Checkpoint functionality not yet implemented")

	// Create dialog box
	dialogStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#666666")).
		Padding(1, 2).
		Width(60).
		Height(5)

	return dialogStyle.Render(content)
}

// SetSize sets the dialog size
func (d *revertDialog) SetSize(width, height int) {
	d.width = width
	d.height = height
}

// Render renders the dialog with background
func (d *revertDialog) Render(background string) string {
	return d.View()
}

// Close closes the dialog
func (d *revertDialog) Close() tea.Cmd {
	return func() tea.Msg { return CloseModalMsg{} }
}

// CloseModalMsg is sent when modal should close
type CloseModalMsg struct{}
