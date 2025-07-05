#!/bin/bash
# Run TUI with maximum debug output

echo "=== RUNNING TUI WITH DEBUG OUTPUT ==="
echo ""

cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode

# Set debug environment variables
export DEBUG=*
export OPENCODE_DEBUG=true
export OPENCODE_LOG_LEVEL=debug

# Ensure the binary exists
if [ ! -f "packages/tui/dgmo-fixed" ]; then
    echo "Building TUI first..."
    cd packages/tui
    go build -o dgmo-fixed cmd/dgmo/main.go
    cd ../..
fi

# Show current directory structure
echo "Current directory structure:"
ls -la .opencode/ 2>/dev/null || echo ".opencode not found"
echo ""

# Try to run with explicit config
echo "Starting TUI with debug output..."
./packages/tui/dgmo-fixed 2>&1 | tee dgmo-debug.log
