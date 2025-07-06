package clipboard

import (
	"fmt"

	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
)

// ClipboardKeyMap defines keybindings for clipboard operations
type ClipboardKeyMap struct {
	Copy          key.Binding
	CopyWithStats key.Binding
	Paste         key.Binding
	CopyPrompt    key.Binding
}

// DefaultClipboardKeyMap returns the default keybindings for clipboard operations
func DefaultClipboardKeyMap() ClipboardKeyMap {
	return ClipboardKeyMap{
		Copy: key.NewBinding(
			key.WithKeys("ctrl+c"),
			key.WithHelp("ctrl+c", "copy"),
		),
		CopyWithStats: key.NewBinding(
			key.WithKeys("ctrl+shift+c"),
			key.WithHelp("ctrl+shift+c", "copy with stats"),
		),
		Paste: key.NewBinding(
			key.WithKeys("ctrl+v"),
			key.WithHelp("ctrl+v", "paste"),
		),
		CopyPrompt: key.NewBinding(
			key.WithKeys("ctrl+alt+c"),
			key.WithHelp("ctrl+alt+c", "copy continuation prompt"),
		),
	}
}

// ClipboardKeyHandler handles clipboard-related key events
type ClipboardKeyHandler struct {
	keyMap            ClipboardKeyMap
	clipboardManager  *ClipboardManager
	getCurrentContent func() string        // Function to get current content to copy
	onPaste           func(string) tea.Cmd // Function to handle paste operations
}

// NewClipboardKeyHandler creates a new clipboard key handler
func NewClipboardKeyHandler(
	getCurrentContent func() string,
	onPaste func(string) tea.Cmd,
) *ClipboardKeyHandler {
	return &ClipboardKeyHandler{
		keyMap:            DefaultClipboardKeyMap(),
		clipboardManager:  NewClipboardManager(),
		getCurrentContent: getCurrentContent,
		onPaste:           onPaste,
	}
}

// HandleKeyMsg processes key messages for clipboard operations
func (h *ClipboardKeyHandler) HandleKeyMsg(msg tea.KeyMsg) tea.Cmd {
	switch {
	case key.Matches(msg, h.keyMap.Copy):
		if h.getCurrentContent != nil {
			content := h.getCurrentContent()
			if content != "" {
				return h.clipboardManager.CopyWithFallback(CopyRequest{
					Content:   content,
					ShowStats: false,
					ShowToast: true,
				})
			}
		}
		return nil

	case key.Matches(msg, h.keyMap.CopyWithStats):
		if h.getCurrentContent != nil {
			content := h.getCurrentContent()
			if content != "" {
				return h.clipboardManager.CopyWithFallback(CopyRequest{
					Content:   content,
					ShowStats: true,
					ShowToast: true,
				})
			}
		}
		return nil

	case key.Matches(msg, h.keyMap.Paste):
		return h.handlePaste()

	case key.Matches(msg, h.keyMap.CopyPrompt):
		return h.handleCopyPrompt()
	}

	return nil
}

// handlePaste handles paste operations
func (h *ClipboardKeyHandler) handlePaste() tea.Cmd {
	return func() tea.Msg {
		// Try system clipboard first
		content, err := GetClipboardContentSync()
		if err != nil {
			// Try fallback
			if fallbackContent, _, hasContent := h.clipboardManager.GetFallbackContent(); hasContent {
				content = fallbackContent
				err = nil
			}
		}

		if err != nil {
			return CopyResultMsg{
				Result: CopyResult{
					Success:      false,
					Error:        err,
					ToastMessage: fmt.Sprintf("Failed to paste: %v", err),
				},
			}
		}

		// Call the paste handler if provided
		if h.onPaste != nil {
			return h.onPaste(content)
		}

		return nil
	}
}

// handleCopyPrompt handles copying continuation prompts
func (h *ClipboardKeyHandler) handleCopyPrompt() tea.Cmd {
	// This would be implemented to generate and copy a continuation prompt
	// For now, return a placeholder
	return func() tea.Msg {
		prompt := h.generateContinuationPrompt()
		return CopyPromptWithStats(prompt)()
	}
}

// generateContinuationPrompt generates a continuation prompt based on current context
func (h *ClipboardKeyHandler) generateContinuationPrompt() string {
	// This is a placeholder implementation
	// In a real implementation, this would analyze the current session state
	// and generate an appropriate continuation prompt
	return `## Continuation Prompt

Continue the current task from where we left off.

### Current Context:
- Session: Active
- Last action: [To be determined from session state]

### Next Steps:
1. Review current progress
2. Continue implementation
3. Test and validate

Please proceed with the next logical step in the implementation.`
}

// GetClipboardContentSync synchronously reads from clipboard
func GetClipboardContentSync() (string, error) {
	// This is a synchronous version for immediate use
	// In practice, you might want to use the async version
	return "", fmt.Errorf("not implemented - use async version")
}

// SetKeyMap updates the keybinding map
func (h *ClipboardKeyHandler) SetKeyMap(keyMap ClipboardKeyMap) {
	h.keyMap = keyMap
}

// GetKeyMap returns the current keybinding map
func (h *ClipboardKeyHandler) GetKeyMap() ClipboardKeyMap {
	return h.keyMap
}

// Help returns help information for clipboard keybindings
func (h *ClipboardKeyHandler) Help() []key.Binding {
	return []key.Binding{
		h.keyMap.Copy,
		h.keyMap.CopyWithStats,
		h.keyMap.Paste,
		h.keyMap.CopyPrompt,
	}
}
