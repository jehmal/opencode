package clipboard

import (
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/atotto/clipboard"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/dgmo/internal/components/toast"
)

// CopyRequest represents a request to copy content to clipboard
type CopyRequest struct {
	Content    string
	Title      string
	ShowStats  bool
	ShowToast  bool
	ToastTitle string
}

// CopyResult contains the result of a clipboard copy operation
type CopyResult struct {
	Success      bool
	Error        error
	Stats        ContentStats
	ToastMessage string
}

// ContentStats contains statistics about the copied content
type ContentStats struct {
	CharacterCount int
	WordCount      int
	LineCount      int
	ByteSize       int
	HasUnicode     bool
}

// CopyResultMsg is sent when a clipboard operation completes
type CopyResultMsg struct {
	Result CopyResult
}

// calculateStats computes statistics for the given content
func calculateStats(content string) ContentStats {
	stats := ContentStats{
		CharacterCount: utf8.RuneCountInString(content),
		ByteSize:       len([]byte(content)),
		LineCount:      strings.Count(content, "\n") + 1,
		HasUnicode:     utf8.RuneCountInString(content) != len(content),
	}

	// Count words (split by whitespace)
	words := strings.Fields(content)
	stats.WordCount = len(words)

	// If content is only whitespace, line count should be 0
	if strings.TrimSpace(content) == "" {
		stats.LineCount = 0
		stats.WordCount = 0
	}

	return stats
}

// formatStats creates a human-readable statistics string
func formatStats(stats ContentStats) string {
	var parts []string

	if stats.CharacterCount > 0 {
		parts = append(parts, fmt.Sprintf("%d chars", stats.CharacterCount))
	}

	if stats.WordCount > 0 {
		parts = append(parts, fmt.Sprintf("%d words", stats.WordCount))
	}

	if stats.LineCount > 1 {
		parts = append(parts, fmt.Sprintf("%d lines", stats.LineCount))
	}

	if stats.ByteSize > 1024 {
		kb := float64(stats.ByteSize) / 1024.0
		if kb > 1024 {
			mb := kb / 1024.0
			parts = append(parts, fmt.Sprintf("%.1f MB", mb))
		} else {
			parts = append(parts, fmt.Sprintf("%.1f KB", kb))
		}
	} else if stats.ByteSize > 0 {
		parts = append(parts, fmt.Sprintf("%d bytes", stats.ByteSize))
	}

	if len(parts) == 0 {
		return "empty content"
	}

	return strings.Join(parts, ", ")
}

// CopyToClipboard copies content to clipboard and returns a command that will send the result
func CopyToClipboard(request CopyRequest) tea.Cmd {
	return func() tea.Msg {
		// Calculate statistics
		stats := calculateStats(request.Content)

		// Attempt to copy to clipboard
		err := clipboard.WriteAll(request.Content)

		result := CopyResult{
			Success: err == nil,
			Error:   err,
			Stats:   stats,
		}

		// Generate toast message
		if request.ShowToast {
			if result.Success {
				if request.ShowStats {
					result.ToastMessage = fmt.Sprintf("Copied to clipboard (%s)", formatStats(stats))
				} else {
					result.ToastMessage = "Copied to clipboard"
				}
			} else {
				result.ToastMessage = fmt.Sprintf("Failed to copy: %v", err)
			}
		}

		return CopyResultMsg{Result: result}
	}
}

// CopyWithToast is a convenience function that copies content and shows a toast notification
func CopyWithToast(content string, title string) tea.Cmd {
	return CopyToClipboard(CopyRequest{
		Content:    content,
		Title:      title,
		ShowStats:  true,
		ShowToast:  true,
		ToastTitle: title,
	})
}

// CopyWithStatsToast copies content and shows detailed statistics in the toast
func CopyWithStatsToast(content string, title string) tea.Cmd {
	return CopyToClipboard(CopyRequest{
		Content:    content,
		Title:      title,
		ShowStats:  true,
		ShowToast:  true,
		ToastTitle: title,
	})
}

