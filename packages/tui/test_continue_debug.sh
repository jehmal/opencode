#!/bin/bash

echo "=== Debug Test for /continue Command ==="
echo "This script tests the continuation prompt flow with debug logging"
echo ""

# Build the TUI with the latest changes
echo "1. Building TUI with debug logging..."
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui
go build -o dgmo-debug ./cmd/dgmo/

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"
echo ""

echo "2. Setting up debug environment..."
export DGMO_DEBUG=true
export DGMO_SERVER="http://localhost:5747"

echo ""
echo "3. Starting TUI with debug logging..."
echo "   Watch for [CONTINUATION DEBUG] log entries"
echo ""
echo "Steps to test:"
echo "1. Start the TUI: ./dgmo-debug 2>&1 | grep -E 'CONTINUATION DEBUG|ERROR|WARN'"
echo "2. Type or select a session"
echo "3. Type '/continue' and press Enter"
echo ""
echo "Expected debug log sequence:"
echo "- [CONTINUATION DEBUG] Command triggered"
echo "- [CONTINUATION DEBUG] Server response received"
echo "- [CONTINUATION DEBUG] Prompt completed, waiting for task"
echo "- [CONTINUATION DEBUG] TaskStartedMsg received"
echo "- [CONTINUATION DEBUG] TaskProgressMsg for continuation task"
echo "- [CONTINUATION DEBUG] TaskCompletedMsg received"
echo "- [CONTINUATION DEBUG] Matched continuation task! Creating new session"
echo ""
echo "If timeout occurs:"
echo "- [CONTINUATION DEBUG] Timeout waiting for TaskCompletedMsg"
echo ""
echo "Run: ./dgmo-debug 2>&1 | tee debug.log | grep -E 'CONTINUATION|ERROR|WARN'"