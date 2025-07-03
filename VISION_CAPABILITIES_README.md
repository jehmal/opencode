# DGMO Vision Capabilities

DGMO now supports native vision capabilities, allowing you to include images in your prompts for AI
analysis. This feature works seamlessly with Claude's vision API and other providers that support
multimodal inputs.

## Important Update (July 2025)

The Read tool now properly handles images! Previously, there was a mismatch between the tool's
description (which claimed to support images) and its implementation (which rejected them). This has
been fixed - the Read tool now acknowledges image files and works correctly with DGMO's vision
capabilities.

## How It Works

When you include an image path in your prompt, DGMO automatically:

1. Detects image file paths in your message
2. Reads and encodes the images as base64
3. Sends them along with your text to the AI
4. The AI can then analyze and respond about the images

## Supported Image Formats

- PNG (.png)
- JPEG (.jpg, .jpeg)
- GIF (.gif)
- WebP (.webp)
- BMP (.bmp)

## Usage Examples

### Basic Image Analysis

```bash
dgmo run "Look at this image and tell me what you see: \"screenshot.png\""
```

### Using Backticks

```bash
dgmo run "Analyze `image.jpg` and describe its contents"
```

### Full Path (Windows)

```bash
dgmo run "What is in C:\\Users\\username\\Pictures\\photo.png"
```

### Full Path (WSL/Linux)

```bash
dgmo run "Describe /mnt/c/Users/username/Pictures/photo.png"
```

### Multiple Images

```bash
dgmo run "Compare \"before.png\" and \"after.png\" and tell me what changed"
```

### Relative Paths

```bash
dgmo run "Look at ./screenshots/ui-bug.png and suggest fixes"
```

## Path Formats

DGMO automatically handles various path formats:

- **Quoted paths**: `"path/to/image.png"`
- **Backtick paths**: `` `path/to/image.png` ``
- **Unquoted paths**: `path/to/image.png` (if unambiguous)
- **Windows paths**: `C:\Users\...\image.png`
- **WSL paths**: `/mnt/c/Users/.../image.png`
- **Relative paths**: `./image.png` or `../images/photo.jpg`

## Size Limits

- Maximum image size: 5MB per image
- Images larger than 5MB will show an error message

## Error Handling

If an image cannot be loaded, DGMO will:

1. Show an error message indicating which image failed
2. Continue processing the text portion of your prompt
3. The AI will receive the text without the failed image

## Visual Mode Integration

When using visual mode (`dgmo run --visual`), image paths in visual prompts are also automatically
processed.

## Technical Details

### Implementation

- Images are read using Bun's file API
- Encoded as base64 data URLs
- Sent as `FilePart` messages with proper MIME types
- The AI SDK handles the conversion to provider-specific formats

### File Detection

The system looks for image paths in:

- Double quotes: `"image.png"`
- Single quotes: `'image.png'`
- Backticks: `` `image.png` ``
- Unquoted paths that end with image extensions

### Performance

- Images are loaded asynchronously
- Only images explicitly mentioned in prompts are processed
- No background scanning or indexing occurs

## Examples with Output

### Example 1: Screenshot Analysis

```bash
dgmo run "Look at \"Screenshot 2025-07-03 095403.png\" and tell me what UI elements you see"

📷 Loaded image: Screenshot 2025-07-03 095403.png

I can see a screenshot showing...
```

### Example 2: Error Handling

```bash
dgmo run "Analyze \"nonexistent.png\""

Failed to load image nonexistent.png: Image file not found: nonexistent.png

I cannot see the image you mentioned as it failed to load...
```

## Tips

1. **Use quotes for paths with spaces**: `"My Documents/screenshot.png"`
2. **Relative paths work from current directory**: `./image.png`
3. **Multiple images are processed in order mentioned**
4. **The AI sees images in the order they appear in your message**

## Troubleshooting

### "File not found" errors

- Check the file path is correct
- Ensure the file exists
- Try using an absolute path

### "File too large" errors

- Resize images larger than 5MB
- Use image compression tools
- Consider cropping to relevant portions

### Images not being detected

- Ensure the file has a supported extension
- Use quotes around the path
- Check for typos in the file path

## Future Enhancements

Potential future improvements:

- Automatic image resizing for large files
- Support for more image formats
- Image URL support (not just local files)
- Clipboard image support
- Drag-and-drop in TUI mode
