package websocket

import (
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/dgmo/internal/components/mcp"
)

// MCPEventData represents the data structure for MCP events from WebSocket
type MCPEventData struct {
	ID         string                 `json:"id"`
	Server     string                 `json:"server,omitempty"`
	Method     string                 `json:"method,omitempty"`
	SessionID  string                 `json:"sessionID,omitempty"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
	Timestamp  int64                  `json:"timestamp"`
	Duration   int64                  `json:"duration,omitempty"`
	Response   interface{}            `json:"response,omitempty"`
	Error      string                 `json:"error,omitempty"`
	Message    string                 `json:"message,omitempty"`
}

// MCPEventProcessor processes MCP events and converts them to Bubble Tea messages
type MCPEventProcessor struct {
	mcpPanel mcp.MCPPanelComponent
}

// NewMCPEventProcessor creates a new MCP event processor
func NewMCPEventProcessor(mcpPanel mcp.MCPPanelComponent) *MCPEventProcessor {
	return &MCPEventProcessor{
		mcpPanel: mcpPanel,
	}
}

// HandleMCPEvent processes MCP events and returns appropriate Bubble Tea commands
func (h *MCPEventProcessor) HandleMCPEvent(eventType string, data MCPEventData) tea.Cmd {
	switch eventType {
	case "mcp.call.started":
		return h.handleMCPCallStarted(data)
	case "mcp.call.progress":
		return h.handleMCPCallProgress(data)
	case "mcp.call.completed":
		return h.handleMCPCallCompleted(data)
	case "mcp.call.failed":
		return h.handleMCPCallFailed(data)
	default:
		return nil
	}
}

func (h *MCPEventProcessor) handleMCPCallStarted(data MCPEventData) tea.Cmd {
	call := mcp.MCPCall{
		ID:         data.ID,
		Server:     data.Server,
		Method:     data.Method,
		Status:     mcp.MCPCallRunning,
		StartTime:  time.Unix(data.Timestamp/1000, (data.Timestamp%1000)*1000000),
		Parameters: data.Parameters,
	}

	return func() tea.Msg {
		return mcp.MCPCallStartedMsg{Call: call}
	}
}

func (h *MCPEventProcessor) handleMCPCallProgress(data MCPEventData) tea.Cmd {
	return func() tea.Msg {
		return mcp.MCPCallProgressMsg{
			ID:      data.ID,
			Message: data.Message,
		}
	}
}

func (h *MCPEventProcessor) handleMCPCallCompleted(data MCPEventData) tea.Cmd {
	duration := time.Duration(data.Duration) * time.Millisecond

	return func() tea.Msg {
		return mcp.MCPCallCompletedMsg{
			ID:       data.ID,
			Duration: duration,
			Response: data.Response,
			Error:    "",
		}
	}
}

func (h *MCPEventProcessor) handleMCPCallFailed(data MCPEventData) tea.Cmd {
	duration := time.Duration(data.Duration) * time.Millisecond

	return func() tea.Msg {
		return mcp.MCPCallCompletedMsg{
			ID:       data.ID,
			Duration: duration,
			Response: nil,
			Error:    data.Error,
		}
	}
}
