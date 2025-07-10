package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"math/rand"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// ConnectionState represents the current connection state
type ConnectionState int32

const (
	StateDisconnected ConnectionState = iota
	StateConnecting
	StateConnected
	StateReconnecting
	StateFailed
)

func (s ConnectionState) String() string {
	switch s {
	case StateDisconnected:
		return "disconnected"
	case StateConnecting:
		return "connecting"
	case StateConnected:
		return "connected"
	case StateReconnecting:
		return "reconnecting"
	case StateFailed:
		return "failed"
	default:
		return "unknown"
	}
}

// RetryConfig holds configuration for connection retry logic
type RetryConfig struct {
	MaxRetries     int
	BaseDelay      time.Duration
	MaxDelay       time.Duration
	BackoffFactor  float64
	JitterEnabled  bool
	ServerCheckURL string
}

// DefaultRetryConfig returns sensible defaults for retry configuration
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:     10,
		BaseDelay:      1 * time.Second,
		MaxDelay:       30 * time.Second,
		BackoffFactor:  2.0,
		JitterEnabled:  true,
		ServerCheckURL: "http://localhost:5747/health",
	}
}

// TaskClient manages WebSocket connection for task events
type TaskClient struct {
	url           string
	conn          *websocket.Conn
	mu            sync.RWMutex
	tasks         map[string]*TaskInfo
	handlers      TaskEventHandlers
	reconnect     bool
	ctx           context.Context
	cancel        context.CancelFunc
	state         int32 // atomic access to ConnectionState
	retryConfig   RetryConfig
	retryCount    int32
	lastHeartbeat time.Time
	heartbeatMu   sync.RWMutex
	eventQueue    []TaskEvent
	queueMu       sync.Mutex
	statusHandler func(ConnectionState, error)
	// Agent counting per session
	sessionAgentCounters map[string]int32 // sessionID -> next agent number
	agentCounterMu       sync.RWMutex
	// Goroutine tracking
	wg               sync.WaitGroup
	goroutineCtx     context.Context
	goroutineCancel  context.CancelFunc
	reconnecting     bool // prevent multiple reconnection attempts
}

// TaskEventHandlers contains callbacks for task events
type TaskEventHandlers struct {
	OnTaskStarted   func(TaskInfo)
	OnTaskProgress  func(sessionID, taskID string, progress int, message string, phase string, currentTool string)
	OnTaskCompleted func(sessionID, taskID string, duration time.Duration, success bool, summary string)
	OnTaskFailed    func(sessionID, taskID string, error string, recoverable bool)
}

// TaskEvent represents a WebSocket task event
type TaskEvent struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// TaskStartedData represents task.started event data
type TaskStartedData struct {
	SessionID   string `json:"sessionID"`
	TaskID      string `json:"taskID"`
	AgentName   string `json:"agentName"`
	Description string `json:"taskDescription"`
	Timestamp   int64  `json:"timestamp"`
}

// TaskProgressData represents task.progress event data
type TaskProgressData struct {
	SessionID       string `json:"sessionID"`
	TaskID          string `json:"taskID"`
	Progress        int    `json:"progress"`
	Message         string `json:"message,omitempty"`
	Timestamp       int64  `json:"timestamp"`
	StartTime       int64  `json:"startTime,omitempty"`
	Phase           string `json:"phase,omitempty"`
	CurrentTool     string `json:"currentTool,omitempty"`
	ToolDescription string `json:"toolDescription,omitempty"`
}

// TaskCompletedData represents task.completed event data
type TaskCompletedData struct {
	SessionID string `json:"sessionID"`
	TaskID    string `json:"taskID"`
	Duration  int64  `json:"duration"`
	Success   bool   `json:"success"`
	Summary   string `json:"summary,omitempty"`
	Timestamp int64  `json:"timestamp"`
}

// TaskFailedData represents task.failed event data
type TaskFailedData struct {
	SessionID   string `json:"sessionID"`
	TaskID      string `json:"taskID"`
	Error       string `json:"error"`
	Recoverable bool   `json:"recoverable"`
	Timestamp   int64  `json:"timestamp"`
}

// NewTaskClient creates a new task event client
func NewTaskClient(handlers TaskEventHandlers) *TaskClient {
	ctx, cancel := context.WithCancel(context.Background())
	return &TaskClient{
		url:                  "ws://localhost:5747",
		tasks:                make(map[string]*TaskInfo),
		handlers:             handlers,
		reconnect:            true,
		ctx:                  ctx,
		cancel:               cancel,
		state:                int32(StateDisconnected),
		retryConfig:          DefaultRetryConfig(),
		eventQueue:           make([]TaskEvent, 0),
		sessionAgentCounters: make(map[string]int32),
	}
}

