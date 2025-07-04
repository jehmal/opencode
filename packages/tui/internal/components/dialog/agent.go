package dialog

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/components/list"
	"github.com/sst/dgmo/internal/components/modal"
	"github.com/sst/dgmo/internal/components/toast"
	"github.com/sst/dgmo/internal/layout"
	"github.com/sst/dgmo/internal/util"
)

// AgentDialog interface for the agent mode selection dialog
type AgentDialog interface {
	layout.Modal
}

type agentDialog struct {
	app          *app.App
	width        int
	height       int
	modal        *modal.Modal
	list         list.List[list.StringItem]
	originalMode string
	modeApplied  bool
}

func NewAgentDialog(app *app.App) AgentDialog {
	modes := []string{"read-only", "all-tools"}

	// Default to read-only
	selectedIdx := 0

	modeList := list.NewStringList(
		modes,
		2, // maxVisible
		"No modes available",
		true, // showHelp
	)
	modeList.SetSelectedIndex(selectedIdx)

	d := &agentDialog{
		app:          app,
		list:         modeList,
		originalMode: "read-only",
		modeApplied:  false,
	}

	d.modal = modal.New(
		modal.WithTitle("Select Agent Mode"),
		modal.WithMaxWidth(60),
		modal.WithMaxHeight(10),
	)

	return d
}

func (d *agentDialog) Init() tea.Cmd {
	return nil
}

func (d *agentDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		d.width = msg.Width
		d.height = msg.Height
		return d, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "enter":
			if item, idx := d.list.GetSelectedItem(); idx >= 0 {
				selectedMode := string(item)
				d.modeApplied = true

				// For now, just show a success message
				// TODO: Implement actual config update through API
				return d, tea.Sequence(
					util.CmdHandler(modal.CloseModalMsg{}),
					toast.NewSuccessToast(fmt.Sprintf("Agent mode set to %s for this session", selectedMode)),
				)
			}
		case "esc", "ctrl+c":
			return d, util.CmdHandler(modal.CloseModalMsg{})
		}
	}

	var cmd tea.Cmd
	listModel, cmd := d.list.Update(msg)
	d.list = listModel.(list.List[list.StringItem])
	return d, cmd
}

func (d *agentDialog) Render(background string) string {
	content := d.list.View()

	// Add help text
	helpText := "\n\nread-only: Sub-agents can only read files and search\nall-tools: Sub-agents have full access to all tools\n\n↑/↓: Navigate • Enter: Select • Esc: Cancel"

	return d.modal.Render(content+helpText, background)
}

func (d *agentDialog) Close() tea.Cmd {
	return nil
}

func (d *agentDialog) SetSize(width, height int) {
	d.width = width
	d.height = height
}

func (d *agentDialog) Focused() bool {
	return true
}

func (d *agentDialog) Focus() tea.Cmd {
	return nil
}

func (d *agentDialog) Blur() {
}
