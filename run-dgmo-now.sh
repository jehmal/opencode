#!/bin/bash
# Simple solution - just run dgmo correctly

echo "=== RUNNING DGMO ==="
echo ""

# Restore original if needed
if [ -f "/home/jehma/.local/bin/dgmo.backup" ]; then
    echo "Restoring original dgmo..."
    sudo cp /home/jehma/.local/bin/dgmo.backup /home/jehma/.local/bin/dgmo
fi

# Set the session with sub-sessions
export DGMO_SESSION_ID=ses_8265d514cffeJtVYlbD526eTCt

echo "Session set to: General greeting to Claude"
echo "This session has 2 sub-sessions:"
echo "- Agent Technology poem"
echo "- Agent Nature poem"
echo ""
echo "Starting dgmo..."
echo ""
echo "Once it loads, try: /sub-sessions"
echo "(Note: They may not show if dgmo doesn't have our fixes)"
echo ""

# Run from the project directory
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT
/home/jehma/.local/bin/dgmo
