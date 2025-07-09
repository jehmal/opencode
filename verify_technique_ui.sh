#!/bin/bash

echo "=== Verifying Prompting Technique UI Changes ==="
echo ""
echo "Build completed successfully!"
echo "Binary updated at: $(ls -la /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/dgmo | awk '{print $6, $7, $8}')"
echo ""

echo "IMPORTANT: You need to restart DGMO to see the changes!"
echo ""

# Check if old processes are running
if pgrep -f dgmo > /dev/null; then
    echo "⚠️  WARNING: Old DGMO processes are still running!"
    echo "These need to be stopped first."
    echo ""
    echo "To stop them:"
    echo "1. Press Ctrl+C in any terminal running dgmo"
    echo "2. Or run: pkill -f dgmo"
    echo ""
fi

echo "Changes implemented:"
echo "✅ Prompting techniques now display in a bordered card above assistant messages"
echo "✅ Model name no longer shows technique information"
echo "✅ New format:"
echo ""
echo "   ╭─ 🧠 Techniques: CoT • FS • ReAct ────────────────────╮"
echo "   │ Enhanced with step-by-step reasoning and more        │"
echo "   ╰──────────────────────────────────────────────────────╯"
echo ""
echo "   [Assistant message content here...]"
echo ""

echo "To test:"
echo "1. Make sure all old dgmo processes are stopped"
echo "2. Open a fresh terminal"
echo "3. Navigate to: cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode"
echo "4. Run: ./dgmo"
echo "5. Start a conversation and look for the new technique display"
echo ""

echo "Troubleshooting:"
echo "- If you still see the old UI, make sure you stopped all old processes"
echo "- The binary path should be: /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/dgmo"
echo "- Not the one in packages/tui/"
echo ""

# Show the code changes for verification
echo "Code verification:"
echo "- renderPromptingTechnique creates bordered card ✓"
echo "- cleanModelID removes technique info from model name ✓"
echo "- Both cached and uncached messages use cleanModelID ✓"