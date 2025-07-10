package tui

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"

	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/commands"
	"github.com/sst/dgmo/internal/completions"
	"github.com/sst/dgmo/internal/components/chat"
	"github.com/sst/dgmo/internal/components/clipboard"
	cmdcomp "github.com/sst/dgmo/internal/components/commands"
	"github.com/sst/dgmo/internal/components/dialog"
	"github.com/sst/dgmo/internal/components/mcp"
	"github.com/sst/dgmo/internal/components/modal"
	"github.com/sst/dgmo/internal/components/status"
	"github.com/sst/dgmo/internal/components/toast"
	"github.com/sst/dgmo/internal/layout"
	"github.com/sst/dgmo/internal/styles"
	"github.com/sst/dgmo/internal/theme"
	"github.com/sst/dgmo/internal/util"
	"github.com/sst/opencode-sdk-go"
)

// InterruptDebounceTimeoutMsg is sent when the interrupt key debounce timeout expires
type InterruptDebounceTimeoutMsg struct{}

// InterruptKeyState tracks the state of interrupt key presses for debouncing
type InterruptKeyState int

const (
	InterruptKeyIdle InterruptKeyState = iota
	InterruptKeyFirstPress
)

const interruptDebounceTimeout = 1 * time.Second

// ContinuationPromptProgressMsg is sent when continuation prompt generation makes progress
type ContinuationPromptProgressMsg struct {
	TaskID      string
	Progress    int
	Message     string
	Phase       string
	CurrentTool string
}

// ContinuationPromptCompletedMsg is sent when continuation prompt generation completes
type ContinuationPromptCompletedMsg struct {
	TaskID   string
	Prompt   string
	Duration time.Duration
	Error    error
}

type appModel struct {
	width, height int
	app           *app.App
	modal         layout.Modal
	status        status.StatusComponent
	editor        chat.EditorComponent
	messages      chat.MessagesComponent
	mcpPanel      mcp.MCPPanelComponent

	completions          dialog.CompletionDialog
	completionManager    *completions.CompletionManager
	showCompletionDialog bool
	showMCPPanel         bool

	leaderBinding                 *key.Binding
	isLeaderSequence              bool
	toastManager                  *toast.ToastManager
	clipboardManager              *clipboard.ClipboardManager
	interruptKeyState             InterruptKeyState
	lastScroll                    time.Time
	isCtrlBSequence               bool                  // Track if Ctrl+B was pressed for multi-key sequences
	isAltScreen                   bool                  // Track alternate screen state - starts false
	continuationTaskID            string                // Track active continuation prompt task ID
	continuationPrompt            string                // Store the continuation prompt until task completes
	pendingContinuationCompletion *app.TaskCompletedMsg // Store early-arriving continuation task completion
	continuationMutex             sync.RWMutex          // Mutex for thread-safe access to continuation fields
}

func (a appModel) Init() tea.Cmd {
	var cmds []tea.Cmd
	// https://github.com/charmbracelet/bubbletea/issues/1440
	// https://github.com/sst/opencode/issues/127
	if !util.IsWsl() {
		cmds = append(cmds, tea.RequestBackgroundColor)
	}
	cmds = append(cmds, a.app.InitializeProvider())
	cmds = append(cmds, a.editor.Init())
	cmds = append(cmds, a.messages.Init())
	cmds = append(cmds, a.mcpPanel.Init())
	cmds = append(cmds, a.status.Init())
	cmds = append(cmds, a.completions.Init())
	cmds = append(cmds, a.toastManager.Init())

	// Check if we should show the init dialog
	cmds = append(cmds, func() tea.Msg {
		shouldShow := a.app.Info.Git && a.app.Info.Time.Initialized > 0
		return dialog.ShowInitDialogMsg{Show: shouldShow}
	})

	return tea.Batch(cmds...)
}

var BUGGED_SCROLL_KEYS = map[string]bool{
	"0": true,
	"1": true,
	"2": true,
	"3": true,
	"4": true,
	"5": true,
	"6": true,
	"7": true,
	"8": true,
	"9": true,
	"M": true,
	"m": true,
	"[": true,
	";": true,
}

