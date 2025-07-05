#!/bin/bash
# Quick check for sub-sessions in WSL

echo "=== Quick Sub-Session Check ==="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Find storage
STORAGE_BASE="$HOME/.local/share/opencode/project"

if [ ! -d "$STORAGE_BASE" ]; then
    echo -e "${RED}Storage not found at: $STORAGE_BASE${NC}"
    exit 1
fi

echo -e "${GREEN}Storage found at: $STORAGE_BASE${NC}"
echo ""

# Find most recent project
RECENT_PROJECT=$(find "$STORAGE_BASE" -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | head -2 | tail -1 | cut -d' ' -f2)

if [ -z "$RECENT_PROJECT" ]; then
    echo -e "${RED}No projects found${NC}"
    exit 1
fi

echo -e "${YELLOW}Most recent project: $(basename "$RECENT_PROJECT")${NC}"

# Find most recent main session
SESSION_DIR="$RECENT_PROJECT/storage/session/info"
if [ ! -d "$SESSION_DIR" ]; then
    echo -e "${RED}No sessions found${NC}"
    exit 1
fi

# Get most recent main session (no parentID)
MAIN_SESSION=""
LATEST_TIME=0

for session_file in "$SESSION_DIR"/*.json; do
    if [ -f "$session_file" ]; then
        # Check if it has parentID
        has_parent=$(jq -r '.parentID // empty' "$session_file" 2>/dev/null)
        if [ -z "$has_parent" ]; then
            # It's a main session
            created=$(jq -r '.time.created' "$session_file" 2>/dev/null)
            if [ "$created" -gt "$LATEST_TIME" ]; then
                LATEST_TIME=$created
                MAIN_SESSION=$(basename "$session_file" .json)
            fi
        fi
    fi
done

if [ -z "$MAIN_SESSION" ]; then
    echo -e "${RED}No main session found${NC}"
    exit 1
fi

echo -e "${GREEN}Active main session: $MAIN_SESSION${NC}"

# Check for sub-sessions
INDEX_FILE="$RECENT_PROJECT/storage/session/sub-session-index/${MAIN_SESSION}.json"
SUB_DIR="$RECENT_PROJECT/storage/session/sub-sessions"

echo ""
echo "Checking for sub-sessions..."

if [ -f "$INDEX_FILE" ]; then
    SUB_COUNT=$(jq '. | length' "$INDEX_FILE" 2>/dev/null || echo 0)
    echo -e "${GREEN}✓ Index file exists with $SUB_COUNT sub-sessions${NC}"
    
    if [ "$SUB_COUNT" -gt 0 ]; then
        echo "Sub-session IDs:"
        jq -r '.[]' "$INDEX_FILE" | head -5 | while read -r sub_id; do
            echo "  - $sub_id"
            
            # Check if file exists
            SUB_FILE="$SUB_DIR/${sub_id}.json"
            if [ -f "$SUB_FILE" ]; then
                agent=$(jq -r '.agentName' "$SUB_FILE" 2>/dev/null)
                status=$(jq -r '.status' "$SUB_FILE" 2>/dev/null)
                echo "    Agent: $agent, Status: $status"
            else
                echo -e "    ${RED}File not found!${NC}"
            fi
        done
    fi
else
    echo -e "${RED}✗ No index file found${NC}"
fi

# Check sub-session directory
echo ""
if [ -d "$SUB_DIR" ]; then
    TOTAL_SUBS=$(find "$SUB_DIR" -name "*.json" | wc -l)
    echo "Total sub-session files: $TOTAL_SUBS"
    
    # Check for orphaned sub-sessions
    echo ""
    echo "Checking for sub-sessions belonging to current session..."
    FOUND=0
    
    for sub_file in "$SUB_DIR"/*.json; do
        if [ -f "$sub_file" ]; then
            parent=$(jq -r '.parentSessionId' "$sub_file" 2>/dev/null)
            if [ "$parent" = "$MAIN_SESSION" ]; then
                FOUND=$((FOUND + 1))
                sub_id=$(basename "$sub_file" .json)
                agent=$(jq -r '.agentName' "$sub_file" 2>/dev/null)
                echo -e "${YELLOW}Found: $sub_id - $agent${NC}"
            fi
        fi
    done
    
    if [ $FOUND -eq 0 ]; then
        echo -e "${RED}No sub-sessions found for current session${NC}"
    else
        echo -e "${GREEN}Found $FOUND sub-sessions for current session${NC}"
    fi
else
    echo -e "${RED}Sub-sessions directory not found${NC}"
fi

echo ""
echo "=== Summary ==="
echo "Project: $(basename "$RECENT_PROJECT")"
echo "Session: $MAIN_SESSION"
echo "Index says: $SUB_COUNT sub-sessions"
echo "Actually found: $FOUND sub-sessions for this session"

if [ "$SUB_COUNT" -ne "$FOUND" ]; then
    echo -e "${RED}⚠️  Mismatch between index and actual files!${NC}"
fi
