package chat

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
	"github.com/charmbracelet/x/ansi"
	"github.com/sst/dgmo/internal/app"
	"github.com/sst/dgmo/internal/components/diff"
	"github.com/sst/dgmo/internal/layout"
	"github.com/sst/dgmo/internal/styles"
	"github.com/sst/dgmo/internal/theme"
	"github.com/sst/opencode-sdk-go"
	"github.com/tidwall/gjson"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

// Global map to track task start times and progress
var (
	taskStartTimes    = make(map[string]time.Time)
	taskProgress      = make(map[string]int)
	taskCurrentTool   = make(map[string]string)
	taskPhase         = make(map[string]string)
	taskMessage       = make(map[string]string)
	taskAgentNumbers  = make(map[string]int32) // taskID -> agent number
	sessionAgentCount = make(map[string]int32) // sessionID -> next agent number
	taskMutex         sync.RWMutex
)

// UpdateTaskProgress updates the progress for a task
func UpdateTaskProgress(taskID string, progress int) {
	taskMutex.Lock()
	defer taskMutex.Unlock()
	taskProgress[taskID] = progress
}

// RegisterTaskAgent registers a task with its agent number
func RegisterTaskAgent(taskID string, sessionID string, agentNumber int32) {
	taskMutex.Lock()
	defer taskMutex.Unlock()
	taskAgentNumbers[taskID] = agentNumber
}

// GetTaskAgentNumber gets the agent number for a task
func GetTaskAgentNumber(taskID string) int32 {
	taskMutex.RLock()
	defer taskMutex.RUnlock()
	if agentNum, ok := taskAgentNumbers[taskID]; ok {
		return agentNum
	}
	return 0 // Return 0 to indicate "not found"
}

// GetTaskAgentNumberWithFound gets the agent number for a task and whether it was found
func GetTaskAgentNumberWithFound(taskID string) (int32, bool) {
	taskMutex.RLock()
	defer taskMutex.RUnlock()
	agentNum, ok := taskAgentNumbers[taskID]
	return agentNum, ok
}

// GetNextAgentNumber gets the next agent number for a session
func GetNextAgentNumber(sessionID string) int32 {
	taskMutex.Lock()
	defer taskMutex.Unlock()
	sessionAgentCount[sessionID]++
	return sessionAgentCount[sessionID]
}

// UpdateTaskCurrentTool updates the current tool for a task
func UpdateTaskCurrentTool(taskID string, tool string) {
	taskMutex.Lock()
	defer taskMutex.Unlock()
	taskCurrentTool[taskID] = tool
}

// GetTaskCurrentTool gets the current tool for a task
func GetTaskCurrentTool(taskID string) string {
	taskMutex.RLock()
	defer taskMutex.RUnlock()
	return taskCurrentTool[taskID]
}

// UpdateTaskMessage updates the current message for a task
func UpdateTaskMessage(taskID string, message string) {
	taskMutex.Lock()
	defer taskMutex.Unlock()
	taskMessage[taskID] = message
}

// GetTaskMessage gets the current message for a task
func GetTaskMessage(taskID string) string {
	taskMutex.RLock()
	defer taskMutex.RUnlock()
	return taskMessage[taskID]
}

// GenerateProgressLines creates Claude Code style progress lines
func GenerateProgressLines(taskID string) []string {
	taskMutex.RLock()
	defer taskMutex.RUnlock()

	var lines []string
	tool := taskCurrentTool[taskID]
	message := taskMessage[taskID]

	if tool != "" && message != "" {
		// Extract file information from message if present
		if strings.Contains(message, "/") {
			// Likely a file path
			lines = append(lines, fmt.Sprintf("📂 %s", extractFileName(message)))
		}

		// Add tool-specific emoji and action
		toolEmoji := getToolEmoji(tool)
		lines = append(lines, fmt.Sprintf("%s %s", toolEmoji, message))

		// Add duration if available
		if len(lines) < 3 {
			lines = append(lines, fmt.Sprintf("⏱️  Running for %.1fs", time.Since(time.Now()).Seconds()))
		}
	}

	return lines
}

// getToolEmoji returns an emoji for the tool
func getToolEmoji(tool string) string {
	switch strings.ToLower(tool) {
	case "read":
		return "📖"
	case "write":
		return "✍️"
	case "edit":
		return "✏️"
	case "bash":
		return "💻"
	case "grep":
		return "🔍"
	case "glob":
		return "📁"
	case "list":
		return "📋"
	default:
		return "⚡"
	}
}

// extractFileName extracts filename from a path
func extractFileName(path string) string {
	if strings.Contains(path, "/") {
		parts := strings.Split(path, "/")
		return parts[len(parts)-1]
	}
	return path
}

// GetTaskProgress gets the progress for a task
func GetTaskProgress(taskID string) int {
	taskMutex.RLock()
	defer taskMutex.RUnlock()
	if progress, ok := taskProgress[taskID]; ok {
		return progress
	}
	return 0
}

// UpdateTaskTool updates the current tool for a task
func UpdateTaskTool(taskID string, tool string) {
	taskMutex.Lock()
	defer taskMutex.Unlock()
	taskCurrentTool[taskID] = tool
}

// GetTaskTool gets the current tool for a task
func GetTaskTool(taskID string) string {
	taskMutex.RLock()
	defer taskMutex.RUnlock()
	if tool, ok := taskCurrentTool[taskID]; ok {
		return tool
	}
	return ""
}

// UpdateTaskPhase updates the phase for a task
func UpdateTaskPhase(taskID string, phase string) {
	taskMutex.Lock()
	defer taskMutex.Unlock()
	taskPhase[taskID] = phase
}

// GetTaskPhase gets the phase for a task
func GetTaskPhase(taskID string) string {
	taskMutex.RLock()
	defer taskMutex.RUnlock()
	if phase, ok := taskPhase[taskID]; ok {
		return phase
	}
	return ""
}

