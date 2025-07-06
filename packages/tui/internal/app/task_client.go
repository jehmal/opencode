package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// TaskClient manages WebSocket connection for task events
type TaskClient struct {
	url       string
	conn      *websocket.Conn
	mu        sync.RWMutex
	tasks     map[string]*TaskInfo
	handlers  TaskEventHandlers
	reconnect bool
	ctx       context.Context
	cancel    context.CancelFunc
}

// TaskEventHandlers contains callbacks for task events
type TaskEventHandlers struct {
	OnTaskStarted   func(TaskInfo)
	OnTaskProgress  func(taskID string, progress int, message string)
	OnTaskCompleted func(taskID string, duration time.Duration, success bool, summary string)
	OnTaskFailed    func(taskID string, error string, recoverable bool)
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
	SessionID string `json:"sessionID"`
	TaskID    string `json:"taskID"`
	Progress  int    `json:"progress"`
	Message   string `json:"message,omitempty"`
	Timestamp int64  `json:"timestamp"`
	StartTime int64  `json:"startTime,omitempty"`
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
		url:       "ws://localhost:5747",
		tasks:     make(map[string]*TaskInfo),
		handlers:  handlers,
		reconnect: true,
		ctx:       ctx,
		cancel:    cancel,
	}
}

// Connect establishes WebSocket connection
func (tc *TaskClient) Connect() error {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	if tc.conn != nil {
		return nil // Already connected
	}

	conn, _, err := websocket.DefaultDialer.Dial(tc.url, nil)
	if err != nil {
		return fmt.Errorf("failed to connect to task event server: %w", err)
	}

	tc.conn = conn
	go tc.readLoop()
	slog.Info("Connected to task event server", "url", tc.url)
	return nil
}

// Disconnect closes the WebSocket connection
func (tc *TaskClient) Disconnect() {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	tc.reconnect = false
	tc.cancel()

	if tc.conn != nil {
		tc.conn.Close()
		tc.conn = nil
	}
}

// GetTask returns task info by ID
func (tc *TaskClient) GetTask(taskID string) (*TaskInfo, bool) {
	tc.mu.RLock()
	defer tc.mu.RUnlock()
	task, ok := tc.tasks[taskID]
	return task, ok
}

// readLoop handles incoming WebSocket messages
func (tc *TaskClient) readLoop() {
	defer func() {
		tc.mu.Lock()
		if tc.conn != nil {
			tc.conn.Close()
			tc.conn = nil
		}
		tc.mu.Unlock()

		// Attempt reconnection if enabled
		if tc.reconnect {
			time.Sleep(5 * time.Second)
			if err := tc.Connect(); err != nil {
				slog.Error("Failed to reconnect to task event server", "error", err)
			}
		}
	}()

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
				}
				return
			}

			tc.handleEvent(event)
		}
	}
}

// handleEvent processes incoming task events
func (tc *TaskClient) handleEvent(event TaskEvent) {
	switch event.Type {
	case "task.started":
		var data TaskStartedData
		if err := json.Unmarshal(event.Data, &data); err != nil {
			slog.Error("Failed to unmarshal task.started event", "error", err)
			return
		}

		task := TaskInfo{
			ID:          data.TaskID,
			SessionID:   data.SessionID,
			AgentName:   data.AgentName,
			Description: data.Description,
			Status:      TaskStatusRunning,
			Progress:    0,
			StartTime:   time.Unix(0, data.Timestamp*int64(time.Millisecond)),
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
			tc.handlers.OnTaskProgress(data.TaskID, data.Progress, data.Message)
		}

	case "task.completed":
		var data TaskCompletedData
		if err := json.Unmarshal(event.Data, &data); err != nil {
			slog.Error("Failed to unmarshal task.completed event", "error", err)
			return
		}

		tc.mu.Lock()
		if task, ok := tc.tasks[data.TaskID]; ok {
			task.Status = TaskStatusCompleted
			task.Progress = 100
			task.Duration = time.Duration(data.Duration) * time.Millisecond
		}
		tc.mu.Unlock()

		if tc.handlers.OnTaskCompleted != nil {
			tc.handlers.OnTaskCompleted(data.TaskID, time.Duration(data.Duration)*time.Millisecond, data.Success, data.Summary)
		}

		// Clean up completed task after a delay
		go func() {
			time.Sleep(30 * time.Second)
			tc.mu.Lock()
			delete(tc.tasks, data.TaskID)
			tc.mu.Unlock()
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
			tc.handlers.OnTaskFailed(data.TaskID, data.Error, data.Recoverable)
		}

		// Clean up failed task after a delay
		go func() {
			time.Sleep(30 * time.Second)
			tc.mu.Lock()
			delete(tc.tasks, data.TaskID)
			tc.mu.Unlock()
		}()

	case "heartbeat":
		// Ignore heartbeat messages
	default:
		slog.Warn("Unknown task event type", "type", event.Type)
	}
}
