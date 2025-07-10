package app

import (
	"context"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"log/slog"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/dgmo/internal/commands"
	"github.com/sst/dgmo/internal/components/toast"
	"github.com/sst/dgmo/internal/config"
	"github.com/sst/dgmo/internal/image"
	"github.com/sst/dgmo/internal/styles"
	"github.com/sst/dgmo/internal/theme"
	"github.com/sst/dgmo/internal/util"
	"github.com/sst/opencode-sdk-go"
)

var RootPath string
var CwdPath string

type App struct {
	Info      opencode.App
	Version   string
	StatePath string
	Config    *opencode.Config
	Client    *opencode.Client
	State     *config.State
	Provider  *opencode.Provider
	Model     *opencode.Model
	Session   *opencode.Session
	Messages  []opencode.Message
	Commands  commands.CommandRegistry

	// Session navigation state
	SessionStack         []string // Stack of session IDs for navigation history
	CurrentSessionType   string   // "main" or "sub"
	LastViewedSubSession string   // Track last viewed sub-session for quick access
	sessionMutex         sync.RWMutex // Mutex for thread-safe access to session fields

	// Task tracking
	TaskClient *TaskClient

	// Checkpoint service
	CheckpointService *CheckpointService

	// Shutdown handling
	shutdownCtx    context.Context
	shutdownCancel context.CancelFunc
	shutdownWg     sync.WaitGroup
}

type SessionSelectedMsg = *opencode.Session
type ModelSelectedMsg struct {
	Provider opencode.Provider
	Model    opencode.Model
}
type SessionClearedMsg struct{}
type CompactSessionMsg struct{}
type SendMsg struct {
	Text        string
	Attachments []Attachment
}

// QueuedSendMsg is a message that was queued and should bypass busy check
type QueuedSendMsg struct {
	Text        string
	Attachments []Attachment
}
type CompletionDialogTriggeredMsg struct {
	InitialValue string
}
type OptimisticMessageAddedMsg struct {
	Message opencode.Message
}

// Session navigation messages
type SessionSwitchedMsg struct {
	SessionID string
	Session   *opencode.Session
	Messages  []opencode.Message
}

type NavigateBackMsg struct{}

type NavigateToSiblingMsg struct {
	Direction int // -1 for previous, 1 for next
}

type ConnectionStatusMsg struct {
	Status    string // "connected", "connecting", "reconnecting", "disconnected", "failed"
	Message   string
	IsHealthy bool
}

func New(
	ctx context.Context,
	version string,
	appInfo opencode.App,
	httpClient *opencode.Client,
	baseURL string,
) (*App, error) {
	RootPath = appInfo.Path.Root
	CwdPath = appInfo.Path.Cwd

	configInfo, err := httpClient.Config.Get(ctx)
	if err != nil {
		return nil, err
	}

	if configInfo.Keybinds.Leader == "" {
		configInfo.Keybinds.Leader = "ctrl+x"
	}

	appStatePath := filepath.Join(appInfo.Path.State, "tui")
	appState, err := config.LoadState(appStatePath)
	if err != nil {
		appState = config.NewState()
		config.SaveState(appStatePath, appState)
	}

	if configInfo.Theme != "" {
		appState.Theme = configInfo.Theme
	}

	if configInfo.Model != "" {
		splits := strings.Split(configInfo.Model, "/")
		appState.Provider = splits[0]
		appState.Model = strings.Join(splits[1:], "/")
	}

	if err := theme.LoadThemesFromDirectories(
		appInfo.Path.Config,
		appInfo.Path.Root,
		appInfo.Path.Cwd,
	); err != nil {
		slog.Warn("Failed to load themes from directories", "error", err)
	}

	if appState.Theme != "" {
		if appState.Theme == "system" && styles.Terminal != nil {
			theme.UpdateSystemTheme(
				styles.Terminal.Background,
				styles.Terminal.BackgroundIsDark,
			)
		}
		theme.SetTheme(appState.Theme)
	}

	slog.Debug("Loaded config", "config", configInfo)

	app := &App{
		Info:              appInfo,
		Version:           version,
		StatePath:         appStatePath,
		Config:            configInfo,
		Client:            httpClient,
		State:             appState,
		Commands:          commands.LoadFromConfig(configInfo),
		CheckpointService: NewCheckpointService(baseURL),
	}

	// Initialize navigation state
	// Note: Session is not loaded yet at this point, will be set later
	app.CurrentSessionType = "main" // Default to main
	app.SessionStack = []string{}

	// Initialize shutdown context
	app.shutdownCtx, app.shutdownCancel = context.WithCancel(context.Background())

	return app, nil
}

