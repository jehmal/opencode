package mcp

import (
	"fmt"
	"time"

	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/theme"
)

// initBasicTheme initializes themes for demo purposes
func initBasicTheme() {
	// Load built-in themes
	if err := theme.LoadThemesFromJSON(); err != nil {
		fmt.Printf("Warning: Failed to load themes: %v\n", err)
		// Create a minimal fallback theme if loading fails
		createFallbackTheme()
	}
}

// createFallbackTheme creates a minimal theme as fallback
func createFallbackTheme() {
	fallbackTheme := &simpleTheme{}
	theme.RegisterTheme("fallback", fallbackTheme)
}

// simpleTheme is a minimal theme implementation for demo purposes
type simpleTheme struct{}

func (t *simpleTheme) Name() string { return "fallback" }
func (t *simpleTheme) Background() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#1a1a1a"), Light: lipgloss.Color("#ffffff")}
}
func (t *simpleTheme) BackgroundPanel() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#2a2a2a"), Light: lipgloss.Color("#f5f5f5")}
}
func (t *simpleTheme) BackgroundElement() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#3a3a3a"), Light: lipgloss.Color("#e5e5e5")}
}
func (t *simpleTheme) BorderSubtle() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#444444"), Light: lipgloss.Color("#cccccc")}
}
func (t *simpleTheme) Border() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#666666"), Light: lipgloss.Color("#999999")}
}
func (t *simpleTheme) BorderActive() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#888888"), Light: lipgloss.Color("#666666")}
}
func (t *simpleTheme) Primary() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#0099ff"), Light: lipgloss.Color("#0066cc")}
}
func (t *simpleTheme) Secondary() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#6666ff"), Light: lipgloss.Color("#4444cc")}
}
func (t *simpleTheme) Accent() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#ff6600"), Light: lipgloss.Color("#cc4400")}
}
func (t *simpleTheme) TextMuted() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#888888"), Light: lipgloss.Color("#666666")}
}
func (t *simpleTheme) Text() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#ffffff"), Light: lipgloss.Color("#000000")}
}
func (t *simpleTheme) Error() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#ff4444"), Light: lipgloss.Color("#cc0000")}
}
func (t *simpleTheme) Warning() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#ffaa00"), Light: lipgloss.Color("#ff8800")}
}
func (t *simpleTheme) Success() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#44ff44"), Light: lipgloss.Color("#008800")}
}
func (t *simpleTheme) Info() compat.AdaptiveColor {
	return compat.AdaptiveColor{Dark: lipgloss.Color("#44aaff"), Light: lipgloss.Color("#0088cc")}
}

// Diff colors (minimal implementation)
func (t *simpleTheme) DiffAdded() compat.AdaptiveColor               { return t.Success() }
func (t *simpleTheme) DiffRemoved() compat.AdaptiveColor             { return t.Error() }
func (t *simpleTheme) DiffContext() compat.AdaptiveColor             { return t.TextMuted() }
func (t *simpleTheme) DiffHunkHeader() compat.AdaptiveColor          { return t.Primary() }
func (t *simpleTheme) DiffHighlightAdded() compat.AdaptiveColor      { return t.Success() }
func (t *simpleTheme) DiffHighlightRemoved() compat.AdaptiveColor    { return t.Error() }
func (t *simpleTheme) DiffAddedBg() compat.AdaptiveColor             { return t.BackgroundPanel() }
func (t *simpleTheme) DiffRemovedBg() compat.AdaptiveColor           { return t.BackgroundPanel() }
func (t *simpleTheme) DiffContextBg() compat.AdaptiveColor           { return t.Background() }
func (t *simpleTheme) DiffLineNumber() compat.AdaptiveColor          { return t.TextMuted() }
func (t *simpleTheme) DiffAddedLineNumberBg() compat.AdaptiveColor   { return t.BackgroundPanel() }
func (t *simpleTheme) DiffRemovedLineNumberBg() compat.AdaptiveColor { return t.BackgroundPanel() }

// Markdown colors (minimal implementation)
func (t *simpleTheme) MarkdownText() compat.AdaptiveColor            { return t.Text() }
func (t *simpleTheme) MarkdownHeading() compat.AdaptiveColor         { return t.Primary() }
func (t *simpleTheme) MarkdownLink() compat.AdaptiveColor            { return t.Info() }
func (t *simpleTheme) MarkdownLinkText() compat.AdaptiveColor        { return t.Info() }
func (t *simpleTheme) MarkdownCode() compat.AdaptiveColor            { return t.Accent() }
func (t *simpleTheme) MarkdownBlockQuote() compat.AdaptiveColor      { return t.TextMuted() }
func (t *simpleTheme) MarkdownEmph() compat.AdaptiveColor            { return t.Text() }
func (t *simpleTheme) MarkdownStrong() compat.AdaptiveColor          { return t.Text() }
func (t *simpleTheme) MarkdownHorizontalRule() compat.AdaptiveColor  { return t.Border() }
func (t *simpleTheme) MarkdownListItem() compat.AdaptiveColor        { return t.Text() }
func (t *simpleTheme) MarkdownListEnumeration() compat.AdaptiveColor { return t.TextMuted() }
func (t *simpleTheme) MarkdownImage() compat.AdaptiveColor           { return t.Accent() }
func (t *simpleTheme) MarkdownImageText() compat.AdaptiveColor       { return t.Text() }
func (t *simpleTheme) MarkdownCodeBlock() compat.AdaptiveColor       { return t.Accent() }

