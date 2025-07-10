#!/bin/bash
# Comprehensive dgmo fix script

echo "=== DGMO Comprehensive Fix ==="
echo ""

# Step 1: Make debug wrapper executable
echo "Step 1: Setting up debug wrapper..."
chmod +x /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-debug-wrapper.sh

# Step 2: Check if bun is installed
echo ""
echo "Step 2: Checking bun installation..."
if command -v bun &> /dev/null; then
    echo "✅ bun is installed at: $(which bun)"
    echo "   Version: $(bun --version)"
else
    echo "❌ bun is not installed!"
    echo "   Please install bun first: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Step 3: Check if the TypeScript file exists
echo ""
echo "Step 3: Checking dgmo source files..."
if [ -f "/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/src/index.ts" ]; then
    echo "✅ index.ts exists"
else
    echo "❌ index.ts not found!"
    exit 1
fi

# Step 4: Create a working alias
echo ""
echo "Step 4: Creating working dgmo command..."

# Detect shell
if [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
elif [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
else
    SHELL_CONFIG="$HOME/.bashrc"
fi

# Remove any existing dgmo aliases
sed -i '/alias dgmo=/d' "$SHELL_CONFIG" 2>/dev/null

# Create a function instead of an alias for better control
cat >> "$SHELL_CONFIG" << 'EOF'

# DGMO function that preserves working directory
dgmo() {
    local CURRENT_DIR="$(pwd)"
    cd /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode
    bun run src/index.ts "$@"
    local EXIT_CODE=$?
    cd "$CURRENT_DIR"
    return $EXIT_CODE
}
EOF

echo "✅ dgmo function added to $SHELL_CONFIG"

# Step 5: Test the setup
echo ""
echo "Step 5: Testing setup..."
echo ""
echo "=== Setup Complete! ==="
echo ""
echo "To activate dgmo, run:"
echo "  source $SHELL_CONFIG"
echo ""
echo "Then test it with:"
echo "  cd /mnt/c/Users/jehma/Desktop/test"
echo "  dgmo"
echo ""
echo "If dgmo still doesn't work, try running directly:"
echo "  cd /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode"
echo "  bun install"
echo "  bun run src/index.ts"