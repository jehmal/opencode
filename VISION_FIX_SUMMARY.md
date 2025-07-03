# DGMO Vision Fix Summary

## Root Cause Discovered

The issue is a **mismatch between tool description and implementation**:

1. **Tool Description** (`read.txt`): Says "This tool allows OpenCode to read images (eg PNG, JPG,
   etc). When reading an image file the contents are presented visually"

2. **Tool Implementation** (`read.ts`): Explicitly rejects images with error "This is an image file
   of type: PNG\nUse a different tool to process images"

3. **Claude's Expectation**: When Claude sees an image path, it tries to use the Read tool because
   the description says it handles images

4. **Current Behavior**: Read tool rejects the image, so Claude can't see it even though our TUI
   successfully loaded and sent it

## The Solution

We need to fix the Read tool to match its description. The tool should handle images properly
instead of rejecting them.

### Option 1: Simple Fix (Recommended)

Remove the image rejection in `read.ts` and return a success message:

```typescript
// Instead of throwing error for images
if (imageType) {
  return {
    output: `<image_file>\nType: ${imageType}\nPath: ${filePath}\nStatus: Image loaded successfully\n</image_file>`,
    metadata: {
      preview: `${imageType} image file`,
      title: path.relative(App.info().path.root, filePath),
    },
  };
}
```

### Option 2: Full Multimodal Support

Make the Read tool truly multimodal by having it send image data directly (requires deeper
integration with the session/message system).

## Why Our Current Approach Fails

1. We intercept image paths and send them as message parts
2. Claude still sees the image path in the text
3. Claude tries to use Read tool (as trained/expected)
4. Read tool rejects the image
5. Claude reports it can't see images

## Quick Fix for Users

Until the Read tool is properly fixed, users can:

1. **Don't use "Read" command** - Just describe what you want: "analyze this image" instead of "read
   this image"
2. **Use direct questions** - "what do you see in screenshot.png?"
3. **Switch to Claude 3 models** - They may handle vision differently

## Implementation Status

- ✅ TUI correctly detects image paths
- ✅ TUI successfully loads and encodes images
- ✅ TUI sends images as message parts
- ❌ Read tool rejects images (needs fix)
- ❌ Tool description doesn't match implementation

The fix is straightforward - make the Read tool implementation match its description by handling
images instead of rejecting them.
