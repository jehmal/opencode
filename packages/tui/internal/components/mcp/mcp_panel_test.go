package mcp

import (
	"testing"
	"time"

	"github.com/sst/dgmo/internal/app"
)

func TestMCPPanelComponent(t *testing.T) {
	// Create a mock app
	mockApp := &app.App{}

	// Create MCP panel component
	panel := NewMCPPanelComponent(mockApp)

	// Test initial state
	if !panel.IsVisible() {
		t.Error("Panel should be visible by default")
	}

	if len(panel.GetActiveCalls()) != 0 {
		t.Error("Panel should have no active calls initially")
	}

	// Test adding a call
	call := MCPCall{
		ID:        "test-call-1",
		Server:    "test-server",
		Method:    "test-method",
		Status:    MCPCallRunning,
		StartTime: time.Now(),
	}

	panel.AddCall(call)

	activeCalls := panel.GetActiveCalls()
	if len(activeCalls) != 1 {
		t.Errorf("Expected 1 active call, got %d", len(activeCalls))
	}

	if activeCalls[0].ID != "test-call-1" {
		t.Errorf("Expected call ID 'test-call-1', got '%s'", activeCalls[0].ID)
	}

	// Test updating a call
	panel.UpdateCall("test-call-1", MCPCallCompleted, time.Millisecond*100, "success", "")

	activeCalls = panel.GetActiveCalls()
	if len(activeCalls) != 0 {
		t.Error("Completed calls should not be active")
	}

	// Test visibility toggle
	panel.SetVisible(false)
	if panel.IsVisible() {
		t.Error("Panel should not be visible after setting to false")
	}
}

func TestMCPCallStatus(t *testing.T) {
	tests := []struct {
		status   MCPCallStatus
		expected string
	}{
		{MCPCallPending, "pending"},
		{MCPCallRunning, "running"},
		{MCPCallCompleted, "completed"},
		{MCPCallFailed, "failed"},
	}

	for _, test := range tests {
		if test.status.String() != test.expected {
			t.Errorf("Expected status '%s', got '%s'", test.expected, test.status.String())
		}
	}
}