// Syntax highlighting colors (minimal implementation)
func (t *simpleTheme) SyntaxComment() compat.AdaptiveColor     { return t.TextMuted() }
func (t *simpleTheme) SyntaxKeyword() compat.AdaptiveColor     { return t.Primary() }
func (t *simpleTheme) SyntaxFunction() compat.AdaptiveColor    { return t.Secondary() }
func (t *simpleTheme) SyntaxVariable() compat.AdaptiveColor    { return t.Text() }
func (t *simpleTheme) SyntaxString() compat.AdaptiveColor      { return t.Success() }
func (t *simpleTheme) SyntaxNumber() compat.AdaptiveColor      { return t.Warning() }
func (t *simpleTheme) SyntaxType() compat.AdaptiveColor        { return t.Info() }
func (t *simpleTheme) SyntaxOperator() compat.AdaptiveColor    { return t.Text() }
func (t *simpleTheme) SyntaxPunctuation() compat.AdaptiveColor { return t.TextMuted() }

// DemoMCPPanel demonstrates the MCP panel functionality
func DemoMCPPanel() {
	fmt.Println("=== MCP Panel Demo ===")

	// Initialize a basic theme for the demo
	initBasicTheme()

	// Create a mock app
	mockApp := &app.App{}

	// Create MCP panel component
	panel := NewMCPPanelComponent(mockApp)
	panel.SetSize(80, 6)

	fmt.Println("1. Initial panel state:")
	fmt.Printf("   Visible: %t\n", panel.IsVisible())
	fmt.Printf("   Active calls: %d\n", len(panel.GetActiveCalls()))

	// Add some sample MCP calls
	calls := []MCPCall{
		{
			ID:        "qdrant_vector-search-1",
			Server:    "qdrant",
			Method:    "vector-search",
			Status:    MCPCallRunning,
			StartTime: time.Now().Add(-time.Second * 2),
		},
		{
			ID:        "prompt-tech_compose-prompt-1",
			Server:    "prompt-tech",
			Method:    "compose-prompt",
			Status:    MCPCallCompleted,
			StartTime: time.Now().Add(-time.Second * 5),
			EndTime:   time.Now().Add(-time.Second * 3),
			Duration:  time.Second * 2,
		},
		{
			ID:        "system-design_get-concept-1",
			Server:    "system-design",
			Method:    "get-concept",
			Status:    MCPCallFailed,
			StartTime: time.Now().Add(-time.Second * 10),
			EndTime:   time.Now().Add(-time.Second * 8),
			Duration:  time.Second * 2,
			Error:     "Connection timeout",
		},
	}

	fmt.Println("\n2. Adding MCP calls:")
	for _, call := range calls {
		panel.AddCall(call)
		fmt.Printf("   Added: %s:%s (%s)\n", call.Server, call.Method, call.Status.String())
	}

	fmt.Printf("\n3. Active calls: %d\n", len(panel.GetActiveCalls()))

	// Simulate completing the running call
	fmt.Println("\n4. Completing running call...")
	panel.UpdateCall("qdrant_vector-search-1", MCPCallCompleted, time.Second*3, map[string]interface{}{"results": 5}, "")

	fmt.Printf("   Active calls after completion: %d\n", len(panel.GetActiveCalls()))

	// Show panel view (simplified)
	fmt.Println("\n5. Panel view (simplified):")
	view := panel.View()
	if view != "" {
		// Just show that we have content
		fmt.Printf("   Panel has content: %d characters\n", len(view))
		fmt.Println("   Panel is rendering MCP call information")
	} else {
		fmt.Println("   Panel is empty or hidden")
	}

	// Test visibility toggle
	fmt.Println("\n6. Testing visibility toggle:")
	panel.SetVisible(false)
	fmt.Printf("   Visible after hiding: %t\n", panel.IsVisible())

	panel.SetVisible(true)
	fmt.Printf("   Visible after showing: %t\n", panel.IsVisible())

	fmt.Println("\n=== Demo Complete ===")
}
