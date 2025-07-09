#!/bin/bash

echo "Testing Dynamic Continuation Prompts with Real Sessions"
echo "======================================================"
echo ""

SERVER_URL="http://localhost:4096"

# Create Session 1 - REST API
echo "Creating Session 1 (REST API)..."
SESSION1_RESPONSE=$(curl -X POST "$SERVER_URL/session" -H "Content-Type: application/json" -d '{}' -s)
SESSION1_ID=$(echo "$SESSION1_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Session 1 ID: $SESSION1_ID"

# Add messages about REST API
echo "Adding REST API conversation..."
curl -X POST "$SERVER_URL/session/$SESSION1_ID/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "parts": [{"type": "text", "text": "Help me implement a REST API for user management with authentication. I need endpoints for /register, /login, /profile, and /logout."}],
    "providerID": "anthropic",
    "modelID": "claude-3-5-sonnet-20241022"
  }' -s > /dev/null

sleep 2

# Create Session 2 - WebSocket
echo ""
echo "Creating Session 2 (WebSocket)..."
SESSION2_RESPONSE=$(curl -X POST "$SERVER_URL/session" -H "Content-Type: application/json" -d '{}' -s)
SESSION2_ID=$(echo "$SESSION2_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Session 2 ID: $SESSION2_ID"

# Add messages about WebSocket
echo "Adding WebSocket conversation..."
curl -X POST "$SERVER_URL/session/$SESSION2_ID/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "parts": [{"type": "text", "text": "Debug the WebSocket connection issues in my chat application. The connection keeps dropping after 30 seconds and reconnection fails."}],
    "providerID": "anthropic", 
    "modelID": "claude-3-5-sonnet-20241022"
  }' -s > /dev/null

sleep 2

# Generate continuation prompts
echo ""
echo "Generating continuation prompts..."
echo ""

echo "=== Session 1 (REST API) Continuation Prompt ==="
PROMPT1=$(curl -X POST "$SERVER_URL/session/$SESSION1_ID/continuation-prompt" \
  -H "Content-Type: application/json" \
  -d '{}' -s)

if echo "$PROMPT1" | grep -q "prompt"; then
    PROMPT1_TEXT=$(echo "$PROMPT1" | python3 -c "import sys, json; print(json.load(sys.stdin).get('prompt', 'No prompt found'))" 2>/dev/null || echo "$PROMPT1")
    echo "Generated successfully!"
    echo "Preview (first 300 chars):"
    echo "$PROMPT1_TEXT" | head -c 300
    echo "..."
    echo ""
    
    # Check for REST API keywords
    if echo "$PROMPT1_TEXT" | grep -i -E "REST API|user management|authentication|register|login|profile" > /dev/null; then
        echo "✅ Contains REST API related content"
    else
        echo "❌ Missing REST API content"
    fi
else
    echo "❌ Failed to generate prompt"
    echo "Error: $PROMPT1"
fi

echo ""
echo ""
echo "=== Session 2 (WebSocket) Continuation Prompt ==="
PROMPT2=$(curl -X POST "$SERVER_URL/session/$SESSION2_ID/continuation-prompt" \
  -H "Content-Type: application/json" \
  -d '{}' -s)

if echo "$PROMPT2" | grep -q "prompt"; then
    PROMPT2_TEXT=$(echo "$PROMPT2" | python3 -c "import sys, json; print(json.load(sys.stdin).get('prompt', 'No prompt found'))" 2>/dev/null || echo "$PROMPT2")
    echo "Generated successfully!"
    echo "Preview (first 300 chars):"
    echo "$PROMPT2_TEXT" | head -c 300
    echo "..."
    echo ""
    
    # Check for WebSocket keywords
    if echo "$PROMPT2_TEXT" | grep -i -E "WebSocket|chat application|connection|dropping|reconnection" > /dev/null; then
        echo "✅ Contains WebSocket related content"
    else
        echo "❌ Missing WebSocket content"
    fi
else
    echo "❌ Failed to generate prompt"
    echo "Error: $PROMPT2"
fi

# Compare prompts
echo ""
echo ""
echo "=== Verification ==="

# Save full prompts
echo "$PROMPT1_TEXT" > session1_full_prompt.txt
echo "$PROMPT2_TEXT" > session2_full_prompt.txt

# Check if different
if [[ "$PROMPT1_TEXT" == "$PROMPT2_TEXT" ]]; then
    echo "❌ FAIL: Both prompts are identical!"
else
    echo "✅ PASS: Prompts are unique to each session"
    
    # Calculate similarity
    COMMON_LINES=$(comm -12 <(echo "$PROMPT1_TEXT" | sort) <(echo "$PROMPT2_TEXT" | sort) | wc -l)
    echo "Common lines: $COMMON_LINES"
fi

# Check for hardcoded content
if echo "$PROMPT1_TEXT $PROMPT2_TEXT" | grep -i "opencode.*AI coding assistant development" > /dev/null; then
    echo "❌ Found hardcoded default content"
else
    echo "✅ No hardcoded defaults detected"
fi

echo ""
echo "Full prompts saved to:"
echo "- session1_full_prompt.txt (REST API)"  
echo "- session2_full_prompt.txt (WebSocket)"
echo ""
echo "Test complete!"