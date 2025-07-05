#!/bin/bash
# Test script for sub-sessions functionality

echo "=== DGMO Sub-Sessions Test Script ==="
echo "This script will help verify sub-sessions are working correctly"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Check storage directories${NC}"
echo "Looking for storage path..."

# Find all storage directories
STORAGE_PATHS=$(find ~/.local/share/opencode/project -name "storage" -type d 2>/dev/null)

if [ -z "$STORAGE_PATHS" ]; then
    echo -e "${RED}No storage directories found!${NC}"
else
    echo -e "${GREEN}Found storage directories:${NC}"
    echo "$STORAGE_PATHS"
    
    echo ""
    echo -e "${YELLOW}Step 2: Check for sub-sessions${NC}"
    
    for STORAGE in $STORAGE_PATHS; do
        echo "Checking: $STORAGE"
        
        # Check sub-sessions directory
        SUB_SESSIONS="$STORAGE/session/sub-sessions"
        if [ -d "$SUB_SESSIONS" ]; then
            COUNT=$(find "$SUB_SESSIONS" -name "*.json" 2>/dev/null | wc -l)
            echo -e "  Sub-sessions: ${GREEN}$COUNT files${NC}"
            
            # Show recent files
            if [ $COUNT -gt 0 ]; then
                echo "  Recent sub-sessions:"
                find "$SUB_SESSIONS" -name "*.json" -printf "    %f (modified: %TY-%Tm-%Td %TH:%TM)\n" 2>/dev/null | sort -r | head -5
            fi
        else
            echo -e "  Sub-sessions: ${RED}Directory not found${NC}"
        fi
        
        # Check index directory
        INDEX_DIR="$STORAGE/session/sub-session-index"
        if [ -d "$INDEX_DIR" ]; then
            INDEX_COUNT=$(find "$INDEX_DIR" -name "*.json" 2>/dev/null | wc -l)
            echo -e "  Index files: ${GREEN}$INDEX_COUNT files${NC}"
            
            # Show recent index files
            if [ $INDEX_COUNT -gt 0 ]; then
                echo "  Recent index files:"
                find "$INDEX_DIR" -name "*.json" -printf "    %f (modified: %TY-%Tm-%Td %TH:%TM)\n" 2>/dev/null | sort -r | head -5
            fi
        else
            echo -e "  Index files: ${RED}Directory not found${NC}"
        fi
        
        echo ""
    done
fi

echo -e "${YELLOW}Step 3: Testing Instructions${NC}"
echo "1. In DGMO, create agents with: ${GREEN}Create 3 agents to analyze this code${NC}"
echo "2. Wait for the task to execute (you'll see JSON output)"
echo "3. Open sub-session dialog with: ${GREEN}/sub-session${NC}"
echo "4. Check the console/logs for diagnostic output"
echo ""
echo "5. Run this script again to see if new files were created"
echo ""
echo -e "${YELLOW}Diagnostic Commands:${NC}"
echo "Watch for new files: watch -n 1 'find ~/.local/share/opencode/project -name \"*.json\" -mmin -5 | tail -20'"
echo "Tail DGMO logs: tail -f ~/.local/share/opencode/logs/dgmo.log (if logging is enabled)"
echo ""
echo "=== End of Test Script ==="
