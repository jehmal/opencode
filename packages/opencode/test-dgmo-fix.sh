#!/bin/bash
# Test script for dgmo working directory fix

echo "Testing dgmo working directory fix..."
echo ""

# Test 1: Check wrapper exists
if [ -f "/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-wrapper.sh" ]; then
    echo "✅ Wrapper script exists"
else
    echo "❌ Wrapper script not found"
    exit 1
fi

# Test 2: Check wrapper is executable
if [ -x "/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-wrapper.sh" ]; then
    echo "✅ Wrapper script is executable"
else
    echo "❌ Wrapper script is not executable"
    echo "   Run: chmod +x /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-wrapper.sh"
    exit 1
fi

# Test 3: Check dgmo binary exists
if [ -f "/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/bin/dgmo" ]; then
    echo "✅ dgmo binary exists"
else
    echo "❌ dgmo binary not found"
    exit 1
fi

echo ""
echo "All checks passed! ✅"
echo ""
echo "To complete setup, run:"
echo "  bash /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/setup-dgmo-fix.sh"