// SetStatusHandler sets a callback for connection status changes
func (tc *TaskClient) SetStatusHandler(handler func(ConnectionState, error)) {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	tc.statusHandler = handler
}

// GetConnectionState returns the current connection state
func (tc *TaskClient) GetConnectionState() ConnectionState {
	return ConnectionState(atomic.LoadInt32(&tc.state))
}

// setState atomically updates the connection state and notifies handlers
func (tc *TaskClient) setState(newState ConnectionState, err error) {
	oldState := ConnectionState(atomic.SwapInt32(&tc.state, int32(newState)))
	if oldState != newState {
		slog.Info("Connection state changed", "from", oldState, "to", newState)
		tc.mu.RLock()
		handler := tc.statusHandler
		tc.mu.RUnlock()
		if handler != nil {
			go handler(newState, err)
		}
	}
}

// isServerReady checks if the server is ready to accept connections
func (tc *TaskClient) isServerReady() bool {
	// Try both IPv4 and IPv6 connections
	addresses := []string{"127.0.0.1:5747", "[::1]:5747", "localhost:5747"}

	var lastErr error
	for _, addr := range addresses {
		client := &net.Dialer{Timeout: 2 * time.Second}
		conn, err := client.Dial("tcp", addr)
		if err != nil {
			lastErr = err
			slog.Debug("TCP connection failed", "address", addr, "error", err)
			continue
		}
		conn.Close()
		slog.Debug("TCP connection successful", "address", addr)
		return true
	}

	slog.Debug("All TCP connection attempts failed", "last_error", lastErr)
	return false
}

// calculateBackoffDelay calculates the delay for the next retry attempt
func (tc *TaskClient) calculateBackoffDelay(attempt int) time.Duration {
	if attempt <= 0 {
		return tc.retryConfig.BaseDelay
	}

	delay := float64(tc.retryConfig.BaseDelay) * math.Pow(tc.retryConfig.BackoffFactor, float64(attempt-1))

	if delay > float64(tc.retryConfig.MaxDelay) {
		delay = float64(tc.retryConfig.MaxDelay)
	}

	// Add jitter to prevent thundering herd
	if tc.retryConfig.JitterEnabled {
		jitter := delay * 0.1 * (2*rand.Float64() - 1) // ±10% jitter
		delay += jitter
	}

	return time.Duration(delay)
}

// Connect establishes WebSocket connection with retry logic
func (tc *TaskClient) Connect() error {
	return tc.ConnectWithRetry(true)
}

// ConnectWithRetry establishes WebSocket connection with optional retry logic
func (tc *TaskClient) ConnectWithRetry(enableRetry bool) error {
	// Check connection state without holding lock for long operations
	tc.mu.RLock()
	isConnected := tc.conn != nil && tc.GetConnectionState() == StateConnected
	tc.mu.RUnlock()

	if isConnected {
		return nil // Already connected
	}

	tc.setState(StateConnecting, nil)

	// Wait for server to be ready if this is the first connection attempt
	// Do this WITHOUT holding the mutex to avoid blocking other operations
	if atomic.LoadInt32(&tc.retryCount) == 0 {
		slog.Info("Waiting for WebSocket server to be ready...")
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		
		timeout := time.After(60 * time.Second)
		elapsed := 0
		
		for {
			select {
			case <-tc.ctx.Done():
				return tc.ctx.Err()
			case <-timeout:
				slog.Warn("Server not ready after 60 seconds, attempting connection anyway")
				goto connect
			case <-ticker.C:
				elapsed++
				if tc.isServerReady() {
					slog.Info("WebSocket server is ready", "elapsed_seconds", elapsed)
					goto connect
				}
				if elapsed%10 == 0 {
					slog.Info("Still waiting for server...", "elapsed", fmt.Sprintf("%ds", elapsed))
				}
			}
		}
		connect:
	}

	var lastErr error
	maxRetries := 1
	if enableRetry {
		maxRetries = tc.retryConfig.MaxRetries
	}

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			tc.setState(StateReconnecting, lastErr)
			delay := tc.calculateBackoffDelay(attempt)
			slog.Info("Retrying connection", "attempt", attempt+1, "delay", delay)

			select {
			case <-time.After(delay):
			case <-tc.ctx.Done():
				tc.setState(StateDisconnected, tc.ctx.Err())
				return tc.ctx.Err()
			}
		}

		// Check if server is ready before attempting connection
		if !tc.isServerReady() {
			lastErr = fmt.Errorf("server not ready")
			continue
		}

		dialer := websocket.Dialer{
			HandshakeTimeout: 10 * time.Second,
			ReadBufferSize:   1024,
			WriteBufferSize:  1024,
		}

		slog.Info("Attempting WebSocket connection", "url", tc.url, "attempt", attempt+1)
		conn, resp, err := dialer.Dial(tc.url, nil)
		if err != nil {
			lastErr = err
			atomic.AddInt32(&tc.retryCount, 1)
			slog.Warn("Connection attempt failed", "attempt", attempt+1, "error", err, "response", resp)
			continue
		}

		// Connection successful - acquire lock only for setting connection
		tc.mu.Lock()
		tc.conn = conn
		tc.mu.Unlock()

		atomic.StoreInt32(&tc.retryCount, 0)
		tc.setState(StateConnected, nil)
		tc.updateHeartbeat()

		// Track goroutines
		tc.mu.Lock()
		if tc.goroutineCtx == nil {
			tc.goroutineCtx, tc.goroutineCancel = context.WithCancel(tc.ctx)
		}
		tc.mu.Unlock()
		
		// Process any queued events
		go func() {
			tc.wg.Add(1)
			defer tc.wg.Done()
			tc.processQueuedEvents()
		}()

		// Start reading messages
		go func() {
			tc.wg.Add(1)
			defer tc.wg.Done()
			tc.readLoop()
		}()

		slog.Info("Connected to task event server", "url", tc.url, "attempts", attempt+1)
		return nil
	}

	// All retry attempts failed
	tc.setState(StateFailed, lastErr)
	return fmt.Errorf("failed to connect after %d attempts: %w", maxRetries, lastErr)
}