func (a appModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyPressMsg:
		keyString := msg.String()
		if time.Since(a.lastScroll) < time.Millisecond*100 && BUGGED_SCROLL_KEYS[keyString] {
			return a, nil
		}

		// 1. Handle active modal
		if a.modal != nil {
			switch keyString {
			// Escape always closes current modal
			case "esc", "ctrl+c":
				cmd := a.modal.Close()
				a.modal = nil
				return a, cmd
			}

			// Pass all other key presses to the modal
			updatedModal, cmd := a.modal.Update(msg)
			a.modal = updatedModal.(layout.Modal)
			return a, cmd
		}

		// 2. Handle alternate screen toggle (Shift+Tab)
		if keyString == "shift+tab" {
			a.isAltScreen = !a.isAltScreen
			var cmd tea.Cmd
			if a.isAltScreen {
				cmd = tea.EnterAltScreen
			} else {
				cmd = tea.ExitAltScreen
			}
			// Show toast notification for user feedback
			toastMsg := "Fullscreen mode enabled"
			if !a.isAltScreen {
				toastMsg = "Fullscreen mode disabled"
			}
			return a, tea.Batch(cmd, toast.NewInfoToast(toastMsg))
		}

		// 2.5. Handle MCP panel toggle (Ctrl+M)
		if keyString == "ctrl+m" {
			a.showMCPPanel = !a.showMCPPanel
			a.mcpPanel.SetVisible(a.showMCPPanel)
			toastMsg := "MCP panel enabled"
			if !a.showMCPPanel {
				toastMsg = "MCP panel disabled"
			}
			return a, toast.NewInfoToast(toastMsg)
		}

		// 3. Check for commands that require leader
		if a.isLeaderSequence {
			matches := a.app.Commands.Matches(msg, a.isLeaderSequence)
			a.isLeaderSequence = false
			if len(matches) > 0 {
				return a, util.CmdHandler(commands.ExecuteCommandsMsg(matches))
			}
		}

		// 4. Handle completions trigger
		if keyString == "/" && !a.showCompletionDialog {
			a.showCompletionDialog = true

			initialValue := "/"
			currentInput := a.editor.Value()

			// if the input doesn't end with a space,
			// then we want to include the last word
			// (ie, `packages/`)
			if !strings.HasSuffix(currentInput, " ") {
				words := strings.Split(a.editor.Value(), " ")
				if len(words) > 0 {
					lastWord := words[len(words)-1]
					lastWord = strings.TrimSpace(lastWord)
					initialValue = lastWord + "/"
				}
			}

			updated, cmd := a.completions.Update(
				app.CompletionDialogTriggeredMsg{
					InitialValue: initialValue,
				},
			)
			a.completions = updated.(dialog.CompletionDialog)
			cmds = append(cmds, cmd)

			updated, cmd = a.editor.Update(msg)
			a.editor = updated.(chat.EditorComponent)
			cmds = append(cmds, cmd)

			updated, cmd = a.updateCompletions(msg)
			a.completions = updated.(dialog.CompletionDialog)
			cmds = append(cmds, cmd)

			return a, tea.Sequence(cmds...)
		}

		if a.showCompletionDialog {
			switch keyString {
			case "tab", "enter", "esc", "ctrl+c":
				updated, cmd := a.updateCompletions(msg)
				a.completions = updated.(dialog.CompletionDialog)
				cmds = append(cmds, cmd)
				return a, tea.Batch(cmds...)
			}

			updated, cmd := a.editor.Update(msg)
			a.editor = updated.(chat.EditorComponent)
			cmds = append(cmds, cmd)

			updated, cmd = a.updateCompletions(msg)
			a.completions = updated.(dialog.CompletionDialog)
			cmds = append(cmds, cmd)

			return a, tea.Batch(cmds...)
		}

		// 5. Maximize editor responsiveness for printable characters
		if msg.Text != "" {
			updated, cmd := a.editor.Update(msg)
			a.editor = updated.(chat.EditorComponent)
			cmds = append(cmds, cmd)
			return a, tea.Batch(cmds...)
		}

		// 6. Check for leader key activation
		if a.leaderBinding != nil &&
			!a.isLeaderSequence &&
			key.Matches(msg, *a.leaderBinding) {
			a.isLeaderSequence = true
			return a, nil
		}

		// 6. Handle interrupt key debounce for session interrupt
		interruptCommand := a.app.Commands[commands.SessionInterruptCommand]
		if interruptCommand.Matches(msg, a.isLeaderSequence) && a.app.IsBusy() {
			switch a.interruptKeyState {
			case InterruptKeyIdle:
				// First interrupt key press - start debounce timer
				a.interruptKeyState = InterruptKeyFirstPress
				a.editor.SetInterruptKeyInDebounce(true)
				return a, tea.Tick(interruptDebounceTimeout, func(t time.Time) tea.Msg {
					return InterruptDebounceTimeoutMsg{}
				})
			case InterruptKeyFirstPress:
				// Second interrupt key press within timeout - actually interrupt
				a.interruptKeyState = InterruptKeyIdle
				a.editor.SetInterruptKeyInDebounce(false)
				return a, util.CmdHandler(commands.ExecuteCommandMsg(interruptCommand))
			}
		}

		// 8. Check again for commands that don't require leader (excluding interrupt when busy)
		matches := a.app.Commands.Matches(msg, a.isLeaderSequence)
		if len(matches) > 0 {
			// Skip interrupt key if we're in debounce mode and app is busy
			if interruptCommand.Matches(msg, a.isLeaderSequence) && a.app.IsBusy() && a.interruptKeyState != InterruptKeyIdle {
				return a, nil
			}
			return a, util.CmdHandler(commands.ExecuteCommandsMsg(matches))
		}

		// 9. Handle Ctrl+B sequences
		if a.isCtrlBSequence {
			a.isCtrlBSequence = false
			switch keyString {
			case ".":
				// Navigate to next sibling sub-session
				return a, a.navigateToSibling(context.Background(), "next")
			case ",":
				// Navigate to previous sibling sub-session
				return a, a.navigateToSibling(context.Background(), "prev")
			default:
				// Any other key cancels the sequence
				return a, nil
			}
		}

		if keyString == "ctrl+b" && a.app.Session != nil {

			// Set flag for multi-key sequence
			a.isCtrlBSequence = true
			// Also handle immediate navigation
			// If in sub-session, return to parent
			if a.app.CurrentSessionType == "sub" && a.app.Session.ParentID != "" {
				a.isCtrlBSequence = false // Cancel sequence since we're navigating

				return a, a.app.SwitchToSession(context.Background(), a.app.Session.ParentID)
			}
			// If in main session and has viewed sub-sessions, go to last viewed
			if a.app.CurrentSessionType == "main" && a.app.LastViewedSubSession != "" {
				a.isCtrlBSequence = false // Cancel sequence since we're navigating

				return a, a.app.SwitchToSession(context.Background(), a.app.LastViewedSubSession)
			}
			// Otherwise wait for next key (. or ,)

			return a, toast.NewInfoToast("Press . for next or , for previous sibling")
		}

		// 10. Fallback to editor. This is for other characters
		// like backspace, tab, etc.
		updatedEditor, cmd := a.editor.Update(msg)
		a.editor = updatedEditor.(chat.EditorComponent)
		return a, cmd
	case tea.MouseWheelMsg:
		a.lastScroll = time.Now()
		if a.modal != nil {
			return a, nil
		}
		updated, cmd := a.messages.Update(msg)
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
		return a, tea.Batch(cmds...)
	case tea.BackgroundColorMsg:
		styles.Terminal = &styles.TerminalInfo{
			Background:       msg.Color,
			BackgroundIsDark: msg.IsDark(),
		}

		return a, func() tea.Msg {
			theme.UpdateSystemTheme(
				styles.Terminal.Background,
				styles.Terminal.BackgroundIsDark,
			)
			return dialog.ThemeSelectedMsg{
				ThemeName: theme.CurrentThemeName(),
			}
		}
	case modal.CloseModalMsg:
		var cmd tea.Cmd
		if a.modal != nil {
			cmd = a.modal.Close()
		}
		a.modal = nil
		return a, cmd
	case commands.ExecuteCommandMsg:
		updated, cmd := a.executeCommand(commands.Command(msg))
		return updated, cmd
	case commands.ExecuteCommandsMsg:
		for _, command := range msg {
			updated, cmd := a.executeCommand(command)
			if cmd != nil {
				return updated, cmd
			}
		}
	case error:
		return a, toast.NewErrorToast(msg.Error())
	case app.SendMsg:
		a.showCompletionDialog = false
		cmd := a.app.SendChatMessage(context.Background(), msg.Text, msg.Attachments)
		cmds = append(cmds, cmd)
	case dialog.CompletionDialogCloseMsg:
		a.showCompletionDialog = false
	case opencode.EventListResponseEventInstallationUpdated:
		return a, toast.NewSuccessToast(
			"DGMO updated to "+msg.Properties.Version+", restart to apply.",
			toast.WithTitle("New version installed"),
		)
	case opencode.EventListResponseEventSessionDeleted:
		if a.app.Session != nil && msg.Properties.Info.ID == a.app.Session.ID {
			a.app.Session = &opencode.Session{}
			a.app.Messages = []opencode.Message{}
		}
		return a, toast.NewSuccessToast("Session deleted successfully")
	case opencode.EventListResponseEventSessionUpdated:
		if msg.Properties.Info.ID == a.app.Session.ID {
			a.app.Session = &msg.Properties.Info
		}
	case opencode.EventListResponseEventMessageUpdated:
		if msg.Properties.Info.Metadata.SessionID == a.app.Session.ID {
			exists := false
			optimisticReplaced := false

			// First check if this is replacing an optimistic message
			if msg.Properties.Info.Role == opencode.MessageRoleUser {
				// Look for optimistic messages to replace
				for i, m := range a.app.Messages {
					if strings.HasPrefix(m.ID, "optimistic-") && m.Role == opencode.MessageRoleUser {
						// Replace the optimistic message with the real one
						a.app.Messages[i] = msg.Properties.Info
						exists = true
						optimisticReplaced = true
						break
					}
				}
			}

			// If not replacing optimistic, check for existing message with same ID
			if !optimisticReplaced {
				for i, m := range a.app.Messages {
					if m.ID == msg.Properties.Info.ID {
						a.app.Messages[i] = msg.Properties.Info
						exists = true
						break
					}
				}
			}

			if !exists {
				a.app.Messages = append(a.app.Messages, msg.Properties.Info)
			}
		}
	case opencode.EventListResponseEventSessionError:
		switch err := msg.Properties.Error.AsUnion().(type) {
		case nil:
		case opencode.ProviderAuthError:
			slog.Error("Failed to authenticate with provider", "error", err.Data.Message)
			return a, toast.NewErrorToast("Provider error: " + err.Data.Message)
		case opencode.UnknownError:
			slog.Error("Server error", "name", err.Name, "message", err.Data.Message)
			return a, toast.NewErrorToast(err.Data.Message, toast.WithTitle(string(err.Name)))
		}
	case tea.WindowSizeMsg:
		msg.Height -= 2 // Make space for the status bar
		a.width, a.height = msg.Width, msg.Height
		layout.Current = &layout.LayoutInfo{
			Viewport: layout.Dimensions{
				Width:  a.width,
				Height: a.height,
			},
			Container: layout.Dimensions{
				Width: min(a.width, 80),
			},
		}
		// Update child component sizes
		mcpPanelHeight := 0
		if a.showMCPPanel {
			mcpPanelHeight = 6 // Height for MCP panel
		}
		messagesHeight := a.height - 6 - mcpPanelHeight // Leave room for editor, status bar, and MCP panel
		a.messages.SetSize(a.width, messagesHeight)
		a.editor.SetSize(min(a.width, 80), 5)
		a.mcpPanel.SetSize(a.width, mcpPanelHeight)
	case app.SessionSelectedMsg:
		messages, err := a.app.ListMessages(context.Background(), msg.ID)
		if err != nil {
			slog.Error("Failed to list messages", "error", err)
			return a, toast.NewErrorToast("Failed to open session")
		}
		a.app.Session = msg
		a.app.Messages = messages

		// Update session type when selecting from dialog
		if msg.ParentID != "" {
			a.app.CurrentSessionType = "sub"
			a.app.LastViewedSubSession = msg.ID
		} else {
			a.app.CurrentSessionType = "main"
		}

	case app.SessionSwitchedMsg:

		// Handle session switching from navigation
		a.app.Session = msg.Session
		a.app.Messages = msg.Messages
		// Close any open modal
		if a.modal != nil {
			cmd := a.modal.Close()
			a.modal = nil
			cmds = append(cmds, cmd)
		}
		// Show success toast
		cmds = append(cmds, toast.NewSuccessToast(fmt.Sprintf("Switched to session: %s", msg.Session.Title)))
		// Messages will be updated automatically via a.app.Messages
	case app.ModelSelectedMsg:
		a.app.Provider = &msg.Provider
		a.app.Model = &msg.Model
		a.app.State.Provider = msg.Provider.ID
		a.app.State.Model = msg.Model.ID
		a.app.State.UpdateModelUsage(msg.Provider.ID, msg.Model.ID)
		a.app.SaveState()
	case dialog.ThemeSelectedMsg:
		a.app.State.Theme = msg.ThemeName
		a.app.SaveState()
	case toast.ShowToastMsg:
		tm, cmd := a.toastManager.Update(msg)
		a.toastManager = tm
		cmds = append(cmds, cmd)
	case toast.DismissToastMsg:
		tm, cmd := a.toastManager.Update(msg)
		a.toastManager = tm
		cmds = append(cmds, cmd)
	case toast.UpdateToastMsg:
		tm, cmd := a.toastManager.Update(msg)
		a.toastManager = tm
		cmds = append(cmds, cmd)
	case InterruptDebounceTimeoutMsg:
		// Reset interrupt key state after timeout
		a.interruptKeyState = InterruptKeyIdle
		a.editor.SetInterruptKeyInDebounce(false)
	case app.TaskStartedMsg:
		// DEBUG: Log task started events
		slog.Info("[CONTINUATION DEBUG] TaskStartedMsg received",
			"taskID", msg.Task.ID,
			"sessionID", msg.Task.SessionID,
			"agentNumber", msg.Task.AgentNumber,
			"currentSessionID", func() string {
				if a.app.Session != nil {
					return a.app.Session.ID
				}
				return "<no session>"
			}(),
			"isContinuationTask", strings.HasPrefix(msg.Task.ID, "continuation-"))

		// Only process if this task belongs to current session
		if a.app.Session != nil && msg.Task.SessionID != "" && msg.Task.SessionID != a.app.Session.ID {
			return a, nil // Ignore events from other sessions
		}
		// Task started - update progress to 0 and register agent number
		chat.UpdateTaskProgress(msg.Task.ID, 0)
		chat.RegisterTaskAgent(msg.Task.ID, msg.Task.SessionID, msg.Task.AgentNumber)
		// Check if this is a continuation prompt task
		if strings.HasPrefix(msg.Task.ID, "continuation-") {
			// Don't show generic task toast for continuation prompts
			// The /continue command already shows initial toast
		} else {
			// Show toast notification for task start
			cmds = append(cmds, toast.NewInfoToast(
				fmt.Sprintf("Task started: %s", msg.Task.Description),
				toast.WithTitle("🚀 Task Progress"),
				toast.WithDuration(3*time.Second),
			))
		}
	case app.TaskProgressMsg:
		// DEBUG: Log task progress for continuation tasks
		if strings.HasPrefix(msg.TaskID, "continuation-") {
			slog.Info("[CONTINUATION DEBUG] TaskProgressMsg for continuation task",
				"taskID", msg.TaskID,
				"progress", msg.Progress,
				"phase", msg.Phase,
				"message", msg.Message)
		}

		// Only process if this task belongs to current session
		if a.app.Session != nil && msg.SessionID != "" && msg.SessionID != a.app.Session.ID {
			return a, nil // Ignore events from other sessions
		}
		// Update task progress and metadata
		chat.UpdateTaskProgress(msg.TaskID, msg.Progress)
		if msg.Message != "" {
			chat.UpdateTaskMessage(msg.TaskID, msg.Message)
		}
		if msg.Phase != "" {
			chat.UpdateTaskPhase(msg.TaskID, msg.Phase)
		}
		if msg.CurrentTool != "" {
			chat.UpdateTaskTool(msg.TaskID, msg.CurrentTool)
		}
		// Check if this is a continuation prompt task
		if strings.HasPrefix(msg.TaskID, "continuation-") {
			// Convert to ContinuationPromptProgressMsg for special handling
			cmds = append(cmds, func() tea.Msg {
				return ContinuationPromptProgressMsg{
					TaskID:      msg.TaskID,
					Progress:    msg.Progress,
					Message:     msg.Message,
					Phase:       msg.Phase,
					CurrentTool: msg.CurrentTool,
				}
			})
		} else {
			// Show progress toast notification with visual progress bar
			progressMsg := "Task progress"
			if msg.Message != "" {
				progressMsg = msg.Message
			}
			cmds = append(cmds, toast.NewProgressToast(
				progressMsg,
				msg.Progress,
				toast.WithTitle("⏳ Progress Update"),
				toast.WithDuration(3*time.Second),
			))
		}
	case app.TaskCompletedMsg:
		// DEBUG: Log all task completion events
		slog.Info("[CONTINUATION DEBUG] TaskCompletedMsg received",
			"taskID", msg.TaskID,
			"sessionID", msg.SessionID,
			"waitingForTaskID", a.continuationTaskID,
			"isMatch", msg.TaskID == a.continuationTaskID,
			"success", msg.Success,
			"isContinuationTask", strings.HasPrefix(msg.TaskID, "continuation-"))

		// Check if this is a continuation task but we don't have the ID yet
		if strings.HasPrefix(msg.TaskID, "continuation-") && a.continuationTaskID == "" {
			// Store this event for later processing
			slog.Info("[CONTINUATION DEBUG] Storing pending continuation completion",
				"taskID", msg.TaskID,
				"sessionID", msg.SessionID)
			msgCopy := msg // Make a copy
			a.pendingContinuationCompletion = &msgCopy
			return a, nil
		}

		// Check if this is our continuation prompt task
		if a.continuationTaskID != "" && msg.TaskID == a.continuationTaskID {
			// DEBUG: Log that we matched the task
			slog.Info("[CONTINUATION DEBUG] Matched continuation task! Creating new session",
				"taskID", msg.TaskID,
				"promptAvailable", len(a.continuationPrompt) > 0)

			// This is our continuation prompt task completing
			// Now we can create the new session and send the prompt

			// Create a new session for the continuation
			session, err := a.app.CreateSession(context.Background())
			if err != nil {
				slog.Error("[CONTINUATION DEBUG] Failed to create new session", "error", err)
				cmds = append(cmds, toast.NewErrorToast("Failed to create new session for continuation"))
				// Clear continuation tracking
				a.continuationTaskID = ""
				a.continuationPrompt = ""
				return a, tea.Batch(cmds...)
			}

			// Switch to the new session
			a.app.Session = session
			a.app.Messages = []opencode.Message{}
			cmds = append(cmds, util.CmdHandler(app.SessionSelectedMsg(session)))
			cmds = append(cmds, util.CmdHandler(app.SessionClearedMsg{}))

			// Calculate prompt stats
			lines := strings.Count(a.continuationPrompt, "\n") + 1
			words := len(strings.Fields(a.continuationPrompt))

			// Show success toast with statistics
			successMsg := fmt.Sprintf("New session created! Continuing work... (%d lines, %d words)",
				lines, words)

			cmds = append(cmds, toast.NewSuccessToast(
				successMsg,
				toast.WithTitle("✅ Handoff Ready"),
				toast.WithDuration(5*time.Second),
			))

			// Send the continuation prompt as the first message in the new session
			cmds = append(cmds, a.app.SendChatMessage(context.Background(), a.continuationPrompt, []app.Attachment{}))

			// Clear continuation tracking
			a.continuationTaskID = ""
			a.continuationPrompt = ""
			a.pendingContinuationCompletion = nil
			return a, tea.Batch(cmds...)
		}

		// Only process other tasks if they belong to current session
		if a.app.Session != nil && msg.SessionID != "" && msg.SessionID != a.app.Session.ID {
			return a, nil // Ignore events from other sessions
		}
		// Task completed - set progress to 100
		chat.UpdateTaskProgress(msg.TaskID, 100)
		// Show completion notification with statistics
		completionMsg := "Task completed successfully"
		if msg.Summary != "" {
			completionMsg = fmt.Sprintf("Task completed: %s", msg.Summary)
		}
		durationStr := fmt.Sprintf("Duration: %v", msg.Duration.Round(time.Millisecond))

		if msg.Success {
			cmds = append(cmds, toast.NewSuccessToast(
				fmt.Sprintf("%s (%s)", completionMsg, durationStr),
				toast.WithTitle("✅ Task Complete"),
				toast.WithDuration(5*time.Second),
			))
		} else {
			cmds = append(cmds, toast.NewWarningToast(
				fmt.Sprintf("Task finished with issues (%s)", durationStr),
				toast.WithTitle("⚠️ Task Complete"),
				toast.WithDuration(5*time.Second),
			))
		}
	case app.TaskFailedMsg:
		// Only process if this task belongs to current session
		if a.app.Session != nil && msg.SessionID != "" && msg.SessionID != a.app.Session.ID {
			return a, nil // Ignore events from other sessions
		}
		// Task failed - show error toast
		errorMsg := fmt.Sprintf("Task failed: %s", msg.Error)
		if msg.Recoverable {
			errorMsg += " (recoverable)"
		}
		cmds = append(cmds, toast.NewErrorToast(
			errorMsg,
			toast.WithTitle("❌ Task Failed"),
			toast.WithDuration(7*time.Second),
		))
		slog.Warn("Task failed", "taskID", msg.TaskID, "error", msg.Error)
	case app.ConnectionStatusMsg:
		// Handle connection status changes
		switch msg.Status {
		case "connected":
			cmds = append(cmds, toast.NewSuccessToast("Connected to task server"))
		case "connecting":
			cmds = append(cmds, toast.NewInfoToast("Connecting to task server..."))
		case "reconnecting":
			cmds = append(cmds, toast.NewWarningToast("Reconnecting to task server..."))
		case "disconnected":
			cmds = append(cmds, toast.NewWarningToast("Disconnected from task server"))
		case "failed":
			cmds = append(cmds, toast.NewErrorToast(msg.Message))
		}

		// Update status component with connection info
		a.status.SetConnectionStatus(msg.Status, msg.IsHealthy)
	case mcp.MCPCallStartedMsg:
		// Handle MCP call started
		a.mcpPanel.AddCall(msg.Call)
	case mcp.MCPCallCompletedMsg:
		// Handle MCP call completed
		status := mcp.MCPCallCompleted
		if msg.Error != "" {
			status = mcp.MCPCallFailed
		}
		a.mcpPanel.UpdateCall(msg.ID, status, msg.Duration, msg.Response, msg.Error)
	case ContinuationPromptProgressMsg: // Update the existing toast with progress
		// Extract session ID from taskID format: "continuation-{sessionID}-{timestamp}"
		parts := strings.Split(msg.TaskID, "-")
		sessionID := ""
		if len(parts) >= 3 {
			sessionID = parts[1]
		}
		toastID := fmt.Sprintf("continuation-toast-%s", sessionID)
		cmds = append(cmds, toast.NewProgressToast(
			msg.Message,
			msg.Progress,
			toast.WithID(toastID),
			toast.WithTitle("🔄 Agent Handoff"),
			toast.WithDuration(5*time.Second),
		))
	case ContinuationPromptCompletedMsg:
		// Handle completion of continuation prompt generation
		if msg.Error != nil {
			slog.Error("[CONTINUATION DEBUG] Generation failed",
				"error", msg.Error,
				"taskID", msg.TaskID)
			cmds = append(cmds, toast.NewErrorToast(
				fmt.Sprintf("Failed to generate prompt: %v", msg.Error),
				toast.WithTitle("❌ Generation Failed"),
				toast.WithDuration(7*time.Second),
			))
			// Clear continuation task tracking on error
			a.continuationTaskID = ""
			a.continuationPrompt = ""
		} else {
			// Store the continuation task ID and prompt
			// We'll wait for the TaskCompletedMsg before creating new session
			a.continuationTaskID = msg.TaskID
			a.continuationPrompt = msg.Prompt

			// DEBUG: Log stored values
			slog.Info("[CONTINUATION DEBUG] Prompt completed, waiting for task",
				"taskID", msg.TaskID,
				"storedTaskID", a.continuationTaskID,
				"promptLength", len(msg.Prompt),
				"duration", msg.Duration,
				"hasPendingCompletion", a.pendingContinuationCompletion != nil)

			// Check if we already received the task completion event
			if a.pendingContinuationCompletion != nil && a.pendingContinuationCompletion.TaskID == msg.TaskID {
				slog.Info("[CONTINUATION DEBUG] Found pending completion event, processing immediately",
					"taskID", msg.TaskID)

				// Process the pending completion immediately
				pendingMsg := *a.pendingContinuationCompletion
				a.pendingContinuationCompletion = nil

				// Trigger the completion handling by sending the message again
				cmds = append(cmds, func() tea.Msg { return pendingMsg })
			} else {
				// Show progress toast
				cmds = append(cmds, toast.NewInfoToast(
					"Prompt generated, waiting for task completion...",
					toast.WithTitle("📝 Processing"),
					toast.WithDuration(5*time.Second),
				))

				// Add a timeout fallback - if no TaskCompletedMsg within 30 seconds
				cmds = append(cmds, tea.Tick(30*time.Second, func(t time.Time) tea.Msg {
					return struct{ TimeoutForTaskID string }{TimeoutForTaskID: msg.TaskID}
				}))
			}
		}
	case struct{ TimeoutForTaskID string }:
		// Handle timeout for continuation prompt task
		a.continuationMutex.RLock()
		taskMatch := a.continuationTaskID == msg.TimeoutForTaskID && a.continuationTaskID != ""
		prompt := a.continuationPrompt
		a.continuationMutex.RUnlock()
		
		if taskMatch {
			// DEBUG: Log timeout
			slog.Warn("[CONTINUATION DEBUG] Timeout waiting for TaskCompletedMsg",
				"taskID", msg.TimeoutForTaskID,
				"continuationTaskID", a.continuationTaskID,
				"hasPrompt", len(a.continuationPrompt) > 0)

			// We have the prompt but didn't get task completion
			// Create the session anyway
			if prompt != "" {
				// Create a new session for the continuation
				session, err := a.app.CreateSession(context.Background())
				if err != nil {
					slog.Error("[CONTINUATION DEBUG] Failed to create new session after timeout", "error", err)
					cmds = append(cmds, toast.NewErrorToast("Failed to create new session for continuation"))
					// Clear continuation tracking
					a.continuationTaskID = ""
					a.continuationPrompt = ""
					return a, tea.Batch(cmds...)
				}

				// Switch to the new session
				a.app.Session = session
				a.app.Messages = []opencode.Message{}
				cmds = append(cmds, util.CmdHandler(app.SessionSelectedMsg(session)))
				cmds = append(cmds, util.CmdHandler(app.SessionClearedMsg{}))

				// Show warning toast about timeout
				cmds = append(cmds, toast.NewWarningToast(
					"Created session after timeout - task completion not received",
					toast.WithTitle("⚠️ Timeout Recovery"),
					toast.WithDuration(5*time.Second),
				))

				// Send the continuation prompt as the first message in the new session
				cmds = append(cmds, a.app.SendChatMessage(context.Background(), prompt, []app.Attachment{}))

				// Clear continuation tracking with lock
				a.continuationMutex.Lock()
				a.continuationTaskID = ""
				a.continuationPrompt = ""
				a.continuationMutex.Unlock()
			}
		}
	}

	// update status bar
	s, cmd := a.status.Update(msg)
	cmds = append(cmds, cmd)
	a.status = s.(status.StatusComponent)

	// update editor
	u, cmd := a.editor.Update(msg)
	a.editor = u.(chat.EditorComponent)
	cmds = append(cmds, cmd)

	// update messages
	u, cmd = a.messages.Update(msg)
	a.messages = u.(chat.MessagesComponent)
	cmds = append(cmds, cmd)

	// update MCP panel
	u, cmd = a.mcpPanel.Update(msg)
	a.mcpPanel = u.(mcp.MCPPanelComponent)
	cmds = append(cmds, cmd)

	// update modal
	if a.modal != nil {
		u, cmd := a.modal.Update(msg)
		a.modal = u.(layout.Modal)
		cmds = append(cmds, cmd)
	}

	if a.showCompletionDialog {
		u, cmd := a.completions.Update(msg)
		a.completions = u.(dialog.CompletionDialog)
		cmds = append(cmds, cmd)
	}

	return a, tea.Batch(cmds...)
}

