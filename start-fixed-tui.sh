#!/bin/bash
# Simple TUI startup script

echo "=== STARTING FIXED DGMO TUI ==="
echo ""

# Ensure we're in the opencode directory (where the app expects to be)
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode

# Check if the fixed binary exists
if [ ! -f "packages/tui/dgmo-fixed" ]; then
    echo "Building fixed TUI first..."
    cd packages/tui
    go build -o dgmo-fixed cmd/dgmo/main.go
    cd ../..
fi

# Set any necessary environment variables
export OPENCODE_ROOT=/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode

# Run the fixed TUI
echo "Starting TUI from: $(pwd)"
echo "Watch for [SUB-SESSION FIX] messages in the output"
echo ""

exec ./packages/tui/dgmo-fixed
