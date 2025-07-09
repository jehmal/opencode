#!/bin/bash

# Test the continuation prompt API and monitor WebSocket events

echo "Testing continuation prompt API..."
echo "================================"

# Get session ID from command line or use a default
SESSION_ID=${1:-"test-session-id"}
SERVER_URL=${DGMO_SERVER:-"http://localhost:3000"}

echo "Using session ID: $SESSION_ID"
echo "Server URL: $SERVER_URL"
echo ""

# Start WebSocket monitor in background
echo "Starting WebSocket event monitor..."
node test-continue-events.js > ws-events.log 2>&1 &
WS_PID=$!
sleep 2

# Make the API request
echo "Making continuation prompt request..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  "${SERVER_URL}/session/${SESSION_ID}/continuation-prompt")

# Extract status code and response body
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo ""
echo "HTTP Status Code: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"

# Extract task ID from response
if [ "$HTTP_CODE" = "200" ]; then
    TASK_ID=$(echo "$BODY" | jq -r '.taskId // empty' 2>/dev/null)
    if [ ! -z "$TASK_ID" ]; then
        echo ""
        echo "Task ID: $TASK_ID"
        echo "Waiting 5 seconds for WebSocket events..."
        sleep 5
    fi
fi

# Stop WebSocket monitor
kill $WS_PID 2>/dev/null

# Show captured events
echo ""
echo "Captured WebSocket events:"
echo "=========================="
grep -E "task\.(started|progress|completed)" ws-events.log | grep -v heartbeat || echo "No task events captured"

# Show continuation-specific events
echo ""
echo "Continuation-specific events:"
echo "============================="
grep "continuation" ws-events.log || echo "No continuation events found"

# Cleanup
rm -f ws-events.log