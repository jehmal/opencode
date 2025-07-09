package dialog

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/muesli/reflow/truncate"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/components/list"
	"github.com/sst/dgmo/internal/components/modal"
	"github.com/sst/dgmo/internal/components/toast"
	"github.com/sst/dgmo/internal/layout"
	"github.com/sst/dgmo/internal/styles"
	"github.com/sst/dgmo/internal/theme"
	"github.com/sst/dgmo/internal/util"
)

// RevertDialog interface for the checkpoint revert dialog
type RevertDialog interface {
	layout.Modal
}

// checkpointItem is a custom list item for checkpoints
type checkpointItem struct {
	checkpoint   app.Checkpoint
	isConfirming bool
}

func (c checkpointItem) Render(selected bool, width int) string {
	t := theme.CurrentTheme()
	baseStyle := styles.NewStyle()

	var text string
	if c.isConfirming {
		text = "Press Enter again to confirm revert"
	} else {
		// Show user prompt or description
		text = c.checkpoint.Description
		if c.checkpoint.Metadata.UserPrompt != "" {
			text = c.checkpoint.Metadata.UserPrompt
		}
	}

	truncatedStr := truncate.StringWithTail(text, uint(width-1), "...")

	var itemStyle styles.Style
	if selected {
		if c.isConfirming {
			// Red background for revert confirmation
			itemStyle = baseStyle.
				Background(t.Error()).
				Foreground(t.BackgroundElement()).
				Width(width).
				PaddingLeft(1)
		} else {
			// Normal selection
			itemStyle = baseStyle.
				Background(t.Primary()).
				Foreground(t.BackgroundElement()).
				Width(width).
				PaddingLeft(1)
		}
	} else {
		if c.isConfirming {
			// Red text for revert confirmation when not selected
			itemStyle = baseStyle.
				Foreground(t.Error()).
				PaddingLeft(1)
		} else {
			itemStyle = baseStyle.
				PaddingLeft(1)
		}
	}

	// Add time and file count info on second line
	mainText := itemStyle.Render(truncatedStr)

	if !c.isConfirming {
		// Format time ago
		timestamp := time.Unix(c.checkpoint.Timestamp/1000, 0)
		timeAgo := time.Since(timestamp).Round(time.Minute)

		var timeStr string
		if timeAgo < time.Hour {
			timeStr = fmt.Sprintf("%d minutes ago", int(timeAgo.Minutes()))
		} else if timeAgo < 24*time.Hour {
			timeStr = fmt.Sprintf("%d hours ago", int(timeAgo.Hours()))
		} else {
			timeStr = fmt.Sprintf("%d days ago", int(timeAgo.Hours()/24))
		}

		subText := fmt.Sprintf("  %s • %d files changed", timeStr, c.checkpoint.Metadata.FileCount)
		subStyle := baseStyle.Foreground(t.TextMuted()).PaddingLeft(1)

		return mainText + "\n" + subStyle.Render(subText)
	}

	return mainText
}

// revertDialog is the implementation
type revertDialog struct {
	width              int
	height             int
	modal              *modal.Modal
	checkpoints        []app.Checkpoint
	list               list.List[checkpointItem]
	app                *app.App
	revertConfirmation int // -1 means no confirmation, >= 0 means confirming revert at this index
	loading            bool
	error              error
}

func (d *revertDialog) Init() tea.Cmd {
	return d.loadCheckpoints()
}

func (d *revertDialog) loadCheckpoints() tea.Cmd {
	return func() tea.Msg {
		slog.Debug("Loading checkpoints for session", "sessionID", d.app.Session.ID)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		checkpoints, err := d.app.CheckpointService.ListCheckpoints(ctx, d.app.Session.ID)
		if err != nil {
			slog.Error("Failed to load checkpoints", "error", err)
			return checkpointLoadErrorMsg{err: err}
		}

		slog.Debug("Loaded checkpoints", "count", len(checkpoints))
		return checkpointLoadedMsg{checkpoints: checkpoints}
	}
}

type checkpointLoadedMsg struct {
	checkpoints []app.Checkpoint
}

type checkpointLoadErrorMsg struct {
	err error
}

type checkpointRevertedMsg struct{}

