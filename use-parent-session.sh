#!/bin/bash
# Immediate workaround to see sub-sessions

echo "=== SUB-SESSIONS WORKAROUND ==="
echo ""
echo "Your session ses_8265d514cffeJtVYlbD526eTCt has 2 sub-sessions!"
echo ""
echo "Let's make sure you're in the right session:"
echo ""

# Set the session explicitly
export DGMO_SESSION_ID=ses_8265d514cffeJtVYlbD526eTCt

echo "1. Setting session ID: $DGMO_SESSION_ID"
echo ""
echo "2. Starting dgmo with this session..."
echo ""
echo "3. Once in dgmo, type: /sub-sessions"
echo ""
echo "If you still don't see sub-sessions, the issue is the installed dgmo"
echo "doesn't include our enhanced fetching logic."
echo ""
echo "Starting dgmo now..."
echo ""

# Start dgmo with the correct session
dgmo
