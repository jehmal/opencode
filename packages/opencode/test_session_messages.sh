#!/bin/bash

echo "Testing Session Message Analysis"
echo "================================"

SERVER_URL="http://localhost:4096"

# Create a new session
echo "Creating test session..."
SESSION_RESPONSE=$(curl -X POST "$SERVER_URL/session" -H "Content-Type: application/json" -d '{}' -s)
SESSION_ID=$(echo "$SESSION_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Session ID: $SESSION_ID"

# Try different ways to add messages
echo ""
echo "Testing message creation..."

# Method 1: Direct chat endpoint
echo "Method 1: Chat endpoint"
CHAT_RESPONSE=$(curl -X POST "$SERVER_URL/session/$SESSION_ID/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "parts": [{"type": "text", "text": "Help implement REST API endpoints for /users, /posts, /comments with authentication middleware"}],
    "providerID": "anthropic",
    "modelID": "claude-3-5-sonnet-20241022"
  }' -s)
echo "Chat response: $(echo "$CHAT_RESPONSE" | head -c 100)..."

# Wait for message processing
sleep 3

# Check messages via API
echo ""
echo "Checking messages via API..."
MESSAGES=$(curl -s "http://localhost:4096/session/$SESSION_ID/messages" 2>/dev/null || echo "No messages endpoint")
echo "Messages response: $(echo "$MESSAGES" | head -c 200)..."

# Now generate continuation prompt
echo ""
echo "Generating continuation prompt..."
PROMPT_RESPONSE=$(curl -X POST "$SERVER_URL/session/$SESSION_ID/continuation-prompt" \
  -H "Content-Type: application/json" \
  -d '{}' -s)

# Check if prompt contains our content
if echo "$PROMPT_RESPONSE" | grep -q "prompt"; then
    PROMPT_TEXT=$(echo "$PROMPT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('prompt', ''))" 2>/dev/null)
    echo "Prompt generated successfully!"
    
    # Save full prompt
    echo "$PROMPT_TEXT" > test_session_prompt.txt
    
    # Check for our keywords
    echo ""
    echo "Content Analysis:"
    if echo "$PROMPT_TEXT" | grep -i -E "REST API|/users|/posts|/comments|authentication|middleware" > /dev/null; then
        echo "✅ Contains session-specific content (REST API, endpoints)"
    else
        echo "❌ Missing session-specific content"
    fi
    
    # Check what was extracted
    echo ""
    echo "Extracted Topics:"
    echo "$PROMPT_TEXT" | grep -A5 "Critical Files" | head -10
    echo ""
    echo "Extracted Tasks:"
    echo "$PROMPT_TEXT" | grep -A10 "Required Tasks" | head -15
else
    echo "❌ Failed to generate prompt"
    echo "Response: $PROMPT_RESPONSE"
fi

echo ""
echo "Full prompt saved to test_session_prompt.txt"