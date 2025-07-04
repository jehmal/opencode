# Vision Fix Complete - OpenCode TUI

## What Was Fixed

The issue was that Claude was trying to use the Read tool when it saw file paths in the text,
instead of using the images that were already attached. The fix modifies the text sent to Claude by
replacing file paths with `[image]` after successfully loading the images.

## How It Works Now

1. User types:
   `what do you see in C:\Users\jehma\Desktop\AI\DGMSTT\Screenshot 2025-07-03 095403.png`
2. TUI detects the image path
3. TUI loads and encodes the image as base64
4. TUI replaces the path in the text with `[image]`
5. Claude receives: `what do you see in [image]` + the actual image data
6. Claude uses its vision capabilities instead of trying to read the file

## Technical Changes

In `/opencode/packages/tui/internal/app/app.go`:

- Images are processed first to determine which ones loaded successfully
- Successfully loaded image paths are tracked
- The original text is cleaned by replacing all loaded image paths with `[image]`
- This prevents Claude from seeing the file path and trying to use the Read tool

## Usage Examples

### Good Patterns (Will Work)

- "analyze this screenshot C:\Users\name\image.png"
- "what's in /home/user/photo.jpg"
- "look at 'my image.png'"
- "explain this diagram screenshot.png"

### What NOT to Do

- Don't use "Read" in your prompt (e.g., "Read this image")
- This will still trigger the Read tool

## Testing the Fix

1. Build the TUI:

   ```bash
   cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui
   go build ./cmd/dgmo
   ```

2. Run DGMO:

   ```bash
   ./dgmo
   ```

3. Type a message with an image path:

   ```
   what do you see in C:\Users\jehma\Desktop\AI\DGMSTT\Screenshot 2025-07-03 095403.png
   ```

4. You should see:
   - Toast: "Processing 1 image(s)..."
   - Your message with 📎 indicator
   - Toast: "✅ Successfully loaded 1 image(s)"
   - Claude analyzing the actual image content

## How to Verify It's Working

- Claude should describe what's IN the image, not just acknowledge it exists
- You should NOT see Claude using the Read tool
- The response should contain visual descriptions

## Troubleshooting

If vision still doesn't work:

1. Make sure you're using a vision-capable model (Claude Opus, Sonnet, etc.)
2. Check that the image file exists and is under 5MB
3. Ensure the image format is supported (PNG, JPG, GIF, WebP, BMP)
4. Try with a simple filename first, then test with full paths

## Summary

The vision capabilities are now fully restored with a fix that prevents Claude from trying to read
image files as text. The implementation:

- ✅ Detects images in text
- ✅ Loads and encodes images
- ✅ Cleans text to prevent tool usage
- ✅ Sends images as FilePartParam
- ✅ Works with all path formats
