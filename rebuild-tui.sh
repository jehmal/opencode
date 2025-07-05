#!/bin/bash
# Script to rebuild the TUI with the sub-sessions fix

echo "=== REBUILDING TUI WITH SUB-SESSIONS FIX ==="
echo ""

# Navigate to the TUI directory
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui

# Build the TUI
echo "Building TUI..."
go build -o dgmo cmd/dgmo/main.go

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "The fixed TUI binary is at: $(pwd)/dgmo"
    echo ""
    echo "To use it:"
    echo "1. Copy to your PATH: sudo cp dgmo /usr/local/bin/"
    echo "2. Or run directly: ./dgmo"
    echo ""
    echo "The fix includes:"
    echo "- Fetches direct children of current session"
    echo "- Fetches siblings if in a child session"
    echo "- Shows all sub-sessions as fallback"
    echo "- Labels each sub-session with context (direct/sibling/all)"
else
    echo "❌ Build failed. Please check for Go compilation errors."
fi
