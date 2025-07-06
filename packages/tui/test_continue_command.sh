#!/bin/bash

echo "=== Testing /continue Command Integration ==="
echo "This script will test the WebSocket connection and real-time updates"
echo ""

# Check if server is running
echo "1. Checking if server is running..."
if curl -s http://localhost:5747/health > /dev/null 2>&1; then
    echo "✅ WebSocket server is accessible on port 5747"
else
    echo "❌ WebSocket server is not accessible. Make sure the server is running."
    echo "   Run: cd ../opencode && bun run dev"
    exit 1
fi

echo ""
echo "2. Testing WebSocket connection..."
# Use wscat or websocat if available
if command -v wscat &> /dev/null; then
    echo "Using wscat to test WebSocket..."
    timeout 2 wscat -c ws://localhost:5747 2>&1 | head -5
elif command -v websocat &> /dev/null; then
    echo "Using websocat to test WebSocket..."
    timeout 2 websocat ws://localhost:5747 2>&1 | head -5
else
    echo "⚠️  No WebSocket client found. Install wscat with: npm install -g wscat"
fi

echo ""
echo "3. Instructions for manual testing:"
echo "   a) Start the TUI: ./cmd/dgmo/dgmo"
echo "   b) Type '/continue' in the chat"
echo "   c) You should see:"
echo "      - Initial toast: 'Generating continuation prompt...'"
echo "      - Progress update: 'Analyzing project state...' (25%)"
echo "      - Progress update: 'Generating handoff instructions...' (75%)"
echo "      - Success toast: 'Prompt Generated & Copied' with stats"
echo "      - Prompt automatically copied to clipboard"
echo ""
echo "4. Expected timing:"
echo "   - Initial response: < 2 seconds"
echo "   - Progress updates: visible at 1s and 2.5s"
echo "   - Total completion: < 5 seconds"
echo ""
echo "5. Debugging tips:"
echo "   - Check TUI logs for WebSocket connection status"
echo "   - Monitor server logs for task event emissions"
echo "   - Use browser DevTools on ws://localhost:5747 to see events"