func (a appModel) View() string {
	mainLayout := a.chat(layout.Current.Container.Width, lipgloss.Center)
	if a.modal != nil {
		mainLayout = a.modal.Render(mainLayout)
	}
	mainLayout = a.toastManager.RenderOverlay(mainLayout)
	if theme.CurrentThemeUsesAnsiColors() {
		mainLayout = util.ConvertRGBToAnsi16Colors(mainLayout)
	}
	return mainLayout + "\n" + a.status.View()
}

func (a appModel) chat(width int, align lipgloss.Position) string {
	editorView := a.editor.View(width, align)
	lines := a.editor.Lines()
	messagesView := a.messages.View()
	if a.app.Session == nil || a.app.Session.ID == "" {
		messagesView = a.home()
	}
	editorHeight := max(lines, 5)

	t := theme.CurrentTheme()
	centeredEditorView := lipgloss.PlaceHorizontal(
		a.width,
		align,
		editorView,
		styles.WhitespaceStyle(t.Background()),
	)

	// Build layout items
	layoutItems := []layout.FlexItem{
		{
			View: messagesView,
			Grow: true,
		},
	}

	// Add MCP panel if visible
	if a.showMCPPanel && a.mcpPanel.IsVisible() {
		mcpPanelView := a.mcpPanel.View()
		layoutItems = append(layoutItems, layout.FlexItem{
			View:      mcpPanelView,
			FixedSize: 6,
		})
	}

	// Add editor at the bottom
	layoutItems = append(layoutItems, layout.FlexItem{
		View:      centeredEditorView,
		FixedSize: 5,
	})

	mainLayout := layout.Render(
		layout.FlexOptions{
			Direction: layout.Column,
			Width:     a.width,
			Height:    a.height,
		},
		layoutItems...,
	)

	if lines > 1 {
		editorWidth := min(a.width, 80)
		editorX := (a.width - editorWidth) / 2
		editorY := a.height - editorHeight
		mainLayout = layout.PlaceOverlay(
			editorX,
			editorY,
			a.editor.Content(width, align),
			mainLayout,
		)
	}

	if a.showCompletionDialog {
		editorWidth := min(a.width, 80)
		editorX := (a.width - editorWidth) / 2
		a.completions.SetWidth(editorWidth)
		overlay := a.completions.View()
		overlayHeight := lipgloss.Height(overlay)
		editorY := a.height - editorHeight + 1

		mainLayout = layout.PlaceOverlay(
			editorX,
			editorY-overlayHeight,
			overlay,
			mainLayout,
		)
	}

	return mainLayout
}

