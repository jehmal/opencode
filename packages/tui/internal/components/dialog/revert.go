package dialog

import (
	"context"
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/components/toast"
	"github.com/sst/dgmo/internal/layout"
)

// Messages for checkpoint operations
type checkpointsLoadedMsg struct {
	checkpoints []app.Checkpoint
}

type checkpointErrorMsg struct {
	err error
}

type checkpointRestoredMsg struct{}

// RevertDialog interface for the checkpoint revert dialog
type RevertDialog interface {
	layout.Modal
}

// revertDialog is the implementation
type revertDialog struct {
	app           *app.App
	checkpoints   []app.Checkpoint
	selectedIndex int
	loading       bool
	restoring     bool
	error         string
	width         int
	height        int
}

// NewRevertDialog creates a new revert dialog
func NewRevertDialog(app *app.App) RevertDialog {
	return &revertDialog{
		app:           app,
		loading:       true,
		selectedIndex: 0,
	}
}

// Init initializes the dialog and loads checkpoints
func (d *revertDialog) Init() tea.Cmd {
	return d.loadCheckpoints()
}

// loadCheckpoints fetches checkpoints from the server
func (d *revertDialog) loadCheckpoints() tea.Cmd {
	return func() tea.Msg {
		if d.app.Session == nil {
			return checkpointErrorMsg{err: fmt.Errorf("no active session")}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		checkpoints, err := d.app.CheckpointService.ListCheckpoints(ctx, d.app.Session.ID)
		if err != nil {
			return checkpointErrorMsg{err: err}
		}

		return checkpointsLoadedMsg{checkpoints: checkpoints}
	}
}

// restoreCheckpoint restores to the selected checkpoint
func (d *revertDialog) restoreCheckpoint(checkpointID string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		err := d.app.CheckpointService.RestoreCheckpoint(ctx, checkpointID)
		if err != nil {
			return checkpointErrorMsg{err: err}
		}

		return checkpointRestoredMsg{}
	}
}

// Update handles tea messages
func (d *revertDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		d.width = msg.Width
		d.height = msg.Height
		return d, nil

	case checkpointsLoadedMsg:
		d.loading = false
		d.checkpoints = msg.checkpoints

		if len(d.checkpoints) == 0 {
			d.error = "No checkpoints available"
		}
		return d, nil

	case checkpointErrorMsg:
		d.loading = false
		d.restoring = false
		d.error = msg.err.Error()
		return d, nil

	case checkpointRestoredMsg:
		// Close dialog and show success toast
		return d, tea.Batch(
			func() tea.Msg { return CloseModalMsg{} },
			func() tea.Msg { return toast.NewSuccessToast("Checkpoint restored successfully") },
		)

	case tea.KeyMsg:
		if d.loading || d.restoring {
			return d, nil
		}

		switch msg.String() {
		case "esc", "ctrl+c", "q":
			return d, func() tea.Msg { return CloseModalMsg{} }

		case "up", "k":
			if d.selectedIndex > 0 && len(d.checkpoints) > 0 {
				d.selectedIndex--
			}

		case "down", "j":
			if d.selectedIndex < len(d.checkpoints)-1 {
				d.selectedIndex++
			}

		case "enter":
			if d.error != "" {
				return d, func() tea.Msg { return CloseModalMsg{} }
			}

			if len(d.checkpoints) > 0 {
				d.restoring = true
				checkpoint := d.checkpoints[d.selectedIndex]
				return d, d.restoreCheckpoint(checkpoint.ID)
			}
		}
	}

	return d, nil
}

// View renders the dialog
func (d *revertDialog) View() string {
	var content strings.Builder

	if d.loading {
		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("#666666")).
			Render("Loading checkpoints..."))
	} else if d.restoring {
		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("#7D56F4")).
			Render("Restoring checkpoint..."))
	} else if d.error != "" {
		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FF0000")).
			Render(fmt.Sprintf("Error: %s\n\nPress Enter to close", d.error)))
	} else if len(d.checkpoints) == 0 {
		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("#666666")).
			Render("No checkpoints available"))
	} else {
		// Show checkpoint list
		content.WriteString(lipgloss.NewStyle().
			Bold(true).
			Render("Select a checkpoint to revert to:"))
		content.WriteString("\n\n")

		for i, cp := range d.checkpoints {
			// Format checkpoint display
			t := time.Unix(cp.Timestamp/1000, 0)
			timeAgo := time.Since(t).Round(time.Minute)

			var timeStr string
			if timeAgo < time.Hour {
				timeStr = fmt.Sprintf("%d minutes ago", int(timeAgo.Minutes()))
			} else if timeAgo < 24*time.Hour {
				timeStr = fmt.Sprintf("%d hours ago", int(timeAgo.Hours()))
			} else {
				timeStr = fmt.Sprintf("%d days ago", int(timeAgo.Hours()/24))
			}

			// Show user prompt or description
			title := cp.Description
			if cp.Metadata.UserPrompt != "" {
				title = cp.Metadata.UserPrompt
				if len(title) > 60 {
					title = title[:57] + "..."
				}
			}

			// Format the line
			line := fmt.Sprintf("%s\n  %s • %d files", title, timeStr, cp.Metadata.FileCount)

			// Apply selection styling
			if i == d.selectedIndex {
				line = lipgloss.NewStyle().
					Background(lipgloss.Color("#7D56F4")).
					Foreground(lipgloss.Color("#FFFFFF")).
					PaddingLeft(1).
					PaddingRight(1).
					Render(line)
			} else {
				line = lipgloss.NewStyle().
					PaddingLeft(1).
					Render(line)
			}

			content.WriteString(line)
			if i < len(d.checkpoints)-1 {
				content.WriteString("\n\n")
			}
		}

		content.WriteString("\n\n")
		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("#666666")).
			Render("↑/↓ to navigate • Enter to restore • Esc to cancel"))
	}

	// Create dialog box
	dialogStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#666666")).
		Padding(1, 2)

	// Set appropriate size
	if d.error != "" || d.loading || d.restoring || len(d.checkpoints) == 0 {
		dialogStyle = dialogStyle.Width(60).Height(7)
	} else {
		// Calculate height based on content
		lines := strings.Count(content.String(), "\n") + 4
		dialogStyle = dialogStyle.
			Width(70).
			Height(min(lines, 20))
	}

	return dialogStyle.Render(content.String())
}

// SetSize sets the dialog size
func (d *revertDialog) SetSize(width, height int) {
	d.width = width
	d.height = height
}

// Render renders the dialog with background
func (d *revertDialog) Render(background string) string {
	if d.width > 0 && d.height > 0 {
		dialog := d.View()
		return lipgloss.Place(d.width, d.height, lipgloss.Center, lipgloss.Center, dialog)
	}
	return d.View()
}

// Close closes the dialog
func (d *revertDialog) Close() tea.Cmd {
	return func() tea.Msg { return CloseModalMsg{} }
}

// Helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// CloseModalMsg is sent when modal should close
type CloseModalMsg struct{}