func toMarkdown(content string, width int, backgroundColor compat.AdaptiveColor) string {
	r := styles.GetMarkdownRenderer(width-7, backgroundColor)
	content = strings.ReplaceAll(content, app.RootPath+"/", "")
	rendered, _ := r.Render(content)
	lines := strings.Split(rendered, "\n")

	if len(lines) > 0 {
		firstLine := lines[0]
		cleaned := ansi.Strip(firstLine)
		nospace := strings.ReplaceAll(cleaned, " ", "")
		if nospace == "" {
			lines = lines[1:]
		}
		if len(lines) > 0 {
			lastLine := lines[len(lines)-1]
			cleaned = ansi.Strip(lastLine)
			nospace = strings.ReplaceAll(cleaned, " ", "")
			if nospace == "" {
				lines = lines[:len(lines)-1]
			}
		}
	}
	content = strings.Join(lines, "\n")
	return strings.TrimSuffix(content, "\n")
}

// renderTechniqueInfo renders prompting technique information for a message
func renderTechniqueInfo(metadata opencode.MessageMetadata) string {
	// WORKAROUND: Extract technique info from modelID field
	// Format: "model-name|TECHNIQUES:tech1,tech2"
	if metadata.Assistant.ModelID != "" {
		modelID := metadata.Assistant.ModelID
		if strings.Contains(modelID, "|TECHNIQUES:") {
			parts := strings.Split(modelID, "|TECHNIQUES:")
			if len(parts) == 2 {
				techniquesStr := parts[1]
				techniques := strings.Split(techniquesStr, ",")
				if len(techniques) > 0 && techniques[0] != "" {
					return formatTechniqueNames(techniques)
				}
			}
		}
	}

	// Fallback: Try to access prompting data through JSON.ExtraFields (in case SDK is updated)
	if metadata.Assistant.JSON.ExtraFields != nil {
		prompting := metadata.Assistant.JSON.ExtraFields["prompting"]
		if !prompting.IsNull() {
			// Parse the prompting data using gjson
			promptingData := gjson.Parse(prompting.Raw())

			// Extract techniques array
			techniques := promptingData.Get("techniques").Array()
			if len(techniques) > 0 {
				techniqueNames := []string{}
				for _, tech := range techniques {
					techniqueNames = append(techniqueNames, tech.String())
				}
				if len(techniqueNames) > 0 {
					return formatTechniqueNames(techniqueNames)
				}
			}
		}
	}
	return ""
}

// cleanModelID removes technique info from modelID for display
func cleanModelID(modelID string) string {
	if strings.Contains(modelID, "|TECHNIQUES:") {
		parts := strings.Split(modelID, "|TECHNIQUES:")
		if len(parts) > 0 {
			return parts[0]
		}
	}
	return modelID
}

// getCompactTechniqueDescription returns a brief description based on active techniques
func getCompactTechniqueDescription(techniques []string) string {
	descriptions := map[string]string{
		"cot":                  "step-by-step reasoning",
		"few_shot":             "example-based learning",
		"react":                "reasoning and acting",
		"tot":                  "exploring thought trees",
		"self_consistency":     "multiple reasoning paths",
		"constitutional_ai":    "self-critique and improvement",
		"meta_prompting":       "optimal prompt generation",
		"iterative_refinement": "progressive improvement",
		"active_prompt":        "adaptive prompting",
		"pal":                  "program-aided reasoning",
		"reflexion":            "self-reflection learning",
		"generated_knowledge":  "knowledge generation",
		"prompt_chaining":      "chained subtasks",
		"persona":              "role-based perspective",
		"multi_agent":          "coordinated agents",
		"consensus_building":   "agreement through deliberation",
		"hierarchical":         "hierarchical decomposition",
	}

	// Build a description based on the techniques
	var descParts []string
	for _, tech := range techniques {
		if desc, ok := descriptions[strings.ToLower(tech)]; ok {
			descParts = append(descParts, desc)
		}
	}

	if len(descParts) == 0 {
		return "Enhanced reasoning active"
	} else if len(descParts) == 1 {
		return "Enhanced with " + descParts[0]
	} else if len(descParts) == 2 {
		return "Enhanced with " + descParts[0] + " and " + descParts[1]
	} else {
		// For 3 or more, just use the first two and add "and more"
		return "Enhanced with " + descParts[0] + ", " + descParts[1] + " and more"
	}
}

// formatTechniqueNames formats technique names for display
func formatTechniqueNames(techniques []string) string {
	// Map full technique names to abbreviations
	abbreviations := map[string]string{
		"chain-of-thought":        "CoT",
		"few-shot":                "FS",
		"tree-of-thoughts":        "ToT",
		"react":                   "ReAct",
		"self-consistency":        "SC",
		"least-to-most":           "LtM",
		"step-back":               "SB",
		"analogical":              "AR",
		"socratic":                "SM",
		"maieutic":                "MP",
		"constitutional-ai":       "CAI",
		"meta-prompting":          "MP",
		"role-play":               "RP",
		"perspective-shift":       "PS",
		"constraint-based":        "CB",
		"recursive-decomposition": "RD",
		"iterative-refinement":    "IR",
		"adversarial":             "AP",
	}

	result := []string{}
	for _, tech := range techniques {
		if abbr, ok := abbreviations[tech]; ok {
			result = append(result, abbr)
		} else {
			// If no abbreviation, use first 3 letters capitalized
			if len(tech) >= 3 {
				result = append(result, strings.ToUpper(tech[:3]))
			} else {
				result = append(result, strings.ToUpper(tech))
			}
		}
	}

	if len(result) > 0 {
		return "◆ " + strings.Join(result, "+")
	}
	return ""
}

type blockRenderer struct {
	border        bool
	borderColor   *compat.AdaptiveColor
	paddingTop    int
	paddingBottom int
	paddingLeft   int
	paddingRight  int
	marginTop     int
	marginBottom  int
}

type renderingOption func(*blockRenderer)

func WithNoBorder() renderingOption {
	return func(c *blockRenderer) {
		c.border = false
	}
}

func WithBorderColor(color compat.AdaptiveColor) renderingOption {
	return func(c *blockRenderer) {
		c.borderColor = &color
	}
}

