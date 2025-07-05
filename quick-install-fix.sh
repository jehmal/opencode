#!/bin/bash
# Quick install of fixed dgmo

echo "=== INSTALLING FIXED DGMO ==="
echo ""

# First, let's find where dgmo is really installed
echo "1. Finding dgmo installation..."
DGMO_REAL_PATH=$(readlink -f $(which dgmo))
echo "   dgmo is at: $DGMO_REAL_PATH"
echo ""

# Build our fixed version
echo "2. Building fixed version..."
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui

# Apply a quick fix if the build fails
if [ ! -f "go.mod" ]; then
    echo "   Creating go.mod..."
    go mod init github.com/sst/dgmo
    go mod tidy
fi

go build -o dgmo-fixed cmd/dgmo/main.go

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Let's try a different approach..."
    echo ""
    echo "Alternative: Use the Node.js wrapper"
    cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT
    
    # Create a wrapper script
    cat > dgmo-wrapper << 'EOF'
#!/bin/bash
# Wrapper that ensures we're in the right session
if [ -n "$1" ] && [ "$1" = "/sub-sessions" ]; then
    echo "Intercepting /sub-sessions command..."
    # Show sub-sessions using our script
    bun run /mnt/c/Users/jehma/Desktop/AI/DGMSTT/show-my-subsessions.ts
else
    # Pass through to real dgmo
    exec /usr/bin/dgmo "$@"
fi
EOF
    chmod +x dgmo-wrapper
    echo "Created wrapper script: dgmo-wrapper"
    echo "Use: ./dgmo-wrapper instead of dgmo"
    exit 0
fi

echo "✅ Build successful!"
echo ""

# Install it
echo "3. Installing fixed version..."
echo "   This will replace: $DGMO_REAL_PATH"
echo "   Backup will be at: ${DGMO_REAL_PATH}.backup"
echo ""
echo "Press Enter to continue or Ctrl+C to cancel..."
read

sudo cp "$DGMO_REAL_PATH" "${DGMO_REAL_PATH}.backup"
sudo cp dgmo-fixed "$DGMO_REAL_PATH"

echo ""
echo "✅ Installation complete!"
echo ""
echo "Now run: dgmo"
echo "Then use: /sub-sessions"
echo ""
echo "You should see your 2 sub-sessions:"
echo "- Agent Technology poem"
echo "- Agent Nature poem"
