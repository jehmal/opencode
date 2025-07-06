#!/bin/bash

echo "Testing Enhanced Tasks UI in DGMO"
echo "================================="
echo ""
echo "This test will demonstrate the improved Tasks UI with:"
echo "- Beautiful bordered task boxes with rounded corners"
echo "- Animated spinners for running tasks"
echo "- Gradient progress bars"
echo "- Task type icons"
echo "- Elapsed time display"
echo ""
echo "To test:"
echo "1. Run: dgmo"
echo "2. Create parallel tasks with: 'create 3 agents to analyze this codebase'"
echo "3. Observe the enhanced task display with:"
echo "   - Rounded border boxes (╭─╮ characters)"
echo "   - Progress bars: [████████░░░░] 75%"
echo "   - Animated spinners: ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
echo "   - Task icons: 🔍 search, 📝 write, etc."
echo "   - Time display: ⏱ 2m 34s"
echo ""
echo "Expected appearance:"
echo "╭─ Agent 1: Analyze codebase ──────────────╮"
echo "│  ⠸ Running... [████████░░░░] 75%         │"
echo "│  ⏱  2m 34s                               │"
echo "╰──────────────────────────────────────────╯"
echo ""
echo "Press Enter to continue..."
read

# Optional: Run dgmo directly
echo "Starting DGMO..."
dgmo