func (a appModel) home() string {
	t := theme.CurrentTheme()
	baseStyle := styles.NewStyle().Background(t.Background())
	base := baseStyle.Render
	muted := styles.NewStyle().Foreground(t.TextMuted()).Background(t.Background()).Render

	dgm := `
█▀▀▄ █▀▀▀ █▀▄▀█
█░░█ █░▀█ █░▀░█
▀▀▀  ▀▀▀▀ ▀░░░▀`
	o := `
  █▀▀█
▀ █░░█
  ▀▀▀▀`

	logo := lipgloss.JoinHorizontal(
		lipgloss.Top,
		muted(dgm),
		base(o),
	)
	// cwd := app.Info.Path.Cwd
	// config := app.Info.Path.Config

	versionStyle := styles.NewStyle().
		Foreground(t.TextMuted()).
		Background(t.Background()).
		Width(lipgloss.Width(logo)).
		Align(lipgloss.Right)
	version := versionStyle.Render(a.app.Version)

	logoAndVersion := strings.Join([]string{logo, version}, "\n")
	logoAndVersion = lipgloss.PlaceHorizontal(
		a.width,
		lipgloss.Center,
		logoAndVersion,
		styles.WhitespaceStyle(t.Background()),
	)
	commandsView := cmdcomp.New(
		a.app,
		cmdcomp.WithBackground(t.Background()),
		cmdcomp.WithLimit(6),
	)
	cmds := lipgloss.PlaceHorizontal(
		a.width,
		lipgloss.Center,
		commandsView.View(),
		styles.WhitespaceStyle(t.Background()),
	)

	lines := []string{}
	lines = append(lines, logoAndVersion)
	lines = append(lines, "")
	lines = append(lines, "")
	// lines = append(lines, base("cwd ")+muted(cwd))
	// lines = append(lines, base("config ")+muted(config))
	// lines = append(lines, "")
	lines = append(lines, cmds)

	return lipgloss.Place(
		a.width,
		a.height-5,
		lipgloss.Center,
		lipgloss.Center,
		baseStyle.Render(strings.Join(lines, "\n")),
		styles.WhitespaceStyle(t.Background()),
	)
}

