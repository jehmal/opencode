#!/bin/bash
# Check if the TUI has our fixes

echo "=== CHECKING TUI FOR SUB-SESSION FIXES ==="
echo ""

# Check the installed dgmo binary
echo "1. Checking installed dgmo binary:"
which dgmo
ls -la $(which dgmo)
echo ""

# Check if our fix is in the source
echo "2. Checking if fix is in subsession.go:"
grep -n "SUB-SESSION FIX" /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui/internal/components/dialog/subsession.go | head -5

if [ $? -eq 0 ]; then
    echo "✅ Fix is in the source code"
else
    echo "❌ Fix is NOT in the source code"
fi
echo ""

# Check the TUI binary location
echo "3. TUI build location:"
ls -la /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui/dgmo 2>/dev/null
if [ $? -ne 0 ]; then
    echo "TUI binary not found at expected location"
fi
echo ""

# Build the TUI with our fix
echo "4. Building TUI with fix..."
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui
go build -o dgmo-fixed cmd/dgmo/main.go

if [ $? -eq 0 ]; then
    echo "✅ Build successful! New binary: dgmo-fixed"
    echo ""
    echo "To use the fixed version:"
    echo "1. Stop current dgmo (Ctrl+C)"
    echo "2. Run: ./dgmo-fixed"
    echo "   OR"
    echo "   sudo cp dgmo-fixed /usr/local/bin/dgmo"
else
    echo "❌ Build failed"
fi
