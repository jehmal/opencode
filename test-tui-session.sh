#!/bin/bash

# Test TUI session functionality
echo "=== Testing DGMO TUI Session Functionality ==="
echo

# Set up environment
export DGMO_SERVER="http://localhost:8812"
export DGMO_APP_INFO='{
  "name": "dgmstt",
  "version": "1.0.0",
  "path": {
    "root": "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode",
    "data": "/home/jehma/.local/share/opencode/project/mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode",
    "cwd": "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode",
    "state": "/home/jehma/.local/share/opencode/project/mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode",
    "log": "/home/jehma/.local/share/opencode/project/mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode/log",
    "config": "/home/jehma/.config/opencode"
  },
  "time": {
    "initialized": 0
  },
  "git": false
}'

# Check if server is running
if ! curl -s http://localhost:8812/session >/dev/null 2>&1; then
    echo "Error: Backend server not running on port 8812"
    echo "Start it with: cd packages/opencode && bun run ./src/index.ts serve --port 8812"
    exit 1
fi

echo "Backend server is running ✓"
echo

# Get current sessions
echo "Current sessions:"
curl -s http://localhost:8812/session | python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data[:5]:
    print(f\"- {s['id']} {'(has parent)' if 'parentID' in s and s['parentID'] else ''}\")"
echo

# Check sub-sessions
echo "Checking sub-sessions:"
total_subs=$(curl -s http://localhost:8812/sub-sessions | python3 -c "import json, sys; print(len(json.load(sys.stdin)))")
echo "Total sub-sessions in system: $total_subs"
echo

# Find a session with sub-sessions
echo "Looking for sessions with sub-sessions:"
curl -s http://localhost:8812/session | python3 -c "
import json, sys, subprocess
sessions = json.load(sys.stdin)
found = False
for s in sessions:
    if not s.get('parentID'):  # Only check main sessions
        result = subprocess.run(['curl', '-s', f\"http://localhost:8812/session/{s['id']}/sub-sessions\"], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            subs = json.loads(result.stdout)
            if subs:
                print(f\"✓ Session {s['id']} has {len(subs)} sub-sessions\")
                found = True
                break
if not found:
    print(\"No sessions with sub-sessions found\")
"
echo

# Instructions for manual testing
echo "=== Manual Testing Instructions ==="
echo
echo "1. Run the TUI:"
echo "   cd packages/tui"
echo "   ./dgmo-test"
echo
echo "2. Test commands:"
echo "   - Press Ctrl+X L to list sessions"
echo "   - Press Ctrl+X U to view sub-sessions"
echo "   - Create new sub-sessions: 'Create 3 agents to test sub-sessions'"
echo "   - Navigate with Enter to open sub-session"
echo "   - Navigate with Ctrl+B to return to parent"
echo "   - Navigate with Ctrl+B . for next sibling"
echo "   - Navigate with Ctrl+B , for previous sibling"
echo
echo "3. Check logs:"
echo "   tail -f $HOME/.local/share/opencode/project/mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode/log/tui.log"
echo

# Try to detect common issues
echo "=== Checking for Common Issues ==="
echo

# Check if dgmo binary exists
if [ -f "./dgmo-test" ]; then
    echo "✓ TUI binary exists"
else
    echo "✗ TUI binary not found - run: go build -o dgmo-test cmd/dgmo/main.go"
fi

# Check WebSocket port
if nc -z localhost 5747 2>/dev/null; then
    echo "✓ WebSocket server running on port 5747"
else
    echo "✗ WebSocket server not accessible on port 5747"
fi

echo
echo "=== Ready for Testing ==="