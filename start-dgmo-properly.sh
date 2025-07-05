#!/bin/bash
# Proper TUI startup script with required environment variables

echo "=== STARTING DGMO TUI WITH PROPER ENVIRONMENT ==="
echo ""

cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode

# First, get the app info from the opencode binary
echo "Getting app info from opencode..."
APP_INFO=$(bun run packages/opencode/bin/opencode.js app 2>/dev/null)

if [ -z "$APP_INFO" ]; then
    echo "Failed to get app info, using fallback..."
    # Create a fallback app info
    APP_INFO=$(cat << 'EOF'
{
  "name": "dgmstt",
  "version": "1.0.0",
  "path": {
    "root": "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode",
    "data": "/home/jehma/.local/share/opencode/project/mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode",
    "cwd": "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"
  }
}
EOF
)
fi

echo "App info:"
echo "$APP_INFO" | jq . 2>/dev/null || echo "$APP_INFO"
echo ""

# Set the required environment variables
export DGMO_APP_INFO="$APP_INFO"
export DGMO_SERVER="http://localhost:58741"  # Default opencode server port

# Build if needed
if [ ! -f "packages/tui/dgmo-fixed" ]; then
    echo "Building TUI..."
    cd packages/tui
    go build -o dgmo-fixed cmd/dgmo/main.go
    cd ../..
fi

# Start the opencode server in the background
echo "Starting opencode server..."
bun run packages/opencode/bin/opencode.js server > opencode-server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
echo "Waiting for server to start..."
sleep 3

# Now start the TUI
echo ""
echo "Starting TUI..."
echo "Watch for [SUB-SESSION FIX] messages"
echo ""

./packages/tui/dgmo-fixed

# Cleanup on exit
kill $SERVER_PID 2>/dev/null
