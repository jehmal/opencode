#!/bin/bash

echo "=== Simple /continue Command Test ==="
echo ""
echo "Testing dgmo-debug with /continue command"
echo ""

# Check if dgmo-debug exists
if [ ! -f "./dgmo-debug" ]; then
    echo "Building dgmo-debug..."
    go build -o dgmo-debug ./cmd/dgmo/
fi

echo "Instructions:"
echo "1. The TUI will start"
echo "2. Type a test message like 'hello'"
echo "3. Wait for response"
echo "4. Type '/continue'"
echo "5. Watch for the continuation prompt generation"
echo "6. Press Ctrl+C to exit"
echo ""
echo "Starting dgmo-debug..."
echo ""

# Run dgmo-debug
./dgmo-debug