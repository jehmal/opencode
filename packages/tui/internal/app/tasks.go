package app

import (
	"time"
)

// TaskInfo represents information about a running task
type TaskInfo struct {
	ID          string
	SessionID   string
	AgentName   string
	Description string
	Status      TaskStatus
	Progress    int
	StartTime   time.Time
	Duration    time.Duration
	Error       string
}

// TaskStatus represents the status of a task
type TaskStatus int

const (
	TaskStatusPending TaskStatus = iota
	TaskStatusRunning
	TaskStatusCompleted
	TaskStatusFailed
)

// TaskStartedMsg is sent when a task starts
type TaskStartedMsg struct {
	Task TaskInfo
}

// TaskProgressMsg is sent when a task makes progress
type TaskProgressMsg struct {
	TaskID   string
	Progress int
	Message  string
}

// TaskCompletedMsg is sent when a task completes
type TaskCompletedMsg struct {
	TaskID   string
	Duration time.Duration
	Success  bool
	Summary  string
}

// TaskFailedMsg is sent when a task fails
type TaskFailedMsg struct {
	TaskID      string
	Error       string
	Recoverable bool
}
