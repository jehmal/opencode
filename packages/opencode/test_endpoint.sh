#!/bin/bash

echo "Testing /continue endpoint directly for session-specific prompts"
echo "==============================================================="
echo ""

# First, let's check if the server is running
SERVER_URL="http://localhost:4096"

echo "Checking if server is running at $SERVER_URL..."
if curl -s "$SERVER_URL/health" > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "❌ Server is not running. Starting it now..."
    cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode
    bun run ./src/index.ts serve &
    SERVER_PID=$!
    echo "Waiting for server to start (PID: $SERVER_PID)..."
    sleep 5
fi

# Create a test session and add messages
echo ""
echo "Creating test sessions with different contexts..."

# Test 1: Create a session about REST API
SESSION_ID_1="test-session-rest-api-$(date +%s)"
echo "Session 1 ID: $SESSION_ID_1"

# Create session
curl -X POST "$SERVER_URL/session/new" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$SESSION_ID_1\"}" \
  -s > /dev/null

# Add messages about REST API
curl -X POST "$SERVER_URL/session/$SESSION_ID_1/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "parts": [{
      "type": "text",
      "text": "Help me implement a REST API for user management with authentication endpoints"
    }],
    "providerID": "test",
    "modelID": "test"
  }' \
  -s > /dev/null

echo "Added REST API context to session 1"

# Test 2: Create a session about WebSocket
SESSION_ID_2="test-session-websocket-$(date +%s)-2"
echo "Session 2 ID: $SESSION_ID_2"

curl -X POST "$SERVER_URL/session/new" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$SESSION_ID_2\"}" \
  -s > /dev/null

curl -X POST "$SERVER_URL/session/$SESSION_ID_2/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "parts": [{
      "type": "text",
      "text": "Debug the WebSocket connection issues in the chat application. The connection keeps dropping."
    }],
    "providerID": "test",
    "modelID": "test"
  }' \
  -s > /dev/null

echo "Added WebSocket context to session 2"

# Now test the continuation prompts
echo ""
echo "Testing continuation prompt generation..."
echo ""

echo "=== Session 1 (REST API) Continuation Prompt ==="
PROMPT_1=$(curl -X POST "$SERVER_URL/session/$SESSION_ID_1/continuation-prompt" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -s | jq -r '.prompt' 2>/dev/null)

if [[ -z "$PROMPT_1" ]]; then
    echo "❌ Failed to generate prompt for session 1"
else
    echo "✅ Generated prompt for session 1"
    echo "First 500 chars:"
    echo "$PROMPT_1" | head -c 500
    echo "..."
    
    # Check for REST API keywords
    if echo "$PROMPT_1" | grep -i -E "REST API|user management|authentication" > /dev/null; then
        echo "✅ Contains REST API related content"
    else
        echo "❌ Missing REST API content"
    fi
fi

echo ""
echo ""
echo "=== Session 2 (WebSocket) Continuation Prompt ==="
PROMPT_2=$(curl -X POST "$SERVER_URL/session/$SESSION_ID_2/continuation-prompt" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -s | jq -r '.prompt' 2>/dev/null)

if [[ -z "$PROMPT_2" ]]; then
    echo "❌ Failed to generate prompt for session 2"
else
    echo "✅ Generated prompt for session 2"
    echo "First 500 chars:"
    echo "$PROMPT_2" | head -c 500
    echo "..."
    
    # Check for WebSocket keywords
    if echo "$PROMPT_2" | grep -i -E "WebSocket|chat application|connection" > /dev/null; then
        echo "✅ Contains WebSocket related content"
    else
        echo "❌ Missing WebSocket content"
    fi
fi

echo ""
echo ""
echo "=== Checking for Dynamic Content ==="

# Check if prompts are different
if [[ "$PROMPT_1" == "$PROMPT_2" ]]; then
    echo "❌ FAIL: Both prompts are identical! They should be different."
else
    echo "✅ PASS: Prompts are different for different sessions"
fi

# Check for hardcoded defaults
if echo "$PROMPT_1 $PROMPT_2" | grep -i "opencode.*AI coding assistant development" > /dev/null; then
    echo "❌ WARNING: Found hardcoded 'opencode' defaults"
else
    echo "✅ No hardcoded defaults found"
fi

# Save full prompts for analysis
echo "$PROMPT_1" > session1_prompt.txt
echo "$PROMPT_2" > session2_prompt.txt

echo ""
echo "Full prompts saved to:"
echo "- session1_prompt.txt (REST API session)"
echo "- session2_prompt.txt (WebSocket session)"

# Clean up
if [[ ! -z "$SERVER_PID" ]]; then
    echo ""
    echo "Stopping test server..."
    kill $SERVER_PID 2>/dev/null || true
fi

echo ""
echo "Test complete!"