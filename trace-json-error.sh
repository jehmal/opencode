#!/bin/bash
# Trace exactly what file is causing the JSON error

echo "=== TRACING JSON ERROR SOURCE ==="
echo ""

cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode

# Use strace to see what file the TUI is trying to read
echo "Running TUI with strace to see file operations..."
echo "(Looking for the file read just before the JSON error)"
echo ""

# Build first if needed
if [ ! -f "packages/tui/dgmo-fixed" ]; then
    cd packages/tui
    go build -o dgmo-fixed cmd/dgmo/main.go
    cd ../..
fi

# Run with strace, filtering for file operations
strace -e trace=open,openat,read -f ./packages/tui/dgmo-fixed 2>&1 | grep -B5 -A5 "JSON"
