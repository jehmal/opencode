package websocket

import (
	"log/slog"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/dgmo/internal/components/mcp"
)

// Example usage of MCP WebSocket integration
func ExampleMCPWebSocketIntegration() {
	// Create WebSocket client
	client := NewTaskClient("ws://localhost:5747")

	// Create MCP panel component
	mcpPanel := mcp.NewMCPPanelComponent(nil) // Pass your app instance

	// Create TUI program (this would be your main TUI program)
	var program *tea.Program // Initialize with your actual program

	// Create MCP WebSocket integration
	integration := NewMCPWebSocketIntegration(client, mcpPanel, program)

	// Start the integration
	if err := integration.Start(); err != nil {
		slog.Error("Failed to start MCP WebSocket integration", "error", err)
		return
	}

	// Monitor connection status
	go func() {
		for {
			if integration.IsConnected() {
				slog.Info("MCP WebSocket is connected")

				// Get queue statistics
				length, capacity := integration.GetQueueStats()
				slog.Info("Queue stats", "length", length, "capacity", capacity)
			} else {
				slog.Warn("MCP WebSocket is disconnected")
			}

			// Check every 30 seconds
			// time.Sleep(30 * time.Second)
		}
	}()

	// When shutting down
	defer integration.Stop()
}

// Example of how to integrate with existing TUI application
func IntegrateWithTUI(program *tea.Program, mcpPanel mcp.MCPPanelComponent) *MCPWebSocketIntegration {
	// Create WebSocket client for task events
	client := NewTaskClient("ws://localhost:5747")

	// Create MCP integration
	integration := NewMCPWebSocketIntegration(client, mcpPanel, program)

	// Start integration
	if err := integration.Start(); err != nil {
		slog.Error("Failed to start MCP integration", "error", err)
		return nil
	}

	slog.Info("MCP WebSocket integration started successfully")
	return integration
}
