# DGMO TUI Vision Usage Guide

## Important Update (July 2025)

The Read tool now properly handles images! Previously it would reject image files, but this has been
fixed. However, for best results, we still recommend using natural language commands like "analyze"
or "look at" instead of "read" when working with images.

## How to Use Images in DGMO TUI

### ✅ Correct Usage

When you want Claude to analyze an image, simply mention the image path in your message naturally:

```
# Good examples:
analyze screenshot.png
look at C:\Users\name\Desktop\photo.jpg
what's in image.png?
compare before.png and after.png
check "my image.png" for issues
```

### ❌ Avoid These Patterns

Don't use "Read" or file-reading commands with images:

```
# Bad examples (will trigger file reading tool):
Read screenshot.png
read image.jpg
cat photo.png
```

The word "Read" triggers Claude's file reading tool, which is designed for text files only and will
show an error for images.

### What Happens Behind the Scenes

1. **Detection**: DGMO automatically detects image paths in your message
2. **Loading**: Images are loaded and encoded to base64
3. **Feedback**: You'll see toast notifications:
   - "Processing X image(s)..." when starting
   - "✅ Successfully loaded X image(s)" when complete
   - "⚠️ Loaded X of Y image(s)" if some fail
4. **Display**: Your message shows with 📎 indicators for each image
5. **Analysis**: Claude receives the images and can analyze them

### Supported Formats

- PNG (.png)
- JPEG (.jpg, .jpeg)
- GIF (.gif)
- WebP (.webp)
- BMP (.bmp)

### Path Formats

All these path formats work:

- Relative: `screenshot.png`, `images/photo.jpg`
- Absolute Unix: `/home/user/image.png`
- Absolute Windows: `C:\Users\name\photo.jpg`
- WSL: `/mnt/c/Users/name/image.png`

### Size Limits

- Maximum 5MB per image (Claude API limit)
- Multiple images supported in one message

### Troubleshooting

**Issue**: "I cannot see images in file paths" or Claude tries to read the file

- **Cause 1**: Using a model that doesn't support vision (e.g., Claude Opus 4)
- **Fix**: Switch to a vision-capable model:
  - Claude 3 Sonnet (`claude-3-5-sonnet-20241022`)
  - Claude 3 Opus (`claude-3-opus-20240229`)
  - GPT-4 Vision (`gpt-4-vision-preview`)
  - GPT-4o (`gpt-4o`)
- **Cause 2**: Used "Read" command which triggers text file reader
- **Fix**: Just mention the image path without "Read"

**Issue**: "Model does not support vision" error

- **Cause**: Current model cannot analyze images
- **Fix**: Change model in settings or use `/model` command to switch

**Issue**: "Failed to load image"

- **Cause**: File not found or path incorrect
- **Fix**: Check the file exists and path is correct

**Issue**: Image too large

- **Cause**: File exceeds 5MB limit
- **Fix**: Resize or compress the image

### Vision-Capable Models

These models support image analysis:

- **Claude 3 Family**: All Claude 3 models (Haiku, Sonnet, Opus)
- **GPT-4 Vision**: gpt-4-vision-preview, gpt-4-turbo, gpt-4o
- **Gemini**: gemini-pro-vision, gemini-1.5-pro

These models do NOT support vision:

- **Claude Opus 4**: Text-only model
- **Claude 2**: Text-only model
- **GPT-3.5**: Text-only model

### Examples

```bash
# Start DGMO TUI
dgmo

# Then type:
analyze Screenshot 2025-07-03 095403.png
# or
what do you see in C:\Users\jehma\Desktop\screenshot.png?
# or
explain the diagram in architecture.png
```

The key is to treat images naturally in your conversation - just mention them like you would in a
chat!
