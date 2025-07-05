package dialog

import (
	"context"
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
	isChild   bool
	level     int
	// New fields for better display
	displayType string // "direct-child", "sibling", "all"
	note        string
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

	// Build the display string with context
	prefix := ""
	switch s.displayType {
	case "sibling":
		prefix = "[Sibling] "
	case "all":
		if s.note != "" {
			prefix = fmt.Sprintf("[%s] ", s.note)
		}
	}

	text := fmt.Sprintf("%s%s %s - %s (%s)", prefix, statusIcon, s.agentName, s.task, timeStr)
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
	// Following the sessions dialog pattern - data is loaded in constructor
	return nil
}

func (s *subSessionDialog) loadSubSessions() tea.Msg {
	// Get current session ID
	currentSession := s.app.Session
	if currentSession == nil {
		return toast.NewErrorToast("No active session")
	}

	ctx := context.Background()
	var allSubSessions []map[string]interface{}

	// Strategy 1: Get direct children of current session
	endpoint := fmt.Sprintf("/session/%s/sub-sessions", currentSession.ID)
	var directChildren []map[string]interface{}
	err := s.app.Client.Get(ctx, endpoint, nil, &directChildren)

	// Also add a visible indicator in the UI
	if err != nil {
		return toast.NewErrorToast(fmt.Sprintf("API Error: %v", err))
	}

	if err == nil && len(directChildren) > 0 {
		for i := range directChildren {
			directChildren[i]["_displayType"] = "direct-child"
		}
		allSubSessions = append(allSubSessions, directChildren...)
	}

	// Strategy 2: If current session has a parent, get siblings
	if currentSession.ParentID != "" {
		parentEndpoint := fmt.Sprintf("/session/%s/sub-sessions", currentSession.ParentID)
		var siblings []map[string]interface{}
		err = s.app.Client.Get(ctx, parentEndpoint, nil, &siblings)

		if err == nil && len(siblings) > 0 {
			// Mark siblings and exclude current session
			for i := range siblings {
				if siblings[i]["id"] != currentSession.ID {
					siblings[i]["_displayType"] = "sibling"
					siblings[i]["_note"] = "Sibling sub-session"
					allSubSessions = append(allSubSessions, siblings[i])
				}
			}
		}
	}

	// Strategy 3: Commented out - we don't want to show ALL sub-sessions
	// Only show direct children and siblings

	return subSessionsLoadedMsg{
		subSessions: allSubSessions,
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

		// Build a tree structure from sub-sessions
		items := s.buildTreeStructure(s.subSessions, msg.currentID)
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
						parentID, _ := sub["parentSessionId"].(string) // Fixed field name
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
	return s.app.SwitchToSession(context.Background(), sessionID)
}
func (s *subSessionDialog) Render(background string) string {
	t := theme.CurrentTheme()

	// Build content
	var content strings.Builder

	// Add breadcrumb navigation
	breadcrumbStyle := styles.NewStyle().
		Foreground(t.Secondary()).
		MarginBottom(1)

	breadcrumb := "Session Navigation"
	if s.app.Session != nil {
		if s.app.Session.ParentID != "" {
			breadcrumb = fmt.Sprintf("📁 Sub-Session: %s", s.app.Session.Title)
		} else {
			breadcrumb = fmt.Sprintf("📁 Main Session: %s", s.app.Session.Title)
		}
	}
	content.WriteString(breadcrumbStyle.Render(breadcrumb))
	content.WriteString("\n")

	if len(s.subSessions) == 0 {
		emptyStyle := styles.NewStyle().
			Foreground(t.Secondary()).
			Align(lipgloss.Center).
			MarginTop(2)
		content.WriteString(emptyStyle.Render("No sub-sessions found"))
		content.WriteString("\n\n")
		content.WriteString(emptyStyle.Render("💡 Create agents using: 'Create X agents to [task]'"))
		content.WriteString("\n")
		content.WriteString(emptyStyle.Render("Example: Create 3 agents to analyze this code"))
		content.WriteString("\n\n")
		hintStyle := styles.NewStyle().
			Foreground(t.Accent()).
			Align(lipgloss.Center)
		content.WriteString(hintStyle.Render(fmt.Sprintf("Current Session: %s", s.currentSession)))
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

// buildTreeStructure organizes sub-sessions into a tree hierarchy
func (s *subSessionDialog) buildTreeStructure(subSessions []map[string]interface{}, currentSessionID string) []subSessionItem {
	var items []subSessionItem

	// Create a map for quick lookup
	sessionMap := make(map[string]map[string]interface{})
	for _, sub := range subSessions {
		if id, ok := sub["id"].(string); ok {
			sessionMap[id] = sub
		}
	}

	// Find root sessions (those whose parent is the current session)
	var roots []map[string]interface{}
	for _, sub := range subSessions {
		parentID, _ := sub["parentSessionId"].(string)
		if parentID == currentSessionID {
			roots = append(roots, sub)
		}
	}

	// If no roots found, show all sessions flat
	if len(roots) == 0 {
		for _, sub := range subSessions {
			items = append(items, s.createSubSessionItem(sub, false, 0))
		}
		return items
	}

	// Build tree recursively
	for _, root := range roots {
		items = append(items, s.createSubSessionItem(root, false, 0))
		items = append(items, s.buildSubTree(sessionMap, root["id"].(string), 1)...)
	}

	return items
}

// buildSubTree recursively builds child sessions
func (s *subSessionDialog) buildSubTree(sessionMap map[string]map[string]interface{}, parentID string, level int) []subSessionItem {
	var items []subSessionItem

	for _, sub := range sessionMap {
		if subParentID, _ := sub["parentSessionId"].(string); subParentID == parentID {
			items = append(items, s.createSubSessionItem(sub, true, level))
			// Recursively add children
			if id, ok := sub["id"].(string); ok {
				items = append(items, s.buildSubTree(sessionMap, id, level+1)...)
			}
		}
	}

	return items
}

// createSubSessionItem creates a subSessionItem from raw data
func (s *subSessionDialog) createSubSessionItem(sub map[string]interface{}, isChild bool, level int) subSessionItem {
	sessionID, _ := sub["id"].(string)
	agentName, _ := sub["agentName"].(string)
	task, _ := sub["taskDescription"].(string)
	status, _ := sub["status"].(string)
	createdAt, _ := sub["createdAt"].(float64)
	parentID, _ := sub["parentSessionId"].(string)
	displayType, _ := sub["_displayType"].(string)
	note, _ := sub["_note"].(string)

	return subSessionItem{
		sessionID:   sessionID,
		agentName:   agentName,
		task:        task,
		status:      status,
		createdAt:   time.Unix(int64(createdAt)/1000, 0),
		parentID:    parentID,
		isChild:     isChild,
		level:       level,
		displayType: displayType,
		note:        note,
	}
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

	dialog := &subSessionDialog{
		width:  width,
		height: height,
		modal:  modal,
		list:   list,
		app:    app,
	}

	// Load sub-sessions immediately following the sessions dialog pattern
	ctx := context.Background()
	currentSession := app.Session
	if currentSession != nil {

		var allSubSessions []map[string]interface{}

		// Strategy 1: Get direct children of current session
		endpoint := fmt.Sprintf("/session/%s/sub-sessions", currentSession.ID)
		var directChildren []map[string]interface{}
		err := app.Client.Get(ctx, endpoint, nil, &directChildren)

		if err == nil && len(directChildren) > 0 {

			for i := range directChildren {
				directChildren[i]["_displayType"] = "direct-child"
			}
			allSubSessions = append(allSubSessions, directChildren...)
		}

		// Strategy 2: If current session has a parent, get siblings
		if currentSession.ParentID != "" {

			parentEndpoint := fmt.Sprintf("/session/%s/sub-sessions", currentSession.ParentID)
			var siblings []map[string]interface{}
			err = app.Client.Get(ctx, parentEndpoint, nil, &siblings)

			if err == nil && len(siblings) > 0 {

				// Mark siblings and exclude current session
				for i := range siblings {
					if siblings[i]["id"] != currentSession.ID {
						siblings[i]["_displayType"] = "sibling"
						siblings[i]["_note"] = "Sibling sub-session"
						allSubSessions = append(allSubSessions, siblings[i])
					}
				}
			}
		}

		// Build tree structure and set items
		if len(allSubSessions) > 0 {
			dialog.subSessions = allSubSessions
			items := dialog.buildTreeStructure(allSubSessions, currentSession.ID)
			dialog.list.SetItems(items)

		}
	}

	return dialog
}
