package toast

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
	"github.com/sst/dgmo/internal/layout"
	"github.com/sst/dgmo/internal/styles"
	"github.com/sst/dgmo/internal/theme"
)

// ShowToastMsg is a message to display a toast notification
type ShowToastMsg struct {
	ID       string // Optional ID for updating the toast later
	Message  string
	Title    *string
	Color    compat.AdaptiveColor
	Duration time.Duration
}

// DismissToastMsg is a message to dismiss a specific toast
type DismissToastMsg struct {
	ID string
}

// UpdateToastMsg is a message to update an existing toast
type UpdateToastMsg struct {
	ID       string
	Message  string
	Title    *string
	Progress *int
}

// Toast represents a single toast notification
type Toast struct {
	ID        string
	Message   string
	Title     *string
	Color     compat.AdaptiveColor
	CreatedAt time.Time
	Duration  time.Duration
	Progress  *int   // For progress toasts
	TaskID    string // For tracking task-related toasts
}

// ToastManager manages multiple toast notifications
type ToastManager struct {
	toasts []Toast
}

// NewToastManager creates a new toast manager
func NewToastManager() *ToastManager {
	return &ToastManager{
		toasts: []Toast{},
	}
}

// Init initializes the toast manager
func (tm *ToastManager) Init() tea.Cmd {
	return nil
}

// Update handles messages for the toast manager
func (tm *ToastManager) Update(msg tea.Msg) (*ToastManager, tea.Cmd) {
	switch msg := msg.(type) {
	case ShowToastMsg:
		// Use provided ID or generate a new one
		id := msg.ID
		if id == "" {
			id = fmt.Sprintf("toast-%d", time.Now().UnixNano())
		}
		
		toast := Toast{
			ID:        id,
			Title:     msg.Title,
			Message:   msg.Message,
			Color:     msg.Color,
			CreatedAt: time.Now(),
			Duration:  msg.Duration,
		}

		tm.toasts = append(tm.toasts, toast)

		// Return command to dismiss after duration
		return tm, tea.Tick(toast.Duration, func(t time.Time) tea.Msg {
			return DismissToastMsg{ID: toast.ID}
		})

	case DismissToastMsg:
		var newToasts []Toast
		for _, t := range tm.toasts {
			if t.ID != msg.ID {
				newToasts = append(newToasts, t)
			}
		}
		tm.toasts = newToasts
	case UpdateToastMsg:
		// Update existing toast
		var cmds []tea.Cmd
		for i, t := range tm.toasts {
			if t.ID == msg.ID {
				// Update message with progress if provided
				if msg.Progress != nil {
					tm.toasts[i].Progress = msg.Progress
					progressBar := renderProgressBar(*msg.Progress, 20)
					tm.toasts[i].Message = fmt.Sprintf("%s\n%s", msg.Message, progressBar)
				} else {
					tm.toasts[i].Message = msg.Message
				}
				if msg.Title != nil {
					tm.toasts[i].Title = msg.Title
				}
				// Reset the duration to keep it visible
				tm.toasts[i].Duration = 30 * time.Second
				tm.toasts[i].CreatedAt = time.Now()
				
				// Cancel previous dismiss timer and set a new one
				cmds = append(cmds, tea.Tick(tm.toasts[i].Duration, func(t time.Time) tea.Msg {
					return DismissToastMsg{ID: msg.ID}
				}))
				break
			}
		}
		return tm, tea.Batch(cmds...)
	}

	return tm, nil
}

// renderSingleToast renders a single toast notification
func (tm *ToastManager) renderSingleToast(toast Toast) string {
	t := theme.CurrentTheme()

	baseStyle := styles.NewStyle().
		Foreground(t.Text()).
		Background(t.BackgroundElement()).
		Padding(1, 2)

	maxWidth := max(40, layout.Current.Viewport.Width/3)
	contentMaxWidth := max(maxWidth-6, 20)

	// Build content with wrapping
	var content strings.Builder
	if toast.Title != nil {
		titleStyle := styles.NewStyle().Foreground(toast.Color).
			Bold(true)
		content.WriteString(titleStyle.Render(*toast.Title))
		content.WriteString("\n")
	}

	// Wrap message text
	messageStyle := styles.NewStyle()

	// If this is a progress toast, add the progress bar
	var fullMessage string
	if toast.Progress != nil {
		progressBar := renderProgressBar(*toast.Progress, 20)
		fullMessage = fmt.Sprintf("%s\n%s", toast.Message, progressBar)
	} else {
		fullMessage = toast.Message
	}

	contentWidth := lipgloss.Width(fullMessage)
	if contentWidth > contentMaxWidth {
		messageStyle = messageStyle.Width(contentMaxWidth)
	}
	content.WriteString(messageStyle.Render(fullMessage))

	// Render toast with max width
	return baseStyle.MaxWidth(maxWidth).Render(content.String())
}