func (a *App) InitializeProvider() tea.Cmd {
	return func() tea.Msg {
		providersResponse, err := a.Client.Config.Providers(context.Background())
		if err != nil {
			slog.Error("Failed to list providers", "error", err)
			// TODO: notify user
			return nil
		}
		providers := providersResponse.Providers
		var defaultProvider *opencode.Provider
		var defaultModel *opencode.Model

		var anthropic *opencode.Provider
		for _, provider := range providers {
			if provider.ID == "anthropic" {
				anthropic = &provider
			}
		}

		// default to anthropic if available
		if anthropic != nil {
			defaultProvider = anthropic
			defaultModel = getDefaultModel(providersResponse, *anthropic)
		}

		for _, provider := range providers {
			if defaultProvider == nil || defaultModel == nil {
				defaultProvider = &provider
				defaultModel = getDefaultModel(providersResponse, provider)
			}
			providers = append(providers, provider)
		}
		if len(providers) == 0 {
			slog.Error("No providers configured")
			return nil
		}

		var currentProvider *opencode.Provider
		var currentModel *opencode.Model
		for _, provider := range providers {
			if provider.ID == a.State.Provider {
				currentProvider = &provider

				for _, model := range provider.Models {
					if model.ID == a.State.Model {
						currentModel = &model
					}
				}
			}
		}
		if currentProvider == nil || currentModel == nil {
			currentProvider = defaultProvider
			currentModel = defaultModel
		}

		return ModelSelectedMsg{
			Provider: *currentProvider,
			Model:    *currentModel,
		}
	}
}

func getDefaultModel(response *opencode.ConfigProvidersResponse, provider opencode.Provider) *opencode.Model {
	if match, ok := response.Default[provider.ID]; ok {
		model := provider.Models[match]
		return &model
	} else {
		for _, model := range provider.Models {
			return &model
		}
	}
	return nil
}

type Attachment struct {
	FilePath string
	FileName string
	MimeType string
	Content  []byte
}

func (a *App) IsBusy() bool {
	if len(a.Messages) == 0 {
		return false
	}

	lastMessage := a.Messages[len(a.Messages)-1]
	return lastMessage.Metadata.Time.Completed == 0
}

func (a *App) SaveState() {
	err := config.SaveState(a.StatePath, a.State)
	if err != nil {
		slog.Error("Failed to save state", "error", err)
	}
}

func (a *App) InitializeProject(ctx context.Context) tea.Cmd {
	cmds := []tea.Cmd{}

	session, err := a.CreateSession(ctx)
	if err != nil {
		// status.Error(err.Error())
		return nil
	}

	// Set session immediately so message events can be processed
	a.Session = session
	cmds = append(cmds, util.CmdHandler(SessionSelectedMsg(session)))

	// Initialize project in background
	go func() {
		// Create goroutine context with timeout
		initCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		
		_, err := a.Client.Session.Init(initCtx, session.ID, opencode.SessionInitParams{
			ProviderID: opencode.F(a.Provider.ID),
			ModelID:    opencode.F(a.Model.ID),
		})
		if err != nil {
			slog.Error("Failed to initialize project", "error", err)
			// status.Error(err.Error())
		}
	}()

	return tea.Batch(cmds...)
}

func (a *App) CompactSession(ctx context.Context) tea.Cmd {
	go func() {
		_, err := a.Client.Session.Summarize(ctx, a.Session.ID, opencode.SessionSummarizeParams{
			ProviderID: opencode.F(a.Provider.ID),
			ModelID:    opencode.F(a.Model.ID),
		})
		if err != nil {
			slog.Error("Failed to compact session", "error", err)
		}
	}()
	return nil
}

func (a *App) MarkProjectInitialized(ctx context.Context) error {
	_, err := a.Client.App.Init(ctx)
	if err != nil {
		slog.Error("Failed to mark project as initialized", "error", err)
		return err
	}
	return nil
}

func (a *App) CreateSession(ctx context.Context) (*opencode.Session, error) {
	session, err := a.Client.Session.New(ctx)
	if err != nil {
		return nil, err
	}
	return session, nil
}

