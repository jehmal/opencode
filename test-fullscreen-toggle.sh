#!/bin/bash

# Test script for fullscreen toggle functionality

echo "Testing Fullscreen Toggle for Bubble Tea TUI"
echo "============================================"
echo ""
echo "FIXED ISSUES:"
echo "1. Initial state now matches actual screen mode (isAltScreen = true)"
echo "2. Commands now use tea.EnterAltScreen/tea.ExitAltScreen directly"
echo "3. Toast messages correctly reflect the state"
echo ""
echo "TEST INSTRUCTIONS:"
echo "1. The app starts in alternate screen mode (fullscreen)"
echo "2. Press Shift+Tab to toggle"
echo "3. First press: Should show 'Fullscreen mode disabled' and exit alt screen"
echo "4. Second press: Should show 'Fullscreen mode enabled' and enter alt screen"
echo ""
echo "WHAT TO VERIFY:"
echo "- Screen actually changes between normal and alternate modes"
echo "- Toast notifications match the actual state"
echo "- Terminal is restored properly when exiting alt screen"
echo "- App functionality continues to work in both modes"
echo ""
echo "Building and running DGMO..."
echo ""

cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui
go build -o dgmo-test cmd/dgmo/main.go
if [ $? -eq 0 ]; then
    echo "Build successful! Starting DGMO..."
    ./dgmo-test
else
    echo "Build failed. Please check the error messages above."
fi