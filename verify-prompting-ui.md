# Verify Prompting UI Implementation

## Summary of Changes

### 1. TypeScript Backend (`/packages/opencode/src/session/index.ts`)

- **Line 461-465**: Removed updating user message with enhanced prompt
- **Line 687-707**: Modified to send enhanced prompt to API only
- **Line 488-490**: Prompting metadata is added to assistant message

### 2. Go Frontend (`/packages/tui/internal/components/chat/message.go`)

#### Key Functions Modified:

1. **`renderTechniqueInfo` (lines 239-260)**:

   - Uses `metadata.Assistant.JSON.ExtraFields["prompting"]` pattern
   - Parses with `gjson` library
   - Extracts techniques array and formats names

2. **`renderText` (lines 533-550)**:

   - Added technique info before content/info join
   - Styled with Primary color and Bold
   - Appears at top of assistant message

3. **`formatTechniqueNames` (lines 263-304)**:
   - Maps technique names to abbreviations
   - Returns format: "◆ CoT" or "◆ CoT+FS" for multiple

## Debugging Steps

1. **Check TypeScript logs**:

   ```bash
   # Look for "Prompt enhanced with techniques" log
   tail -f packages/opencode/logs/*.log | grep -i "prompt enhanced"
   ```

2. **Check Go console output**:

   - Added debug logs will show:
     - If Assistant metadata exists
     - If JSON.ExtraFields exists
     - What fields are available
     - If prompting field is present

3. **Verify SDK compatibility**:
   - Current SDK: `v0.1.0-alpha.7`
   - May need update if `JSON.ExtraFields` structure changed

## Test Procedure

1. Start TypeScript server:

   ```bash
   cd packages/opencode
   bun run src/index.ts
   ```

2. Start Go TUI:

   ```bash
   cd packages/tui
   go run ./cmd/dgmo
   ```

3. Send test prompt:
   - Type: "Explain how binary search works"
   - Expected: User message shows original text
   - Expected: Assistant message has "◆ CoT" at top

## Troubleshooting

If technique indicator doesn't appear:

1. **Check TypeScript side**:

   - Verify `promptingMetadata` is populated
   - Check `next.metadata.assistant.prompting` is set
   - Ensure techniques array has values

2. **Check Go side**:

   - Look for debug output in console
   - Verify `JSON.ExtraFields` structure
   - Check if prompting field exists

3. **SDK Issues**:
   - May need to regenerate SDK with Stainless
   - Or manually update Go types to include Prompting field

## Alternative Approach

If SDK doesn't support prompting field, we could:

1. Use a different metadata field (e.g., tool metadata)
2. Pass technique info in a custom header
3. Include it in the message text with special markers

## Current Status

- ✅ Enhanced prompt hidden from user message
- ✅ Backend sends enhanced prompt to API
- ⚠️ Technique indicator implementation complete but needs testing
- ⚠️ May require SDK update for full functionality
