#!/bin/bash

echo "=== Restarting DGMO with New UI ==="
echo ""

# Kill any existing dgmo processes
echo "Stopping any running dgmo processes..."
pkill -f dgmo 2>/dev/null
sleep 1

# Verify they're stopped
if pgrep -f dgmo > /dev/null; then
    echo "Warning: Some dgmo processes still running. Forcing stop..."
    pkill -9 -f dgmo 2>/dev/null
    sleep 1
fi

echo "All dgmo processes stopped."
echo ""

# Show the new binary info
echo "New binary info:"
ls -la /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/dgmo
echo ""

echo "To start DGMO with the new UI:"
echo "1. Open a new terminal"
echo "2. Navigate to: cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"
echo "3. Run: ./dgmo"
echo ""
echo "The new prompting technique display will show as:"
echo "╭─ 🧠 Techniques: CoT • FS • ReAct ────────────────────╮"
echo "│ Enhanced with step-by-step reasoning and more        │"
echo "╰──────────────────────────────────────────────────────╯"
echo ""
echo "Above the assistant's message instead of next to the model name."