package chat

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
	"github.com/sst/dgmo/internal/theme"
)

// Spinner frames for animated display
var spinnerFrames = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

// Different spinner styles based on elapsed time
var spinnerEvolutions = []struct {
	afterSeconds int
	frames       []string
}{
	{0, []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}},                      // Dots
	{10, []string{"◐", "◓", "◑", "◒"}},                                                   // Circle quarters
	{20, []string{"▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂"}}, // Blocks
	{30, []string{"⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"}},                               // Complex dots
	{45, []string{"◴", "◷", "◶", "◵"}},                                                   // Diamonds
	{60, []string{"⊙", "⊗", "⊕", "⊗"}},                                                   // Pulsing
}

// GetSpinnerFrame returns the appropriate spinner frame based on time
func GetSpinnerFrame() string {
	// Use current time to determine which frame to show
	frame := int(time.Now().UnixMilli()/100) % len(spinnerFrames)
	return spinnerFrames[frame]
}

// GetEvolvingSpinner returns a spinner that changes style based on elapsed time
func GetEvolvingSpinner(elapsed time.Duration) string {
	seconds := int(elapsed.Seconds())

	// Find the appropriate spinner style based on elapsed time
	var frames []string
	for i := len(spinnerEvolutions) - 1; i >= 0; i-- {
		if seconds >= spinnerEvolutions[i].afterSeconds {
			frames = spinnerEvolutions[i].frames
			break
		}
	}

	// Calculate frame based on time
	frame := int(time.Now().UnixMilli()/100) % len(frames)
	return frames[frame]
}

// Tool-specific status messages
var toolMessages = map[string][]string{
	"grep": {
		"Searching for patterns...",
		"Scanning file contents...",
		"Hunting through the codebase...",
		"Pattern matching in progress...",
	},
	"glob": {
		"Finding matching files...",
		"Exploring directory structure...",
		"Discovering project files...",
		"Traversing file system...",
	},
	"read": {
		"Reading file contents...",
		"Loading file data...",
		"Studying the code...",
		"Absorbing knowledge...",
	},
	"write": {
		"Writing changes to disk...",
		"Saving modifications...",
		"Persisting your brilliance...",
		"Committing changes...",
	},
	"edit": {
		"Applying code changes...",
		"Modifying file structure...",
		"Refactoring code...",
		"Transforming source files...",
	},
	"bash": {
		"Executing command...",
		"Running shell process...",
		"Talking to the system...",
		"Processing terminal command...",
	},
	"list": {
		"Listing directory contents...",
		"Scanning folder structure...",
		"Cataloging items...",
		"Building file index...",
	},
}

// Time-based fallback messages
var fallbackMessages = []struct {
	afterSeconds int
	messages     []string
}{
	{0, []string{
		"Thinking deeply...",
		"Processing request...",
		"Analyzing context...",
		"Computing solution...",
	}},
	{10, []string{
		"Still working on it...",
		"Making good progress...",
		"Crunching the numbers...",
		"Optimizing approach...",
	}},
	{30, []string{
		"This is taking a bit longer...",
		"Complex operation in progress...",
		"Working through the details...",
		"Quality takes time...",
	}},
	{60, []string{
		"Thanks for your patience...",
		"Still actively working...",
		"Ensuring accuracy...",
		"Almost there, hang tight...",
	}},
}

// GetDynamicStatus returns a dynamic status message based on tool and elapsed time
func GetDynamicStatus(tool string, elapsed time.Duration) string {
	seconds := int(elapsed.Seconds())

	// Try to get tool-specific message
	if messages, ok := toolMessages[strings.ToLower(tool)]; ok && len(messages) > 0 {
		// Rotate through messages based on time
		messageIndex := (seconds / 3) % len(messages)
		return messages[messageIndex]
	}

	// Otherwise use fallback messages based on elapsed time
	for i := len(fallbackMessages) - 1; i >= 0; i-- {
		if seconds >= fallbackMessages[i].afterSeconds {
			messages := fallbackMessages[i].messages
			messageIndex := (seconds / 4) % len(messages)
			return messages[messageIndex]
		}
	}

	return "Processing..."
}