// updateHeartbeat updates the last heartbeat timestamp
func (tc *TaskClient) updateHeartbeat() {
	tc.heartbeatMu.Lock()
	defer tc.heartbeatMu.Unlock()
	tc.lastHeartbeat = time.Now()
}

// getLastHeartbeat returns the last heartbeat timestamp
func (tc *TaskClient) getLastHeartbeat() time.Time {
	tc.heartbeatMu.RLock()
	defer tc.heartbeatMu.RUnlock()
	return tc.lastHeartbeat
}

// isConnectionHealthy checks if the connection is healthy based on heartbeat
func (tc *TaskClient) isConnectionHealthy() bool {
	if tc.GetConnectionState() != StateConnected {
		return false
	}

	lastHeartbeat := tc.getLastHeartbeat()
	if lastHeartbeat.IsZero() {
		return true // No heartbeat received yet, assume healthy
	}

	return time.Since(lastHeartbeat) < 60*time.Second // 60 second timeout
}

// processQueuedEvents processes any events that were queued while disconnected
func (tc *TaskClient) processQueuedEvents() {
	tc.queueMu.Lock()
	events := make([]TaskEvent, len(tc.eventQueue))
	copy(events, tc.eventQueue)
	tc.eventQueue = tc.eventQueue[:0] // Clear the queue
	tc.queueMu.Unlock()

	if len(events) > 0 {
		slog.Info("Processing queued events", "count", len(events))
		for _, event := range events {
			tc.handleEvent(event)
		}
	}
}

// Disconnect closes the WebSocket connection
func (tc *TaskClient) Disconnect() {
	tc.mu.Lock()
	tc.reconnect = false
	if tc.goroutineCancel != nil {
		tc.goroutineCancel()
	}
	tc.mu.Unlock()
	
	tc.cancel()
	tc.setState(StateDisconnected, nil)

	tc.mu.Lock()
	if tc.conn != nil {
		tc.conn.Close()
		tc.conn = nil
	}
	tc.mu.Unlock()

	// Wait for goroutines to finish with timeout
	done := make(chan struct{})
	go func() {
		tc.wg.Wait()
		close(done)
	}()
	
	select {
	case <-done:
		slog.Info("Disconnected from task event server - all goroutines finished")
	case <-time.After(5 * time.Second):
		slog.Warn("Disconnected from task event server - timeout waiting for goroutines")
	}
}

// IsConnected returns whether the client is currently connected
func (tc *TaskClient) IsConnected() bool {
	return tc.GetConnectionState() == StateConnected
}

