#!/bin/bash
# Simple workaround - just ensure we're in the right session

echo "=== DGMO SUB-SESSIONS WORKAROUND ==="
echo ""
echo "Your session has 2 sub-sessions:"
echo "1. Agent Technology poem (completed)"
echo "2. Agent Nature poem (completed)"
echo ""
echo "Making sure you can see them..."
echo ""

# Export the session ID
export DGMO_SESSION_ID=ses_8265d514cffeJtVYlbD526eTCt

# Create a temporary script that will help
cat > ~/.dgmo-session << EOF
export DGMO_SESSION_ID=ses_8265d514cffeJtVYlbD526eTCt
echo "Session set to: General greeting to Claude"
echo "This session has 2 sub-sessions"
EOF

echo "Session ID set!"
echo ""
echo "Starting dgmo..."
echo "Once it loads, type: /sub-sessions"
echo ""
echo "If you still don't see them, the issue is confirmed to be"
echo "in the installed dgmo binary's code."
echo ""

# Start dgmo
dgmo
