#!/bin/bash

echo "=== Testing Sub-Sessions Debug ==="

# Get the storage directory
STORAGE_DIR="$HOME/.local/share/opencode/project"

echo "1. Checking storage directories:"
ls -la "$STORAGE_DIR" 2>/dev/null || echo "No storage directory found"

echo -e "\n2. Looking for project directories:"
find "$STORAGE_DIR" -maxdepth 1 -type d -name "mnt-c-*" 2>/dev/null | while read dir; do
    echo "  Found project: $(basename "$dir")"
    
    echo "  - Sub-sessions:"
    ls -la "$dir/storage/session/sub-sessions/" 2>/dev/null | grep -E "ses_.*\.json" | wc -l
    
    echo "  - Sub-session index files:"
    ls -la "$dir/storage/session/sub-session-index/" 2>/dev/null | grep -E "ses_.*\.json" | wc -l
    
    echo "  - Recent sub-sessions (last 5):"
    ls -lt "$dir/storage/session/sub-sessions/"*.json 2>/dev/null | head -5 | awk '{print "    " $9}'
    
    echo ""
done

echo -e "\n3. Checking current session:"
# Find the most recent session
LATEST_SESSION=$(find "$STORAGE_DIR"/*/storage/session/info -name "ses_*.json" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2)

if [ -n "$LATEST_SESSION" ]; then
    SESSION_ID=$(basename "$LATEST_SESSION" .json)
    echo "  Latest session: $SESSION_ID"
    echo "  Created: $(stat -c %y "$LATEST_SESSION" 2>/dev/null || stat -f %Sm "$LATEST_SESSION" 2>/dev/null)"
    
    # Check if this session has sub-sessions
    PROJECT_DIR=$(dirname $(dirname $(dirname "$LATEST_SESSION")))
    INDEX_FILE="$PROJECT_DIR/storage/session/sub-session-index/$SESSION_ID.json"
    
    if [ -f "$INDEX_FILE" ]; then
        echo "  Sub-session index exists!"
        echo "  Content: $(cat "$INDEX_FILE")"
    else
        echo "  No sub-session index found for this session"
    fi
else
    echo "  No sessions found"
fi

echo -e "\n4. Testing API endpoint:"
# Get the current session from the most recent message
CURRENT_SESSION=$(find "$STORAGE_DIR"/*/storage/session/message -name "*.json" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2 | xargs basename .json | cut -d'-' -f1)

if [ -n "$CURRENT_SESSION" ]; then
    echo "  Testing /session/$CURRENT_SESSION/sub-sessions"
    curl -s "http://localhost:8080/session/$CURRENT_SESSION/sub-sessions" | jq . 2>/dev/null || echo "  API call failed"
else
    echo "  No current session found"
fi

echo -e "\n5. Checking all sub-sessions via API:"
curl -s "http://localhost:8080/sub-sessions" | jq length 2>/dev/null || echo "  API call failed"