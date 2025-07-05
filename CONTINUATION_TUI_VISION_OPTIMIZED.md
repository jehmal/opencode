# DGMO TUI Vision Implementation - Optimized Instructions

## Executive Summary

You are implementing vision capabilities for DGMO's TUI written in Go. The CLI (TypeScript) vision
is 100% complete and working perfectly. Your task is to port this functionality to Go using parallel
sub-agents with specialized roles.

## Critical Context Recovery

```bash
# First, restore full project context from memory:
qdrant:qdrant-find "DGMO PROJECT SNAPSHOT Vision Capabilities Implementation TUI Go"
qdrant:qdrant-find "DGMO VISION CAPABILITIES IMPLEMENTATION COMPLETE CLI TypeScript"
qdrant:qdrant-find "Go image processing base64 data URL MIME types TUI SendChatMessage"
qdrant:qdrant-find "image detection base64 encoding file path extraction patterns"
qdrant:qdrant-find "TUI SendChatMessage attachment infrastructure MessagePartUnionParam"
```

## Working Directory & Key Files

- **Project Root**: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT`
- **TUI Location**: `/opencode/packages/tui/`
- **Reference Implementation**: `/opencode/packages/opencode/src/util/image-handler.ts`
- **Target File**: `/opencode/packages/tui/internal/app/app.go` (SendChatMessage at line 281)

## Completed Components (DO NOT RECREATE) ✅

- ✅ CLI Vision Implementation - 100% working in TypeScript
- ✅ Image Handler (TypeScript) - Complete reference at `image-handler.ts`
- ✅ Documentation - `/VISION_CAPABILITIES_README.md`
- ✅ Test Script - `/test-vision.sh` for CLI testing
- ✅ Message System - FilePart type already supports images

## Multi-Agent Coordination Strategy

### 🎯 Supervisor Agent (You)

**Role**: Orchestrate sub-agents, monitor progress, integrate components **Responsibilities**:

1. Launch all 4 sub-agents in parallel
2. Monitor their outputs for dependencies
3. Integrate completed components
4. Test the final implementation
5. Handle any cross-agent conflicts

### 👷 Sub-Agent 1: Go Image Detection Specialist

**Persona**: Expert Go developer with regex and file system experience **Task**: Create image
detection utilities **Deliverables**:

```go
// /opencode/packages/tui/internal/image/detector.go
package image

// IsImageFile checks if path points to an image
func IsImageFile(path string) bool

// ExtractImagePaths finds all image paths in text
func ExtractImagePaths(text string) []string
```

**Few-Shot Examples from TypeScript**:

```typescript
// Example 1: Extension detection
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
const isImage = IMAGE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));

// Example 2: Path extraction regex
const patterns = [
  /"([^"]+\.(png|jpg|jpeg|gif|webp|bmp))"/gi, // Quoted paths
  /`([^`]+\.(png|jpg|jpeg|gif|webp|bmp))`/gi, // Backtick paths
  /(?:^|\s)([^\s]+\.(png|jpg|jpeg|gif|webp|bmp))(?:\s|$)/gi, // Unquoted
];
```

### 👷 Sub-Agent 2: Go Base64 Encoding Specialist

**Persona**: Go systems programmer with encoding expertise **Task**: Create image encoding utilities
**Deliverables**:

```go
// /opencode/packages/tui/internal/image/encoder.go
package image

// ReadImageAsBase64 reads and encodes image file
func ReadImageAsBase64(path string) (string, error)

// GetMimeType returns MIME type for image
func GetMimeType(path string) string

// ConvertWindowsPath handles C:\\ to /mnt/c/ conversion
func ConvertWindowsPath(path string) string
```

**Few-Shot Example**:

```typescript
// TypeScript reference
const file = Bun.file(imagePath);
const buffer = await file.arrayBuffer();
const base64 = Buffer.from(buffer).toString('base64');
const mimeType = getMimeType(imagePath);
return `data:${mimeType};base64,${base64}`;
```

### 👷 Sub-Agent 3: TUI Integration Specialist

**Persona**: Go API integration expert familiar with AI SDKs **Task**: Modify SendChatMessage to
support images **Location**: `/opencode/packages/tui/internal/app/app.go:281`

