#!/bin/bash

echo "Automated test for /continue command dynamic prompt generation"
echo "============================================================="

# Start dgmo in tmux
echo "Starting dgmo in tmux..."
tmux new-session -d -s dgmo_test
tmux send-keys -t dgmo_test "cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui && ./cmd/dgmo/dgmo" C-m
sleep 5

# Test 1: REST API Session
echo ""
echo "Test 1: Creating session about REST API development..."
tmux send-keys -t dgmo_test "Help me implement a REST API for user management with authentication" C-m
sleep 10

echo "Running /continue command for REST API session..."
tmux send-keys -t dgmo_test "/continue" C-m
sleep 8

# Capture the screen to see the prompt
tmux capture-pane -t dgmo_test -p > test1_output.txt
echo "Test 1 output saved to test1_output.txt"

# Create new session
echo ""
echo "Creating new session..."
tmux send-keys -t dgmo_test "/new" C-m
sleep 3

# Test 2: WebSocket Session
echo "Test 2: Creating session about WebSocket debugging..."
tmux send-keys -t dgmo_test "Debug the WebSocket connection issues in the chat application" C-m
sleep 10

echo "Running /continue command for WebSocket session..."
tmux send-keys -t dgmo_test "/continue" C-m
sleep 8

# Capture the screen
tmux capture-pane -t dgmo_test -p > test2_output.txt
echo "Test 2 output saved to test2_output.txt"

# Create new session
echo ""
echo "Creating new session..."
tmux send-keys -t dgmo_test "/new" C-m
sleep 3

# Test 3: Unit Testing Session
echo "Test 3: Creating session about unit testing..."
tmux send-keys -t dgmo_test "Write comprehensive unit tests for the payment processing module" C-m
sleep 10

echo "Running /continue command for unit testing session..."
tmux send-keys -t dgmo_test "/continue" C-m
sleep 8

# Capture the screen
tmux capture-pane -t dgmo_test -p > test3_output.txt
echo "Test 3 output saved to test3_output.txt"

# Analysis
echo ""
echo "Analyzing results..."
echo "==================="

# Check if outputs contain session-specific content
echo ""
echo "Test 1 - REST API Session:"
if grep -i "REST API\|user management\|authentication" test1_output.txt > /dev/null; then
    echo "✅ Contains REST API related content"
else
    echo "❌ Missing REST API content"
fi

echo ""
echo "Test 2 - WebSocket Session:"
if grep -i "WebSocket\|chat application\|connection" test2_output.txt > /dev/null; then
    echo "✅ Contains WebSocket related content"
else
    echo "❌ Missing WebSocket content"
fi

echo ""
echo "Test 3 - Unit Testing Session:"
if grep -i "unit test\|payment\|processing" test3_output.txt > /dev/null; then
    echo "✅ Contains unit testing related content"
else
    echo "❌ Missing unit testing content"
fi

# Check for hardcoded defaults
echo ""
echo "Checking for hardcoded defaults..."
if grep -i "opencode.*AI coding assistant development" test1_output.txt test2_output.txt test3_output.txt > /dev/null; then
    echo "❌ WARNING: Found hardcoded 'opencode' defaults - fix may not be working"
else
    echo "✅ No hardcoded defaults found"
fi

# Clean up
echo ""
echo "Cleaning up..."
tmux kill-session -t dgmo_test 2>/dev/null || true

echo ""
echo "Test complete! Check the output files for detailed results:"
echo "- test1_output.txt (REST API session)"
echo "- test2_output.txt (WebSocket session)"
echo "- test3_output.txt (Unit testing session)"