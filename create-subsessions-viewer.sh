#!/bin/bash
# Create a sub-sessions viewer that works alongside dgmo

echo "=== CREATING SUB-SESSIONS VIEWER ==="
echo ""

# Create a standalone sub-sessions viewer
cat > ~/subsessions << 'EOF'
#!/bin/bash
# Standalone sub-sessions viewer

echo "🔍 Sub-Sessions Viewer"
echo "===================="
echo ""

cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT

# Check current session
if [ -n "$DGMO_SESSION_ID" ]; then
    echo "Current session: $DGMO_SESSION_ID"
else
    echo "No session set, checking recent sessions..."
fi
echo ""

# Run the viewer
bun run show-my-subsessions.ts 2>/dev/null || {
    echo "Error running viewer. Make sure you're in the DGMSTT directory."
    echo "Try: cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT && bun run show-my-subsessions.ts"
}

echo ""
echo "Press Enter to return..."
read
EOF

chmod +x ~/subsessions

echo "✅ Created sub-sessions viewer: ~/subsessions"
echo ""
echo "Usage:"
echo "1. Run dgmo normally"
echo "2. In another terminal, run: ~/subsessions"
echo ""
echo "Or create an alias:"
echo "echo 'alias subsessions=\"~/subsessions\"' >> ~/.bashrc"
echo "source ~/.bashrc"
echo ""
echo "This gives you a way to view sub-sessions even if dgmo doesn't show them!"
