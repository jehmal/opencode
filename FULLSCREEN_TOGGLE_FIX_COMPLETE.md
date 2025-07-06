# TUI Fullscreen Toggle Fix - Complete

## Changes Made

### 1. Fixed main.go initialization

**File**: `/packages/tui/cmd/dgmo/main.go`

- **Removed**: `tea.WithAltScreen()` from the program initialization
- **Result**: App now starts in normal terminal mode instead of alternate screen mode

### 2. Fixed initial state in tui.go

**File**: `/packages/tui/internal/tui/tui.go`

- **Changed**: `isAltScreen: true` to `isAltScreen: false` in NewModel function
- **Result**: Internal state now matches the actual screen mode on startup

### 3. Toast messages already correct

- The toast messages were already using "Fullscreen mode enabled/disabled" terminology
- No changes needed here

## Expected Behavior

1. **App Start**: Normal terminal mode (can see previous commands)
2. **First Shift+Tab**: Shows "Fullscreen mode enabled" toast and enters fullscreen
3. **Second Shift+Tab**: Shows "Fullscreen mode disabled" toast and returns to normal

## Testing

Run the test script to verify:

```bash
./test-fullscreen-fix.sh
```

Or test manually:

```bash
cd packages/tui
./dgmo-test
```

## Technical Details

The fix addresses two key issues:

1. The app was starting with `tea.WithAltScreen()` which immediately put it in alternate screen mode
2. The internal `isAltScreen` flag was initialized to `true`, causing the first toggle to exit instead of enter

Now both are aligned to start in normal mode (false state), making the first Shift+Tab correctly enable fullscreen mode.
