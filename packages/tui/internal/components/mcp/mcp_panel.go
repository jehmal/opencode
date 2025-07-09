package mcp

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/styles"
	"github.com/sst/dgmo/internal/theme"
)

// MCPCallStatus represents the status of an MCP call
type MCPCallStatus int

const (
	MCPCallPending MCPCallStatus = iota
	MCPCallRunning
	MCPCallCompleted
	MCPCallFailed
)

func (s MCPCallStatus) String() string {
	switch s {
	case MCPCallPending:
		return "pending"
	case MCPCallRunning:
		return "running"
	case MCPCallCompleted:
		return "completed"
	case MCPCallFailed:
		return "failed"
	default:
		return "unknown"
	}
}

// MCPCall represents an MCP call with its metadata
type MCPCall struct {
	ID         string
	Server     string
	Method     string
	Status     MCPCallStatus
	StartTime  time.Time
	EndTime    time.Time
	Duration   time.Duration
	Error      string
	Parameters map[string]interface{}
	Response   interface{}
}

// MCPCallStartedMsg is sent when an MCP call starts
type MCPCallStartedMsg struct {
	Call MCPCall
}

// MCPCallCompletedMsg is sent when an MCP call completes
type MCPCallCompletedMsg struct {
	ID       string
	Duration time.Duration
	Response interface{}
	Error    string
}

// MCPCallProgressMsg is sent during MCP call execution
type MCPCallProgressMsg struct {
	ID      string
	Message string
}

// MCPPanelComponent interface for the MCP visualization panel
type MCPPanelComponent interface {
	tea.Model
	tea.ViewModel
	SetSize(width, height int)
	AddCall(call MCPCall)
	UpdateCall(id string, status MCPCallStatus, duration time.Duration, response interface{}, error string)
	GetActiveCalls() []MCPCall
	SetVisible(visible bool)
	IsVisible() bool
}

type mcpPanelComponent struct {
	app       *app.App
	width     int
	height    int
	visible   bool
	calls     map[string]*MCPCall
	callOrder []string // Track order of calls for display
	maxCalls  int      // Maximum number of calls to display
}

// NewMCPPanelComponent creates a new MCP visualization panel
func NewMCPPanelComponent(app *app.App) MCPPanelComponent {
	return &mcpPanelComponent{
		app:       app,
		visible:   true,
		calls:     make(map[string]*MCPCall),
		callOrder: make([]string, 0),
		maxCalls:  5, // Show last 5 MCP calls
	}
}

func (m *mcpPanelComponent) Init() tea.Cmd {
	return nil
}

func (m *mcpPanelComponent) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case MCPCallStartedMsg:
		m.AddCall(msg.Call)
		return m, nil
	case MCPCallCompletedMsg:
		status := MCPCallCompleted
		if msg.Error != "" {
			status = MCPCallFailed
		}
		m.UpdateCall(msg.ID, status, msg.Duration, msg.Response, msg.Error)
		return m, nil
	case MCPCallProgressMsg:
		// Update call with progress message if needed
		if call, exists := m.calls[msg.ID]; exists {
			call.Status = MCPCallRunning
		}
		return m, nil
	}
	return m, nil
}

func (m *mcpPanelComponent) View() string {
	if !m.visible || m.height <= 0 {
		return ""
	}

	t := theme.CurrentTheme()

	// Panel header
	headerStyle := styles.NewStyle().
		Background(t.BackgroundElement()).
		Foreground(t.Text()).
		Bold(true).
		Padding(0, 1).
		Width(m.width)

	header := headerStyle.Render("🔌 MCP Calls")

	// If no calls, show empty state
	if len(m.calls) == 0 {
		emptyStyle := styles.NewStyle().
			Background(t.BackgroundPanel()).
			Foreground(t.TextMuted()).
			Padding(0, 1).
			Width(m.width).
			Height(m.height - 1)

		empty := emptyStyle.Render("No active MCP calls")
		return header + "\n" + empty
	}

	// Render active calls
	callLines := make([]string, 0)
	displayCalls := m.getDisplayCalls()

	for _, call := range displayCalls {
		callLine := m.renderCall(*call)
		callLines = append(callLines, callLine)
	}

	// Fill remaining space
	contentHeight := m.height - 1 // Subtract header
	for len(callLines) < contentHeight {
		emptyLine := styles.NewStyle().
			Background(t.BackgroundPanel()).
			Width(m.width).
			Render("")
		callLines = append(callLines, emptyLine)
	}

	// Truncate if too many lines
	if len(callLines) > contentHeight {
		callLines = callLines[:contentHeight]
	}

	content := strings.Join(callLines, "\n")
	return header + "\n" + content
}

