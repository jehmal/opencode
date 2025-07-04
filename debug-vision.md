# Vision Debug Analysis

## Issue

Claude Opus 4 is using the Read tool instead of its vision capabilities when given an image path.

## Root Cause Analysis

1. **What's Happening:**

   - User types: "what do you see in this image C:\Users\jehma\Desktop\AI\DGMSTT\Screenshot
     2025-07-03 095403.png"
   - TUI correctly detects the image path
   - TUI encodes the image as base64
   - TUI sends both text AND FilePartParam
   - Claude sees the text with the file path
   - Claude tries to "Read" the file path instead of using the provided image

2. **Why This Happens:**
   - Claude is trained to use tools when it sees file paths in text
   - The phrase "what do you see in this image [path]" triggers tool usage
   - Claude doesn't realize the image is already provided as a FilePartParam

## Solution

The fix is to modify the text sent to Claude to remove or mask the file path after the image is
loaded:

```go
// In app.go SendChatMessage function
// After loading images successfully, modify the text to remove paths
cleanedText := text
for _, imgPath := range imagePaths {
    // Replace the full path with just a reference
    cleanedText = strings.ReplaceAll(cleanedText, imgPath, "[image]")
}

// Then use cleanedText instead of text in the TextPartParam
parts := []opencode.MessagePartUnionParam{
    opencode.TextPartParam{
        Type: opencode.F(opencode.TextPartTypeText),
        Text: opencode.F(cleanedText), // Use cleaned text
    },
}
```

## Alternative Solutions

1. **Instruction Prepending:** Add instructions to the text: "I've attached an image for you to
   analyze. " + text

2. **Path Removal:** Simply remove all file paths from the text after detecting them

3. **Context Hint:** Replace paths with "[see attached image]" or similar

## Testing the Fix

After implementing, test with:

- "what do you see in C:\Users\jehma\Desktop\AI\DGMSTT\Screenshot 2025-07-03 095403.png"
- Should become: "what do you see in [image]"
- Claude will use vision on the attached FilePartParam instead of trying to read the file
