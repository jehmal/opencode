package status

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/styles"
	"github.com/sst/dgmo/internal/theme"
)

type StatusComponent interface {
	tea.Model
	tea.ViewModel
	SetConnectionStatus(status string, isHealthy bool)
}

type statusComponent struct {
	app               *app.App
	width             int
	connectionStatus  string
	connectionHealthy bool
}

func (m *statusComponent) Init() tea.Cmd {
	return nil
}

func (m *statusComponent) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	}
	return m, nil
}

func (m statusComponent) logo() string {
	t := theme.CurrentTheme()
	base := styles.NewStyle().Foreground(t.TextMuted()).Background(t.BackgroundElement()).Render
	emphasis := styles.NewStyle().Foreground(t.Text()).Background(t.BackgroundElement()).Bold(true).Render

	dgm := base("DGM")
	hyphen := base("-")
	o := emphasis("O ")
	version := base(m.app.Version)
	return styles.NewStyle().
		Background(t.BackgroundElement()).
		Padding(0, 1).
		Render(dgm + hyphen + o + version)
}

func formatTokensAndCost(tokens float64, contextWindow float64, cost float64) string {
	// Format tokens in human-readable format (e.g., 110K, 1.2M)
	var formattedTokens string
	switch {
	case tokens >= 1_000_000:
		formattedTokens = fmt.Sprintf("%.1fM", float64(tokens)/1_000_000)
	case tokens >= 1_000:
		formattedTokens = fmt.Sprintf("%.1fK", float64(tokens)/1_000)
	default:
		formattedTokens = fmt.Sprintf("%d", int(tokens))
	}

	// Remove .0 suffix if present
	if strings.HasSuffix(formattedTokens, ".0K") {
		formattedTokens = strings.Replace(formattedTokens, ".0K", "K", 1)
	}
	if strings.HasSuffix(formattedTokens, ".0M") {
		formattedTokens = strings.Replace(formattedTokens, ".0M", "M", 1)
	}

	// Format cost with $ symbol and 2 decimal places
	formattedCost := fmt.Sprintf("$%.2f", cost)
	percentage := (float64(tokens) / float64(contextWindow)) * 100

	return fmt.Sprintf("Context: %s (%d%%), Cost: %s", formattedTokens, int(percentage), formattedCost)
}

func (m *statusComponent) View() string {
	t := theme.CurrentTheme()
	if m.app.Session == nil || m.app.Session.ID == "" {
		return styles.NewStyle().
			Background(t.Background()).
			Width(m.width).
			Height(2).
			Render("")
	}

	logo := m.logo()
	connectionIndicator := m.connectionStatusIndicator()

	cwd := styles.NewStyle().
		Foreground(t.TextMuted()).
		Background(t.BackgroundPanel()).
		Padding(0, 1).
		Render(m.app.Info.Path.Cwd)

	sessionInfo := ""
	if m.app.Session.ID != "" {
		tokens := float64(0)
		cost := float64(0)
		contextWindow := m.app.Model.Limit.Context

		for _, message := range m.app.Messages {
			cost += message.Metadata.Assistant.Cost
			usage := message.Metadata.Assistant.Tokens
			if usage.Output > 0 {
				if message.Metadata.Assistant.Summary {
					tokens = usage.Output
					continue
				}
				tokens = (usage.Input +
					usage.Cache.Write +
					usage.Cache.Read +
					usage.Output +
					usage.Reasoning)
			}
		}

		sessionInfo = styles.NewStyle().
			Foreground(t.TextMuted()).
			Background(t.BackgroundElement()).
			Padding(0, 1).
			Render(formatTokensAndCost(tokens, contextWindow, cost))
	}

	// diagnostics := styles.Padded().Background(t.BackgroundElement()).Render(m.projectDiagnostics())

	space := max(
		0,
		m.width-lipgloss.Width(logo)-lipgloss.Width(cwd)-lipgloss.Width(connectionIndicator)-lipgloss.Width(sessionInfo),
	)
	spacer := styles.NewStyle().Background(t.BackgroundPanel()).Width(space).Render("")

	status := logo + cwd + spacer + connectionIndicator + sessionInfo

	blank := styles.NewStyle().Background(t.Background()).Width(m.width).Render("")
	return blank + "\n" + status
}

// SetConnectionStatus updates the connection status display
func (m *statusComponent) SetConnectionStatus(status string, isHealthy bool) {
	m.connectionStatus = status
	m.connectionHealthy = isHealthy
}

// connectionStatusIndicator returns a styled connection status indicator
func (m statusComponent) connectionStatusIndicator() string {
	if m.connectionStatus == "" {
		return ""
	}

	t := theme.CurrentTheme()
	var indicator string
	var color = t.TextMuted() // Initialize with a default value to infer type

	switch m.connectionStatus {
	case "connected":
		indicator = "●"
		color = t.Success()
	case "connecting", "reconnecting":
		indicator = "◐"
		color = t.Warning()
	case "disconnected":
		indicator = "○"
		color = t.TextMuted()
	case "failed":
		indicator = "●"
		color = t.Error()
	default:
		indicator = "?"
		color = t.TextMuted()
	}

	return styles.NewStyle().
		Foreground(color).
		Background(t.BackgroundElement()).
		Render(indicator)
}

func NewStatusCmp(app *app.App) StatusComponent {
	statusComponent := &statusComponent{
		app:               app,
		connectionStatus:  "disconnected",
		connectionHealthy: false,
	}

	return statusComponent
}
