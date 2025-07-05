#!/bin/bash
# Find and run dgmo correctly

echo "=== FINDING AND RUNNING DGMO ==="
echo ""

# Check if dgmo is installed globally
if command -v dgmo &> /dev/null; then
    echo "Found dgmo in PATH at: $(which dgmo)"
    echo ""
    
    # Check if it's the sst version or our local version
    dgmo_path=$(which dgmo)
    if [[ $dgmo_path == *"sst"* ]]; then
        echo "This is the official SST dgmo installation"
        echo ""
        
        # We need to run it from our project directory with our fixes
        cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode
        
        # Copy our fixed subsession.go to the right place first
        echo "Applying our sub-session fixes to the system installation..."
        
        # Find where the Go source is
        go_path=$(go env GOPATH)
        if [ -z "$go_path" ]; then
            go_path="$HOME/go"
        fi
        
        sst_tui_path="$go_path/pkg/mod/github.com/sst/dgmo"
        echo "Looking for SST TUI source at: $sst_tui_path"
        
        # Just run dgmo from our project directory
        echo ""
        echo "Starting dgmo from project directory..."
        echo "Watch the terminal for any [SUB-SESSION FIX] messages"
        echo ""
        cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT
        exec dgmo
    else
        echo "Running local dgmo"
        cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT
        exec dgmo
    fi
else
    echo "dgmo not found in PATH"
    echo ""
    echo "Trying to run from opencode directory..."
    
    cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode
    
    # Check for the opencode binary
    if [ -f "packages/opencode/bin/opencode" ]; then
        echo "Found opencode binary"
        echo "Starting dgmo through opencode..."
        exec ./packages/opencode/bin/opencode run dgmo
    else
        echo "ERROR: Cannot find dgmo or opencode binary"
        echo ""
        echo "To install dgmo globally:"
        echo "npm install -g @sst/dgmo"
    fi
fi
