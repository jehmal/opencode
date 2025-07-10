#!/bin/bash
# Setup script for dgmo working directory fix

echo "Setting up dgmo to use current working directory..."

# Make the wrapper executable
chmod +x /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-wrapper.sh

# Detect shell
if [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
elif [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
else
    SHELL_CONFIG="$HOME/.bashrc"  # Default to bashrc
fi

# Check if alias already exists
if grep -q "alias dgmo=" "$SHELL_CONFIG" 2>/dev/null; then
    echo "Removing existing dgmo alias..."
    # Remove existing alias
    sed -i '/alias dgmo=/d' "$SHELL_CONFIG"
fi

# Add new alias
echo "" >> "$SHELL_CONFIG"
echo "# DGMO working directory fix" >> "$SHELL_CONFIG"
echo 'alias dgmo="/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-wrapper.sh"' >> "$SHELL_CONFIG"

echo "✅ Setup complete!"
echo ""
echo "To activate the changes, run:"
echo "  source $SHELL_CONFIG"
echo ""
echo "Or start a new terminal session."
echo ""
echo "Test it by running:"
echo "  cd /mnt/c/Users/jehma/Desktop/test"
echo "  dgmo"