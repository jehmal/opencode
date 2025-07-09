package chat

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/dgmo/internal/theme"
)

// CompactProgressRenderer renders Claude Code style progress (1-3 lines)
type CompactProgressRenderer struct {
	theme theme.Theme
}

// NewCompactProgressRenderer creates a new compact progress renderer
func NewCompactProgressRenderer() *CompactProgressRenderer {
	return &CompactProgressRenderer{
		theme: theme.CurrentTheme(),
	}
}

// TaskSummary represents a compact task summary
type TaskSummary struct {
	SessionID   string
	TaskID      string
	AgentName   string
	Lines       []string
	Spinner     bool
	Elapsed     time.Duration
	Timestamp   time.Time
	IsCompleted bool
	IsFailed    bool
}

// RenderCompactProgress renders a Claude Code style progress display
func (r *CompactProgressRenderer) RenderCompactProgress(summary TaskSummary, width int) string {
	if len(summary.Lines) == 0 {
		return ""
	}

	var result strings.Builder

	// Ensure we have a fresh theme
	r.theme = theme.CurrentTheme()

	for i, line := range summary.Lines {
		if i >= 3 { // Max 3 lines
			break
		}

		var renderedLine string

		if i == 0 {
			// Primary line with spinner or status icon
			renderedLine = r.renderPrimaryLine(line, summary)
		} else {
			// Secondary/tertiary lines with indentation
			renderedLine = r.renderSecondaryLine(line, i)
		}

		// Truncate if too long
		if width > 0 && lipgloss.Width(renderedLine) > width {
			renderedLine = r.truncateLine(renderedLine, width)
		}

		result.WriteString(renderedLine)
		if i < len(summary.Lines)-1 && i < 2 {
			result.WriteString("\n")
		}
	}

	return result.String()
}

// renderPrimaryLine renders the main progress line with status indicator
func (r *CompactProgressRenderer) renderPrimaryLine(line string, summary TaskSummary) string {
	var statusIcon string
	var statusStyle lipgloss.Style

	if summary.IsCompleted {
		statusIcon = "✓"
		statusStyle = lipgloss.NewStyle().Foreground(r.theme.Success()).Bold(true)
	} else if summary.IsFailed {
		statusIcon = "✗"
		statusStyle = lipgloss.NewStyle().Foreground(r.theme.Error()).Bold(true)
	} else if summary.Spinner {
		statusIcon = GetSpinnerFrame()
		statusStyle = lipgloss.NewStyle().Foreground(r.theme.Primary())
	} else {
		statusIcon = "○"
		statusStyle = lipgloss.NewStyle().Foreground(r.theme.TextMuted())
	}

	// Style the main line
	lineStyle := lipgloss.NewStyle().Foreground(r.theme.Text())

	return fmt.Sprintf("%s %s",
		statusStyle.Render(statusIcon),
		lineStyle.Render(line))
}

// renderSecondaryLine renders secondary/tertiary lines with proper indentation
func (r *CompactProgressRenderer) renderSecondaryLine(line string, level int) string {
	// Create indentation based on level
	indent := strings.Repeat("  ", level) // 2 spaces per level

	// Style secondary lines with muted color
	lineStyle := lipgloss.NewStyle().Foreground(r.theme.TextMuted())

	return fmt.Sprintf("%s%s", indent, lineStyle.Render(line))
}

// truncateLine truncates a line to fit within the specified width
func (r *CompactProgressRenderer) truncateLine(line string, maxWidth int) string {
	if maxWidth < 10 {
		return "..."
	}

	// Simple truncation - could be enhanced to preserve styling
	if lipgloss.Width(line) <= maxWidth {
		return line
	}

	// Find a good truncation point
	truncated := line
	for lipgloss.Width(truncated) > maxWidth-3 {
		if len(truncated) <= 1 {
			break
		}
		truncated = truncated[:len(truncated)-1]
	}

	return truncated + "..."
}

// RenderInlineProgress renders a single-line progress for tight spaces
func (r *CompactProgressRenderer) RenderInlineProgress(summary TaskSummary, maxWidth int) string {
	if len(summary.Lines) == 0 {
		return ""
	}

	// Use only the first line for inline display
	primaryLine := summary.Lines[0]

	// Add spinner or status
	var statusIcon string
	if summary.IsCompleted {
		statusIcon = "✓"
	} else if summary.IsFailed {
		statusIcon = "✗"
	} else if summary.Spinner {
		statusIcon = GetSpinnerFrame()
	} else {
		statusIcon = "○"
	}

	// Create compact format: "🤖 Agent 1: Reading files... (2s)"
	elapsedText := ""
	if summary.Elapsed > time.Second {
		elapsedText = fmt.Sprintf(" (%ds)", int(summary.Elapsed.Seconds()))
	}

	fullLine := fmt.Sprintf("%s %s%s", statusIcon, primaryLine, elapsedText)

	// Truncate if necessary
	if maxWidth > 0 && len(fullLine) > maxWidth {
		return r.truncateLine(fullLine, maxWidth)
	}

	return fullLine
}

// RenderProgressBadge renders a small badge showing active task count
func (r *CompactProgressRenderer) RenderProgressBadge(activeCount int) string {
	if activeCount == 0 {
		return ""
	}

	badgeStyle := lipgloss.NewStyle().
		Background(r.theme.Primary()).
		Foreground(r.theme.Background()).
		Padding(0, 1).
		Bold(true)

	if activeCount == 1 {
		return badgeStyle.Render("1 task")
	}

	return badgeStyle.Render(fmt.Sprintf("%d tasks", activeCount))
}

// Note: GetSpinnerFrame is imported from task_renderer.go
