package websocket

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/dgmo/internal/components/mcp"
)

// MCPWebSocketIntegration manages the integration between WebSocket events and MCP panel
type MCPWebSocketIntegration struct {
	client               *TaskClient
	processor            *MCPEventProcessor
	program              *tea.Program
	queue                *MCPEventQueue
	ctx                  context.Context
	cancel               context.CancelFunc
	reconnectAttempts    int
	maxReconnectAttempts int
	reconnectDelay       time.Duration
	mu                   sync.RWMutex
	connected            bool
}

// NewMCPWebSocketIntegration creates a new MCP WebSocket integration
func NewMCPWebSocketIntegration(client *TaskClient, mcpPanel mcp.MCPPanelComponent, program *tea.Program) *MCPWebSocketIntegration {
	processor := NewMCPEventProcessor(mcpPanel)
	queue := NewMCPEventQueueWithProgram(processor, program, 100) // Queue size of 100 events
	ctx, cancel := context.WithCancel(context.Background())

	integration := &MCPWebSocketIntegration{
		client:               client,
		processor:            processor,
		program:              program,
		queue:                queue,
		ctx:                  ctx,
		cancel:               cancel,
		reconnectAttempts:    0,
		maxReconnectAttempts: 5,
		reconnectDelay:       time.Second * 5,
		connected:            false,
	}

	// Register the MCP event handler with the WebSocket client
	client.AddMCPHandler(integration.handleMCPEvent)

	return integration
}

// handleMCPEvent processes MCP events from WebSocket and queues them for processing
func (i *MCPWebSocketIntegration) handleMCPEvent(eventType string, data MCPEventData) {
	slog.Debug("Received MCP event", "type", eventType, "id", data.ID)

	// Queue the event for reliable processing
	if !i.queue.Enqueue(eventType, data) {
		slog.Error("Failed to queue MCP event", "type", eventType, "id", data.ID)
	}
}

// Start begins the WebSocket connection and MCP event processing
func (i *MCPWebSocketIntegration) Start() error {
	slog.Info("Starting MCP WebSocket integration")

	// Start the event queue
	i.queue.Start()

	// Start connection monitoring
	go i.connectionMonitor()

	// Initial connection attempt
	return i.connectWithRetry()
}

// Stop stops the WebSocket connection and MCP event processing
func (i *MCPWebSocketIntegration) Stop() {
	slog.Info("Stopping MCP WebSocket integration")

	i.cancel()
	i.client.Disconnect()
	i.queue.Stop()

	i.mu.Lock()
	i.connected = false
	i.mu.Unlock()
}

// IsConnected returns whether the WebSocket connection is active
func (i *MCPWebSocketIntegration) IsConnected() bool {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.connected && i.client.IsConnected()
}

// connectWithRetry attempts to connect with exponential backoff
func (i *MCPWebSocketIntegration) connectWithRetry() error {
	for attempt := 0; attempt <= i.maxReconnectAttempts; attempt++ {
		select {
		case <-i.ctx.Done():
			return context.Canceled
		default:
		}

		err := i.client.Connect()
		if err == nil {
			i.mu.Lock()
			i.connected = true
			i.reconnectAttempts = 0
			i.mu.Unlock()

			slog.Info("MCP WebSocket connected successfully")
			return nil
		}

		if attempt < i.maxReconnectAttempts {
			delay := i.reconnectDelay * time.Duration(1<<uint(attempt))
			slog.Warn("MCP WebSocket connection failed, retrying",
				"attempt", attempt+1,
				"maxAttempts", i.maxReconnectAttempts+1,
				"delay", delay,
				"error", err)

			timer := time.NewTimer(delay)
			select {
			case <-timer.C:
				// Continue to next attempt
			case <-i.ctx.Done():
				timer.Stop()
				return context.Canceled
			}
			timer.Stop()
		}
	}

	return fmt.Errorf("failed to connect after %d attempts", i.maxReconnectAttempts+1)
}

// connectionMonitor monitors the connection and handles reconnection
func (i *MCPWebSocketIntegration) connectionMonitor() {
	ticker := time.NewTicker(time.Second * 10) // Check every 10 seconds
	defer ticker.Stop()

	for {
		select {
		case <-i.ctx.Done():
			return
		case <-ticker.C:
			if !i.client.IsConnected() {
				i.mu.Lock()
				wasConnected := i.connected
				i.connected = false
				i.mu.Unlock()

				if wasConnected {
					slog.Warn("MCP WebSocket connection lost, attempting reconnection")
					go func() {
						if err := i.connectWithRetry(); err != nil {
							slog.Error("Failed to reconnect MCP WebSocket", "error", err)
						}
					}()
				}
			}
		}
	}
}

// GetQueueStats returns queue statistics for monitoring
func (i *MCPWebSocketIntegration) GetQueueStats() (length, capacity int) {
	return i.queue.GetQueueLength(), i.queue.GetQueueCapacity()
}
