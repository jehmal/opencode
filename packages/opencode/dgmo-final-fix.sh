#!/bin/bash
# Final fix for dgmo working directory issue

# Instructions to fix dgmo:
echo "DGMO Working Directory Fix Instructions"
echo "======================================"
echo ""
echo "The issue is that dgmo is silently crashing. Here are 3 solutions:"
echo ""
echo "SOLUTION 1: Use the direct bun command"
echo "Add this alias to your ~/.bashrc:"
echo ""
echo 'alias dgmo="cd /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode && bun run src/index.ts"'
echo ""
echo "SOLUTION 2: Check for missing dependencies"
echo "Run these commands:"
echo "  cd /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode"
echo "  bun install"
echo ""
echo "SOLUTION 3: Use the debug wrapper"
echo "First make it executable:"
echo "  chmod +x /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-debug-wrapper.sh"
echo ""
echo "Then add this alias to your ~/.bashrc:"
echo 'alias dgmo="/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-debug-wrapper.sh"'
echo ""
echo "After adding the alias, run:"
echo "  source ~/.bashrc"
echo ""
echo "This will show debug output to help identify the issue."