func (a appModel) executeCommand(command commands.Command) (tea.Model, tea.Cmd) {
	cmds := []tea.Cmd{
		util.CmdHandler(commands.CommandExecutedMsg(command)),
	}
	switch command.Name {
	case commands.AppHelpCommand:
		helpDialog := dialog.NewHelpDialog(a.app)
		a.modal = helpDialog
	case commands.EditorOpenCommand:
		if a.app.IsBusy() {
			// status.Warn("Agent is working, please wait...")
			return a, nil
		}
		editor := os.Getenv("EDITOR")
		if editor == "" {
			return a, toast.NewErrorToast("No EDITOR set, can't open editor")
		}

		value := a.editor.Value()
		updated, cmd := a.editor.Clear()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)

		tmpfile, err := os.CreateTemp("", "msg_*.md")
		tmpfile.WriteString(value)
		if err != nil {
			slog.Error("Failed to create temp file", "error", err)
			return a, toast.NewErrorToast("Something went wrong, couldn't open editor")
		}
		tmpfile.Close()
		c := exec.Command(editor, tmpfile.Name()) //nolint:gosec
		c.Stdin = os.Stdin
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		cmd = tea.ExecProcess(c, func(err error) tea.Msg {
			if err != nil {
				slog.Error("Failed to open editor", "error", err)
				return nil
			}
			content, err := os.ReadFile(tmpfile.Name())
			if err != nil {
				slog.Error("Failed to read file", "error", err)
				return nil
			}
			if len(content) == 0 {
				slog.Warn("Message is empty")
				return nil
			}
			os.Remove(tmpfile.Name())
			// attachments := m.attachments
			// m.attachments = nil
			return app.SendMsg{
				Text:        string(content),
				Attachments: []app.Attachment{}, // attachments,
			}
		})
		cmds = append(cmds, cmd)
	case commands.SessionNewCommand:
		if a.app.Session == nil || a.app.Session.ID == "" {
			return a, nil
		}
		a.app.Session = &opencode.Session{}
		a.app.Messages = []opencode.Message{}
		cmds = append(cmds, util.CmdHandler(app.SessionClearedMsg{}))
	case commands.SessionListCommand:
		sessionDialog := dialog.NewSessionDialog(a.app)
		a.modal = sessionDialog
	case commands.SubSessionCommand:
		subSessionDialog := dialog.NewSubSessionDialog(a.app)
		a.modal = subSessionDialog
	case commands.SessionShareCommand:
		if a.app.Session == nil || a.app.Session.ID == "" {
			return a, nil
		}
		response, err := a.app.Client.Session.Share(context.Background(), a.app.Session.ID)
		if err != nil {
			slog.Error("Failed to share session", "error", err)
			return a, toast.NewErrorToast("Failed to share session")
		}
		shareUrl := response.Share.URL
		cmds = append(cmds, tea.SetClipboard(shareUrl))
		cmds = append(cmds, toast.NewSuccessToast("Share URL copied to clipboard!"))
	case commands.SessionInterruptCommand:
		if a.app.Session == nil || a.app.Session.ID == "" {
			return a, nil
		}
		a.app.Cancel(context.Background(), a.app.Session.ID)
		return a, nil
	case commands.SessionCompactCommand:
		if a.app.Session == nil || a.app.Session.ID == "" {
			return a, nil
		}
		// TODO: block until compaction is complete
		a.app.CompactSession(context.Background())
	case commands.ToolDetailsCommand:
		message := "Tool details are now visible"
		if a.messages.ToolDetailsVisible() {
			message = "Tool details are now hidden"
		}
		cmds = append(cmds, util.CmdHandler(chat.ToggleToolDetailsMsg{}))
		cmds = append(cmds, toast.NewInfoToast(message))
	case commands.ModelListCommand:
		modelDialog := dialog.NewModelDialog(a.app)
		a.modal = modelDialog
	case commands.AgentModeCommand:
		agentDialog := dialog.NewAgentDialog(a.app)
		a.modal = agentDialog
	case commands.ThemeListCommand:
		themeDialog := dialog.NewThemeDialog()
		a.modal = themeDialog
	case commands.ProjectInitCommand:
		cmds = append(cmds, a.app.InitializeProject(context.Background()))
	case commands.ContinuationPromptCommand:
		if a.app.Session == nil || a.app.Session.ID == "" {
			return a, toast.NewErrorToast("No active session to generate continuation prompt")
		}

		// DEBUG: Log command triggered
		slog.Info("[CONTINUATION DEBUG] Command triggered",
			"sessionID", a.app.Session.ID,
			"timestamp", time.Now().Format(time.RFC3339Nano))

		// Step 1: Show immediate feedback that command was triggered
		// Show initial toast with longer duration and a specific ID
		toastID := fmt.Sprintf("continuation-toast-%s", a.app.Session.ID)
		cmds = append(cmds, toast.NewInfoToast(
			"Generating continuation prompt...",
			toast.WithID(toastID),
			toast.WithTitle("🔄 Agent Handoff"),
			toast.WithDuration(30*time.Second), // Keep it visible longer
		))

		// Step 2: Start the generation process with beautiful progress feedback
		cmds = append(cmds, func() tea.Msg {
			// Make direct HTTP request since SDK doesn't have this method yet
			serverURL := os.Getenv("DGMO_SERVER")
			if serverURL == "" {
				slog.Error("DGMO_SERVER environment variable not set")
				return toast.NewErrorToast("Server URL not configured")
			}

			// Start time for duration tracking
			startTime := time.Now()

			url := fmt.Sprintf("%s/session/%s/continuation-prompt", serverURL, a.app.Session.ID)
			req, err := http.NewRequestWithContext(context.Background(), "POST", url, strings.NewReader("{}"))
			if err != nil {
				slog.Error("Failed to create continuation prompt request", "error", err)
				return ContinuationPromptCompletedMsg{
					TaskID:   a.app.Session.ID,
					Error:    fmt.Errorf("failed to create request: %w", err),
					Duration: time.Since(startTime),
				}
			}
			req.Header.Set("Content-Type", "application/json")

			client := &http.Client{Timeout: 30 * time.Second}
			resp, err := client.Do(req)
			if err != nil {
				slog.Error("Failed to generate continuation prompt", "error", err)
				return ContinuationPromptCompletedMsg{
					TaskID:   a.app.Session.ID,
					Error:    fmt.Errorf("network error: %w", err),
					Duration: time.Since(startTime),
				}
			}
			defer resp.Body.Close()

			if resp.StatusCode != 200 {
				slog.Error("Continuation prompt request failed", "status", resp.StatusCode)
				return ContinuationPromptCompletedMsg{
					TaskID:   a.app.Session.ID,
					Error:    fmt.Errorf("server error (status %d)", resp.StatusCode),
					Duration: time.Since(startTime),
				}
			}

			var response struct {
				Prompt string      `json:"prompt"`
				TaskID interface{} `json:"taskId,omitempty"` // Server might include task ID
			}
			if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
				slog.Error("Failed to decode continuation prompt response", "error", err)
				return ContinuationPromptCompletedMsg{
					TaskID:   a.app.Session.ID,
					Error:    fmt.Errorf("failed to parse response: %w", err),
					Duration: time.Since(startTime),
				}
			}

			// Extract task ID from response if available
			taskID := fmt.Sprintf("continuation-%s-%d", a.app.Session.ID, startTime.UnixMilli())
			if respTaskID, ok := response.TaskID.(string); ok && respTaskID != "" {
				taskID = respTaskID
			}

			// DEBUG: Log response details
			slog.Info("[CONTINUATION DEBUG] Server response received",
				"taskID", taskID,
				"serverTaskID", response.TaskID,
				"promptLength", len(response.Prompt),
				"sessionID", a.app.Session.ID)

			// Also log WebSocket connection status
			if a.app.TaskClient != nil {
				stats := a.app.TaskClient.GetConnectionStats()
				slog.Info("[CONTINUATION DEBUG] WebSocket status at response time",
					"state", stats["state"],
					"isHealthy", stats["is_healthy"],
					"retryCount", stats["retry_count"])
			}

			// Step 3: Store the prompt and task ID, wait for task completion
			return ContinuationPromptCompletedMsg{
				TaskID:   taskID,
				Prompt:   response.Prompt,
				Duration: time.Since(startTime),
				Error:    nil,
			}
		})
	case commands.InputClearCommand:
		if a.editor.Value() == "" {
			return a, nil
		}
		updated, cmd := a.editor.Clear()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)
	case commands.InputPasteCommand:
		updated, cmd := a.editor.Paste()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)
	case commands.InputSubmitCommand:
		updated, cmd := a.editor.Submit()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)
	case commands.InputNewlineCommand:
		updated, cmd := a.editor.Newline()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)
	case commands.HistoryPreviousCommand:
		if a.showCompletionDialog {
			return a, nil
		}
		updated, cmd := a.editor.Previous()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)
	case commands.HistoryNextCommand:
		if a.showCompletionDialog {
			return a, nil
		}
		updated, cmd := a.editor.Next()
		a.editor = updated.(chat.EditorComponent)
		cmds = append(cmds, cmd)
	case commands.MessagesFirstCommand:
		updated, cmd := a.messages.First()
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
	case commands.MessagesLastCommand:
		updated, cmd := a.messages.Last()
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
	case commands.MessagesPageUpCommand:
		updated, cmd := a.messages.PageUp()
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
	case commands.MessagesPageDownCommand:
		updated, cmd := a.messages.PageDown()
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
	case commands.MessagesHalfPageUpCommand:
		updated, cmd := a.messages.HalfPageUp()
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
	case commands.MessagesHalfPageDownCommand:
		updated, cmd := a.messages.HalfPageDown()
		a.messages = updated.(chat.MessagesComponent)
		cmds = append(cmds, cmd)
	case commands.DynamicSizingToggleCommand:
		// Toggle dynamic sizing (placeholder for now - would need dynamic TUI integration)
		return a, toast.NewInfoToast("Dynamic sizing toggle - feature coming soon!")
	case commands.DynamicSizingPresetCommand:
		// Change sizing preset (placeholder for now - would need dynamic TUI integration)
		return a, toast.NewInfoToast("Sizing preset change - feature coming soon!")
	case commands.AppExitCommand:
		return a, tea.Quit
	case commands.SessionRevertCommand:
		if a.app.Session == nil || a.app.Session.ID == "" {
			return a, toast.NewErrorToast("No active session to revert")
		}
		revertDialog := dialog.NewRevertDialog(a.app)
		a.modal = revertDialog
		cmds = append(cmds, revertDialog.Init()) // Critical: Execute initial command!
	}
	return a, tea.Batch(cmds...)
}