func WithMarginTop(padding int) renderingOption {
	return func(c *blockRenderer) {
		c.marginTop = padding
	}
}

func WithMarginBottom(padding int) renderingOption {
	return func(c *blockRenderer) {
		c.marginBottom = padding
	}
}

func WithPadding(padding int) renderingOption {
	return func(c *blockRenderer) {
		c.paddingTop = padding
		c.paddingBottom = padding
		c.paddingLeft = padding
		c.paddingRight = padding
	}
}

func WithPaddingLeft(padding int) renderingOption {
	return func(c *blockRenderer) {
		c.paddingLeft = padding
	}
}

func WithPaddingRight(padding int) renderingOption {
	return func(c *blockRenderer) {
		c.paddingRight = padding
	}
}

func WithPaddingTop(padding int) renderingOption {
	return func(c *blockRenderer) {
		c.paddingTop = padding
	}
}

func WithPaddingBottom(padding int) renderingOption {
	return func(c *blockRenderer) {
		c.paddingBottom = padding
	}
}

func renderContentBlock(
	content string,
	width int,
	align lipgloss.Position,
	options ...renderingOption,
) string {
	t := theme.CurrentTheme()
	renderer := &blockRenderer{
		border:        true,
		paddingTop:    1,
		paddingBottom: 1,
		paddingLeft:   2,
		paddingRight:  2,
	}
	for _, option := range options {
		option(renderer)
	}

	borderColor := t.BackgroundPanel()
	if renderer.borderColor != nil {
		borderColor = *renderer.borderColor
	}

	style := styles.NewStyle().
		Foreground(t.TextMuted()).
		Background(t.BackgroundPanel()).
		Width(width).
		PaddingTop(renderer.paddingTop).
		PaddingBottom(renderer.paddingBottom).
		PaddingLeft(renderer.paddingLeft).
		PaddingRight(renderer.paddingRight).
		AlignHorizontal(lipgloss.Left)

	if renderer.border {
		style = style.
			BorderStyle(lipgloss.ThickBorder()).
			BorderLeft(true).
			BorderRight(true).
			BorderLeftForeground(borderColor).
			BorderLeftBackground(t.Background()).
			BorderRightForeground(t.BackgroundPanel()).
			BorderRightBackground(t.Background())
	}

	content = style.Render(content)
	content = lipgloss.PlaceHorizontal(
		width,
		lipgloss.Left,
		content,
		styles.WhitespaceStyle(t.Background()),
	)
	content = lipgloss.PlaceHorizontal(
		layout.Current.Viewport.Width,
		align,
		content,
		styles.WhitespaceStyle(t.Background()),
	)
	if renderer.marginTop > 0 {
		for range renderer.marginTop {
			content = "\n" + content
		}
	}
	if renderer.marginBottom > 0 {
		for range renderer.marginBottom {
			content = content + "\n"
		}
	}
	return content
}

func renderText(
	message opencode.Message,
	text string,
	author string,
	showToolDetails bool,
	width int,
	align lipgloss.Position,
	toolCalls ...opencode.ToolInvocationPart,
) string {
	t := theme.CurrentTheme()

	timestamp := time.UnixMilli(int64(message.Metadata.Time.Created)).Local().Format("02 Jan 2006 03:04 PM")
	if time.Now().Format("02 Jan 2006") == timestamp[:11] {
		// don't show the date if it's today
		timestamp = timestamp[12:]
	}
	
	// Extract techniques from author (modelID) if present
	techniqueInfo := ""
	if strings.Contains(author, "|TECHNIQUES:") {
		parts := strings.Split(author, "|TECHNIQUES:")
		if len(parts) == 2 {
			techniques := strings.Split(parts[1], ",")
			var coloredAbbrevs []string
			for _, tech := range techniques {
				if abbrev := getMinimalTechniqueAbbrev(tech); abbrev != "" {
					// Apply color based on technique type
					coloredAbbrev := getColoredTechniqueAbbrev(abbrev, t)
					coloredAbbrevs = append(coloredAbbrevs, coloredAbbrev)
				}
			}
			if len(coloredAbbrevs) > 0 {
				// Use bullet separator with theme color
				separator := lipgloss.NewStyle().Foreground(t.TextMuted()).Render(" • ")
				techniqueInfo = separator + strings.Join(coloredAbbrevs, " ")
			}
		}
	}
	
	info := fmt.Sprintf("%s (%s)%s", cleanModelID(author), timestamp, techniqueInfo)

	messageStyle := styles.NewStyle().
		Background(t.BackgroundPanel()).
		Foreground(t.Text())
	if message.Role == opencode.MessageRoleUser {
		messageStyle = messageStyle.Width(width - 6)
	}

	content := messageStyle.Render(text)
	if message.Role == opencode.MessageRoleAssistant {
		content = toMarkdown(text, width, t.BackgroundPanel())
	}
	if !showToolDetails && toolCalls != nil && len(toolCalls) > 0 {
		content = content + "\n\n"
		for _, toolCall := range toolCalls {
			// Special handling for task tool to preserve multi-line format
			if toolCall.ToolInvocation.ToolName == "task" {
				taskContent := renderToolTitle(toolCall, message.Metadata, width)
				// For tasks, don't add the "∟ " prefix as it breaks the box formatting
				content = content + taskContent + "\n"
			} else {
				title := renderToolTitle(toolCall, message.Metadata, width)
				metadata := opencode.MessageMetadataTool{}
				if _, ok := message.Metadata.Tool[toolCall.ToolInvocation.ToolCallID]; ok {
					metadata = message.Metadata.Tool[toolCall.ToolInvocation.ToolCallID]
				}
				style := styles.NewStyle()
				if _, ok := metadata.ExtraFields["error"]; ok {
					style = style.Foreground(t.Error())
				}
				title = style.Render(title)
				title = title + "\n"
				content = content + title
			}
		}
	}

	content = strings.Join([]string{content, info}, "\n")

	switch message.Role {
	case opencode.MessageRoleUser:
		return renderContentBlock(
			content,
			width,
			align,
			WithBorderColor(t.Secondary()),
		)
	case opencode.MessageRoleAssistant:
		return renderContentBlock(
			content,
			width,
			align,
			WithBorderColor(t.Accent()),
		)
	}
	return ""
}