// GetConnectionStats returns connection statistics
func (tc *TaskClient) GetConnectionStats() map[string]interface{} {
	tc.mu.RLock()
	defer tc.mu.RUnlock()

	tc.queueMu.Lock()
	queueSize := len(tc.eventQueue)
	tc.queueMu.Unlock()

	lastHeartbeat := tc.getLastHeartbeat()

	return map[string]interface{}{
		"state":          tc.GetConnectionState().String(),
		"retry_count":    atomic.LoadInt32(&tc.retryCount),
		"queue_size":     queueSize,
		"last_heartbeat": lastHeartbeat,
		"is_healthy":     tc.isConnectionHealthy(),
		"url":            tc.url,
	}
}

// GetTask returns task info by ID
func (tc *TaskClient) GetTask(taskID string) (*TaskInfo, bool) {
	tc.mu.RLock()
	defer tc.mu.RUnlock()
	task, ok := tc.tasks[taskID]
	return task, ok
}

// getNextAgentNumber returns the next agent number for a session
func (tc *TaskClient) getNextAgentNumber(sessionID string) int32 {
	tc.agentCounterMu.Lock()
	defer tc.agentCounterMu.Unlock()

	// Increment and return the next agent number for this session
	tc.sessionAgentCounters[sessionID]++
	return tc.sessionAgentCounters[sessionID]
}

// resetAgentCounter resets the agent counter for a session
func (tc *TaskClient) resetAgentCounter(sessionID string) {
	tc.agentCounterMu.Lock()
	defer tc.agentCounterMu.Unlock()
	tc.sessionAgentCounters[sessionID] = 0
}

// readLoop handles incoming WebSocket messages with enhanced error handling
func (tc *TaskClient) readLoop() {
	defer func() {
		tc.setState(StateDisconnected, nil)
		tc.mu.Lock()
		if tc.conn != nil {
			tc.conn.Close()
			tc.conn = nil
		}
		tc.mu.Unlock()

		// Attempt reconnection if enabled and not shutting down
		if tc.reconnect && tc.ctx.Err() == nil {
			// Prevent multiple simultaneous reconnection attempts
			tc.mu.Lock()
			if tc.reconnecting {
				tc.mu.Unlock()
				return
			}
			tc.reconnecting = true
			tc.mu.Unlock()
			
			go func() {
				tc.wg.Add(1)
				defer tc.wg.Done()
				defer func() {
					tc.mu.Lock()
					tc.reconnecting = false
					tc.mu.Unlock()
				}()
				
				delay := tc.calculateBackoffDelay(int(atomic.LoadInt32(&tc.retryCount)))
				slog.Info("Scheduling reconnection", "delay", delay)

				select {
				case <-time.After(delay):
					if err := tc.Connect(); err != nil {
						slog.Error("Failed to reconnect to task event server", "error", err)
					}
				case <-tc.ctx.Done():
					return
				}
			}()
		}
	}()

	// Set connection timeout with nil check
	tc.mu.RLock()
	conn := tc.conn
	tc.mu.RUnlock()
	
	if conn != nil {
		conn.SetReadDeadline(time.Now().Add(70 * time.Second)) // Slightly longer than heartbeat interval
	}

	for {
		select {
		case <-tc.ctx.Done():
			return
		default:
			tc.mu.RLock()
			conn := tc.conn
			tc.mu.RUnlock()

			if conn == nil {
				return
			}

			var event TaskEvent
			err := conn.ReadJSON(&event)
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					slog.Error("WebSocket read error", "error", err)
					tc.setState(StateDisconnected, err)
				}
				return
			}

			// Reset read deadline after successful read
			conn.SetReadDeadline(time.Now().Add(70 * time.Second))

			// Handle heartbeat events specially
			if event.Type == "heartbeat" {
				tc.updateHeartbeat()
				continue
			}

			// If we're not connected, queue the event
			if tc.GetConnectionState() != StateConnected {
				tc.queueEvent(event)
				continue
			}

			tc.handleEvent(event)
		}
	}
}

// queueEvent adds an event to the queue for later processing
func (tc *TaskClient) queueEvent(event TaskEvent) {
	tc.queueMu.Lock()
	defer tc.queueMu.Unlock()

	// Limit queue size to prevent memory issues
	if len(tc.eventQueue) < 1000 {
		tc.eventQueue = append(tc.eventQueue, event)
		slog.Debug("Event queued", "type", event.Type, "queue_size", len(tc.eventQueue))
	} else {
		slog.Warn("Event queue full, dropping event", "type", event.Type)
	}
}