func (a appModel) updateCompletions(msg tea.Msg) (tea.Model, tea.Cmd) {
	currentInput := a.editor.Value()
	if currentInput != "" {
		provider := a.completionManager.GetProvider(currentInput)
		a.completions.SetProvider(provider)
	}
	return a.completions.Update(msg)
}

func NewModel(app *app.App) tea.Model {
	completionManager := completions.NewCompletionManager(app)
	initialProvider := completionManager.DefaultProvider()

	messages := chat.NewMessagesComponent(app)
	editor := chat.NewEditorComponent(app)
	mcpPanel := mcp.NewMCPPanelComponent(app)
	completions := dialog.NewCompletionDialogComponent(initialProvider)

	var leaderBinding *key.Binding
	if app.Config.Keybinds.Leader != "" {
		binding := key.NewBinding(key.WithKeys(app.Config.Keybinds.Leader))
		leaderBinding = &binding
	}

	model := &appModel{
		status:   status.NewStatusCmp(app),
		app:      app,
		editor:   editor,
		messages: messages,
		mcpPanel: mcpPanel,

		completions:          completions,
		completionManager:    completionManager,
		leaderBinding:        leaderBinding,
		isLeaderSequence:     false,
		showCompletionDialog: false,
		showMCPPanel:         false, // Start with MCP panel hidden

		toastManager:      toast.NewToastManager(),
		interruptKeyState: InterruptKeyIdle,
		isAltScreen:       false, // Start with alt screen disabled (normal terminal mode)

	}

	return model
}