func renderToolDetails(
	toolCall opencode.ToolInvocationPart,
	messageMetadata opencode.MessageMetadata,
	width int,
	align lipgloss.Position,
) string {
	ignoredTools := []string{"todoread"}
	if slices.Contains(ignoredTools, toolCall.ToolInvocation.ToolName) {
		return ""
	}

	toolCallID := toolCall.ToolInvocation.ToolCallID
	metadata := opencode.MessageMetadataTool{}
	if _, ok := messageMetadata.Tool[toolCallID]; ok {
		metadata = messageMetadata.Tool[toolCallID]
	}

	var result *string
	if toolCall.ToolInvocation.Result != "" {
		result = &toolCall.ToolInvocation.Result
	}

	if toolCall.ToolInvocation.State == "partial-call" {
		title := renderToolTitle(toolCall, messageMetadata, width)
		return renderContentBlock(title, width, align)
	}

	toolArgsMap := make(map[string]any)
	if toolCall.ToolInvocation.Args != nil {
		value := toolCall.ToolInvocation.Args
		if m, ok := value.(map[string]any); ok {
			toolArgsMap = m
			keys := make([]string, 0, len(toolArgsMap))
			for key := range toolArgsMap {
				keys = append(keys, key)
			}
			slices.Sort(keys)
		}
	}

	body := ""
	finished := result != nil && *result != ""
	t := theme.CurrentTheme()

	switch toolCall.ToolInvocation.ToolName {
	case "read":
		preview := metadata.ExtraFields["preview"]
		if preview != nil && toolArgsMap["filePath"] != nil {
			filename := toolArgsMap["filePath"].(string)
			body = preview.(string)
			body = renderFile(filename, body, width, WithTruncate(6))
		}
	case "edit":
		if filename, ok := toolArgsMap["filePath"].(string); ok {
			diffField := metadata.ExtraFields["diff"]
			if diffField != nil {
				patch := diffField.(string)
				var formattedDiff string
				formattedDiff, _ = diff.FormatUnifiedDiff(
					filename,
					patch,
					diff.WithWidth(width-2),
				)
				formattedDiff = strings.TrimSpace(formattedDiff)
				formattedDiff = styles.NewStyle().
					BorderStyle(lipgloss.ThickBorder()).
					BorderBackground(t.Background()).
					BorderForeground(t.BackgroundPanel()).
					BorderLeft(true).
					BorderRight(true).
					Render(formattedDiff)

				body = strings.TrimSpace(formattedDiff)
				body = renderContentBlock(
					body,
					width,
					align,
					WithNoBorder(),
					WithPadding(0),
				)

				if diagnostics := renderDiagnostics(metadata, filename); diagnostics != "" {
					body += "\n" + renderContentBlock(diagnostics, width, align)
				}

				title := renderToolTitle(toolCall, messageMetadata, width)
				title = renderContentBlock(title, width, align)
				content := title + "\n" + body
				return content
			}
		}
	case "write":
		if filename, ok := toolArgsMap["filePath"].(string); ok {
			if content, ok := toolArgsMap["content"].(string); ok {
				body = renderFile(filename, content, width)
				if diagnostics := renderDiagnostics(metadata, filename); diagnostics != "" {
					body += "\n\n" + diagnostics
				}
			}
		}
	case "bash":
		stdout := metadata.ExtraFields["stdout"]
		if stdout != nil {
			command := toolArgsMap["command"].(string)
			body = fmt.Sprintf("```console\n> %s\n%s```", command, stdout)
			body = toMarkdown(body, width, t.BackgroundPanel())
		}
	case "webfetch":
		if format, ok := toolArgsMap["format"].(string); ok && result != nil {
			body = *result
			body = truncateHeight(body, 10)
			if format == "html" || format == "markdown" {
				body = toMarkdown(body, width, t.BackgroundPanel())
			}
		}
	case "todowrite":
		todos := metadata.JSON.ExtraFields["todos"]
		if !todos.IsNull() && finished {
			strTodos := todos.Raw()
			todos := gjson.Parse(strTodos)
			for _, todo := range todos.Array() {
				content := todo.Get("content").String()
				switch todo.Get("status").String() {
				case "completed":
					body += fmt.Sprintf("- [x] %s\n", content)
				// case "in-progress":
				// 	body += fmt.Sprintf("- [ ] %s\n", content)
				default:
					body += fmt.Sprintf("- [ ] %s\n", content)
				}
			}
			body = toMarkdown(body, width, t.BackgroundPanel())
		}
	case "task":
		summary := metadata.JSON.ExtraFields["summary"]
		if !summary.IsNull() {
			strValue := summary.Raw()
			toolcalls := gjson.Parse(strValue).Array()

			steps := []string{}
			for _, toolcall := range toolcalls {
				call := toolcall.Value().(map[string]any)
				if toolInvocation, ok := call["toolInvocation"].(map[string]any); ok {
					data, _ := json.Marshal(toolInvocation)
					var toolCall opencode.ToolInvocationPart
					_ = json.Unmarshal(data, &toolCall)

					if metadata, ok := call["metadata"].(map[string]any); ok {
						data, _ = json.Marshal(metadata)
						var toolMetadata opencode.MessageMetadataTool
						_ = json.Unmarshal(data, &toolMetadata)

						step := renderToolTitle(toolCall, messageMetadata, width)
						steps = append(steps, step)
					}
				}
			}
			body = strings.Join(steps, "\n")
		}
	default:
		// Check if this is an MCP tool (contains underscore in name)
		if strings.Contains(toolCall.ToolInvocation.ToolName, "_") {
			body = renderMCPCompact(toolCall, metadata, result, width)
		} else {
			if result == nil {
				empty := ""
				result = &empty
			}
			body = *result
			body = truncateHeight(body, 10)
		}
	}

	error := ""
	if err, ok := metadata.ExtraFields["error"].(bool); ok && err {
		if message, ok := metadata.ExtraFields["message"].(string); ok {
			error = message
		}
	}

	if error != "" {
		body = styles.NewStyle().
			Foreground(t.Error()).
			Background(t.BackgroundPanel()).
			Render(error)
	}

	if body == "" && error == "" && result != nil {
		body = *result
		body = truncateHeight(body, 10)
	}

	title := renderToolTitle(toolCall, messageMetadata, width)
	content := title + "\n\n" + body
	return renderContentBlock(content, width, align)
}

