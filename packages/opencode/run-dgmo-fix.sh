#!/bin/bash
# Complete setup script for dgmo working directory fix

echo "=== DGMO Working Directory Fix Setup ==="
echo ""

# Step 1: Make wrapper executable
echo "Step 1: Making wrapper executable..."
chmod +x /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-wrapper.sh
if [ $? -eq 0 ]; then
    echo "✅ Wrapper is now executable"
else
    echo "❌ Failed to make wrapper executable"
    exit 1
fi

# Step 2: Check if files exist
echo ""
echo "Step 2: Verifying files..."
if [ -f "/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-wrapper.sh" ]; then
    echo "✅ Wrapper script exists"
else
    echo "❌ Wrapper script not found"
    exit 1
fi

if [ -f "/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/bin/dgmo" ]; then
    echo "✅ dgmo binary exists"
else
    echo "❌ dgmo binary not found"
    exit 1
fi

# Step 3: Setup alias
echo ""
echo "Step 3: Setting up alias..."

# Detect shell
if [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
    SHELL_NAME="bash"
elif [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
    SHELL_NAME="zsh"
else
    SHELL_CONFIG="$HOME/.bashrc"
    SHELL_NAME="bash (default)"
fi

echo "Detected shell: $SHELL_NAME"
echo "Config file: $SHELL_CONFIG"

# Remove existing dgmo alias if present
if grep -q "alias dgmo=" "$SHELL_CONFIG" 2>/dev/null; then
    echo "Removing existing dgmo alias..."
    sed -i '/alias dgmo=/d' "$SHELL_CONFIG"
fi

# Add new alias
echo "" >> "$SHELL_CONFIG"
echo "# DGMO working directory fix (added $(date))" >> "$SHELL_CONFIG"
echo 'alias dgmo="/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-wrapper.sh"' >> "$SHELL_CONFIG"

echo "✅ Alias added to $SHELL_CONFIG"

# Step 4: Final instructions
echo ""
echo "=== Setup Complete! ==="
echo ""
echo "To activate the changes, run ONE of these commands:"
echo ""
echo "  source $SHELL_CONFIG"
echo ""
echo "OR simply close and reopen your terminal."
echo ""
echo "Then test it by running:"
echo "  cd /mnt/c/Users/jehma/Desktop/test"
echo "  dgmo"
echo ""
echo "The dgmo app should now open in the test directory!"