func (m *mcpPanelComponent) renderCall(call MCPCall) string {
	t := theme.CurrentTheme()

	// Status indicator
	var statusColor = t.TextMuted() // Initialize with a default value to infer type
	var statusIcon string

	switch call.Status {
	case MCPCallPending:
		statusColor = t.TextMuted()
		statusIcon = "⏳"
	case MCPCallRunning:
		statusColor = t.Warning()
		statusIcon = "🔄"
	case MCPCallCompleted:
		statusColor = t.Success()
		statusIcon = "✅"
	case MCPCallFailed:
		statusColor = t.Error()
		statusIcon = "❌"
	}
	// Format duration
	duration := ""
	if call.Status == MCPCallCompleted || call.Status == MCPCallFailed {
		duration = fmt.Sprintf(" (%v)", call.Duration.Round(time.Millisecond))
	} else if call.Status == MCPCallRunning {
		duration = fmt.Sprintf(" (%v)", time.Since(call.StartTime).Round(time.Millisecond))
	}

	// Truncate method name if too long
	method := call.Method
	if len(method) > 20 {
		method = method[:17] + "..."
	}

	// Truncate server name if too long
	server := call.Server
	if len(server) > 15 {
		server = server[:12] + "..."
	}

	// Build call info
	callInfo := fmt.Sprintf("%s %s:%s%s", statusIcon, server, method, duration)

	// Add error info if failed
	if call.Status == MCPCallFailed && call.Error != "" {
		errorMsg := call.Error
		if len(errorMsg) > 30 {
			errorMsg = errorMsg[:27] + "..."
		}
		callInfo += fmt.Sprintf(" - %s", errorMsg)
	}

	// Style the line
	lineStyle := styles.NewStyle().
		Background(t.BackgroundPanel()).
		Foreground(statusColor).
		Padding(0, 1).
		Width(m.width)

	return lineStyle.Render(callInfo)
}

func (m *mcpPanelComponent) getDisplayCalls() []*MCPCall {
	// Get the most recent calls up to maxCalls
	displayCalls := make([]*MCPCall, 0)

	// Start from the end of callOrder (most recent)
	start := 0
	if len(m.callOrder) > m.maxCalls {
		start = len(m.callOrder) - m.maxCalls
	}

	for i := start; i < len(m.callOrder); i++ {
		if call, exists := m.calls[m.callOrder[i]]; exists {
			displayCalls = append(displayCalls, call)
		}
	}

	return displayCalls
}

func (m *mcpPanelComponent) SetSize(width, height int) {
	m.width = width
	m.height = height
}

func (m *mcpPanelComponent) AddCall(call MCPCall) {
	// Add or update call
	m.calls[call.ID] = &call

	// Add to order if not already present
	found := false
	for _, id := range m.callOrder {
		if id == call.ID {
			found = true
			break
		}
	}

	if !found {
		m.callOrder = append(m.callOrder, call.ID)
	}

	// Clean up old calls if we have too many
	if len(m.callOrder) > m.maxCalls*2 {
		// Remove oldest calls
		toRemove := m.callOrder[:len(m.callOrder)-m.maxCalls]
		for _, id := range toRemove {
			delete(m.calls, id)
		}
		m.callOrder = m.callOrder[len(m.callOrder)-m.maxCalls:]
	}
}

func (m *mcpPanelComponent) UpdateCall(id string, status MCPCallStatus, duration time.Duration, response interface{}, error string) {
	if call, exists := m.calls[id]; exists {
		call.Status = status
		call.Duration = duration
		call.Response = response
		call.Error = error

		if status == MCPCallCompleted || status == MCPCallFailed {
			call.EndTime = time.Now()
		}
	}
}

func (m *mcpPanelComponent) GetActiveCalls() []MCPCall {
	activeCalls := make([]MCPCall, 0)
	for _, call := range m.calls {
		if call.Status == MCPCallPending || call.Status == MCPCallRunning {
			activeCalls = append(activeCalls, *call)
		}
	}
	return activeCalls
}

func (m *mcpPanelComponent) SetVisible(visible bool) {
	m.visible = visible
}

func (m *mcpPanelComponent) IsVisible() bool {
	return m.visible
}