// CopySilent copies content without showing any notifications
func CopySilent(content string) tea.Cmd {
	return CopyToClipboard(CopyRequest{
		Content:   content,
		ShowStats: false,
		ShowToast: false,
	})
}

// HandleCopyResult processes a CopyResultMsg and returns appropriate toast commands
func HandleCopyResult(msg CopyResultMsg) tea.Cmd {
	result := msg.Result

	if !result.Success {
		// Show error toast
		return toast.NewErrorToast(
			result.ToastMessage,
			toast.WithTitle("Clipboard Error"),
			toast.WithDuration(5*time.Second),
		)
	}

	if result.ToastMessage != "" {
		// Show success toast
		return toast.NewSuccessToast(
			result.ToastMessage,
			toast.WithTitle("Clipboard"),
			toast.WithDuration(3*time.Second),
		)
	}

	return nil
}

// CopyPromptWithStats copies a continuation prompt with detailed statistics
func CopyPromptWithStats(prompt string) tea.Cmd {
	return CopyToClipboard(CopyRequest{
		Content:    prompt,
		Title:      "Continuation Prompt",
		ShowStats:  true,
		ShowToast:  true,
		ToastTitle: "Continuation Prompt",
	})
}

// GetClipboardContent reads content from clipboard
func GetClipboardContent() tea.Cmd {
	return func() tea.Msg {
		content, err := clipboard.ReadAll()
		if err != nil {
			return CopyResultMsg{
				Result: CopyResult{
					Success: false,
					Error:   err,
				},
			}
		}

		stats := calculateStats(content)
		return CopyResultMsg{
			Result: CopyResult{
				Success: true,
				Stats:   stats,
			},
		}
	}
}

// ClipboardManager manages clipboard operations and provides fallback options
type ClipboardManager struct {
	lastCopiedContent string
	lastCopiedTime    time.Time
	fallbackEnabled   bool
}

// NewClipboardManager creates a new clipboard manager
func NewClipboardManager() *ClipboardManager {
	return &ClipboardManager{
		fallbackEnabled: true,
	}
}

// CopyWithFallback attempts to copy to clipboard with fallback options
func (cm *ClipboardManager) CopyWithFallback(request CopyRequest) tea.Cmd {
	return func() tea.Msg {
		stats := calculateStats(request.Content)

		// Try primary clipboard
		err := clipboard.WriteAll(request.Content)

		if err != nil && cm.fallbackEnabled {
			// Store in internal fallback
			cm.lastCopiedContent = request.Content
			cm.lastCopiedTime = time.Now()

			result := CopyResult{
				Success:      true, // Consider fallback as success
				Stats:        stats,
				ToastMessage: "Copied to internal clipboard (system clipboard unavailable)",
			}

			return CopyResultMsg{Result: result}
		}

		result := CopyResult{
			Success: err == nil,
			Error:   err,
			Stats:   stats,
		}

		if request.ShowToast {
			if result.Success {
				if request.ShowStats {
					result.ToastMessage = fmt.Sprintf("Copied to clipboard (%s)", formatStats(stats))
				} else {
					result.ToastMessage = "Copied to clipboard"
				}
			} else {
				result.ToastMessage = fmt.Sprintf("Failed to copy: %v", err)
			}
		}

		// Update internal storage on success
		if result.Success {
			cm.lastCopiedContent = request.Content
			cm.lastCopiedTime = time.Now()
		}

		return CopyResultMsg{Result: result}
	}
}

// GetFallbackContent returns the last copied content from internal storage
func (cm *ClipboardManager) GetFallbackContent() (string, time.Time, bool) {
	if cm.lastCopiedContent == "" {
		return "", time.Time{}, false
	}
	return cm.lastCopiedContent, cm.lastCopiedTime, true
}

// ClearFallback clears the internal clipboard storage
func (cm *ClipboardManager) ClearFallback() {
	cm.lastCopiedContent = ""
	cm.lastCopiedTime = time.Time{}
}
