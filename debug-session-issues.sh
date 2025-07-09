#!/bin/bash

# Comprehensive session debugging script
echo "=== DGMO Session System Debug Report ==="
echo "Time: $(date)"
echo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
STORAGE_BASE="$HOME/.local/share/opencode/project/mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode/storage"

echo -e "${BLUE}=== Storage Analysis ===${NC}"
echo

# Count sessions and sub-sessions
if [ -d "$STORAGE_BASE/session" ]; then
    session_count=$(find "$STORAGE_BASE/session/info" -name "*.json" 2>/dev/null | wc -l)
    subsession_count=$(find "$STORAGE_BASE/session/sub-sessions" -name "*.json" 2>/dev/null | wc -l)
    index_count=$(find "$STORAGE_BASE/session/sub-session-index" -name "*.json" 2>/dev/null | wc -l)
    
    echo "Sessions: $session_count"
    echo "Sub-sessions: $subsession_count"
    echo "Parent indices: $index_count"
    echo
    
    # Show recent sub-sessions
    echo -e "${YELLOW}Recent sub-sessions:${NC}"
    find "$STORAGE_BASE/session/sub-sessions" -name "*.json" -type f -exec ls -lt {} + 2>/dev/null | head -5 | while read -r line; do
        echo "  $line"
    done
    echo
fi

echo -e "${BLUE}=== API Testing ===${NC}"
echo

# Test endpoints
test_endpoint() {
    local endpoint=$1
    local desc=$2
    
    response=$(curl -s -w "\n%{http_code}" "http://localhost:8812$endpoint" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        count=$(echo "$body" | python3 -c "import json, sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
        echo -e "${GREEN}✓${NC} $desc: $count items"
    else
        echo -e "${RED}✗${NC} $desc: HTTP $http_code"
    fi
}

test_endpoint "/session" "Sessions"
test_endpoint "/sub-sessions" "All sub-sessions"
echo

# Find sessions with sub-sessions
echo -e "${YELLOW}Sessions with sub-sessions:${NC}"
curl -s http://localhost:8812/session 2>/dev/null | python3 -c "
import json, sys, subprocess
sessions = json.load(sys.stdin)
found_count = 0
for s in sessions[:20]:  # Check first 20 sessions
    if not s.get('parentID'):  # Only main sessions
        result = subprocess.run(['curl', '-s', f\"http://localhost:8812/session/{s['id']}/sub-sessions\"], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            try:
                subs = json.loads(result.stdout)
                if subs:
                    print(f\"  {s['id']}: {len(subs)} sub-sessions\")
                    found_count += 1
                    if found_count >= 5:  # Show max 5
                        break
            except:
                pass
if found_count == 0:
    print('  None found in first 20 sessions')
" 2>/dev/null
echo

echo -e "${BLUE}=== Recent Activity Analysis ===${NC}"
echo

# Check recent task tool usage
echo -e "${YELLOW}Recent task executions:${NC}"
if [ -f "$STORAGE_BASE/../task-debug.log" ]; then
    tail -5 "$STORAGE_BASE/../task-debug.log" 2>/dev/null | while read -r line; do
        echo "  $line"
    done
else
    echo "  No task debug log found"
fi
echo

# Check TUI logs for errors
echo -e "${YELLOW}Recent TUI errors:${NC}"
if [ -f "$HOME/.local/share/opencode/project/mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode/log/tui.log" ]; then
    grep -i "error\|failed\|panic" "$HOME/.local/share/opencode/project/mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode/log/tui.log" | tail -5 | while read -r line; do
        echo "  $line"
    done
else
    echo "  No TUI log found"
fi
echo

echo -e "${BLUE}=== Potential Issues ===${NC}"
echo

# Check for common issues
issues_found=0

# 1. Check if sub-sessions are being created
recent_subsession=$(find "$STORAGE_BASE/session/sub-sessions" -name "*.json" -mtime -1 2>/dev/null | wc -l)
if [ "$recent_subsession" -eq 0 ]; then
    echo -e "${RED}✗${NC} No sub-sessions created in last 24 hours"
    echo "  Possible cause: Task tool not being used or not creating sub-sessions"
    issues_found=$((issues_found + 1))
else
    echo -e "${GREEN}✓${NC} $recent_subsession sub-sessions created in last 24 hours"
fi

# 2. Check if indices are being updated
recent_index=$(find "$STORAGE_BASE/session/sub-session-index" -name "*.json" -mtime -1 2>/dev/null | wc -l)
if [ "$recent_index" -eq 0 ] && [ "$recent_subsession" -gt 0 ]; then
    echo -e "${RED}✗${NC} No indices updated recently despite new sub-sessions"
    echo "  Possible cause: Index update logic failure"
    issues_found=$((issues_found + 1))
fi

# 3. Check WebSocket connection
if ! nc -z localhost 5747 2>/dev/null; then
    echo -e "${RED}✗${NC} WebSocket server not accessible"
    echo "  Possible cause: Task event server not running"
    issues_found=$((issues_found + 1))
else
    echo -e "${GREEN}✓${NC} WebSocket server accessible"
fi

echo
echo -e "${BLUE}=== Recommendations ===${NC}"
echo

if [ $issues_found -eq 0 ]; then
    echo -e "${GREEN}No major issues detected!${NC}"
    echo
    echo "To test sub-session functionality:"
    echo "1. Run TUI: cd packages/tui && ./dgmo-test"
    echo "2. Create task: 'Create 3 agents to analyze this code'"
    echo "3. Press Ctrl+X U to view sub-sessions"
    echo "4. Monitor logs: tail -f ~/.local/share/opencode/project/*/log/tui.log"
else
    echo -e "${RED}Found $issues_found potential issues${NC}"
    echo
    echo "Debugging steps:"
    echo "1. Ensure task tool is available in agent mode"
    echo "2. Check if SubSession.create() is being called"
    echo "3. Verify storage paths are consistent"
    echo "4. Monitor task execution logs"
fi

echo
echo "=== Debug Report Complete ===