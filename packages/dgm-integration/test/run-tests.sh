#!/bin/bash

echo "🧪 Running DGM Integration Tests..."
echo "================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to package directory
cd "$(dirname "$0")/.."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not found${NC}"
    exit 1
fi

# Install Python dependencies if needed
if [ ! -d "python/venv" ]; then
    echo -e "${YELLOW}📦 Setting up Python environment...${NC}"
    python3 -m venv python/venv
    source python/venv/bin/activate
    pip install -r python/requirements.txt
else
    source python/venv/bin/activate
fi

# Make bridge.py executable
chmod +x python/bridge.py

echo -e "\n${YELLOW}1. Testing Performance Tracker...${NC}"
bun test test/performance.test.ts

echo -e "\n${YELLOW}2. Testing DGM Bridge...${NC}"
bun test test/bridge.test.ts

echo -e "\n${YELLOW}3. Testing Full Integration...${NC}"
bun test test/integration.test.ts

echo -e "\n${GREEN}✅ All tests completed!${NC}"

# Generate test report
echo -e "\n📊 Test Summary:"
bun test --coverage

echo -e "\n${YELLOW}💡 To run tests individually:${NC}"
echo "   bun test test/performance.test.ts"
echo "   bun test test/bridge.test.ts"
echo "   bun test test/integration.test.ts"