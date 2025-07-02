#!/bin/bash
# Setup DGMO (DGM + OpenCode) as a global command

echo "🚀 Setting up DGMO (Self-Improving OpenCode)..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Create the dgmo wrapper script
echo "Creating dgmo command..."
cat > "$SCRIPT_DIR/opencode/dgmo" << 'EOF'
#!/usr/bin/env bash
# DGMO - Self-Improving AI Coding Assistant
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
exec bun "$DIR/packages/opencode/src/index.ts" "$@"
EOF

chmod +x "$SCRIPT_DIR/opencode/dgmo"

# Create global command in /usr/local/bin (system-wide)
echo "Installing dgmo globally..."
sudo ln -sf "$SCRIPT_DIR/opencode/dgmo" /usr/local/bin/dgmo

# Alternative: Install to user's local bin (no sudo needed)
mkdir -p "$HOME/.local/bin"
ln -sf "$SCRIPT_DIR/opencode/dgmo" "$HOME/.local/bin/dgmo"

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo ""
    echo "⚠️  Add this to your ~/.bashrc or ~/.zshrc:"
    echo 'export PATH="$HOME/.local/bin:$PATH"'
    echo ""
    echo "Then run: source ~/.bashrc"
fi

# Test the command
if command -v dgmo &> /dev/null; then
    echo "✅ Success! You can now use 'dgmo' from anywhere!"
    echo ""
    echo "Try these commands:"
    echo "  dgmo --help"
    echo "  dgmo run \"create a Python script\""
    echo "  dgmo evolve --analyze"
    echo "  dgmo tui"
else
    echo "⚠️  'dgmo' command not found in PATH"
    echo "Try: $HOME/.local/bin/dgmo --help"
fi

# Create a quick reference
cat > "$SCRIPT_DIR/DGMO_COMMANDS.txt" << 'EOF'
DGMO - DGM OpenCode Commands
============================

Basic Usage:
  dgmo                        # Start interactive TUI
  dgmo run "task"            # Run a specific task
  dgmo auth list             # Check authentication

Evolution Commands:
  dgmo evolve                # Analyze and evolve
  dgmo evolve --analyze      # Just analyze, no changes
  dgmo evolve --auto-apply   # Apply improvements automatically
  dgmo evolve --verbose      # Show detailed information

What Self-Improves:
- Tool error handling
- Command execution patterns
- File operation efficiency
- Error recovery strategies
- Performance optimizations
EOF

echo ""
echo "📖 Created DGMO_COMMANDS.txt for reference"
echo ""
echo "DGMO = DGM (Darwin Gödel Machine) + OpenCode"
echo "Your AI assistant that learns and improves from usage!"