func renderToolName(name string) string {
	switch name {
	case "webfetch":
		return "Fetch"
	case "todowrite", "todoread":
		return "Plan"
	default:
		normalizedName := name
		if strings.HasPrefix(name, "dgmo_") {
			normalizedName = strings.TrimPrefix(name, "dgmo_")
		}
		return cases.Title(language.Und).String(normalizedName)
	}
}

// extractAgentNumber extracts the agent number from task descriptions
func extractAgentNumber(description string) string {
	// Look for patterns like "Agent 1", "agent 2", etc.
	re := regexp.MustCompile(`(?i)agent\s*(\d+)`)
	matches := re.FindStringSubmatch(description)
	if len(matches) > 1 {
		return matches[1]
	}
	// If no agent number found, generate one based on current tasks
	return "1"
}

// getTaskIcon returns an appropriate icon based on the task description
func getTaskIcon(description string) string {
	desc := strings.ToLower(description)
	switch {
	case strings.Contains(desc, "search") || strings.Contains(desc, "find"):
		return "🔍"
	case strings.Contains(desc, "write") || strings.Contains(desc, "create"):
		return "📝"
	case strings.Contains(desc, "edit") || strings.Contains(desc, "modify"):
		return "✏️"
	case strings.Contains(desc, "build") || strings.Contains(desc, "compile"):
		return "🚀"
	case strings.Contains(desc, "test") || strings.Contains(desc, "verify"):
		return "🧪"
	case strings.Contains(desc, "debug") || strings.Contains(desc, "fix"):
		return "🐛"
	case strings.Contains(desc, "analyze") || strings.Contains(desc, "review"):
		return "📊"
	case strings.Contains(desc, "design") || strings.Contains(desc, "style"):
		return "🎨"
	case strings.Contains(desc, "deploy") || strings.Contains(desc, "release"):
		return "🚢"
	case strings.Contains(desc, "document") || strings.Contains(desc, "docs"):
		return "📚"
	default:
		return "⚡"
	}
}

func renderToolTitle(
	toolCall opencode.ToolInvocationPart,
	messageMetadata opencode.MessageMetadata,
	width int,
) string {
	// TODO: handle truncate to width

	if toolCall.ToolInvocation.State == "partial-call" {
		return renderToolAction(toolCall.ToolInvocation.ToolName)
	}

	toolArgs := ""
	toolArgsMap := make(map[string]any)
	if toolCall.ToolInvocation.Args != nil {
		value := toolCall.ToolInvocation.Args
		if m, ok := value.(map[string]any); ok {
			toolArgsMap = m

			keys := make([]string, 0, len(toolArgsMap))
			for key := range toolArgsMap {
				keys = append(keys, key)
			}
			slices.Sort(keys)
			firstKey := ""
			if len(keys) > 0 {
				firstKey = keys[0]
			}

			toolArgs = renderArgs(&toolArgsMap, firstKey)
		}
	}

	title := renderToolName(toolCall.ToolInvocation.ToolName)
	switch toolCall.ToolInvocation.ToolName {
	case "read":
		toolArgs = renderArgs(&toolArgsMap, "filePath")
		title = fmt.Sprintf("%s %s", title, toolArgs)
	case "edit", "write":
		if filename, ok := toolArgsMap["filePath"].(string); ok {
			title = fmt.Sprintf("%s %s", title, relative(filename))
		}
	case "bash":
		if description, ok := toolArgsMap["description"].(string); ok {
			title = fmt.Sprintf("%s %s", title, description)
		}
	case "task":
		if description, ok := toolArgsMap["description"].(string); ok {
			// Determine status based on tool invocation state
			status := "running"
			if toolCall.ToolInvocation.State == "result" {
				// Check if there's an error in metadata
				// For now, assume completed if we have a result
				status = "completed"
			}

			// Track task start time
			taskKey := toolCall.ToolInvocation.ToolCallID
			taskMutex.Lock()
			if _, exists := taskStartTimes[taskKey]; !exists && status == "running" {
				taskStartTimes[taskKey] = time.Now()
			}
			startTime, exists := taskStartTimes[taskKey]
			taskMutex.Unlock()

			// Calculate duration
			var duration time.Duration
			if exists {
				duration = time.Since(startTime)
			}

			// Get agent number from stored task info, fallback to extraction
			agentNumber, found := GetTaskAgentNumberWithFound(toolCall.ToolInvocation.ToolCallID)
			if !found {
				// Fallback to extraction if not found in storage
				agentNumber = int32(extractAgentNumberFromDescription(description))
			}

			// Use the new compact MCP-like task renderer with progress
			return RenderTaskCompactWithProgress(toolCall.ToolInvocation.ToolCallID, int(agentNumber), description, status, duration, startTime)
		}
	case "webfetch":
		toolArgs = renderArgs(&toolArgsMap, "url")
		title = fmt.Sprintf("%s %s", title, toolArgs)
	case "todowrite", "todoread":
		// title is just the tool name
	default:
		toolName := renderToolName(toolCall.ToolInvocation.ToolName)
		title = fmt.Sprintf("%s %s", toolName, toolArgs)
	}
	return title
}