// RenderTaskProgress renders a beautiful progress bar with smooth gradient
func RenderTaskProgress(progress int, width int) string {
	if width < 20 {
		return fmt.Sprintf("%d%%", progress)
	}

	// Calculate bar dimensions
	percentageSpace := 7 // Space for " 100%" with padding
	barWidth := width - percentageSpace
	if barWidth < 10 {
		barWidth = 10
	}

	filled := (progress * barWidth) / 100
	empty := barWidth - filled

	t := theme.CurrentTheme()

	// Create smooth gradient effect
	var bar strings.Builder
	bar.WriteString("[")

	// Calculate gradient colors based on progress
	var fillColor compat.AdaptiveColor
	if progress < 30 {
		fillColor = t.Primary() // Blue/Purple for early progress
	} else if progress < 70 {
		fillColor = t.Secondary() // Cyan/Teal for mid progress
	} else {
		fillColor = t.Success() // Green for near completion
	}

	// Filled blocks with gradient
	fillStyle := lipgloss.NewStyle().Foreground(fillColor)
	for i := 0; i < filled; i++ {
		// Add slight variation in the middle for depth
		if i > filled/3 && i < 2*filled/3 && progress > 30 && progress < 70 {
			bar.WriteString(lipgloss.NewStyle().Foreground(t.Secondary()).Render("█"))
		} else {
			bar.WriteString(fillStyle.Render("█"))
		}
	}

	// Empty part with subtle dots
	emptyStyle := lipgloss.NewStyle().Foreground(t.TextMuted())
	for i := 0; i < empty; i++ {
		bar.WriteString(emptyStyle.Render("░"))
	}

	bar.WriteString("]")

	// Percentage with dynamic color
	var percentColor compat.AdaptiveColor
	if progress == 100 {
		percentColor = t.Success()
	} else if progress >= 70 {
		percentColor = t.Secondary()
	} else {
		percentColor = t.Text()
	}

	percentStyle := lipgloss.NewStyle().Foreground(percentColor).Bold(true)
	return fmt.Sprintf("%s %s", bar.String(), percentStyle.Render(fmt.Sprintf("%3d%%", progress)))
}

// RenderTaskStatus renders a beautiful task status line
func RenderTaskStatus(icon string, agentNum string, description string, status string, progress int) string {
	t := theme.CurrentTheme()

	// Styles
	iconStyle := lipgloss.NewStyle().Bold(true)
	agentStyle := lipgloss.NewStyle().Foreground(t.Primary()).Bold(true)
	descStyle := lipgloss.NewStyle().Foreground(t.Text())

	var statusPart string
	switch status {
	case "running":
		spinner := GetSpinnerFrame()
		spinnerStyle := lipgloss.NewStyle().Foreground(t.Primary())
		if progress > 0 {
			statusPart = fmt.Sprintf(" %s %s", spinnerStyle.Render(spinner), RenderTaskProgress(progress, 30))
		} else {
			runningStyle := lipgloss.NewStyle().Foreground(t.Secondary()).Italic(true)
			statusPart = fmt.Sprintf(" %s %s", spinnerStyle.Render(spinner), runningStyle.Render("Running..."))
		}
	case "completed":
		successStyle := lipgloss.NewStyle().Foreground(t.Success()).Bold(true)
		statusPart = " " + successStyle.Render("✓ Completed")
	case "failed":
		errorStyle := lipgloss.NewStyle().Foreground(t.Error()).Bold(true)
		statusPart = " " + errorStyle.Render("✗ Failed")
	default:
		pendingStyle := lipgloss.NewStyle().Foreground(t.TextMuted())
		statusPart = " " + pendingStyle.Render("○ Pending")
	}

	return fmt.Sprintf("%s %s %s%s",
		iconStyle.Render(icon),
		agentStyle.Render(fmt.Sprintf("%s:", agentNum)),
		descStyle.Render(description),
		statusPart,
	)
}

// RenderElapsedTime renders elapsed time in a nice format
func RenderElapsedTime(duration time.Duration) string {
	t := theme.CurrentTheme()
	timeStyle := lipgloss.NewStyle().Foreground(t.TextMuted()).Italic(true)

	if duration < time.Minute {
		return timeStyle.Render(fmt.Sprintf("(%ds)", int(duration.Seconds())))
	} else if duration < time.Hour {
		mins := int(duration.Minutes())
		secs := int(duration.Seconds()) % 60
		return timeStyle.Render(fmt.Sprintf("(%dm %ds)", mins, secs))
	} else {
		hours := int(duration.Hours())
		mins := int(duration.Minutes()) % 60
		return timeStyle.Render(fmt.Sprintf("(%dh %dm)", hours, mins))
	}
}

// Box drawing characters for custom borders
const (
	TopLeft     = "╭"
	TopRight    = "╮"
	BottomLeft  = "╰"
	BottomRight = "╯"
	Horizontal  = "─"
	Vertical    = "│"
)