// handleEvent processes incoming task events
func (tc *TaskClient) handleEvent(event TaskEvent) {
	// DEBUG: Log all incoming events
	slog.Debug("[TASK_CLIENT] Received event",
		"type", event.Type,
		"dataLength", len(event.Data))

	switch event.Type {
	case "task.started":
		var data TaskStartedData
		if err := json.Unmarshal(event.Data, &data); err != nil {
			slog.Error("Failed to unmarshal task.started event", "error", err)
			return
		}

		// DEBUG: Log task.started details
		slog.Info("[TASK_CLIENT] task.started event",
			"taskID", data.TaskID,
			"sessionID", data.SessionID,
			"isContinuation", strings.HasPrefix(data.TaskID, "continuation-"))

		// Get the next agent number for this session
		agentNumber := tc.getNextAgentNumber(data.SessionID)

		task := TaskInfo{
			ID:          data.TaskID,
			SessionID:   data.SessionID,
			AgentName:   data.AgentName,
			Description: data.Description,
			Status:      TaskStatusRunning,
			Progress:    0,
			StartTime:   time.Unix(0, data.Timestamp*int64(time.Millisecond)),
			AgentNumber: agentNumber,
		}

		tc.mu.Lock()
		tc.tasks[data.TaskID] = &task
		tc.mu.Unlock()

		if tc.handlers.OnTaskStarted != nil {
			tc.handlers.OnTaskStarted(task)
		}

	case "task.progress":
		var data TaskProgressData
		if err := json.Unmarshal(event.Data, &data); err != nil {
			slog.Error("Failed to unmarshal task.progress event", "error", err)
			return
		}

		tc.mu.Lock()
		if task, ok := tc.tasks[data.TaskID]; ok {
			task.Progress = data.Progress
			if data.StartTime > 0 {
				task.StartTime = time.Unix(0, data.StartTime*int64(time.Millisecond))
			}
			task.Duration = time.Since(task.StartTime)
		}
		tc.mu.Unlock()

		if tc.handlers.OnTaskProgress != nil {
			tc.handlers.OnTaskProgress(data.SessionID, data.TaskID, data.Progress, data.Message, data.Phase, data.CurrentTool)
		}

	case "task.completed":
		var data TaskCompletedData
		if err := json.Unmarshal(event.Data, &data); err != nil {
			slog.Error("Failed to unmarshal task.completed event", "error", err)
			return
		}

		// DEBUG: Log task.completed details
		slog.Info("[TASK_CLIENT] task.completed event",
			"taskID", data.TaskID,
			"sessionID", data.SessionID,
			"isContinuation", strings.HasPrefix(data.TaskID, "continuation-"),
			"success", data.Success,
			"duration", data.Duration)

		tc.mu.Lock()
		if task, ok := tc.tasks[data.TaskID]; ok {
			task.Status = TaskStatusCompleted
			task.Progress = 100
			task.Duration = time.Duration(data.Duration) * time.Millisecond
		}
		tc.mu.Unlock()

		if tc.handlers.OnTaskCompleted != nil {
			tc.handlers.OnTaskCompleted(data.SessionID, data.TaskID, time.Duration(data.Duration)*time.Millisecond, data.Success, data.Summary)
		}

		// Clean up completed task after a delay
		go func() {
			tc.wg.Add(1)
			defer tc.wg.Done()
			
			select {
			case <-time.After(30 * time.Second):
				tc.mu.Lock()
				delete(tc.tasks, data.TaskID)
				tc.mu.Unlock()
			case <-tc.ctx.Done():
				return
			}
		}()

	case "task.failed":
		var data TaskFailedData
		if err := json.Unmarshal(event.Data, &data); err != nil {
			slog.Error("Failed to unmarshal task.failed event", "error", err)
			return
		}

		tc.mu.Lock()
		if task, ok := tc.tasks[data.TaskID]; ok {
			task.Status = TaskStatusFailed
			task.Error = data.Error
		}
		tc.mu.Unlock()

		if tc.handlers.OnTaskFailed != nil {
			tc.handlers.OnTaskFailed(data.SessionID, data.TaskID, data.Error, data.Recoverable)
		}

		// Clean up failed task after a delay
		go func() {
			tc.wg.Add(1)
			defer tc.wg.Done()
			
			select {
			case <-time.After(30 * time.Second):
				tc.mu.Lock()
				delete(tc.tasks, data.TaskID)
				tc.mu.Unlock()
			case <-tc.ctx.Done():
				return
			}
		}()

	case "heartbeat":
		tc.updateHeartbeat()
		slog.Debug("Heartbeat received")
	default:
		slog.Warn("Unknown task event type", "type", event.Type)
	}
}
