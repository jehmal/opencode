# Instructions for Next DGMO Vision Completion Agent

You are completing the vision capabilities for DGMO. The TUI implementation is working correctly,
but the Read tool has a critical bug that prevents Claude from seeing images. Your task is to fix
the Read tool and ensure seamless vision support across both CLI and TUI.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT`
- Critical File: `/opencode/packages/opencode/src/tool/read.ts`
- Tool Description: `/opencode/packages/opencode/src/tool/read.txt`
- TUI Implementation: `/opencode/packages/tui/internal/image/` (already working)
- Architecture Doc: `/VISION_CAPABILITIES_README.md`

## Memory Search Commands

First, retrieve the current project state and discovered issues:

1. Search: "DGMO VISION Root Cause and Solution Identified Read tool"
2. Search: "DGMO TUI VISION IMPLEMENTATION COMPLETE image detection encoding"
3. Search: "Read tool multimodal Claude Code implementation mismatch"
4. Search: "vision capabilities tool description implementation"
5. Search: "DGMO PROJECT SNAPSHOT Vision Capabilities Implementation"

## Completed Components (DO NOT MODIFY) ✅

✅ TUI Image Detection - `/opencode/packages/tui/internal/image/detector.go` ✅ TUI Image Encoding -
`/opencode/packages/tui/internal/image/encoder.go` ✅ TUI SendChatMessage - Modified to detect and
send images ✅ CLI Image Handler - `/opencode/packages/opencode/src/util/image-handler.ts` ✅
Message Parts Integration - Images sent as FilePartParam ✅ User Feedback System - Toast
notifications in TUI

## Critical Issue to Fix

### Root Cause

The Read tool (`/opencode/packages/opencode/src/tool/read.ts`) has a mismatch between its
description and implementation:

- **Description** (line 10 of read.txt): "This tool allows OpenCode to read images (eg PNG, JPG,
  etc). When reading an image file the contents are presented visually"
- **Implementation** (lines 65-69): Throws error rejecting image files
- **Result**: Claude tries to use Read for images but gets rejected

### Required Fix

Replace the image rejection code (lines 65-69) with proper handling:

```typescript
// REMOVE THIS:
if (isImage)
  throw new Error(
    `This is an image file of type: ${isImage}\nUse a different tool to process images`,
  );

// REPLACE WITH:
if (imageType) {
  // For now, acknowledge the image and let the message parts handle it
  const stats = await file.stat();
  const sizeKB = Math.round(stats.size / 1024);

  return {
    output: `<image_file>\nType: ${imageType}\nPath: ${filePath}\nSize: ${sizeKB} KB\nStatus: Image file successfully accessed. The image content is being processed through the message context.\n</image_file>`,
    metadata: {
      preview: `${imageType} image file (${sizeKB} KB)`,
      title: path.relative(App.info().path.root, filePath),
    },
  };
}
```

## Required Tasks (USE 3 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Fix Read Tool Implementation

Fix the Read tool to handle images properly:

1. Open `/opencode/packages/opencode/src/tool/read.ts`
2. Locate the image rejection code (lines 65-69)
3. Replace with the image handling code above
4. Ensure the function still compiles correctly
5. Test that text files still work normally

Location: `/opencode/packages/opencode/src/tool/read.ts` Dependencies: None

### Sub-Agent 2: Verify and Test Vision

Create comprehensive tests for vision capabilities:

1. Create test script `/test-vision-complete.sh`
2. Test CLI: `dgmo run "analyze test-image.png"`
3. Test TUI: Instructions for manual testing
4. Test Read tool: Verify it no longer rejects images
5. Test edge cases: Missing files, large files, invalid formats

Location: `/test-vision-complete.sh` Dependencies: Fixed Read tool

### Sub-Agent 3: Update Documentation

Update all documentation to reflect the fix:

1. Update `/VISION_CAPABILITIES_README.md`
2. Update `/TUI_VISION_USAGE_GUIDE.md`
3. Create `/VISION_TROUBLESHOOTING.md` with common issues
4. Document the Read tool fix
5. Add examples of proper usage

Location: Various documentation files Dependencies: Understanding of the fix

## Integration Requirements

1. **Backward Compatibility**: Ensure text file reading still works
2. **Consistent Behavior**: CLI and TUI should handle images identically
3. **Error Handling**: Graceful failures for unsupported formats
4. **User Experience**: Clear feedback when images are processed

## Technical Constraints

- Maintain existing Read tool interface
- Don't break other tools that depend on Read
- Keep file size limits (5MB for images)
- Preserve line number formatting for text files

## Success Criteria

1. Read tool no longer rejects image files
2. Claude can acknowledge images when Read is used
3. Both CLI and TUI vision work seamlessly
4. No regression in text file reading
5. Clear documentation of the fix

## Testing Approach

After implementation:

1. Test Read tool directly with image path
2. Test CLI: `dgmo run "read screenshot.png"`
3. Test TUI: Type "read image.png" in chat
4. Verify Claude acknowledges the image
5. Test mixed content (text + images)
6. Test error cases (missing files, etc.)

## Known Issues & Solutions

- Issue: Tool description/implementation mismatch Solution: Fix implementation to match description

- Issue: Claude expects Read to handle images Solution: Make Read acknowledge images properly

- Issue: Users confused about vision support Solution: Clear documentation and examples

## Important Notes

- The TUI implementation is already working correctly
- The issue is ONLY in the Read tool implementation
- Don't modify the message parts approach - it's working
- Focus on making Read tool match its description
- This is a simple fix with big impact

Start by searching memory for the mentioned queries to understand the full context, then launch your
sub-agents to complete the vision implementation. The goal is to make vision work seamlessly in both
CLI and TUI by fixing the Read tool to match its documented behavior.
