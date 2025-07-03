#!/bin/bash

echo "=== DGMO Editor Setup Test ==="
echo

# Check if EDITOR is set in current shell
echo "1. Checking current EDITOR variable:"
echo "   EDITOR = '$EDITOR'"
echo

# Source bashrc to get latest changes
echo "2. Loading ~/.bashrc..."
source ~/.bashrc
echo "   EDITOR after sourcing = '$EDITOR'"
echo

# Check if cursor is available
echo "3. Checking if cursor command is available:"
if which cursor > /dev/null 2>&1; then
    echo "   ✓ cursor found at: $(which cursor)"
else
    echo "   ✗ cursor not found in PATH"
fi
echo

# Check bashrc content
echo "4. Checking ~/.bashrc for EDITOR export:"
if grep -q "export EDITOR=\"cursor\"" ~/.bashrc; then
    echo "   ✓ EDITOR export found in ~/.bashrc"
else
    echo "   ✗ EDITOR export NOT found in ~/.bashrc"
fi
echo

echo "=== Instructions ==="
echo "If EDITOR is not set to 'cursor' above:"
echo "1. Close this terminal"
echo "2. Open a new terminal"
echo "3. Run: echo \$EDITOR"
echo "4. It should show: cursor"
echo "5. Then run: dgmo"
echo "6. Try /editor command"
echo
echo "OR in current terminal:"
echo "1. Run: source ~/.bashrc"
echo "2. Run: dgmo"
echo "3. Try /editor command"