func (d *revertDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		d.width = msg.Width
		d.height = msg.Height
		d.list.SetMaxWidth(layout.Current.Container.Width - 12)

	case checkpointLoadedMsg:
		d.loading = false
		d.checkpoints = msg.checkpoints

		// Convert checkpoints to list items
		var items []checkpointItem
		for _, cp := range d.checkpoints {
			items = append(items, checkpointItem{
				checkpoint:   cp,
				isConfirming: false,
			})
		}
		d.list.SetItems(items)

		if len(d.checkpoints) == 0 {
			d.list.SetEmptyMessage("No checkpoints available")
		}

		return d, nil

	case checkpointLoadErrorMsg:
		d.loading = false
		d.error = msg.err
		return d, nil

	case checkpointRevertedMsg:
		// Close dialog and show success
		return d, tea.Sequence(
			util.CmdHandler(modal.CloseModalMsg{}),
			util.CmdHandler(toast.NewSuccessToast("Checkpoint restored successfully")),
		)

	case tea.KeyPressMsg:
		if d.loading {
			return d, nil
		}

		if d.error != nil {
			// Any key closes error state
			return d, util.CmdHandler(modal.CloseModalMsg{})
		}

		switch msg.String() {
		case "enter":
			if d.revertConfirmation >= 0 {
				// Second enter - actually revert
				checkpoint := d.checkpoints[d.revertConfirmation]
				d.revertConfirmation = -1
				return d, d.revertToCheckpoint(checkpoint.ID)
			}

			// First enter - show confirmation
			if _, idx := d.list.GetSelectedItem(); idx >= 0 && idx < len(d.checkpoints) {
				d.revertConfirmation = idx
				d.updateListItems()
				return d, nil
			}

		case "esc", "ctrl+c":
			if d.revertConfirmation >= 0 {
				// Cancel confirmation
				d.revertConfirmation = -1
				d.updateListItems()
				return d, nil
			}
			// Close dialog
			return d, util.CmdHandler(modal.CloseModalMsg{})
		}

		// Reset confirmation on navigation
		if d.revertConfirmation >= 0 && (msg.String() == "up" || msg.String() == "down" ||
			msg.String() == "k" || msg.String() == "j") {
			d.revertConfirmation = -1
			d.updateListItems()
		}
	}

	// Update list
	var cmd tea.Cmd
	listModel, cmd := d.list.Update(msg)
	d.list = listModel.(list.List[checkpointItem])
	return d, cmd
}

func (d *revertDialog) updateListItems() {
	var items []checkpointItem
	for i, cp := range d.checkpoints {
		items = append(items, checkpointItem{
			checkpoint:   cp,
			isConfirming: i == d.revertConfirmation,
		})
	}

	// Preserve current selection
	_, currentIdx := d.list.GetSelectedItem()
	d.list.SetItems(items)
	d.list.SetSelectedIndex(currentIdx)
}

func (d *revertDialog) revertToCheckpoint(checkpointID string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		slog.Debug("Reverting to checkpoint", "checkpointID", checkpointID)

		err := d.app.CheckpointService.RestoreCheckpoint(ctx, checkpointID)
		if err != nil {
			slog.Error("Failed to revert checkpoint", "error", err)
			return toast.NewErrorToast("Failed to revert: " + err.Error())()
		}

		return checkpointRevertedMsg{}
	}
}

func (d *revertDialog) View() string {
	if d.loading {
		return "Loading checkpoints..."
	}

	if d.error != nil {
		return fmt.Sprintf("Error loading checkpoints: %v\n\nPress any key to close", d.error)
	}

	content := d.list.View()

	// Add help text at bottom
	t := theme.CurrentTheme()
	helpText := styles.NewStyle().Foreground(t.TextMuted()).Render("Enter to revert • Esc to cancel")

	return content + "\n\n" + helpText
}

func (d *revertDialog) SetSize(width, height int) {
	d.width = width
	d.height = height
}

func (d *revertDialog) Render(background string) string {
	content := d.View()
	return d.modal.Render(content, background)
}

func (d *revertDialog) Close() tea.Cmd {
	return nil
}

// NewRevertDialog creates a new checkpoint revert dialog
func NewRevertDialog(app *app.App) RevertDialog {
	if app.Session == nil {
		slog.Error("No active session for revert dialog")
		// Return a dialog that shows error
		emptyList := list.NewListComponent(
			[]checkpointItem{},
			10,
			"No active session",
			false,
		)

		dialog := &revertDialog{
			app:                app,
			list:               emptyList,
			revertConfirmation: -1,
			error:              fmt.Errorf("no active session"),
		}

		dialog.modal = modal.New(
			modal.WithTitle("Revert to Checkpoint"),
			modal.WithMaxWidth(layout.Current.Container.Width-8),
		)
		return dialog
	}

	// Create empty list that will be populated after loading
	listComponent := list.NewListComponent(
		[]checkpointItem{},
		10, // maxVisibleItems
		"Loading checkpoints...",
		false, // don't use alphanumeric keys
	)
	listComponent.SetMaxWidth(layout.Current.Container.Width - 12)

	dialog := &revertDialog{
		app:                app,
		list:               listComponent,
		revertConfirmation: -1,
		loading:            true,
	}

	dialog.modal = modal.New(
		modal.WithTitle("Revert to Checkpoint"),
		modal.WithMaxWidth(layout.Current.Container.Width-8),
	)

	return dialog
}

// CloseModalMsg is sent when modal should close
type CloseModalMsg struct{}
