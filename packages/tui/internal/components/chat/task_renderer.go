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

// RenderTaskBoxWithMessage renders a task with a specific status message
func RenderTaskBoxWithMessage(icon string, taskName string, description string, status string, statusMessage string, duration time.Duration, width int) string {
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
	headerContent := fmt.Sprintf(" %s ", taskDesc)
	if taskDesc == "" {
		headerContent = fmt.Sprintf(" %s ", agentNum)
	}
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

	// Status line with spinner and custom message
	var statusLine string
	contentPadding := "  " // 2 spaces for inner padding

	switch status {
	case "running":
		// Use evolving spinner based on elapsed time
		spinner := GetEvolvingSpinner(duration)
		spinnerStyle := lipgloss.NewStyle().Foreground(t.Primary())
		statusText := lipgloss.NewStyle().Foreground(t.Secondary()).Italic(true).Render(statusMessage)

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

// TaskDisplay represents a task for compact MCP-like rendering
type TaskDisplay struct {
	AgentNumber   int
	Description   string
	Status        string
	Duration      time.Duration
	StartTime     time.Time
	CurrentTool   string   // Current tool being used
	CurrentFile   string   // Current file being worked on
	ProgressLines []string // 1-3 lines of current progress
}

// getStatusIcon returns the appropriate icon for task status
func (td *TaskDisplay) getStatusIcon() string {
	switch td.Status {
	case "pending":
		return "🎯"
	case "running":
		return "⚡"
	case "completed":
		return "🎉"
	case "failed":
		return "💥"
	case "cancelled":
		return "⏹️"
	default:
		return "🎯"
	}
}

// getStatusStyle returns the appropriate style for task status
func (td *TaskDisplay) getStatusStyle(t theme.Theme) lipgloss.Style {
	switch td.Status {
	case "pending":
		return lipgloss.NewStyle().Foreground(t.Secondary())
	case "running":
		return lipgloss.NewStyle().Foreground(t.Primary())
	case "completed":
		return lipgloss.NewStyle().Foreground(t.Success())
	case "failed":
		return lipgloss.NewStyle().Foreground(t.Error())
	case "cancelled":
		return lipgloss.NewStyle().Foreground(t.TextMuted())
	default:
		return lipgloss.NewStyle().Foreground(t.Secondary())
	}
}

// RenderCompact renders a task in MCP-like compact format with spinner and progress info
func (td *TaskDisplay) RenderCompact() string {
	t := theme.CurrentTheme()

	// Add spinner for running tasks, otherwise use static prefix
	var prefix string
	if td.Status == "running" {
		spinner := GetEvolvingSpinner(time.Since(td.StartTime))
		spinnerStyle := lipgloss.NewStyle().Foreground(t.Primary())
		taskStyle := lipgloss.NewStyle().Foreground(t.Warning()).Bold(true)
		prefix = fmt.Sprintf("%s %s", spinnerStyle.Render(spinner), taskStyle.Render("TASK"))
	} else {
		prefix = lipgloss.NewStyle().Foreground(t.Warning()).Bold(true).Render("TASK")
	}

	// Format agent number with zero-padding for 10+ agents
	agentFormat := fmt.Sprintf("Agent-%d", td.AgentNumber)
	if td.AgentNumber >= 10 {
		agentFormat = fmt.Sprintf("Agent-%02d", td.AgentNumber)
	}
	agent := lipgloss.NewStyle().Foreground(t.Primary()).Bold(true).Render(agentFormat)

	// Truncate description if needed
	desc := td.Description
	if len(desc) > 45 {
		desc = desc[:42] + "..."
	}
	description := lipgloss.NewStyle().Foreground(t.Text()).Render(desc)

	// Format duration
	var durationStr string
	if td.Status == "pending" {
		durationStr = "[]"
	} else if td.Status == "running" {
		// For running tasks, show live duration
		elapsed := time.Since(td.StartTime)
		durationStr = fmt.Sprintf("[%.1fs]", elapsed.Seconds())
	} else {
		// For completed/failed tasks, show final duration
		durationStr = fmt.Sprintf("[%.1fs]", td.Duration.Seconds())
	}
	duration := lipgloss.NewStyle().Foreground(t.TextMuted()).Render(durationStr)

	// Status icon with appropriate styling
	icon := td.getStatusIcon()
	statusStyle := td.getStatusStyle(t)
	status := statusStyle.Render(icon)

	// Main task line: [spinner] TASK Agent-N • description [duration] status-icon
	mainLine := fmt.Sprintf("%s %s • %s %s %s", prefix, agent, description, duration, status)

	var lines []string
	lines = append(lines, mainLine)

	// Add Claude Code style progress lines (1-3 lines showing current activity)
	if td.Status == "running" && len(td.ProgressLines) > 0 {
		progressStyle := lipgloss.NewStyle().Foreground(t.TextMuted())
		for i, line := range td.ProgressLines {
			if i >= 3 { // Limit to 3 lines max
				break
			}
			lines = append(lines, progressStyle.Render("   "+line))
		}
	}

	// Add sub-session info line
	infoStyle := lipgloss.NewStyle().Foreground(t.TextMuted()).Italic(true)
	infoLine := infoStyle.Render("   Use /sub-session to view")
	lines = append(lines, infoLine)

	return strings.Join(lines, "\n")
}

// RenderTaskCompact creates a compact task display similar to MCP calls
func RenderTaskCompact(agentNumber int, description string, status string, duration time.Duration, startTime time.Time) string {
	task := &TaskDisplay{
		AgentNumber: agentNumber,
		Description: description,
		Status:      status,
		Duration:    duration,
		StartTime:   startTime,
	}
	return task.RenderCompact()
}

// RenderTaskCompactWithProgress creates a compact task display with progress information
func RenderTaskCompactWithProgress(taskID string, agentNumber int, description string, status string, duration time.Duration, startTime time.Time) string {
	task := &TaskDisplay{
		AgentNumber:   agentNumber,
		Description:   description,
		Status:        status,
		Duration:      duration,
		StartTime:     startTime,
		CurrentTool:   GetTaskCurrentTool(taskID),
		ProgressLines: GenerateProgressLines(taskID),
	}
	return task.RenderCompact()
}

// RenderTaskCompactWithElapsed creates a compact task display with elapsed time calculation
func RenderTaskCompactWithElapsed(agentNumber int, description string, status string, startTime time.Time) string {
	var duration time.Duration
	if status == "running" {
		duration = time.Since(startTime)
	} else if !startTime.IsZero() {
		// For completed tasks, calculate total duration
		duration = time.Since(startTime)
	}

	task := &TaskDisplay{
		AgentNumber: agentNumber,
		Description: description,
		Status:      status,
		Duration:    duration,
		StartTime:   startTime,
	}
	return task.RenderCompact()
}

// extractAgentNumberFromDescription extracts agent number from task description
func extractAgentNumberFromDescription(description string) int {
	// Look for patterns like "Agent 1", "agent 2", etc.
	if strings.Contains(strings.ToLower(description), "agent") {
		for i := 1; i <= 99; i++ {
			patterns := []string{
				fmt.Sprintf("Agent %d", i),
				fmt.Sprintf("agent %d", i),
				fmt.Sprintf("Agent-%d", i),
				fmt.Sprintf("agent-%d", i),
			}
			for _, pattern := range patterns {
				if strings.Contains(description, pattern) {
					return i
				}
			}
		}
	}
	// Default to agent 1 if no number found
	return 1
}
