#!/bin/bash

# Test script to verify real-time message rendering in TUI
# This script builds the TUI and tests that messages appear in real-time

echo "=== Testing Real-Time Message Rendering Fix ==="

# Navigate to TUI directory
cd packages/tui

# Build the TUI
echo "1. Building TUI with fix..."
go build -o dgmo-test cmd/dgmo/main.go
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
echo "✅ Build successful"

echo ""
echo "2. To test real-time rendering:"
echo "   a) Start the opencode server in one terminal: cd packages/opencode && npm run dev"
echo "   b) Run the TUI in another terminal: cd packages/tui && ./dgmo-test"
echo "   c) Type a message and press Enter"
echo "   d) Observe that Claude's response appears character-by-character in real-time"
echo ""
echo "Expected behavior:"
echo "- Messages should appear immediately as they stream from the server"
echo "- No need to press any keys or move the cursor to see updates"
echo "- The viewport should auto-scroll to show new content"
echo ""
echo "The fix works by:"
echo "1. Returning a nil message in a tea.Batch() command"
echo "2. This forces BubbleTea to call the View() method"
echo "3. The View() method re-renders the entire UI with updated content"