func (a *App) SendChatMessage(ctx context.Context, text string, attachments []Attachment) tea.Cmd {
	var cmds []tea.Cmd
	if a.Session == nil || a.Session.ID == "" {
		session, err := a.CreateSession(ctx)
		if err != nil {
			return toast.NewErrorToast(err.Error())
		}
		a.Session = session
		cmds = append(cmds, util.CmdHandler(SessionSelectedMsg(session)))
	}

	// Extract image paths from text
	imagePaths := image.ExtractImagePaths(text)
	if len(imagePaths) > 0 {
		slog.Info("Detected images in message", "count", len(imagePaths), "paths", imagePaths)
	}

	// Build optimistic message parts
	optimisticParts := []opencode.MessagePart{{
		Type: opencode.MessagePartTypeText,
		Text: text,
	}}

	// Add image indicators to optimistic message
	for _, imgPath := range imagePaths {
		optimisticParts = append(optimisticParts, opencode.MessagePart{
			Type: opencode.MessagePartTypeText,
			Text: fmt.Sprintf("\n📎 Image: %s", filepath.Base(imgPath)),
		})
	}

	optimisticMessage := opencode.Message{
		ID:    fmt.Sprintf("optimistic-%d", time.Now().UnixNano()),
		Role:  opencode.MessageRoleUser,
		Parts: optimisticParts,
		Metadata: opencode.MessageMetadata{
			SessionID: a.Session.ID,
			Time: opencode.MessageMetadataTime{
				Created: float64(time.Now().Unix()),
			},
		},
	}

	a.Messages = append(a.Messages, optimisticMessage)
	cmds = append(cmds, util.CmdHandler(OptimisticMessageAddedMsg{Message: optimisticMessage}))

	// Show processing toast if images found
	if len(imagePaths) > 0 {
		cmds = append(cmds, toast.NewInfoToast(fmt.Sprintf("Processing %d image(s)...", len(imagePaths))))
	}

	cmds = append(cmds, func() tea.Msg {
		// Process images first to know which ones loaded successfuly
		loadedCount := 0
		loadedPaths := []string{}
		var imageParts []opencode.MessagePartUnionParam

		for _, imgPath := range imagePaths {
			dataURL, err := image.ReadImageAsBase64(imgPath)
			if err != nil {
				slog.Error("Failed to load image", "path", imgPath, "error", err)
				continue
			}

			imageParts = append(imageParts, opencode.FilePartParam{
				Type:      opencode.F(opencode.FilePartTypeFile),
				URL:       opencode.F(dataURL),
				MediaType: opencode.F(image.GetMimeType(imgPath)),
				Filename:  opencode.F(filepath.Base(imgPath)),
			})
			loadedCount++
			loadedPaths = append(loadedPaths, imgPath)
			slog.Info("Successfully loaded image", "path", imgPath, "mimeType", image.GetMimeType(imgPath))
		}

		// Clean the text by replacing file paths with [image] to prevent Claude from trying to read them
		cleanedText := text
		for _, imgPath := range loadedPaths {
			// Replace the path with a placeholder
			cleanedText = strings.ReplaceAll(cleanedText, imgPath, "[image]")
		}

		// Build message parts with cleaned text first
		parts := []opencode.MessagePartUnionParam{
			opencode.TextPartParam{
				Type: opencode.F(opencode.TextPartTypeText),
				Text: opencode.F(cleanedText),
			},
		}

		// Add all image parts
		parts = append(parts, imageParts...)

		// Show feedback about loaded images
		if len(imagePaths) > 0 {
			if loadedCount == len(imagePaths) {
				toast.NewSuccessToast(fmt.Sprintf("✅ Successfully loaded %d image(s)", loadedCount))()
			} else if loadedCount > 0 {
				toast.NewWarningToast(fmt.Sprintf("⚠️ Loaded %d of %d image(s)", loadedCount, len(imagePaths)))()
			} else {
				toast.NewErrorToast("❌ Failed to load any images")()
			}
		}

		_, err := a.Client.Session.Chat(ctx, a.Session.ID, opencode.SessionChatParams{
			Parts:      opencode.F(parts),
			ProviderID: opencode.F(a.Provider.ID),
			ModelID:    opencode.F(a.Model.ID),
		})
		if err != nil {
			errormsg := fmt.Sprintf("failed to send message: %v", err)
			slog.Error(errormsg)
			return toast.NewErrorToast(errormsg)()
		}
		return nil
	})
	// The actual response will come through SSE
	// For now, just return success
	return tea.Batch(cmds...)
}

