#!/bin/bash

echo "Testing TUI Fullscreen Toggle Fix"
echo "================================="
echo ""
echo "Expected behavior:"
echo "1. App starts in NORMAL mode (you can see this message)"
echo "2. Press Shift+Tab to ENABLE fullscreen (screen clears)"
echo "3. Press Shift+Tab again to DISABLE fullscreen (return to normal)"
echo ""
echo "The toast messages should say:"
echo "- First press: 'Fullscreen mode enabled'"
echo "- Second press: 'Fullscreen mode disabled'"
echo ""
echo "Starting TUI in 3 seconds..."
sleep 3

cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui
./dgmo-test