// navigateToSibling navigates to the next or previous sibling sub-session
func (a *appModel) navigateToSibling(ctx context.Context, direction string) tea.Cmd {
	return func() tea.Msg {
		// Only works if we're in a sub-session
		if a.app.Session == nil || a.app.Session.ParentID == "" {
			return toast.NewInfoToast("Not in a sub-session")
		}

		// Get all siblings
		endpoint := fmt.Sprintf("/session/%s/sub-sessions", a.app.Session.ParentID)
		var siblings []map[string]interface{}
		err := a.app.Client.Get(ctx, endpoint, nil, &siblings)
		if err != nil {
			return toast.NewErrorToast(fmt.Sprintf("Failed to get siblings: %v", err))
		}

		if len(siblings) <= 1 {
			return toast.NewInfoToast("No sibling sub-sessions")
		}

		// Find current session index
		currentIndex := -1
		for i, sibling := range siblings {
			if id, ok := sibling["id"].(string); ok && id == a.app.Session.ID {
				currentIndex = i
				break
			}
		}

		if currentIndex == -1 {
			return toast.NewErrorToast("Current session not found in siblings")
		}

		// Calculate next index with wrap-around
		var nextIndex int
		if direction == "next" {
			nextIndex = (currentIndex + 1) % len(siblings)
		} else {
			nextIndex = currentIndex - 1
			if nextIndex < 0 {
				nextIndex = len(siblings) - 1
			}
		}

		// Switch to sibling
		if nextID, ok := siblings[nextIndex]["id"].(string); ok {
			return a.app.SwitchToSession(ctx, nextID)()
		}

		return toast.NewErrorToast("Failed to get sibling ID")
	}
}