func renderToolAction(name string) string {
	spinner := GetSpinnerFrame()
	t := theme.CurrentTheme()
	spinnerStyle := lipgloss.NewStyle().Foreground(t.Primary()).Bold(true)
	textStyle := lipgloss.NewStyle().Foreground(t.Text()).Italic(true)

	var icon, action string
	switch name {
	case "task":
		icon = "🚀"
		action = "Creating agent"
	case "bash":
		icon = "⚡"
		action = "Writing command"
	case "edit":
		icon = "✏️"
		action = "Preparing edit"
	case "webfetch":
		icon = "🌐"
		action = "Fetching from web"
	case "glob":
		icon = "🔎"
		action = "Finding files"
	case "grep":
		icon = "🔍"
		action = "Searching content"
	case "list":
		icon = "📁"
		action = "Listing directory"
	case "read":
		icon = "📖"
		action = "Reading file"
	case "write":
		icon = "💾"
		action = "Preparing write"
	case "todowrite":
		icon = "📋"
		action = "Writing tasks"
	case "todoread":
		icon = "📋"
		action = "Reading tasks"
	case "patch":
		icon = "🔧"
		action = "Preparing patch"
	default:
		icon = "⚙️"
		action = "Working"
	}

	return fmt.Sprintf("%s %s %s", icon, spinnerStyle.Render(spinner), textStyle.Render(action+"..."))
}

type fileRenderer struct {
	filename string
	content  string
	height   int
}

type fileRenderingOption func(*fileRenderer)

func WithTruncate(height int) fileRenderingOption {
	return func(c *fileRenderer) {
		c.height = height
	}
}

func renderFile(
	filename string,
	content string,
	width int,
	options ...fileRenderingOption) string {
	t := theme.CurrentTheme()
	renderer := &fileRenderer{
		filename: filename,
		content:  content,
	}
	for _, option := range options {
		option(renderer)
	}

	lines := []string{}
	for line := range strings.SplitSeq(content, "\n") {
		line = strings.TrimRightFunc(line, unicode.IsSpace)
		line = strings.ReplaceAll(line, "\t", "  ")
		lines = append(lines, line)
	}
	content = strings.Join(lines, "\n")

	if renderer.height > 0 {
		content = truncateHeight(content, renderer.height)
	}
	content = fmt.Sprintf("```%s\n%s\n```", extension(renderer.filename), content)
	content = toMarkdown(content, width, t.BackgroundPanel())
	return content
}

func renderArgs(args *map[string]any, titleKey string) string {
	if args == nil || len(*args) == 0 {
		return ""
	}

	keys := make([]string, 0, len(*args))
	for key := range *args {
		keys = append(keys, key)
	}
	slices.Sort(keys)

	title := ""
	parts := []string{}
	for _, key := range keys {
		value := (*args)[key]
		if value == nil {
			continue
		}
		if key == "filePath" || key == "path" {
			value = relative(value.(string))
		}
		if key == titleKey {
			title = fmt.Sprintf("%s", value)
			continue
		}
		parts = append(parts, fmt.Sprintf("%s=%v", key, value))
	}
	if len(parts) == 0 {
		return title
	}
	return fmt.Sprintf("%s (%s)", title, strings.Join(parts, ", "))
}

func truncateHeight(content string, height int) string {
	lines := strings.Split(content, "\n")
	if len(lines) > height {
		return strings.Join(lines[:height], "\n")
	}
	return content
}

func relative(path string) string {
	path = strings.TrimPrefix(path, app.CwdPath+"/")
	return strings.TrimPrefix(path, app.RootPath+"/")
}

func extension(path string) string {
	ext := filepath.Ext(path)
	if ext == "" {
		ext = ""
	} else {
		ext = strings.ToLower(ext[1:])
	}
	return ext
}

// Diagnostic represents an LSP diagnostic
type Diagnostic struct {
	Range struct {
		Start struct {
			Line      int `json:"line"`
			Character int `json:"character"`
		} `json:"start"`
	} `json:"range"`
	Severity int    `json:"severity"`
	Message  string `json:"message"`
}

// renderDiagnostics formats LSP diagnostics for display in the TUI
func renderDiagnostics(metadata opencode.MessageMetadataTool, filePath string) string {
	if diagnosticsData, ok := metadata.ExtraFields["diagnostics"].(map[string]any); ok {
		if fileDiagnostics, ok := diagnosticsData[filePath].([]any); ok {
			var errorDiagnostics []string
			for _, diagInterface := range fileDiagnostics {
				diagMap, ok := diagInterface.(map[string]any)
				if !ok {
					continue
				}
				// Parse the diagnostic
				var diag Diagnostic
				diagBytes, err := json.Marshal(diagMap)
				if err != nil {
					continue
				}
				if err := json.Unmarshal(diagBytes, &diag); err != nil {
					continue
				}
				// Only show error diagnostics (severity === 1)
				if diag.Severity != 1 {
					continue
				}
				line := diag.Range.Start.Line + 1        // 1-based
				column := diag.Range.Start.Character + 1 // 1-based
				errorDiagnostics = append(errorDiagnostics, fmt.Sprintf("Error [%d:%d] %s", line, column, diag.Message))
			}
			if len(errorDiagnostics) == 0 {
				return ""
			}
			t := theme.CurrentTheme()
			var result strings.Builder
			for _, diagnostic := range errorDiagnostics {
				if result.Len() > 0 {
					result.WriteString("\n")
				}
				result.WriteString(styles.NewStyle().Foreground(t.Error()).Render(diagnostic))
			}
			return result.String()
		}
	}
	return ""

	// diagnosticsData should be a map[string][]Diagnostic
	// strDiagnosticsData := diagnosticsData.Raw()
	// diagnosticsMap := gjson.Parse(strDiagnosticsData).Value().(map[string]any)
	// fileDiagnostics, ok := diagnosticsMap[filePath]
	// if !ok {
	// 	return ""
	// }

	// diagnosticsList, ok := fileDiagnostics.([]any)
	// if !ok {
	// 	return ""
	// }

}