// RenderTaskBox renders a task in a beautiful box with custom borders
func RenderTaskBox(icon string, taskName string, description string, status string, progress int, duration time.Duration, width int) string {
	return RenderTaskBoxWithTool(icon, taskName, description, status, progress, duration, width, "")
}

// RenderTaskBoxWithTool renders a task with dynamic status based on current tool
func RenderTaskBoxWithTool(icon string, taskName string, description string, status string, progress int, duration time.Duration, width int, currentTool string) string {
	t := theme.CurrentTheme()

	// Ensure minimum width
	if width < 40 {
		width = 40
	}

	// Extract agent number from taskName if it contains "Agent N:"
	agentNum := taskName
	taskDesc := description
	if strings.HasPrefix(taskName, "Agent ") && strings.Contains(taskName, ":") {
		parts := strings.SplitN(taskName, ":", 2)
		agentNum = strings.TrimSpace(parts[0])
		if len(parts) > 1 && taskDesc == "" {
			taskDesc = strings.TrimSpace(parts[1])
		}
	}

	// Build the header line
	headerContent := fmt.Sprintf(" %s: %s ", agentNum, taskDesc)
	headerWidth := len(headerContent)
	remainingWidth := width - headerWidth - 2 // -2 for corners
	if remainingWidth < 0 {
		// Truncate if too long
		maxLen := width - 10 // Leave space for corners and padding
		if maxLen > 0 {
			headerContent = headerContent[:maxLen] + "..."
		}
		remainingWidth = 0
	}

	headerStyle := lipgloss.NewStyle().Foreground(t.Primary()).Bold(true)
	header := TopLeft + Horizontal + headerStyle.Render(headerContent) + " " + strings.Repeat(Horizontal, remainingWidth) + TopRight

	// Build the content lines
	var lines []string
	lines = append(lines, header)

	// Status line with spinner/progress
	var statusLine string
	contentPadding := "  " // 2 spaces for inner padding

	switch status {
	case "running":
		// Use evolving spinner based on elapsed time
		spinner := GetEvolvingSpinner(duration)
		spinnerStyle := lipgloss.NewStyle().Foreground(t.Primary())

		// Get dynamic status message
		statusMsg := GetDynamicStatus(currentTool, duration)
		statusText := lipgloss.NewStyle().Foreground(t.Secondary()).Italic(true).Render(statusMsg)

		statusLine = fmt.Sprintf("%s %s%s %s",
			Vertical,
			contentPadding,
			spinnerStyle.Render(spinner),
			statusText)
	case "completed":
		successStyle := lipgloss.NewStyle().Foreground(t.Success()).Bold(true)
		statusLine = fmt.Sprintf("%s %s%s",
			Vertical,
			contentPadding,
			successStyle.Render("✓ Completed"))
	case "failed":
		errorStyle := lipgloss.NewStyle().Foreground(t.Error()).Bold(true)
		statusLine = fmt.Sprintf("%s %s%s",
			Vertical,
			contentPadding,
			errorStyle.Render("✗ Failed"))
	default:
		pendingStyle := lipgloss.NewStyle().Foreground(t.TextMuted())
		statusLine = fmt.Sprintf("%s %s%s",
			Vertical,
			contentPadding,
			pendingStyle.Render("○ Pending"))
	}

	// Pad status line to full width
	statusContent := statusLine[3:] // Remove the vertical bar temporarily
	statusPadding := width - lipgloss.Width(statusContent) - 2
	if statusPadding > 0 {
		statusLine = Vertical + " " + statusContent + strings.Repeat(" ", statusPadding) + Vertical
	} else {
		statusLine = Vertical + " " + statusContent + " " + Vertical
	}
	lines = append(lines, statusLine)

	// Time line (if running or completed)
	if status == "running" || status == "completed" {
		timeDisplay := RenderElapsedTime(duration)
		timeLine := fmt.Sprintf("%s %s⏱  %s", Vertical, contentPadding, timeDisplay)
		timePadding := width - lipgloss.Width(timeLine) + 1 // +1 because vertical bar is 1 char
		if timePadding > 0 {
			timeLine = timeLine + strings.Repeat(" ", timePadding) + Vertical
		} else {
			timeLine = timeLine + " " + Vertical
		}
		lines = append(lines, timeLine)
	}

	// Footer
	footer := BottomLeft + strings.Repeat(Horizontal, width-2) + BottomRight
	lines = append(lines, footer)

	// Apply border color to the entire box
	borderStyle := lipgloss.NewStyle().Foreground(t.Border())
	var styledLines []string
	for _, line := range lines {
		styledLines = append(styledLines, borderStyle.Render(line))
	}

	return strings.Join(styledLines, "\n")
}
