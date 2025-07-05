#!/bin/bash
# Apply our fix to the system dgmo

echo "=== APPLYING FIX TO SYSTEM DGMO ==="
echo ""

# First, find where dgmo is installed
DGMO_PATH=$(which dgmo)
if [ -z "$DGMO_PATH" ]; then
    echo "dgmo not found in PATH"
    exit 1
fi

echo "Found dgmo at: $DGMO_PATH"

# Build our fixed version
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui
echo "Building fixed version..."
go build -o dgmo-fixed cmd/dgmo/main.go

if [ $? -eq 0 ]; then
    echo "Build successful!"
    echo ""
    echo "To apply the fix:"
    echo "sudo cp dgmo-fixed $DGMO_PATH"
    echo ""
    echo "Then run dgmo normally from any directory"
else
    echo "Build failed!"
fi
