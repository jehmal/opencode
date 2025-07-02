#!/bin/bash

# Integration Test Runner for DGMSTT Phase 2
# This script manages the test servers and runs all integration tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PYTHON_PORT=8001
TS_PORT=8002
PYTHON_PID=""
TS_PID=""
TEST_FAILED=0

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    
    if [ ! -z "$PYTHON_PID" ]; then
        echo "Stopping Python server (PID: $PYTHON_PID)"
        kill $PYTHON_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$TS_PID" ]; then
        echo "Stopping TypeScript server (PID: $TS_PID)"
        kill $TS_PID 2>/dev/null || true
    fi
    
    # Clean up temp files
    rm -rf tmp/tests/* 2>/dev/null || true
    
    if [ $TEST_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All tests completed successfully${NC}"
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        exit 1
    fi
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Function to check if server is ready
wait_for_server() {
    local port=$1
    local name=$2
    local max_attempts=30
    local attempt=0
    
    echo -n "Waiting for $name server on port $port"
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo -e " ${RED}✗${NC}"
    echo "Server failed to start on port $port"
    return 1
}

# Parse command line arguments
VERBOSE=false
COVERAGE=false
PERF_ONLY=false
QUICK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -p|--perf)
            PERF_ONLY=true
            shift
            ;;
        -q|--quick)
            QUICK=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -v, --verbose    Enable verbose output"
            echo "  -c, --coverage   Run with coverage reporting"
            echo "  -p, --perf       Run performance tests only"
            echo "  -q, --quick      Run quick tests only (skip performance)"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Print header
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}DGMSTT Phase 2 Integration Tests${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check dependencies
echo "Checking dependencies..."

if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: bun is not installed${NC}"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: python3 is not installed${NC}"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed${NC}"
    exit 1
fi

echo -e "Dependencies ${GREEN}✓${NC}"
echo ""

# Create temp directory
mkdir -p tmp/tests

# Start Python server
echo "Starting Python tool server..."
if [ "$VERBOSE" = true ]; then
    python3 -m shared.tools.server --port $PYTHON_PORT &
else
    python3 -m shared.tools.server --port $PYTHON_PORT > /dev/null 2>&1 &
fi
PYTHON_PID=$!

# Start TypeScript server
echo "Starting TypeScript tool server..."
if [ "$VERBOSE" = true ]; then
    bun run shared/tools/server.ts --port=$TS_PORT &
else
    bun run shared/tools/server.ts --port=$TS_PORT > /dev/null 2>&1 &
fi
TS_PID=$!

# Wait for servers to be ready
wait_for_server $PYTHON_PORT "Python" || exit 1
wait_for_server $TS_PORT "TypeScript" || exit 1

echo ""
echo -e "${GREEN}Servers started successfully${NC}"
echo ""

# Function to run tests with proper error handling
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "\n${YELLOW}Running $test_name...${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✓ $test_name passed${NC}"
    else
        echo -e "${RED}✗ $test_name failed${NC}"
        TEST_FAILED=1
    fi
}

# Run tests based on options
if [ "$PERF_ONLY" = true ]; then
    # Performance tests only
    if [ "$VERBOSE" = true ]; then
        export VERBOSE_TESTS=true
    fi
    
    run_test "Performance Benchmarks" "bun test tests/integration/tool-protocol/performance.test.ts"
    
elif [ "$QUICK" = true ]; then
    # Quick tests only (no performance)
    if [ "$COVERAGE" = true ]; then
        run_test "TypeScript Tool Execution Tests" "bun test --coverage tests/integration/tool-protocol/tool-execution.test.ts"
        run_test "TypeScript Error Scenarios" "bun test --coverage tests/integration/tool-protocol/error-scenarios.test.ts"
        run_test "Python Integration Tests" "pytest tests/integration/tool-protocol/test_python_tools.py -v --cov=shared.tools"
    else
        run_test "TypeScript Tool Execution Tests" "bun test tests/integration/tool-protocol/tool-execution.test.ts"
        run_test "TypeScript Error Scenarios" "bun test tests/integration/tool-protocol/error-scenarios.test.ts"
        run_test "Python Integration Tests" "pytest tests/integration/tool-protocol/test_python_tools.py -v"
    fi
    
else
    # All tests
    if [ "$COVERAGE" = true ]; then
        run_test "TypeScript Tool Execution Tests" "bun test --coverage tests/integration/tool-protocol/tool-execution.test.ts"
        run_test "TypeScript Error Scenarios" "bun test --coverage tests/integration/tool-protocol/error-scenarios.test.ts"
        run_test "TypeScript Performance Tests" "bun test --coverage tests/integration/tool-protocol/performance.test.ts"
        run_test "Python Integration Tests" "pytest tests/integration/tool-protocol/test_python_tools.py -v --cov=shared.tools --cov-report=html"
    else
        run_test "TypeScript Tool Execution Tests" "bun test tests/integration/tool-protocol/tool-execution.test.ts"
        run_test "TypeScript Error Scenarios" "bun test tests/integration/tool-protocol/error-scenarios.test.ts"
        run_test "TypeScript Performance Tests" "bun test tests/integration/tool-protocol/performance.test.ts"
        run_test "Python Integration Tests" "pytest tests/integration/tool-protocol/test_python_tools.py -v"
    fi
fi

# Generate test report
echo -e "\n${YELLOW}Generating test report...${NC}"

# Create test report directory
mkdir -p test-results

# Generate summary
cat > test-results/summary.txt << EOF
DGMSTT Phase 2 Integration Test Results
======================================
Date: $(date)

Servers:
- Python Server: Port $PYTHON_PORT (PID: $PYTHON_PID)
- TypeScript Server: Port $TS_PORT (PID: $TS_PID)

Test Configuration:
- Verbose: $VERBOSE
- Coverage: $COVERAGE
- Performance Only: $PERF_ONLY
- Quick Mode: $QUICK

Test Status: $([ $TEST_FAILED -eq 0 ] && echo "PASSED" || echo "FAILED")
EOF

echo -e "${GREEN}Test report saved to test-results/summary.txt${NC}"

# Coverage report location
if [ "$COVERAGE" = true ]; then
    echo -e "\n${YELLOW}Coverage Reports:${NC}"
    echo "- TypeScript: coverage/lcov-report/index.html"
    echo "- Python: htmlcov/index.html"
fi