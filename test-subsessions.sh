#!/bin/bash

echo "=== Testing OpenCode Sub-Sessions Fix ==="
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if sub-sessions exist
check_subsessions() {
    local project_dir="$1"
    local count=$(find "$project_dir/storage/session/sub-sessions/" -name "*.json" 2>/dev/null | wc -l)
    echo "$count"
}

# Function to find recent sessions
find_recent_sessions() {
    local project_dir="$1"
    find "$project_dir/storage/session/info/" -name "*.json" -mtime -1 2>/dev/null | head -5
}

echo "1. Checking project directories..."
echo "================================="
for dir in ~/.local/share/opencode/project/*/; do
    if [ -d "$dir" ]; then
        echo -e "${YELLOW}Project:${NC} $(basename "$dir")"
        echo "  Path: $dir"
        
        # Check for sub-sessions
        sub_count=$(check_subsessions "$dir")
        echo -e "  Sub-sessions: ${GREEN}$sub_count${NC}"
        
        # Check for recent sessions
        recent_count=$(find_recent_sessions "$dir" | wc -l)
        echo -e "  Recent sessions: ${GREEN}$recent_count${NC}"
        
        # Show sample sub-session if exists
        if [ $sub_count -gt 0 ]; then
            sample=$(find "$dir/storage/session/sub-sessions/" -name "*.json" 2>/dev/null | head -1)
            if [ -n "$sample" ]; then
                echo -e "  ${YELLOW}Sample sub-session:${NC}"
                jq -r '.parentSessionId, .agentName, .status' "$sample" 2>/dev/null | sed 's/^/    /'
            fi
        fi
        echo
    fi
done

echo "2. Checking agent configuration..."
echo "================================="
echo -e "${YELLOW}Looking for agent-config.ts...${NC}"
config_file="/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/config/agent-config.ts"
if [ -f "$config_file" ]; then
    echo -e "${GREEN}Found!${NC}"
    echo "Default mode:"
    grep -A1 "DEFAULT_MODE" "$config_file" | grep -v "^--" | sed 's/^/  /'
    echo "Task tool in ALL_TOOLS:"
    grep '"task"' "$config_file" | sed 's/^/  /'
else
    echo -e "${RED}Not found!${NC}"
fi

echo
echo "3. Testing recommendations..."
echo "============================"
echo "To test if the fix works:"
echo "1. Start opencode: dgmo run"
echo "2. Create a task WITHOUT using /agents:"
echo "   Example: 'Create 3 agents to analyze this code'"
echo "3. Check /sub-session dialog in TUI"
echo "4. Look for new files in:"
echo "   ~/.local/share/opencode/project/*/storage/session/sub-sessions/"
echo
echo "Expected behavior:"
echo "- Task tool should be available by default"
echo "- Sub-sessions should be created with proper parentID"
echo "- /sub-session dialog should show the created agents"

echo
echo "=== Test Complete ==="
