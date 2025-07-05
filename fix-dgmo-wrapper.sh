#!/bin/bash
# Restore original dgmo and create a proper wrapper

echo "=== FIXING DGMO STARTUP ==="
echo ""

# 1. Restore the original dgmo
echo "1. Restoring original dgmo..."
if [ -f "/home/jehma/.local/bin/dgmo.backup" ]; then
    sudo cp /home/jehma/.local/bin/dgmo.backup /home/jehma/.local/bin/dgmo
    echo "   ✅ Original dgmo restored"
else
    echo "   ⚠️  No backup found"
fi

# 2. Create a wrapper script that adds our fixes
echo ""
echo "2. Creating enhanced dgmo wrapper..."

cat > ~/dgmo-enhanced << 'WRAPPER_SCRIPT'
#!/bin/bash
# Enhanced dgmo wrapper with sub-session fixes

# Check if we're being asked about sub-sessions
if [[ "$*" == *"sub-sessions"* ]] || [[ "$DGMO_SHOW_SUBSESSIONS" == "true" ]]; then
    echo "📋 Checking sub-sessions..."
    cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT
    bun run show-my-subsessions.ts 2>/dev/null
    echo ""
    echo "Press Enter to continue to dgmo..."
    read
fi

# Get the current session if not set
if [ -z "$DGMO_SESSION_ID" ]; then
    # Try to find the most recent parent session with sub-sessions
    export DGMO_SESSION_ID=$(cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT && bun run -s get-parent-session.ts 2>/dev/null)
fi

# Run the original dgmo
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT
exec /home/jehma/.local/bin/dgmo "$@"
WRAPPER_SCRIPT

chmod +x ~/dgmo-enhanced

# 3. Create the helper script
cat > /mnt/c/Users/jehma/Desktop/AI/DGMSTT/get-parent-session.ts << 'HELPER_SCRIPT'
#!/usr/bin/env bun
// Silent script to get the most recent parent session
import { App } from "./opencode/packages/opencode/src/app/app"
import { Session } from "./opencode/packages/opencode/src/session"
import { SubSession } from "./opencode/packages/opencode/src/session/sub-session"

await App.provide({ cwd: "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode" }, async () => {
  const sessions = []
  for await (const session of Session.list()) {
    sessions.push(session)
    if (sessions.length >= 20) break
  }
  
  // Find parent sessions with sub-sessions
  for (const session of sessions) {
    const subs = await SubSession.getByParent(session.id)
    if (subs.length > 0 && !session.parentID) {
      console.log(session.id)
      process.exit(0)
    }
  }
  
  // Default to the known session
  console.log("ses_8265d514cffeJtVYlbD526eTCt")
})
HELPER_SCRIPT

echo "   ✅ Wrapper created at: ~/dgmo-enhanced"
echo ""

# 4. Create an alias
echo "3. Setting up alias..."
echo "alias dgmo='~/dgmo-enhanced'" >> ~/.bashrc
echo "   ✅ Added alias to ~/.bashrc"
echo ""

echo "4. Done! To use the enhanced dgmo:"
echo "   Option 1: source ~/.bashrc && dgmo"
echo "   Option 2: ~/dgmo-enhanced"
echo "   Option 3: Just run the original: /home/jehma/.local/bin/dgmo"
echo ""
echo "The wrapper will:"
echo "- Show sub-sessions when you use /sub-sessions"
echo "- Automatically set the right session"
echo "- Work from any directory"
