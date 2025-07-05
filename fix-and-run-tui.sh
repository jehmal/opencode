#!/bin/bash
# Fix the TUI startup issue and run it properly

echo "=== FIXING TUI STARTUP ==="
echo ""

# First, let's check what's causing the JSON error
echo "1. Checking for app config issues..."

# Navigate to the correct directory
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode

# Check if there's a config file issue
if [ -f ".opencode/config.json" ]; then
    echo "Found config file, checking validity:"
    cat .opencode/config.json | jq . > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "❌ Invalid JSON in config file"
        echo "Creating backup and fixing..."
        cp .opencode/config.json .opencode/config.json.backup
        echo '{}' > .opencode/config.json
    else
        echo "✅ Config file is valid"
    fi
else
    echo "No config file found, creating default..."
    mkdir -p .opencode
    echo '{}' > .opencode/config.json
fi

# Initialize the app if needed
echo ""
echo "2. Initializing the app..."
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode
bun run packages/opencode/bin/opencode.js init

# Now build and run the TUI from the project root
echo ""
echo "3. Building the fixed TUI..."
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui
go build -o dgmo-fixed cmd/dgmo/main.go

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "4. Starting the fixed TUI..."
    echo "Running from project directory: /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"
    echo ""
    
    # Run from the project directory
    cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode
    exec /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/tui/dgmo-fixed
else
    echo "❌ Build failed"
fi