// renderPromptingTechnique creates a compact display for prompting techniques
func renderPromptingTechnique(metadata opencode.MessageMetadata, width int) string {
	// Extract technique info from modelID workaround
	if metadata.Assistant.ModelID == "" {
		return ""
	}

	// Debug: Log that we're in the new rendering function
	// fmt.Fprintf(os.Stderr, "DEBUG: renderPromptingTechnique called with modelID: %s\n", metadata.Assistant.ModelID)

	modelID := metadata.Assistant.ModelID
	if !strings.Contains(modelID, "|TECHNIQUES:") {
		// fmt.Fprintf(os.Stderr, "DEBUG: No techniques found in modelID\n")
		return ""
	}

	parts := strings.Split(modelID, "|TECHNIQUES:")
	if len(parts) != 2 {
		return ""
	}

	techniquesStr := parts[1]
	techniques := strings.Split(techniquesStr, ",")
	if len(techniques) == 0 || techniques[0] == "" {
		return ""
	}

	// Get minimal abbreviations for each technique
	var abbrevs []string
	for _, tech := range techniques {
		abbrev := getMinimalTechniqueAbbrev(tech)
		if abbrev != "" {
			abbrevs = append(abbrevs, abbrev)
		}
	}
	
	if len(abbrevs) == 0 {
		return ""
	}
	
	// Join abbreviations with a dot separator for minimal display
	techniqueText := strings.Join(abbrevs, " • ")
	
	// Apply theme-appropriate styling - subtle and minimal
	t := theme.CurrentTheme()
	techniqueStyle := lipgloss.NewStyle().
		Foreground(t.TextMuted()). // Use muted color for discreteness
		Italic(true)                // Italic for subtle differentiation
	
	// Return just the styled abbreviation text, no box or decorations
	return techniqueStyle.Render(techniqueText)
}

// getMinimalTechniqueAbbrev returns a minimal abbreviation for a technique
func getMinimalTechniqueAbbrev(technique string) string {
	abbrevs := map[string]string{
		"chain-of-thought":         "CoT",
		"chain_of_thought":         "CoT",
		"cot":                      "CoT",
		"few-shot":                 "FS",
		"few_shot":                 "FS",
		"tree-of-thoughts":         "ToT",
		"tree_of_thoughts":         "ToT",
		"tot":                      "ToT",
		"react":                    "ReAct",
		"self-consistency":         "SC",
		"self_consistency":         "SC",
		"least-to-most":            "LtM",
		"least_to_most":            "LtM",
		"step-back":                "SB",
		"step_back":                "SB",
		"analogical":               "AR",
		"socratic":                 "SM",
		"maieutic":                 "MP",
		"constitutional-ai":        "CAI",
		"constitutional_ai":        "CAI",
		"meta-prompting":           "MetaP",
		"meta_prompting":           "MetaP",
		"role-play":                "RP",
		"role_play":                "RP",
		"perspective-shift":        "PS",
		"perspective_shift":        "PS",
		"constraint-based":         "CB",
		"constraint_based":         "CB",
		"recursive-decomposition":  "RD",
		"recursive_decomposition":  "RD",
		"iterative-refinement":     "IR",
		"iterative_refinement":     "IR",
		"adversarial":              "AP",
		"active-prompt":            "ActP",
		"active_prompt":            "ActP",
		"pal":                      "PAL",
		"reflexion":                "Rfx",
		"generated-knowledge":      "GK",
		"generated_knowledge":      "GK",
		"prompt-chaining":          "PC",
		"prompt_chaining":          "PC",
		"persona":                  "Prs",
		"multi-agent":              "MA",
		"multi_agent":              "MA",
		"consensus-building":       "ConsB",
		"consensus_building":       "ConsB",
		"hierarchical":             "HD",  // As requested
		"hierarchical_decomposition": "HD",
	}
	
	// Normalize the technique name to lowercase
	normalized := strings.ToLower(strings.TrimSpace(technique))
	
	if abbrev, ok := abbrevs[normalized]; ok {
		return abbrev
	}
	
	// If not found, return empty string to skip unknown techniques
	return ""
}

// getColoredTechniqueAbbrev returns a colored version of the technique abbreviation
func getColoredTechniqueAbbrev(abbrev string, t theme.Theme) string {
	// Define color mappings for different technique categories
	// Using theme colors for consistency
	var style lipgloss.Style
	
	switch abbrev {
	// Reasoning techniques - Blue/Cyan tones
	case "CoT", "ToT", "PAL":
		style = lipgloss.NewStyle().Foreground(t.Info())
	
	// Generation techniques - Green tones
	case "FS", "Prs", "GK":
		style = lipgloss.NewStyle().Foreground(t.Success())
	
	// Multi-agent/Coordination - Purple/Magenta tones
	case "MA", "ConsB", "HD":
		style = lipgloss.NewStyle().Foreground(t.Secondary())
	
	// Optimization techniques - Yellow/Gold tones
	case "IR", "Rfx", "SC":
		style = lipgloss.NewStyle().Foreground(t.Warning())
	
	// Advanced techniques - Orange/Red tones
	case "ReAct", "CAI", "MetaP":
		style = lipgloss.NewStyle().Foreground(t.Error())
	
	// Problem-solving techniques - Teal tones
	case "LtM", "SB", "RD":
		style = lipgloss.NewStyle().Foreground(t.Accent())
	
	// Interactive techniques - Pink tones
	case "SM", "MP", "RP", "PS":
		style = lipgloss.NewStyle().Foreground(t.Primary())
	
	// Default for others
	default:
		style = lipgloss.NewStyle().Foreground(t.TextMuted())
	}
	
	// Make it slightly bold for better visibility
	return style.Bold(true).Render(abbrev)
}

