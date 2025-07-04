package dialog

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/muesli/reflow/truncate"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/components/list"
	"github.com/sst/dgmo/internal/components/modal"
	"github.com/sst/dgmo/internal/components/toast"
	"github.com/sst/dgmo/internal/layout"
	"github.com/sst/dgmo/internal/styles"
	"github.com/sst/dgmo/internal/theme"
)

// SubSessionDialog interface for the sub-session navigation dialog
type SubSessionDialog interface {
	layout.Modal
}

// subSessionItem is a custom list item for sub-sessions
type subSessionItem struct {
	sessionID string
	agentName string
	task      string
	status    string
	createdAt time.Time
	parentID  string
}

func (s subSessionItem) Render(selected bool, width int) string {
	t := theme.CurrentTheme()
	baseStyle := styles.NewStyle()

	// Format the display text
	statusIcon := "●"
	statusColor := t.Secondary()
	switch s.status {
	case "running":
		statusIcon = "▶"
		statusColor = t.Primary()
	case "completed":
		statusIcon = "✓"
		statusColor = t.Success()
	case "failed":
		statusIcon = "✗"
		statusColor = t.Error()
	}

	// Format time
	timeStr := s.createdAt.Format("Jan 2 15:04")

	// Build the display string
	text := fmt.Sprintf("%s %s - %s (%s)", statusIcon, s.agentName, s.task, timeStr)
	truncatedStr := truncate.StringWithTail(text, uint(width-1), "...")

	var itemStyle styles.Style
	if selected {
		itemStyle = baseStyle.
			Background(t.Primary()).
			Foreground(t.BackgroundElement()).
			Width(width).
			PaddingLeft(1)
	} else {
		// Apply status color when not selected
		itemStyle = baseStyle.
			Foreground(statusColor).
			PaddingLeft(1)
	}

	return itemStyle.Render(truncatedStr)
}

type subSessionDialog struct {
	width          int
	height         int
	modal          *modal.Modal
	subSessions    []map[string]interface{}
	list           list.List[subSessionItem]
	app            *app.App
	currentSession string
}

func (s *subSessionDialog) Init() tea.Cmd {
	// Load sub-sessions on init
	return s.loadSubSessions
}

func (s *subSessionDialog) loadSubSessions() tea.Msg {
	// Get current session ID
	currentSession := s.app.Session
	if currentSession == nil {
		return toast.NewErrorToast("No active session")
	}

	// TODO: SDK doesn't have GetSubSessionsByParent method yet
	// For now, return empty list
	// ctx := context.Background()
	// subSessions, err := s.app.Client.GetSubSessionsByParent(ctx, currentSession.ID)
	// if err != nil {
	// 	return toast.ErrorMsg{Message: fmt.Sprintf("Failed to load sub-sessions: %v", err)}
	// }

	// Placeholder: return empty sub-sessions for now
	subSessions := []map[string]interface{}{}

	return subSessionsLoadedMsg{
		subSessions: subSessions,
		currentID:   currentSession.ID,
	}
}

type subSessionsLoadedMsg struct {
	subSessions []map[string]interface{}
	currentID   string
}

func (s *subSessionDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		s.width = msg.Width
		s.height = msg.Height
		s.list.SetMaxWidth(layout.Current.Container.Width - 12)

	case subSessionsLoadedMsg:
		s.subSessions = msg.subSessions
		s.currentSession = msg.currentID

		// Convert to list items
		items := make([]subSessionItem, len(s.subSessions))
		for i, sub := range s.subSessions {
			// Extract fields from map
			sessionID, _ := sub["id"].(string)
			agentName, _ := sub["agentName"].(string)
			task, _ := sub["taskDescription"].(string)
			status, _ := sub["status"].(string)
			createdAt, _ := sub["createdAt"].(float64)
			parentID, _ := sub["parentSessionID"].(string)

			items[i] = subSessionItem{
				sessionID: sessionID,
				agentName: agentName,
				task:      task,
				status:    status,
				createdAt: time.Unix(int64(createdAt)/1000, 0),
				parentID:  parentID,
			}
		}
		s.list.SetItems(items)

	case tea.KeyPressMsg:
		switch msg.String() {
		case "enter":
			if len(s.subSessions) > 0 {
				_, selected := s.list.GetSelectedItem()
				if selected >= 0 && selected < len(s.subSessions) {
					// Switch to the selected sub-session
					subSession := s.subSessions[selected]
					sessionID, _ := subSession["id"].(string)
					return s, s.switchToSession(sessionID)
				}
			}

		case "ctrl+b":
			// Return to parent session
			if s.currentSession != "" {
				// Find parent of current session
				for _, sub := range s.subSessions {
					id, _ := sub["id"].(string)
					if id == s.currentSession {
						parentID, _ := sub["parentSessionID"].(string)
						return s, s.switchToSession(parentID)
					}
				}
			}

		case "esc", "ctrl+c":
			return s, nil

		case "r":
			// Refresh the list
			return s, s.loadSubSessions
		}
	}

	// Update the list
	listModel, cmd := s.list.Update(msg)
	s.list = listModel.(list.List[subSessionItem])

	return s, cmd
}

func (s *subSessionDialog) switchToSession(sessionID string) tea.Cmd {
	return func() tea.Msg {
		// TODO: SDK doesn't have session switching yet
		// For now, just close the dialog
		// ctx := context.Background()
		// session, err := s.app.Client.Session.Get(ctx, sessionID)
		// if err != nil {
		// 	return toast.ErrorMsg{Message: fmt.Sprintf("Failed to load session: %v", err)}
		// }
		// s.app.Session = &session

		return tea.Sequence(
			func() tea.Msg { return nil },
			toast.NewSuccessToast("Sub-session switching not yet implemented"),
		)()
	}
}

func (s *subSessionDialog) Render(background string) string {
	t := theme.CurrentTheme()

	// Build content
	var content strings.Builder

	if len(s.subSessions) == 0 {
		emptyStyle := styles.NewStyle().
			Foreground(t.Secondary()).
			Align(lipgloss.Center).
			MarginTop(2)
		content.WriteString(emptyStyle.Render("No sub-sessions found"))
		content.WriteString("\n\n")
		content.WriteString(emptyStyle.Render("Sub-sessions are created when using the task tool"))
	} else {
		// Show list
		content.WriteString(s.list.View())

		// Show help
		helpStyle := styles.NewStyle().
			Foreground(t.Secondary()).
			MarginTop(1)

		helpText := "enter: switch • ctrl+b: parent • r: refresh • esc: close"
		content.WriteString("\n")
		content.WriteString(helpStyle.Render(helpText))
	}

	return s.modal.Render(content.String(), background)
}

func (s *subSessionDialog) View() string {
	// View is required by tea.Model but we use Render for actual display
	return s.Render("")
}

func (s *subSessionDialog) Close() tea.Cmd {
	return nil
}

// NewSubSessionDialog creates a new sub-session navigation dialog
func NewSubSessionDialog(app *app.App) SubSessionDialog {
	width := min(layout.Current.Container.Width-4, 80)
	height := min(layout.Current.Container.Height-4, 20)

	modal := modal.New(
		modal.WithTitle("Sub-Sessions"),
		modal.WithMaxWidth(width),
		modal.WithMaxHeight(height),
	)

	list := list.NewListComponent([]subSessionItem{}, 10, "No sub-sessions", true)
	list.SetMaxWidth(width - 12)

	return &subSessionDialog{
		width:  width,
		height: height,
		modal:  modal,
		list:   list,
		app:    app,
	}
}
