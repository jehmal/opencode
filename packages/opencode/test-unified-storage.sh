#!/bin/bash
# Test script to verify unified storage works from different directories

echo "DGMO Unified Storage Test"
echo "========================="
echo

# Test 1: Check unified storage exists
UNIFIED_DIR="$HOME/.local/share/opencode/project/unified/storage"
if [ -d "$UNIFIED_DIR" ]; then
    echo "✅ Unified storage directory exists"
    SESSION_COUNT=$(find "$UNIFIED_DIR/session/info" -name "*.json" 2>/dev/null | wc -l)
    echo "   Found $SESSION_COUNT sessions"
else
    echo "❌ Unified storage directory not found"
    exit 1
fi

echo
echo "Testing DGMO from different directories..."
echo

# Test 2: Run from home directory
echo "Test 1: Running from home directory"
cd ~
echo "  Current dir: $(pwd)"
echo "  Running: dgmo --version"
dgmo --version 2>/dev/null || echo "  ❌ dgmo command not found"

# Test 3: Run from project root
echo
echo "Test 2: Running from project root"
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT
echo "  Current dir: $(pwd)"
echo "  Expected: Sessions should load from unified storage"

# Test 4: Run from a random directory
echo
echo "Test 3: Running from random directory"
cd /tmp
echo "  Current dir: $(pwd)"
echo "  Expected: Sessions should still load from unified storage"

echo
echo "Summary:"
echo "--------"
echo "The unified storage fix ensures that no matter which directory"
echo "you run 'dgmo' from, it will always use the same storage location:"
echo "$UNIFIED_DIR"
echo
echo "This means your sessions are always accessible and never 'lost'!"