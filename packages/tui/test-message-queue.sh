#!/bin/bash

# Test script for message queue busy error fix
# This script helps verify that queued messages are sent successfully

echo "Message Queue Busy Error Test"
echo "============================="
echo ""
echo "Instructions:"
echo "1. Start the TUI: go run cmd/dgmo/main.go"
echo "2. Send a message to the assistant (e.g., 'Tell me a long story')"
echo "3. While the assistant is responding, quickly type another message and press Enter"
echo "4. You should see a toast: 'Message queued (1 in queue). Will send when assistant finishes.'"
echo "5. When the assistant completes, watch for:"
echo "   - Toast: 'Sending queued message... (0 remaining)'"
echo "   - The queued message should be sent automatically"
echo "   - NO 'Session is busy' error should appear"
echo ""
echo "Expected log output:"
echo "- INFO: 'Session is busy, retrying...' (if retry logic triggers)"
echo "- NO ERROR: 'failed to send message: ... is busy'"
echo ""
echo "Press Ctrl+C to exit when done testing."