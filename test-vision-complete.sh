#!/bin/bash

# DGMO Vision Capabilities Test Script
# Tests both CLI and TUI vision functionality

echo "================================================"
echo "DGMO Vision Capabilities Test Suite"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_pattern="$3"
    
    echo -n "Testing: $test_name... "
    
    # Run the command and capture output
    output=$(eval "$command" 2>&1)
    
    # Check if the expected pattern is found
    if echo "$output" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAILED${NC}"
        echo "  Command: $command"
        echo "  Expected: $expected_pattern"
        echo "  Got: $output"
        ((TESTS_FAILED++))
    fi
}

# Create test images if they don't exist
echo "Setting up test environment..."
echo ""

# Use the existing screenshot for testing
TEST_IMAGE="Screenshot 2025-07-03 095403.png"
if [ -f "$TEST_IMAGE" ]; then
    echo "Using existing image: $TEST_IMAGE"
else
    echo -e "${RED}Error: Test image not found: $TEST_IMAGE${NC}"
    exit 1
fi

# Test 1: CLI - Read tool with image
echo ""
echo "=== CLI Tests ==="
echo ""

run_test "CLI: Read tool handles images" \
    "dgmo run 'read \"$TEST_IMAGE\"' 2>&1 | head -30" \
    "PNG image\\|image content\\|screenshot"

# Test 2: CLI - Direct image analysis
run_test "CLI: Direct image analysis" \
    "dgmo run 'analyze \"$TEST_IMAGE\"' 2>&1 | head -20" \
    "Screenshot"

# Test 3: CLI - Multiple images
run_test "CLI: Multiple images support" \
    "dgmo run 'compare \"$TEST_IMAGE\" and \"$TEST_IMAGE\"' 2>&1 | head -20" \
    "Screenshot"

# Test 4: CLI - Image with quotes
run_test "CLI: Quoted image paths" \
    "dgmo run 'look at \"$TEST_IMAGE\"' 2>&1 | head -20" \
    "Screenshot"

# Test 5: CLI - Non-existent image handling
run_test "CLI: Non-existent image error" \
    "dgmo run 'analyze non-existent-image.png' 2>&1" \
    "not found\\|does not exist"

# Test 6: Read tool description check
echo ""
echo "=== Read Tool Tests ==="
echo ""

# Check if Read tool description mentions image support
if grep -q "read images" /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/tool/read.txt; then
    echo -e "Read tool description: ${GREEN}Correctly mentions image support${NC}"
    ((TESTS_PASSED++))
else
    echo -e "Read tool description: ${RED}Missing image support mention${NC}"
    ((TESTS_FAILED++))
fi

# Check if Read tool implementation handles images
if grep -q "isImageFile" /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/tool/read.ts; then
    echo -e "Read tool implementation: ${GREEN}Has image handling code${NC}"
    ((TESTS_PASSED++))
else
    echo -e "Read tool implementation: ${RED}Missing image handling code${NC}"
    ((TESTS_FAILED++))
fi

# TUI Tests (Manual)
echo ""
echo "=== TUI Manual Test Instructions ==="
echo ""
echo "To test TUI vision capabilities:"
echo "1. Start TUI: dgmo"
echo "2. Type: analyze \"$TEST_IMAGE\""
echo "   - Should show: ✅ Loaded image: $TEST_IMAGE"
echo "   - Should show: 📎 Image: $TEST_IMAGE in message"
echo "3. Type: read \"$TEST_IMAGE\""
echo "   - Should acknowledge image file, not throw error"
echo "4. Type: what do you see in \"$TEST_IMAGE\"?"
echo "   - Should analyze the image content"
echo ""
echo "Common issues to check:"
echo "- Ensure you're using a vision-capable model (Claude 3, GPT-4V)"
echo "- Check that feedback appears in TUI, not console"
echo "- Verify image indicators (📎) show in messages"
echo ""

# Summary
echo "================================================"
echo "Test Summary"
echo "================================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All automated tests passed!${NC}"
    echo "Please run the manual TUI tests to complete verification."
    exit 0
else
    echo -e "${RED}Some tests failed. Please check the output above.${NC}"
    exit 1
fi