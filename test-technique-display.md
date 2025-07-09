# Prompting Technique Display Test

## Changes Made

### 1. Backend (TypeScript) - `/packages/opencode/src/session/index.ts`

- Line 461-465: Removed updating user message with enhanced prompt
- Line 687-707: Modified messages array to use enhanced prompt only for API call
- The enhanced prompt is now sent to the model but not stored/displayed in the user message

### 2. Frontend (Go) - `/packages/tui/internal/components/chat/message.go`

#### Updated `renderTechniqueInfo` function (lines 239-260):

```go
// Now properly extracts prompting data from Assistant metadata
if metadata.Assistant != nil && metadata.Assistant.JSON.ExtraFields != nil {
    prompting := metadata.Assistant.JSON.ExtraFields["prompting"]
    if !prompting.IsNull() {
        // Parse using gjson (same pattern as todowrite)
        promptingData := gjson.Parse(prompting.Raw())
        techniques := promptingData.Get("techniques").Array()
        // Extract and format technique names
    }
}
```

#### Updated `renderText` function (lines 471-490):

```go
if message.Role == opencode.MessageRoleAssistant {
    content = toMarkdown(text, width, t.BackgroundPanel())

    // Add prompting technique info at the top
    techniqueInfo := renderTechniqueInfo(message.Metadata)
    if techniqueInfo != "" {
        techniqueStyle := styles.NewStyle().
            Foreground(t.Primary()).
            Bold(true).
            Background(t.BackgroundPanel())
        techniqueIndicator := techniqueStyle.Render(techniqueInfo)
        content = techniqueIndicator + "\n\n" + content
    }
}
```

#### Technique Abbreviations (lines 265-284):

- chain-of-thought → CoT
- few-shot → FS
- tree-of-thoughts → ToT
- react → ReAct
- self-consistency → SC
- least-to-most → LtM
- step-back → SB
- analogical → AR
- socratic → SM
- maieutic → MP
- constitutional-ai → CAI
- meta-prompting → MP
- role-play → RP
- perspective-shift → PS
- constraint-based → CB
- recursive-decomposition → RD
- iterative-refinement → IR
- adversarial → AP

## Expected Behavior

1. **User Message**: Shows only the original prompt (no enhancement visible)
2. **Assistant Message**: Shows "◆ CoT" (or other technique) at the top of the response
3. **Backend**: Enhanced prompt is sent to the model for better responses

## Testing

To test the changes:

1. Rebuild the TUI: `cd packages/tui && go build -o dgmo ./cmd/dgmo`
2. Run the TUI: `./dgmo`
3. Send a prompt like "Explain binary search"
4. Verify:
   - User message shows original text only
   - Assistant message has "◆ CoT" at the top
   - Response quality reflects the enhanced prompt

## Troubleshooting

If the technique indicator doesn't appear:

1. Check that the TypeScript server is passing `prompting` metadata in the assistant response
2. Verify the SDK is up to date (may need regeneration with Stainless)
3. Check console logs for any errors in metadata parsing
