#!/bin/bash

# Test script to verify session and sub-session functionality
echo "=== DGMO Session & Sub-Session Test ==="
echo "Time: $(date)"
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get storage path
STORAGE_PATH="$HOME/.local/share/opencode/project"
echo "Storage base path: $STORAGE_PATH"
echo

# Function to test API endpoint
test_api() {
    local endpoint=$1
    local description=$2
    echo -e "${YELLOW}Testing:${NC} $description"
    echo "Endpoint: $endpoint"
    
    response=$(curl -s -w "\n%{http_code}" "http://localhost:8812$endpoint" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ Success${NC} (HTTP $http_code)"
        echo "Response preview: $(echo "$body" | head -c 200)..."
    else
        echo -e "${RED}✗ Failed${NC} (HTTP $http_code)"
        echo "Response: $body"
    fi
    echo
}

# Function to count files in a directory
count_files() {
    local dir=$1
    local pattern=$2
    if [ -d "$dir" ]; then
        count=$(find "$dir" -name "$pattern" 2>/dev/null | wc -l)
        echo "$count"
    else
        echo "0"
    fi
}

# Find the most recent project directory
echo "Finding project directories..."
for proj_dir in $(find "$STORAGE_PATH" -maxdepth 1 -type d -name "mnt-*" 2>/dev/null | sort -r); do
    if [ -d "$proj_dir/storage/session" ]; then
        echo "Found project: $proj_dir"
        
        # Count sessions and sub-sessions
        session_count=$(count_files "$proj_dir/storage/session/info" "*.json")
        subsession_count=$(count_files "$proj_dir/storage/session/sub-sessions" "*.json")
        index_count=$(count_files "$proj_dir/storage/session/sub-session-index" "*.json")
        
        echo "  Sessions: $session_count"
        echo "  Sub-sessions: $subsession_count"
        echo "  Parent indices: $index_count"
        
        # Show recent sessions
        if [ $session_count -gt 0 ]; then
            echo "  Recent sessions:"
            find "$proj_dir/storage/session/info" -name "*.json" -type f -exec basename {} .json \; | sort -r | head -5 | while read session_id; do
                if [ -f "$proj_dir/storage/session/sub-session-index/$session_id.json" ]; then
                    sub_count=$(jq 'length' "$proj_dir/storage/session/sub-session-index/$session_id.json" 2>/dev/null || echo "0")
                    echo "    - $session_id (has $sub_count sub-sessions)"
                else
                    echo "    - $session_id"
                fi
            done
        fi
        echo
    fi
done

# Test API endpoints
echo -e "${YELLOW}=== Testing API Endpoints ===${NC}"
echo

# Check if server is running
if ! curl -s http://localhost:8812/health >/dev/null 2>&1; then
    echo -e "${RED}Error: Backend server not running on port 8812${NC}"
    echo "Start it with: cd packages/opencode && bun run ./src/index.ts serve --port 8812"
    exit 1
fi

# Test various endpoints
test_api "/health" "Health check"
test_api "/sessions" "List all sessions"
test_api "/sub-sessions" "List all sub-sessions"

# Get a session with sub-sessions
echo -e "${YELLOW}Finding sessions with sub-sessions...${NC}"
sessions=$(curl -s http://localhost:8812/sessions 2>/dev/null | jq -r '.[].id' 2>/dev/null || echo "")
if [ -n "$sessions" ]; then
    for session_id in $sessions; do
        sub_count=$(curl -s "http://localhost:8812/session/$session_id/sub-sessions" 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
        if [ "$sub_count" -gt "0" ]; then
            echo -e "${GREEN}Found session with sub-sessions:${NC} $session_id (has $sub_count sub-sessions)"
            test_api "/session/$session_id/sub-sessions" "Sub-sessions for $session_id"
            break
        fi
    done
fi

echo
echo "=== Test Complete ==="
echo
echo "To debug further:"
echo "1. Start backend: cd packages/opencode && bun run ./src/index.ts serve --port 8812"
echo "2. Build TUI: cd packages/tui && go build -o dgmo cmd/dgmo/main.go"
echo "3. Run TUI with env vars:"
echo "   export DGMO_SERVER=\"http://localhost:8812\""
echo "   ./dgmo"
echo "4. Create tasks with: 'Create 3 agents to test sub-sessions'"
echo "5. Check sub-sessions with: /sub-session or Ctrl+X U"