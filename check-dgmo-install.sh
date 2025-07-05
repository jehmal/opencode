#!/bin/bash
# Find where dgmo is installed and check version

echo "=== DGMO INSTALLATION INFO ==="
echo ""

# Find dgmo
DGMO_PATH=$(which dgmo)
echo "dgmo location: $DGMO_PATH"

# Check if it's a symlink
if [ -L "$DGMO_PATH" ]; then
    echo "It's a symlink pointing to: $(readlink -f $DGMO_PATH)"
fi

# Check version
echo ""
echo "dgmo version:"
dgmo --version 2>/dev/null || echo "No version flag"

# Check where it might be installed
echo ""
echo "Checking common installation locations:"
locations=(
    "$HOME/.local/bin/dgmo"
    "$HOME/go/bin/dgmo"
    "/usr/local/bin/dgmo"
    "/usr/bin/dgmo"
    "$HOME/.npm-global/bin/dgmo"
    "$HOME/.bun/bin/dgmo"
)

for loc in "${locations[@]}"; do
    if [ -f "$loc" ]; then
        echo "✓ Found at: $loc (size: $(ls -lh $loc | awk '{print $5}'))"
    fi
done

echo ""
echo "To apply our fix, we need to:"
echo "1. Either recompile dgmo from source with our changes"
echo "2. Or use a wrapper that intercepts the sub-sessions call"
echo ""
echo "For now, just run dgmo and watch for [SUB-SESSION FIX] messages:"
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT
dgmo
