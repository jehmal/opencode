package main

import (
	"context"
	"encoding/json"
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
	var appInfo opencode.App
	err := json.Unmarshal([]byte(appInfoStr), &appInfo)
	if err != nil {
		slog.Error("Failed to unmarshal app info", "error", err)
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

	app_, err := app.New(ctx, version, appInfo, httpClient)
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
			program.Send(app.TaskStartedMsg{Task: task})
		},
		OnTaskProgress: func(taskID string, progress int, message string) {
			program.Send(app.TaskProgressMsg{
				TaskID:   taskID,
				Progress: progress,
				Message:  message,
			})
		},
		OnTaskCompleted: func(taskID string, duration time.Duration, success bool, summary string) {
			program.Send(app.TaskCompletedMsg{
				TaskID:   taskID,
				Duration: duration,
				Success:  success,
				Summary:  summary,
			})
		},
		OnTaskFailed: func(taskID string, error string, recoverable bool) {
			program.Send(app.TaskFailedMsg{
				TaskID:      taskID,
				Error:       error,
				Recoverable: recoverable,
			})
		},
	})

	// Connect to task event server
	if err := taskClient.Connect(); err != nil {
		slog.Warn("Failed to connect to task event server", "error", err)
		// Don't fail, just continue without task progress
	} else {
		app_.TaskClient = taskClient
		defer taskClient.Disconnect()
	}

	go func() {
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

	slog.Info("TUI exited", "result", result)
}
