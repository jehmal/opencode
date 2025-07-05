#!/bin/bash
# Build and install our fixed dgmo globally

echo "=== BUILDING AND INSTALLING FIXED DGMO ==="
echo ""

cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui

# 1. Build our fixed version
echo "1. Building fixed dgmo..."
go build -o dgmo-fixed cmd/dgmo/main.go

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# 2. Find where dgmo is installed
DGMO_PATH=$(which dgmo)
if [ -z "$DGMO_PATH" ]; then
    echo "❌ dgmo not found in PATH"
    exit 1
fi

echo "2. Current dgmo location: $DGMO_PATH"
echo ""

# 3. Backup the original
echo "3. Creating backup..."
sudo cp "$DGMO_PATH" "${DGMO_PATH}.backup"
echo "   Backup saved to: ${DGMO_PATH}.backup"
echo ""

# 4. Install our fixed version
echo "4. Installing fixed version..."
sudo cp dgmo-fixed "$DGMO_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Fixed dgmo installed successfully!"
    echo ""
    echo "The fix includes:"
    echo "- Checks direct children of current session"
    echo "- Checks siblings if in a child session"
    echo "- Shows all sub-sessions as fallback"
    echo ""
    echo "Now run: dgmo"
    echo "Then: /sub-sessions"
else
    echo "❌ Failed to install. You may need to run with sudo"
fi
