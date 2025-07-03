# DGMO Vision Troubleshooting Guide

This guide helps resolve common issues with DGMO's vision capabilities.

## Read Tool Fix (July 2025)

### Previous Issue

The Read tool had a mismatch between its description and implementation:

- **Description**: "This tool allows OpenCode to read images"
- **Implementation**: Threw error rejecting image files
- **Result**: Claude would try to use Read for images but get rejected

### Current Status: FIXED ✅

The Read tool now properly handles images:

- Detects image files by extension
- Returns acknowledgment instead of error
- Works seamlessly with vision capabilities

## Common Issues and Solutions

### 1. "I cannot see images" Error

**Symptoms**: Claude says it cannot see images despite successful loading

**Causes & Solutions**:

#### Wrong Model

- **Issue**: Using a non-vision model (e.g., Claude 2, GPT-3.5)
- **Solution**: Switch to a vision-capable model:
  - Claude 3 Family (Haiku, Sonnet, Opus)
  - Claude 3.5 Sonnet
  - GPT-4 Vision, GPT-4 Turbo, GPT-4o
  - Gemini Pro Vision

#### Using "Read" Command in TUI

- **Issue**: Typing "Read image.png" triggers text file reader
- **Solution**: Use these commands instead:
  - "analyze image.png"
  - "look at image.png"
  - "what's in image.png?"
  - "describe image.png"

### 2. Image Not Loading

**Symptoms**: "Failed to load image" error

**Solutions**:

1. **Check file exists**: `ls -la image.png`
2. **Use absolute path**: `/full/path/to/image.png`
3. **Check file size**: Must be under 5MB
4. **Verify extension**: Must be .png, .jpg, .jpeg, .gif, .webp, or .bmp

### 3. TUI Feedback Issues

**Symptoms**: No visual confirmation of image loading in TUI

**Expected Behavior**:

- Toast notification: "Processing X image(s)..."
- Success message: "✅ Successfully loaded X image(s)"
- Message shows: "📎 Image: filename.png"

**If Missing**:

- Update to latest DGMO version
- Check TUI logs for errors
- Ensure using vision-capable model

### 4. Path Format Issues

**Windows Users**:

```bash
# Correct formats:
dgmo run "analyze C:\\Users\\name\\image.png"
dgmo run "analyze \"C:\\Users\\name\\My Pictures\\image.png\""

# WSL format also works:
dgmo run "analyze /mnt/c/Users/name/image.png"
```

**Linux/Mac Users**:

```bash
# Correct formats:
dgmo run "analyze /home/user/image.png"
dgmo run "analyze ~/Desktop/screenshot.png"
dgmo run "analyze ./relative/path/image.png"
```

### 5. Multiple Images Not Working

**Issue**: Only first image is processed

**Solution**: Ensure all paths are properly quoted:

```bash
dgmo run "compare \"image1.png\" and \"image2.png\""
```

## Debugging Steps

### 1. Test Read Tool

```bash
# This should now work (not throw error):
dgmo run "read test-image.png"
```

### 2. Test Direct Analysis

```bash
# This should analyze the image:
dgmo run "analyze test-image.png"
```

### 3. Check Model Capabilities

```bash
# Verify your model supports vision:
dgmo run "do you support image analysis?"
```

### 4. Enable Debug Logging

For TUI issues, check the logs to see what's being sent to the API.

## Model-Specific Notes

### Claude 3 Models

- All Claude 3 variants support vision
- Best results with Sonnet or Opus
- Haiku is faster but less detailed

### GPT-4 Vision

- Requires "gpt-4-vision-preview" or "gpt-4-turbo"
- Regular "gpt-4" does NOT support vision

### Gemini

- Use "gemini-pro-vision" specifically
- Regular "gemini-pro" is text-only

## Quick Fixes

### Reset and Test

```bash
# 1. Create test image
echo "test" > test.txt && convert -size 100x100 xc:blue test.png 2>/dev/null || touch test.png

# 2. Test CLI
dgmo run "analyze test.png"

# 3. Test TUI
dgmo  # Then type: analyze test.png
```

### Verify Installation

```bash
# Check Read tool has image support
grep -n "isImageFile" /path/to/opencode/packages/opencode/src/tool/read.ts
```

## Still Having Issues?

1. **Update DGMO**: Ensure you have the latest version
2. **Check Logs**: Look for error messages in console output
3. **File Issue**: Report at https://github.com/sst/dgmo/issues with:
   - Exact command used
   - Error message received
   - Model being used
   - DGMO version

## Summary

Most vision issues are resolved by:

1. Using a vision-capable model
2. Avoiding "Read" command for images
3. Ensuring proper path formatting
4. Keeping images under 5MB

The Read tool fix ensures that even if you use "read image.png", it will no longer throw an error,
making the system more robust and user-friendly.
