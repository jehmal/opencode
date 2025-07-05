#!/bin/bash
# Fix the app initialization and JSON issues

echo "=== FIXING APP INITIALIZATION ==="
echo ""

cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode

# 1. Check what's in the .opencode directory
echo "1. Checking .opencode directory:"
ls -la .opencode/ 2>/dev/null || echo "   .opencode directory not found"
echo ""

# 2. Check for app.json
echo "2. Checking for app.json:"
if [ -f ".opencode/app.json" ]; then
    echo "   Found app.json, contents:"
    cat .opencode/app.json
    echo ""
else
    echo "   app.json not found - this is likely the issue!"
fi
echo ""

# 3. Initialize the opencode app properly
echo "3. Initializing opencode app..."
echo '{"name":"dgmstt","version":"1.0.0"}' > .opencode/app.json
echo "   Created app.json"

# 4. Ensure config exists
echo ""
echo "4. Ensuring config.json exists:"
mkdir -p .opencode
if [ ! -f ".opencode/config.json" ]; then
    echo '{"agentMode":"all-tools"}' > .opencode/config.json
    echo "   Created config.json"
else
    echo "   config.json already exists"
fi

# 5. Create a proper opencode.json in the root
echo ""
echo "5. Creating opencode.json:"
cat > opencode.json << 'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "name": "dgmstt",
  "version": "1.0.0",
  "agentMode": "all-tools"
}
EOF
echo "   Created opencode.json"

# 6. Now try to run the TUI again
echo ""
echo "6. Starting the fixed TUI..."
echo "   Running from: $(pwd)"
echo ""

# Export the data path to ensure it finds storage
export OPENCODE_DATA_PATH=/home/jehma/.local/share/opencode/project/mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode

# Run the fixed TUI
exec ./packages/tui/dgmo-fixed