// renderMCPCompact creates a compact display for MCP tool calls
func renderMCPCompact(toolCall opencode.ToolInvocationPart, metadata opencode.MessageMetadataTool, result *string, width int) string {
	t := theme.CurrentTheme()

	// Parse MCP tool name (e.g., "qdrant_qdrant-find" -> "qdrant" server, "find" function)
	toolName := toolCall.ToolInvocation.ToolName
	parts := strings.SplitN(toolName, "_", 2)
	serverName := parts[0]
	functionName := toolName
	if len(parts) > 1 {
		functionName = parts[1]
	}

	// Get key parameters for display
	toolArgs := toolCall.ToolInvocation.Args
	var keyParams []string

	// Extract important parameters based on common MCP patterns
	if toolArgsMap, ok := toolArgs.(map[string]interface{}); ok {
		if query, ok := toolArgsMap["query"].(string); ok && query != "" {
			truncated := query
			if len(truncated) > 50 {
				truncated = truncated[:47] + "..."
			}
			keyParams = append(keyParams, fmt.Sprintf("query: '%s'", truncated))
		}
		if collection, ok := toolArgsMap["collection_name"].(string); ok && collection != "" {
			keyParams = append(keyParams, fmt.Sprintf("collection: %s", collection))
		}
		if task, ok := toolArgsMap["task"].(string); ok && task != "" {
			truncated := task
			if len(truncated) > 40 {
				truncated = truncated[:37] + "..."
			}
			keyParams = append(keyParams, fmt.Sprintf("task: '%s'", truncated))
		}
		if techniques, ok := toolArgsMap["techniques"].([]interface{}); ok && len(techniques) > 0 {
			keyParams = append(keyParams, fmt.Sprintf("techniques: %d", len(techniques)))
		}
		if limit, ok := toolArgsMap["limit"].(float64); ok {
			keyParams = append(keyParams, fmt.Sprintf("limit: %.0f", limit))
		}
	}

	// Determine status and result summary
	var status, resultSummary string

	// Safe type assertion for finished field
	finished := false
	if finishedVal, ok := metadata.ExtraFields["finished"]; ok && finishedVal != nil {
		if finishedBool, ok := finishedVal.(bool); ok {
			finished = finishedBool
		}
	}

	if err, ok := metadata.ExtraFields["error"].(bool); ok && err {
		status = "❌ Failed"
		if message, ok := metadata.ExtraFields["message"].(string); ok {
			resultSummary = message
		}
	} else if finished {
		status = "✅ Success"
		if result != nil && *result != "" {
			// Try to extract meaningful summary from result
			resultText := *result
			if strings.Contains(resultText, "\"status\": \"success\"") {
				// Parse JSON response for summary
				if strings.Contains(resultText, "\"results\":") {
					if count := strings.Count(resultText, "\"content\":"); count > 0 {
						resultSummary = fmt.Sprintf("%d results found", count)
					}
				} else if strings.Contains(resultText, "\"collections\":") {
					if count := strings.Count(resultText, "\"name\":"); count > 0 {
						resultSummary = fmt.Sprintf("%d collections", count)
					}
				} else if strings.Contains(resultText, "\"points_count\":") {
					resultSummary = "Collection info retrieved"
				} else {
					resultSummary = "Operation completed"
				}
			} else {
				// For non-JSON results, show first line or truncated content
				lines := strings.Split(resultText, "\n")
				if len(lines) > 0 && lines[0] != "" {
					resultSummary = lines[0]
					if len(resultSummary) > 60 {
						resultSummary = resultSummary[:57] + "..."
					}
				}
			}
		}
		if resultSummary == "" {
			resultSummary = "Completed successfully"
		}
	} else {
		status = "⏳ Running"
		resultSummary = "Processing request..."
	}

	// Build compact display
	var lines []string

	// Brief result summary (1-3 lines) at the top
	if finished && result != nil && *result != "" {
		summaryStyle := lipgloss.NewStyle().Foreground(t.Text()).Italic(true)
		resultText := *result

		// Generate brief summary based on result content
		var briefSummary string
		if strings.Contains(resultText, "\"status\": \"success\"") {
			// Parse JSON for key information
			if strings.Contains(resultText, "\"results\":") && strings.Contains(resultText, "\"content\":") {
				count := strings.Count(resultText, "\"content\":")
				briefSummary = fmt.Sprintf("Found %d results", count)
			} else if strings.Contains(resultText, "\"collections\":") {
				count := strings.Count(resultText, "\"name\":")
				briefSummary = fmt.Sprintf("Listed %d collections", count)
			} else if strings.Contains(resultText, "\"points_count\":") {
				briefSummary = "Retrieved collection information"
			} else {
				briefSummary = "Operation completed successfully"
			}
		} else {
			// For non-JSON results, show first line truncated
			lines := strings.Split(resultText, "\n")
			if len(lines) > 0 && lines[0] != "" {
				briefSummary = lines[0]
				if len(briefSummary) > 80 {
					briefSummary = briefSummary[:77] + "..."
				}
			} else {
				briefSummary = "Operation completed"
			}
		}

		if briefSummary != "" {
			lines = append(lines, summaryStyle.Render(briefSummary))
			lines = append(lines, "") // Empty line for spacing
		}
	}

	// Header line: MCP Server • Function
	headerStyle := lipgloss.NewStyle().Foreground(t.Primary()).Bold(true)
	serverStyle := lipgloss.NewStyle().Foreground(t.Secondary())
	header := fmt.Sprintf("%s %s • %s",
		headerStyle.Render("MCP"),
		serverStyle.Render(serverName),
		functionName)
	lines = append(lines, header)
	// Parameters line (if any)
	if len(keyParams) > 0 {
		paramStyle := lipgloss.NewStyle().Foreground(t.TextMuted())
		paramLine := strings.Join(keyParams, ", ")
		if len(paramLine) > width-4 {
			paramLine = paramLine[:width-7] + "..."
		}
		lines = append(lines, paramStyle.Render("  "+paramLine))
	}

	// Status and result line
	var statusStyle lipgloss.Style
	if strings.Contains(status, "✅") {
		statusStyle = lipgloss.NewStyle().Foreground(t.Success())
	} else if strings.Contains(status, "❌") {
		statusStyle = lipgloss.NewStyle().Foreground(t.Error())
	} else {
		statusStyle = lipgloss.NewStyle().Foreground(t.Warning())
	}

	statusLine := fmt.Sprintf("  %s", statusStyle.Render(status))
	if resultSummary != "" {
		resultStyle := lipgloss.NewStyle().Foreground(t.Text())
		statusLine += " " + resultStyle.Render(resultSummary)
	}
	lines = append(lines, statusLine)

	return strings.Join(lines, "\n")
}
