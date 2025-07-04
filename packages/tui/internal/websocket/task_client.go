package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// TaskEvent represents a task event from the WebSocket server
type TaskEvent struct {
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
}

// TaskEventHandler is a function that handles task events
type TaskEventHandler func(event TaskEvent)

// TaskClient manages the WebSocket connection for task events
type TaskClient struct {
	url       string
	conn      *websocket.Conn
	mu        sync.Mutex
	handlers  []TaskEventHandler
	ctx       context.Context
	cancel    context.CancelFunc
	reconnect bool
	connected bool
}

// NewTaskClient creates a new task event client
func NewTaskClient(wsURL string) *TaskClient {
	ctx, cancel := context.WithCancel(context.Background())
	return &TaskClient{
		url:       wsURL,
		handlers:  make([]TaskEventHandler, 0),
		ctx:       ctx,
		cancel:    cancel,
		reconnect: true,
	}
}

// AddHandler adds an event handler
func (c *TaskClient) AddHandler(handler TaskEventHandler) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handlers = append(c.handlers, handler)
}

// Connect establishes the WebSocket connection
func (c *TaskClient) Connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.connected {
		return nil
	}

	u, err := url.Parse(c.url)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	conn, _, err := dialer.Dial(u.String(), nil)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}

	c.conn = conn
	c.connected = true

	// Start reading messages
	go c.readLoop()

	slog.Info("Connected to task event server", "url", c.url)
	return nil
}

// readLoop reads messages from the WebSocket
func (c *TaskClient) readLoop() {
	defer func() {
		c.mu.Lock()
		c.connected = false
		if c.conn != nil {
			c.conn.Close()
		}
		c.mu.Unlock()

		// Attempt reconnection if enabled
		if c.reconnect {
			time.Sleep(5 * time.Second)
			if err := c.Connect(); err != nil {
				slog.Error("Failed to reconnect", "error", err)
			}
		}
	}()

	for {
		select {
		case <-c.ctx.Done():
			return
		default:
			_, message, err := c.conn.ReadMessage()
			if err != nil {
				slog.Error("Read error", "error", err)
				return
			}

			var event TaskEvent
			if err := json.Unmarshal(message, &event); err != nil {
				slog.Error("Failed to parse event", "error", err)
				continue
			}

			// Skip heartbeat events
			if event.Type == "heartbeat" {
				continue
			}

			// Notify all handlers
			c.mu.Lock()
			handlers := make([]TaskEventHandler, len(c.handlers))
			copy(handlers, c.handlers)
			c.mu.Unlock()

			for _, handler := range handlers {
				go handler(event)
			}
		}
	}
}

// Disconnect closes the WebSocket connection
func (c *TaskClient) Disconnect() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.reconnect = false
	c.cancel()

	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}
	c.connected = false
}

// IsConnected returns whether the client is connected
func (c *TaskClient) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connected
}
