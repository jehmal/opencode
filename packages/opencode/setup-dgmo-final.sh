#!/bin/bash
# Final setup for dgmo working directory fix

echo "=== Final DGMO Working Directory Fix ==="
echo ""

# Make wrapper executable
chmod +x /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-wrapper-final.sh

# Detect shell config file
if [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
elif [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
else
    SHELL_CONFIG="$HOME/.bashrc"
fi

# Remove any existing dgmo aliases or functions
sed -i '/alias dgmo=/d' "$SHELL_CONFIG" 2>/dev/null
sed -i '/^dgmo()/,/^}/d' "$SHELL_CONFIG" 2>/dev/null

# Add the new alias
echo "" >> "$SHELL_CONFIG"
echo "# DGMO working directory fix (updated $(date))" >> "$SHELL_CONFIG"
echo 'alias dgmo="/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-wrapper-final.sh"' >> "$SHELL_CONFIG"

echo "✅ Setup complete!"
echo ""
echo "Run this command to activate:"
echo "  source $SHELL_CONFIG"
echo ""
echo "Then test with:"
echo "  cd /mnt/c/Users/jehma/Desktop/test"
echo "  dgmo"