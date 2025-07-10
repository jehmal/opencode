#!/bin/bash

# Test script to debug SSE event handling in DGMO TUI

echo "Testing SSE Event Handling in DGMO TUI"
echo "======================================"
echo ""
echo "This test will:"
echo "1. Start DGMO with debug logging"
echo "2. Monitor SSE events being received"
echo "3. Help diagnose why messages aren't appearing"
echo ""
echo "Starting DGMO with debug logging..."
echo ""

# Enable debug logging
export DGMO_LOG_LEVEL=debug

# Run DGMO and capture logs
./dgmo 2>&1 | grep -E "SSE|Event|Message|context canceled" | tee dgmo-sse-debug.log &

echo ""
echo "DGMO started with PID $!"
echo ""
echo "Monitoring for SSE events..."
echo "Send a message in the TUI and watch for events here."
echo ""
echo "Press Ctrl+C to stop monitoring."
echo ""

# Keep the script running
wait