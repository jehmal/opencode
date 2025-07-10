#!/bin/bash

# Test script for the improved session busy fix
# This script helps test the message queue behavior with the new activity-based waiting

echo "=== Session Busy Fix Test Script ==="
echo "This script will help you test the improved message queue handling"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Test Scenario 1: Basic Queue Test${NC}"
echo "1. Send a message to the assistant (e.g., 'Tell me a story')"
echo "2. While the assistant is typing, quickly send another message"
echo "3. The second message should show as queued with a toast notification"
echo "4. After the assistant finishes and a quiet period passes, the queued message should send automatically"
echo ""
echo "Expected behavior:"
echo "- No 'Session is busy' errors"
echo "- Queue count displayed in editor"
echo "- Toast notifications for queue status"
echo ""
read -p "Press Enter to continue to next test..."

echo -e "${YELLOW}Test Scenario 2: Rapid Fire Test${NC}"
echo "1. Send a message to the assistant"
echo "2. Quickly send 3-4 more messages while it's responding"
echo "3. All messages should queue up"
echo "4. They should process one by one after quiet periods"
echo ""
echo "Expected behavior:"
echo "- Queue count increases with each message"
echo "- Messages process sequentially"
echo "- No errors between messages"
echo ""
read -p "Press Enter to continue to next test..."

echo -e "${YELLOW}Test Scenario 3: Long Response Test${NC}"
echo "1. Send a message that generates a long response (e.g., 'Write a detailed guide about Go programming')"
echo "2. Queue a message early in the response"
echo "3. The queued message should wait for ALL updates to finish"
echo ""
echo "Expected behavior:"
echo "- Queue waits for the full quiet period (800ms) after last update"
echo "- No premature sending while backend is still processing"
echo ""
read -p "Press Enter to view debug instructions..."

echo -e "${YELLOW}Debug Mode Instructions${NC}"
echo "To see detailed timing information, run dgmo with debug logging:"
echo ""
echo "  SLOG_LEVEL=debug ./dgmo"
echo ""
echo "Look for these log messages:"
echo "- 'Session is busy, retrying...' - Shows retry attempts"
echo "- 'Session quiet period reached' - Shows when queue processing starts"
echo "- 'Max wait time reached' - Shows if failsafe triggered"
echo ""

echo -e "${GREEN}Key Improvements in This Fix:${NC}"
echo "1. Activity-based waiting (not just Time.Completed)"
echo "2. 800ms quiet period ensures backend is truly idle"
echo "3. 5 second max wait time prevents hanging"
echo "4. Improved retry logic with gentler backoff"
echo ""

echo "Happy testing! 🚀"