#!/bin/bash

echo "Testing debug output fix for OpenCode DGMSTT"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Production mode (default)
echo -e "${YELLOW}Test 1: Production mode (should have NO debug output)${NC}"
echo "Running: OPENCODE_ENV=production bun run src/index.ts serve --port 8812"
echo "Starting server in background..."
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode
OPENCODE_ENV=production timeout 5s bun run src/index.ts serve --port 8812 2>&1 | tee /tmp/prod-output.log &
PID=$!
sleep 3
kill $PID 2>/dev/null

OUTPUT_LINES=$(wc -l < /tmp/prod-output.log)
if [ $OUTPUT_LINES -eq 0 ]; then
    echo -e "${GREEN}✓ PASS: No debug output in production mode${NC}"
else
    echo -e "${RED}✗ FAIL: Found $OUTPUT_LINES lines of output in production mode${NC}"
    echo "Output preview:"
    head -5 /tmp/prod-output.log
fi
echo ""

# Test 2: Development mode
echo -e "${YELLOW}Test 2: Development mode (should show debug output)${NC}"
echo "Running: OPENCODE_ENV=development bun run src/index.ts serve --port 8813"
OPENCODE_ENV=development timeout 5s bun run src/index.ts serve --port 8813 2>&1 | tee /tmp/dev-output.log &
PID=$!
sleep 3
kill $PID 2>/dev/null

OUTPUT_LINES=$(wc -l < /tmp/dev-output.log)
if [ $OUTPUT_LINES -gt 0 ]; then
    echo -e "${GREEN}✓ PASS: Debug output visible in development mode ($OUTPUT_LINES lines)${NC}"
else
    echo -e "${RED}✗ FAIL: No debug output in development mode${NC}"
fi
echo ""

# Test 3: Explicit debug flag
echo -e "${YELLOW}Test 3: Explicit debug flag (should show debug output)${NC}"
echo "Running: OPENCODE_DEBUG=true bun run src/index.ts serve --port 8814"
OPENCODE_DEBUG=true timeout 5s bun run src/index.ts serve --port 8814 2>&1 | tee /tmp/debug-output.log &
PID=$!
sleep 3
kill $PID 2>/dev/null

OUTPUT_LINES=$(wc -l < /tmp/debug-output.log)
if [ $OUTPUT_LINES -gt 0 ]; then
    echo -e "${GREEN}✓ PASS: Debug output visible with OPENCODE_DEBUG=true ($OUTPUT_LINES lines)${NC}"
else
    echo -e "${RED}✗ FAIL: No debug output with OPENCODE_DEBUG=true${NC}"
fi
echo ""

# Test 4: Check for specific debug prefixes
echo -e "${YELLOW}Test 4: Checking for debug prefixes in production${NC}"
OPENCODE_ENV=production timeout 5s bun run src/index.ts serve --port 8815 2>&1 | tee /tmp/prefix-test.log &
PID=$!
sleep 3
kill $PID 2>/dev/null

if grep -q "\[TASK\]\|\[SESSION\]\|\[NAV\]\|\[SUB-SESSION\]" /tmp/prefix-test.log; then
    echo -e "${RED}✗ FAIL: Found debug prefixes in production mode${NC}"
    grep "\[TASK\]\|\[SESSION\]\|\[NAV\]\|\[SUB-SESSION\]" /tmp/prefix-test.log | head -5
else
    echo -e "${GREEN}✓ PASS: No debug prefixes found in production mode${NC}"
fi
echo ""

# Summary
echo -e "${YELLOW}Test Summary${NC}"
echo "============"
echo "Production mode should suppress ALL debug output"
echo "Development mode should show debug output"
echo "OPENCODE_DEBUG=true should force debug output"
echo ""
echo "To use in production:"
echo "  export OPENCODE_ENV=production"
echo "  dgmo"
echo ""
echo "Or use the production wrapper:"
echo "  ./dgmo-prod"

# Cleanup
rm -f /tmp/prod-output.log /tmp/dev-output.log /tmp/debug-output.log /tmp/prefix-test.log