func (a *App) Cancel(ctx context.Context, sessionID string) error {
	_, err := a.Client.Session.Abort(ctx, sessionID)
	if err != nil {
		slog.Error("Failed to cancel session", "error", err)
		// status.Error(err.Error())
		return err
	}
	return nil
}

func (a *App) ListSessions(ctx context.Context) ([]opencode.Session, error) {
	response, err := a.Client.Session.List(ctx)
	if err != nil {
		return nil, err
	}
	if response == nil {
		return []opencode.Session{}, nil
	}
	sessions := *response
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].Time.Created-sessions[j].Time.Created > 0
	})
	return sessions, nil
}

func (a *App) DeleteSession(ctx context.Context, sessionID string) error {
	_, err := a.Client.Session.Delete(ctx, sessionID)
	if err != nil {
		slog.Error("Failed to delete session", "error", err)
		return err
	}
	return nil
}

func (a *App) ListMessages(ctx context.Context, sessionId string) ([]opencode.Message, error) {
	response, err := a.Client.Session.Messages(ctx, sessionId)
	if err != nil {
		return nil, err
	}
	if response == nil {
		return []opencode.Message{}, nil
	}
	messages := *response
	return messages, nil
}

func (a *App) ListProviders(ctx context.Context) ([]opencode.Provider, error) {
	response, err := a.Client.Config.Providers(ctx)
	if err != nil {
		return nil, err
	}
	if response == nil {
		return []opencode.Provider{}, nil
	}

	providers := *response
	return providers.Providers, nil
}

// func (a *App) loadCustomKeybinds() {
//
// }

// Session navigation methods

// PushSession adds a session to the navigation stack
func (a *App) PushSession(sessionID string) {
	a.sessionMutex.Lock()
	defer a.sessionMutex.Unlock()
	
	if a.SessionStack == nil {
		a.SessionStack = []string{}
	}
	// Avoid duplicates at the top
	if len(a.SessionStack) > 0 && a.SessionStack[len(a.SessionStack)-1] == sessionID {
		return
	}
	a.SessionStack = append(a.SessionStack, sessionID)
}

// PopSession removes and returns the last session from the stack
func (a *App) PopSession() string {
	a.sessionMutex.Lock()
	defer a.sessionMutex.Unlock()
	
	if len(a.SessionStack) == 0 {
		return ""
	}
	sessionID := a.SessionStack[len(a.SessionStack)-1]
	a.SessionStack = a.SessionStack[:len(a.SessionStack)-1]
	return sessionID
}

// LoadSession loads a session and its messages
func (a *App) LoadSession(ctx context.Context, sessionID string) (*opencode.Session, []opencode.Message, error) {
	// Get all sessions and find the one we want
	sessions, err := a.ListSessions(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list sessions: %w", err)
	}

	var session *opencode.Session
	for _, s := range sessions {
		if s.ID == sessionID {
			session = &s
			break
		}
	}

	if session == nil {
		return nil, nil, fmt.Errorf("session not found: %s", sessionID)
	}

	// Get messages
	messages, err := a.ListMessages(ctx, sessionID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get messages: %w", err)
	}

	return session, messages, nil
}

// SwitchToSession switches the current session context
func (a *App) SwitchToSession(ctx context.Context, sessionID string) tea.Cmd {
	return func() tea.Msg {
		session, messages, err := a.LoadSession(ctx, sessionID)
		if err != nil {
			return toast.NewErrorToast(fmt.Sprintf("Failed to load session: %v", err))
		}

		// Track navigation
		if a.Session != nil {
			a.PushSession(a.Session.ID)
		}

		// Update session type
		if session.ParentID != "" {
			a.CurrentSessionType = "sub"
			a.LastViewedSubSession = sessionID
		} else {
			a.CurrentSessionType = "main"
		}

		return SessionSwitchedMsg{
			SessionID: sessionID,
			Session:   session,
			Messages:  messages,
		}
	}
}

// Shutdown gracefully shuts down the app and cleans up resources
func (a *App) Shutdown() {
	if a.shutdownCancel != nil {
		a.shutdownCancel()
	}
	
	// Wait for all goroutines with timeout
	done := make(chan struct{})
	go func() {
		a.shutdownWg.Wait()
		close(done)
	}()
	
	select {
	case <-done:
		// All goroutines finished
	case <-time.After(5 * time.Second):
		slog.Warn("Shutdown timeout - some goroutines may not have finished")
	}
	
	// Disconnect task client if exists
	if a.TaskClient != nil {
		a.TaskClient.Disconnect()
	}
}
