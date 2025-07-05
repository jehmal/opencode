# Instructions for Next DGMO TUI Vision Implementation Agent

You are implementing vision capabilities for DGMO's TUI (Terminal User Interface) written in Go. The
project is 50% complete with CLI vision working perfectly. Your task is to port the TypeScript
vision implementation to Go for the TUI interface.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT`
- TUI Location: `/opencode/packages/tui/`
- CLI Reference Implementation: `/opencode/packages/opencode/src/util/image-handler.ts`
- Architecture Doc: `/VISION_CAPABILITIES_README.md`
- Related Systems: opencode-sdk-go, AI SDK integration

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "DGMO PROJECT SNAPSHOT Vision Capabilities Implementation TUI Go"
2. Search: "DGMO VISION CAPABILITIES IMPLEMENTATION COMPLETE CLI TypeScript"
3. Search: "image detection base64 encoding file path extraction patterns"
4. Search: "Go image processing base64 data URL MIME types"
5. Search: "TUI SendChatMessage attachment infrastructure MessagePartUnionParam"

## Completed Components (DO NOT RECREATE)

✅ CLI Vision Implementation - Full TypeScript implementation working ✅ Image Handler Utility
(TypeScript) - Reference implementation at `/opencode/packages/opencode/src/util/image-handler.ts`
✅ Run Command Integration - CLI command fully supports vision ✅ Documentation -
`/VISION_CAPABILITIES_README.md` complete ✅ Test Script - `/test-vision.sh` for CLI testing

## Critical Files to Reference

### TypeScript Implementation (Reference):

- `/opencode/packages/opencode/src/util/image-handler.ts` - Image detection and encoding logic
- `/opencode/packages/opencode/src/cli/cmd/run.ts` - How CLI integrates vision

### Go Files to Modify:

- `/opencode/packages/tui/internal/app/app.go` - SendChatMessage method (line 281)
- `/opencode/packages/tui/internal/components/chat/editor.go` - Editor component with attachments

### SDK Reference:

- Check opencode-sdk-go for MessagePartUnionParam types
- Look for FilePartParam or similar in the SDK

## Required Tasks (USE 4 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Go Image Detection & Path Extraction

Create image detection utilities in Go:

- Create `/opencode/packages/tui/internal/image/detector.go`
- Implement `IsImageFile(path string) bool` function
- Implement `ExtractImagePaths(text string) []string` function
- Support extensions: .png, .jpg, .jpeg, .gif, .webp, .bmp
- Handle quoted paths, backtick paths, and unquoted paths
- Test with Windows paths (C:\...) and WSL paths (/mnt/c/...) Location:
  `/opencode/packages/tui/internal/image/` Dependencies: Go standard library (regexp, strings, path)

### Sub-Agent 2: Go Image Encoding & File Reading

Create base64 encoding utilities:

- Create `/opencode/packages/tui/internal/image/encoder.go`
- Implement `ReadImageAsBase64(path string) (string, error)` function
- Implement `GetMimeType(path string) string` function
- Handle Windows to WSL path conversion
- Check file existence and size limits (5MB max)
- Return data URL format: `data:image/png;base64,...` Location:
  `/opencode/packages/tui/internal/image/` Dependencies: Go standard library (os, io,
  encoding/base64, mime)

### Sub-Agent 3: TUI Message Integration

Modify SendChatMessage to support images:

- Update `/opencode/packages/tui/internal/app/app.go`
- In SendChatMessage method (line 281), detect image paths in text
- For each detected image path:
  - Read and encode as base64
  - Create FilePartParam (or equivalent) message parts
- Modify the API call at line 311 to include both text and file parts
- Add error handling for failed image loads
- Show user feedback when images are loaded Location: `/opencode/packages/tui/internal/app/`
  Dependencies: Image utilities from Sub-Agents 1 & 2

### Sub-Agent 4: SDK Integration & Testing

Ensure proper SDK message format:

- Research opencode-sdk-go for file/image message part types
- Find or create FilePartParam equivalent
- Ensure message parts array can contain mixed types
- Create test cases for TUI vision
- Update any type definitions needed
- Document the Go implementation approach Location: Various SDK and test files Dependencies:
  opencode-sdk-go documentation

## Integration Requirements

1. **Compatibility**: Match CLI behavior exactly - same image detection patterns
2. **User Experience**: Show feedback when images are loaded/fail
3. **Error Handling**: Graceful failures with clear messages
4. **Path Support**: Handle Windows, WSL, and relative paths
5. **Size Limits**: Enforce 5MB limit per image
6. **Performance**: Don't block UI while encoding images

## Technical Constraints

- Use Go standard library where possible
- Maintain TUI responsiveness during image processing
- Follow existing Go code patterns in the TUI
- Ensure cross-platform compatibility (Windows/Linux/macOS)
- Keep image processing synchronous for simplicity
- Maximum image size: 5MB (same as CLI)

## Success Criteria

1. TUI detects image paths in user messages
2. Images are encoded and sent to the API
3. Claude responds with image analysis in TUI
4. Multiple images in one message work
5. Error handling for missing/invalid images
6. Path formats handled transparently
7. User sees feedback when images are processed
8. No regression in existing TUI functionality

## Testing Approach

After implementation:

1. Start TUI: `dgmo`
2. Type message with image: "analyze test-image.png"
3. Verify image is loaded (feedback message)
4. Confirm AI receives and analyzes image
5. Test with multiple images
6. Test with invalid paths (error handling)
7. Test with large files (>5MB rejection)
8. Test Windows and WSL path formats

## Known Issues & Solutions

- Issue: Go doesn't have Bun.file() API Solution: Use os.ReadFile() and standard Go file operations
- Issue: SDK might not have FilePartParam Solution: Check for ImagePartParam or create custom type
- Issue: Path conversion complexity Solution: Create robust path normalization function

## Important Notes

- The CLI implementation in TypeScript is fully working - use it as reference
- The TUI already has an attachment system but it's not being used
- Focus on making the text-based image path detection work first
- The Go implementation should mirror the TypeScript logic closely
- Remember: Users just type image paths naturally, no special syntax

## ReAct Pattern for Implementation

Use the ReAct (Reasoning and Acting) pattern:

1. **Thought**: Analyze what needs to be done
2. **Action**: Implement specific component
3. **Observation**: Test and verify it works
4. **Thought**: Decide next step based on results
5. Continue until all components are integrated

Start by searching memory for the mentioned queries to understand the current state, then launch
your sub-agents to implement TUI vision capabilities. The goal is to make vision work as seamlessly
in the TUI as it does in the CLI - users should just mention image paths and get instant visual
analysis.