// View renders all active toasts
func (tm *ToastManager) View() string {
	if len(tm.toasts) == 0 {
		return ""
	}

	var toastViews []string
	for _, toast := range tm.toasts {
		toastView := tm.renderSingleToast(toast)
		toastViews = append(toastViews, toastView+"\n")
	}

	return strings.Join(toastViews, "\n")
}

// RenderOverlay renders the toasts as an overlay on the given background
func (tm *ToastManager) RenderOverlay(background string) string {
	if len(tm.toasts) == 0 {
		return background
	}

	bgWidth := lipgloss.Width(background)
	bgHeight := lipgloss.Height(background)
	result := background

	// Start from top with 2 character padding
	currentY := 2

	// Render each toast individually
	for _, toast := range tm.toasts {
		// Render individual toast
		toastView := tm.renderSingleToast(toast)
		toastWidth := lipgloss.Width(toastView)
		toastHeight := lipgloss.Height(toastView)

		// Position at top-right with 2 character padding from right edge
		x := max(bgWidth-toastWidth-4, 0)

		// Check if toast fits vertically
		if currentY+toastHeight > bgHeight-2 {
			// No more room for toasts
			break
		}

		// Place this toast
		result = layout.PlaceOverlay(
			x,
			currentY,
			toastView,
			result,
			layout.WithOverlayBorder(),
			layout.WithOverlayBorderColor(toast.Color),
		)

		// Move down for next toast (add 1 for spacing between toasts)
		currentY += toastHeight + 1
	}

	return result
}

type ToastOptions struct {
	Title    string
	Duration time.Duration
}

type toastOptions struct {
	id       *string
	title    *string
	duration *time.Duration
	color    *compat.AdaptiveColor
}

type ToastOption func(*toastOptions)

func WithTitle(title string) ToastOption {
	return func(t *toastOptions) {
		t.title = &title
	}
}
func WithDuration(duration time.Duration) ToastOption {
	return func(t *toastOptions) {
		t.duration = &duration
	}
}

func WithColor(color compat.AdaptiveColor) ToastOption {
	return func(t *toastOptions) {
		t.color = &color
	}
}

// WithID sets a specific ID for the toast
func WithID(id string) ToastOption {
	return func(t *toastOptions) {
		t.id = &id
	}
}

func NewToast(message string, options ...ToastOption) tea.Cmd {
	t := theme.CurrentTheme()
	duration := 5 * time.Second
	color := t.Primary()

	opts := toastOptions{
		duration: &duration,
		color:    &color,
	}
	for _, option := range options {
		option(&opts)
	}

	return func() tea.Msg {
		id := ""
		if opts.id != nil {
			id = *opts.id
		}
		return ShowToastMsg{
			ID:       id,
			Message:  message,
			Title:    opts.title,
			Duration: *opts.duration,
			Color:    *opts.color,
		}
	}
}

func NewInfoToast(message string, options ...ToastOption) tea.Cmd {
	options = append(options, WithColor(theme.CurrentTheme().Info()))
	return NewToast(
		message,
		options...,
	)
}

func NewSuccessToast(message string, options ...ToastOption) tea.Cmd {
	options = append(options, WithColor(theme.CurrentTheme().Success()))
	return NewToast(
		message,
		options...,
	)
}

func NewWarningToast(message string, options ...ToastOption) tea.Cmd {
	options = append(options, WithColor(theme.CurrentTheme().Warning()))
	return NewToast(
		message,
		options...,
	)
}

func NewErrorToast(message string, options ...ToastOption) tea.Cmd {
	options = append(options, WithColor(theme.CurrentTheme().Error()))
	return NewToast(
		message,
		options...,
	)
}

// NewProgressToast creates a toast with a progress bar
func NewProgressToast(message string, progress int, options ...ToastOption) tea.Cmd {
	// Create a visual progress bar
	progressBar := renderProgressBar(progress, 20)
	fullMessage := fmt.Sprintf("%s\n%s", message, progressBar)

	options = append(options, WithColor(theme.CurrentTheme().Info()))
	return NewToast(
		fullMessage,
		options...,
	)
}

// renderProgressBar creates a visual progress bar
func renderProgressBar(progress int, width int) string {
	if progress < 0 {
		progress = 0
	}
	if progress > 100 {
		progress = 100
	}

	filled := (progress * width) / 100
	empty := width - filled

	bar := strings.Repeat("█", filled) + strings.Repeat("░", empty)
	return fmt.Sprintf("[%s] %d%%", bar, progress)
}
