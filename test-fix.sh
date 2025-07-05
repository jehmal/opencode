#!/bin/bash
# Test if the fix is working by checking the output

echo "=== TESTING SUB-SESSIONS FIX ==="
echo ""

cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT

# Create a test script that will capture dgmo output
cat > test-subsessions.exp << 'EOF'
#!/usr/bin/expect -f

set timeout 30
spawn dgmo

# Wait for the UI to load
expect "Ask me anything"

# Send the /sub-sessions command
send "/sub-sessions\r"

# Look for our debug output
expect {
    "SUB-SESSION FIX" {
        puts "\n✅ FIX IS WORKING - Found debug output"
        exit 0
    }
    "No sub-sessions found" {
        puts "\n❌ FIX NOT APPLIED - Using old code"
        exit 1
    }
    timeout {
        puts "\n⚠️ Timeout - could not determine"
        exit 2
    }
}

# Exit
send "\003"
expect eof
EOF

chmod +x test-subsessions.exp

echo "Running dgmo and checking for our fix..."
echo ""

# Run the test
if command -v expect &> /dev/null; then
    ./test-subsessions.exp
else
    echo "expect not installed, running dgmo directly"
    echo "Type /sub-sessions and look for [SUB-SESSION FIX] messages"
    echo ""
    dgmo
fi

# Cleanup
rm -f test-subsessions.exp
