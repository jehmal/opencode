#!/bin/bash
# Start DGMO the correct way

echo "=== STARTING DGMO CORRECTLY ==="
echo ""

cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode

# The correct way to start dgmo is through the opencode CLI
echo "Starting DGMO through opencode..."
echo ""
echo "This will:"
echo "1. Start the opencode server"
echo "2. Set up the environment"
echo "3. Launch the TUI with our fixes"
echo ""
echo "Watch for [SUB-SESSION FIX] messages in the output"
echo ""

# Make sure our fixed binary is in place
if [ -f "packages/tui/dgmo-fixed" ]; then
    echo "Using our fixed TUI binary..."
    # Replace the original with our fixed version
    cp packages/tui/dgmo-fixed packages/tui/dgmo
fi

# Run dgmo through opencode
exec bun run packages/opencode/bin/opencode.js run dgmo
