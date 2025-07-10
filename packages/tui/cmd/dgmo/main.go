package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/tui"
	"github.com/sst/opencode-sdk-go"
	"github.com/sst/opencode-sdk-go/option"
)

var Version = "dev"

func main() {
	version := Version
	if version != "dev" && !strings.HasPrefix(Version, "v") {
		version = "v" + Version
	}

	// Set up a null logger immediately to prevent any console output
	nullLogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	slog.SetDefault(nullLogger)

	url := os.Getenv("DGMO_SERVER")

	appInfoStr := os.Getenv("DGMO_APP_INFO")
	if appInfoStr == "" {
		slog.Error("DGMO_APP_INFO environment variable is not set")
		os.Exit(1)
	}
	
	var appInfo opencode.App
	err := json.Unmarshal([]byte(appInfoStr), &appInfo)
	if err != nil {
		slog.Error("Failed to unmarshal app info", "error", err, "appInfoStr", appInfoStr)
		os.Exit(1)
	}

	logfile := filepath.Join(appInfo.Path.Data, "log", "tui.log")
	if _, err := os.Stat(filepath.Dir(logfile)); os.IsNotExist(err) {
		err := os.MkdirAll(filepath.Dir(logfile), 0755)
		if err != nil {
			slog.Error("Failed to create log directory", "error", err)
			os.Exit(1)
		}
	}
	file, err := os.Create(logfile)
	if err != nil {
		slog.Error("Failed to create log file", "error", err)
		os.Exit(1)
	}
	defer file.Close()
	logger := slog.New(slog.NewTextHandler(file, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	slog.Debug("TUI launched", "app", appInfo)

	httpClient := opencode.NewClient(
		option.WithBaseURL(url),
	)

	if err != nil {
		slog.Error("Failed to create client", "error", err)
		os.Exit(1)
	}

	// Create main context for the application
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	app_, err := app.New(ctx, version, appInfo, httpClient, url)
	if err != nil {
		panic(err)
	}

	program := tea.NewProgram(
		tui.NewModel(app_),
		tea.WithKeyboardEnhancements(),
		tea.WithMouseCellMotion(),
	)

	// Initialize task client with event handlers
	taskClient := app.NewTaskClient(app.TaskEventHandlers{
		OnTaskStarted: func(task app.TaskInfo) {
			slog.Info("TUI received task started event", "taskID", task.ID, "description", task.Description)
			program.Send(app.TaskStartedMsg{Task: task})
		},
		OnTaskProgress: func(sessionID, taskID string, progress int, message string, phase string, currentTool string) {
			slog.Info("TUI received task progress event",
				"sessionID", sessionID,
				"taskID", taskID,
				"progress", progress,
				"message", message,
				"phase", phase,
				"currentTool", currentTool)
			program.Send(app.TaskProgressMsg{
				SessionID:   sessionID,
				TaskID:      taskID,
				Progress:    progress,
				Message:     message,
				Phase:       phase,
				CurrentTool: currentTool,
			})
		},
		OnTaskCompleted: func(sessionID, taskID string, duration time.Duration, success bool, summary string) {
			slog.Info("TUI received task completed event", "sessionID", sessionID, "taskID", taskID, "success", success, "duration", duration)
			program.Send(app.TaskCompletedMsg{
				SessionID: sessionID,
				TaskID:    taskID,
				Duration:  duration,
				Success:   success,
				Summary:   summary,
			})
		},
		OnTaskFailed: func(sessionID, taskID string, error string, recoverable bool) {
			slog.Info("TUI received task failed event", "sessionID", sessionID, "taskID", taskID, "error", error, "recoverable", recoverable)
			program.Send(app.TaskFailedMsg{
				SessionID:   sessionID,
				TaskID:      taskID,
				Error:       error,
				Recoverable: recoverable,
			})
		},
	})

	// Set up connection status handler for UI feedback
	taskClient.SetStatusHandler(func(state app.ConnectionState, err error) {
		switch state {
		case app.StateConnected:
			program.Send(app.ConnectionStatusMsg{
				Status:    "connected",
				Message:   "Connected to task event server",
				IsHealthy: true,
			})
		case app.StateConnecting:
			program.Send(app.ConnectionStatusMsg{
				Status:    "connecting",
				Message:   "Connecting to task event server...",
				IsHealthy: false,
			})
		case app.StateReconnecting:
			program.Send(app.ConnectionStatusMsg{
				Status:    "reconnecting",
				Message:   "Reconnecting to task event server...",
				IsHealthy: false,
			})
		case app.StateDisconnected:
			program.Send(app.ConnectionStatusMsg{
				Status:    "disconnected",
				Message:   "Disconnected from task event server",
				IsHealthy: false,
			})
		case app.StateFailed:
			errMsg := "Connection failed"
			if err != nil {
				errMsg = fmt.Sprintf("Connection failed: %v", err)
			}
			program.Send(app.ConnectionStatusMsg{
				Status:    "failed",
				Message:   errMsg,
				IsHealthy: false,
			})
		}
	})

	// Connect to task event server with graceful degradation
	app_.TaskClient = taskClient
	defer taskClient.Disconnect()

	// Attempt connection in background to avoid blocking startup
	go func() {
		defer cancel() // Ensure context is cancelled on exit
		slog.Info("TUI attempting to connect to WebSocket server...")
		if err := taskClient.Connect(); err != nil {
			slog.Error("TUI failed to connect to task event server", "error", err)
			// Application continues to work without task progress
		} else {
			slog.Info("TUI successfully connected to WebSocket server")
			// Log connection stats
			stats := taskClient.GetConnectionStats()
			slog.Info("TUI WebSocket connection stats", "stats", stats)
		}
	}()

	// Event streaming goroutine with cleanup
	done := make(chan struct{})
	go func() {
		defer close(done)
		stream := httpClient.Event.ListStreaming(ctx)
		for stream.Next() {
			evt := stream.Current().AsUnion()
			program.Send(evt)
		}
		if err := stream.Err(); err != nil {
			slog.Error("Error streaming events", "error", err)
			program.Send(err)
		}
	}()

	// Run the TUI
	result, err := program.Run()
	if err != nil {
		slog.Error("TUI error", "error", err)
	}

	// Cleanup
	cancel() // Cancel context to stop all goroutines
	
	// Wait for event streaming to finish with timeout
	select {
	case <-done:
		slog.Info("Event streaming goroutine finished")
	case <-time.After(2 * time.Second):
		slog.Warn("Timeout waiting for event streaming goroutine")
	}
	
	// Shutdown app resources
	if app_ != nil {
		app_.Shutdown()
	}

	slog.Info("TUI exited", "result", result)
}