**ReAct Pattern Implementation**:

```
Thought: Need to detect images in user message before sending
Action: Call image.ExtractImagePaths(text)
Observation: Found 2 image paths

Thought: Need to load and encode each image
Action: For each path, call image.ReadImageAsBase64()
Observation: Successfully encoded both images

Thought: Need to create message parts array with text and images
Action: Build []MessagePartUnionParam with TextPart and FileParts
Observation: Message structure ready

Thought: Send to API with mixed content
Action: Update API call to use message parts array
Observation: API accepted multi-part message
```

### 👷 Sub-Agent 4: SDK Research & Testing Specialist

**Persona**: SDK documentation expert and QA engineer **Task**: Research opencode-sdk-go types and
create tests

**Iterative Refinement Process**:

1. **Iteration 1**: Find MessagePartUnionParam or equivalent in SDK
2. **Iteration 2**: Identify FilePartParam or ImagePartParam types
3. **Iteration 3**: Create test cases for vision functionality
4. **Iteration 4**: Document Go implementation patterns
5. **Iteration 5**: Validate cross-platform compatibility

## Integration Requirements

### Type Compatibility

```go
// Expected structure (verify in SDK):
type MessagePartUnionParam interface{}

type TextPartParam struct {
    Type string `json:"type"`  // "text"
    Text string `json:"text"`
}

type FilePartParam struct {
    Type string `json:"type"`  // "file"
    URL  string `json:"url"`   // data:image/png;base64,...
}
```

### Error Handling Pattern

```go
// Graceful degradation for image loading
images := image.ExtractImagePaths(text)
var parts []MessagePartUnionParam

// Always add text part
parts = append(parts, TextPartParam{Type: "text", Text: text})

// Try to add image parts
for _, imgPath := range images {
    if data, err := image.ReadImageAsBase64(imgPath); err == nil {
        parts = append(parts, FilePartParam{
            Type: "file",
            URL:  data,
        })
        // Show user feedback
        fmt.Printf("✅ Loaded image: %s\n", imgPath)
    } else {
        fmt.Printf("❌ Failed to load image %s: %v\n", imgPath, err)
    }
}
```

## Success Criteria Checklist

- [ ] Image paths detected in TUI messages
- [ ] Images encoded to base64 data URLs
- [ ] SendChatMessage sends multi-part messages
- [ ] User sees feedback for loaded images
- [ ] Errors handled gracefully
- [ ] Windows/WSL paths work correctly
- [ ] 5MB size limit enforced
- [ ] Multiple images in one message work

## Testing Protocol

```bash
# After implementation:
dgmo  # Start TUI

# Test cases:
# 1. Single image: "analyze screenshot.png"
# 2. Multiple images: "compare before.png and after.png"
# 3. Windows path: "look at C:\Users\name\image.jpg"
# 4. Invalid path: "analyze missing.png" (should show error)
# 5. Large file: "analyze huge.png" (>5MB, should reject)
```

## Known Solutions from Memory

### Path Conversion (Windows to WSL)

```go
func ConvertWindowsPath(path string) string {
    if strings.HasPrefix(path, "C:\\") {
        return "/mnt/c/" + strings.ReplaceAll(path[3:], "\\", "/")
    }
    return path
}
```

### MIME Type Detection

```go
var mimeTypes = map[string]string{
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif":  "image/gif",
    ".webp": "image/webp",
    ".bmp":  "image/bmp",
}
```

## Parallel Execution Command

Launch all sub-agents simultaneously with their specialized prompts:

1. Start Sub-Agent 1 (Image Detection)
2. Start Sub-Agent 2 (Base64 Encoding)
3. Start Sub-Agent 3 (TUI Integration)
4. Start Sub-Agent 4 (SDK Research)

Monitor outputs and integrate as components complete. The goal is seamless vision support in TUI
matching CLI functionality exactly.

## Final Integration Checklist

- [ ] All 4 sub-agents completed their tasks
- [ ] Components integrated into TUI
- [ ] Tests pass for all scenarios
- [ ] User experience matches CLI
- [ ] Documentation updated if needed

Remember: The TypeScript implementation is your gold standard. Match its behavior exactly in Go.
