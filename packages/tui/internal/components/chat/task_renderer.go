package chat

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/dgmo/internal/theme"
)

// Spinner frames for animated display
var spinnerFrames = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

// GetSpinnerFrame returns the appropriate spinner frame based on time
func GetSpinnerFrame() string {
	// Use current time to determine which frame to show
	frame := int(time.Now().UnixMilli()/100) % len(spinnerFrames)
	return spinnerFrames[frame]
}

// RenderTaskProgress renders a beautiful progress bar
func RenderTaskProgress(progress int, width int) string {
	if width < 20 {
		return fmt.Sprintf("%d%%", progress)
	}

	barWidth := width - 10 // Leave space for percentage
	filled := (progress * barWidth) / 100
	empty := barWidth - filled

	t := theme.CurrentTheme()

	// Create gradient effect
	var bar strings.Builder
	for i := 0; i < filled; i++ {
		if i < filled/3 {
			bar.WriteString(lipgloss.NewStyle().Foreground(t.Primary()).Render("█"))
		} else if i < 2*filled/3 {
			bar.WriteString(lipgloss.NewStyle().Foreground(t.Secondary()).Render("█"))
		} else {
			bar.WriteString(lipgloss.NewStyle().Foreground(t.Success()).Render("█"))
		}
	}

	// Empty part
	emptyStyle := lipgloss.NewStyle().Foreground(t.TextMuted())
	for i := 0; i < empty; i++ {
		bar.WriteString(emptyStyle.Render("░"))
	}

	// Percentage
	percentStyle := lipgloss.NewStyle().Foreground(t.Text()).Bold(true)
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

// RenderTaskBox renders a task in a beautiful box
func RenderTaskBox(icon string, taskName string, description string, status string, progress int, duration time.Duration, width int) string {
	t := theme.CurrentTheme()

	// Create the main content
	mainLine := RenderTaskStatus(icon, taskName, description, status, progress)

	// Add elapsed time if running or completed
	if status == "running" || status == "completed" {
		mainLine += " " + RenderElapsedTime(duration)
	}

	// Create a subtle box around it
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(t.Border()).
		Padding(0, 1).
		Width(width - 2)

	return boxStyle.Render(mainLine)
}
