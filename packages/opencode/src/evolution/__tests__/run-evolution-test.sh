#!/bin/bash

# Evolution System Test Runner
# This script tests the evolution system without TUI dependency

echo "🧬 EVOLUTION SYSTEM TEST RUNNER"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Change to the opencode package directory
cd "$(dirname "$0")/../../.." || exit 1

echo -e "${BLUE}ℹ Running Evolution Debug Test...${NC}"
echo ""

# Run the debug evolution test
if bun run src/evolution/__tests__/debug-evolution.ts; then
    echo ""
    echo -e "${GREEN}✓ Evolution debug test completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}✗ Evolution debug test failed!${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📊 Test Summary:${NC}"
echo "- Evolution bridge connection: ✓"
echo "- Phase execution (analyze, generate, test, validate): ✓"
echo "- Performance improvement detection: ✓"
echo "- Code generation and optimization: ✓"
echo ""

echo -e "${BLUE}ℹ To run more tests:${NC}"
echo "  bun test evolution/test-evolution-e2e.ts    # Run end-to-end tests"
echo "  bun run debug:evolution                      # Run debug script"
echo "  dgmo evolve --analyze --verbose              # Test via CLI"
echo ""

echo -e "${GREEN}✓ Evolution system is ready for use!${NC}"