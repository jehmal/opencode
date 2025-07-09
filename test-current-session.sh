#!/bin/bash

# Test current session and sub-sessions
echo "=== Testing Current Session Sub-Sessions ==="
echo

# Get the most recent session
echo "Getting most recent session..."
RECENT_SESSION=$(curl -s http://localhost:8812/session | python3 -c "
import json, sys
sessions = json.load(sys.stdin)
# Find the most recent non-child session
for s in sessions:
    if not s.get('parentID'):
        print(s['id'])
        break
")

if [ -z "$RECENT_SESSION" ]; then
    echo "No sessions found"
    exit 1
fi

echo "Most recent main session: $RECENT_SESSION"
echo

# Check if this session has sub-sessions
echo "Checking sub-sessions for this session..."
SUB_COUNT=$(curl -s "http://localhost:8812/session/$RECENT_SESSION/sub-sessions" | python3 -c "
import json, sys
subs = json.load(sys.stdin)
print(len(subs))
for s in subs[:3]:
    print(f\"  - {s['id']}: {s['agentName']} ({s['status']})\")
")

echo "Sub-sessions found: $SUB_COUNT"
echo

# Get all sub-sessions and check which sessions have them
echo "Sessions with sub-sessions:"
curl -s http://localhost:8812/session | python3 -c "
import json, sys, subprocess
sessions = json.load(sys.stdin)
sessions_with_subs = []
for s in sessions:
    if not s.get('parentID'):  # Only check main sessions
        result = subprocess.run(['curl', '-s', f\"http://localhost:8812/session/{s['id']}/sub-sessions\"], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            try:
                subs = json.loads(result.stdout)
                if subs:
                    sessions_with_subs.append((s['id'], len(subs), s['time']['created']))
            except:
                pass

# Sort by creation time (most recent first)
sessions_with_subs.sort(key=lambda x: x[2], reverse=True)

print(f'Found {len(sessions_with_subs)} sessions with sub-sessions:')
for sid, count, created in sessions_with_subs[:10]:
    print(f'  {sid}: {count} sub-sessions')
"

echo
echo "To test in TUI:"
echo "1. Open a session that has sub-sessions (from list above)"
echo "2. Press Ctrl+X U to view sub-sessions"
echo "3. If still showing 'No sub-sessions', the issue is in the dialog"