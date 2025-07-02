# Tool Protocol Integration Tests

## Overview

This directory contains comprehensive integration tests for the DGMSTT Phase 2 Tool Protocol implementation. These tests verify cross-language tool execution via JSON-RPC between TypeScript and Python components.

## Test Structure

```
tool-protocol/
├── setup.ts                    # Test infrastructure and utilities
├── tool-execution.test.ts      # Core tool execution tests
├── error-scenarios.test.ts     # Error handling and edge cases
├── performance.test.ts         # Performance benchmarks
├── test_python_tools.py        # Python-specific tests
├── server.ts                   # TypeScript tool server
├── server.py                   # Python tool server
└── README.md                   # This file
```

## Running Tests

### Prerequisites

1. Install dependencies:
   ```bash
   # TypeScript/Node.js dependencies
   bun install
   
   # Python dependencies
   pip install -r dgm/requirements.txt
   pip install pytest pytest-asyncio aiohttp
   ```

2. Ensure both tool servers are available:
   ```bash
   # Check TypeScript server
   bun run shared/tools/server.ts --help
   
   # Check Python server
   python -m shared.tools.server --help
   ```

### Running All Tests

```bash
# Run all integration tests
make test-integration

# Or manually:
bun test tests/integration/tool-protocol/
pytest tests/integration/tool-protocol/
```

### Running Specific Test Suites

```bash
# TypeScript tests only
bun test tests/integration/tool-protocol/tool-execution.test.ts
bun test tests/integration/tool-protocol/error-scenarios.test.ts
bun test tests/integration/tool-protocol/performance.test.ts

# Python tests only
pytest tests/integration/tool-protocol/test_python_tools.py -v

# Specific test class
pytest tests/integration/tool-protocol/test_python_tools.py::TestCrossLanguageCompatibility -v
```

### Running with Coverage

```bash
# TypeScript coverage
bun test --coverage tests/integration/tool-protocol/

# Python coverage
pytest tests/integration/tool-protocol/ --cov=shared.tools --cov-report=html
```

### Running Performance Tests

```bash
# Run with verbose output
VERBOSE_TESTS=true bun test tests/integration/tool-protocol/performance.test.ts

# Run with custom iterations
PERF_ITERATIONS=1000 bun test tests/integration/tool-protocol/performance.test.ts
```

## Test Categories

### 1. Tool Execution Tests (`tool-execution.test.ts`)

Tests basic tool functionality across languages:

- **Bash Tool**: Command execution, output capture, error handling
- **Edit Tool**: File editing, multi-line edits, string replacement
- **Glob Tool**: File pattern matching, directory traversal
- **Grep Tool**: Content searching, regex patterns, file filtering
- **Cross-Language**: TypeScript calling Python tools and vice versa

### 2. Error Scenarios (`error-scenarios.test.ts`)

Tests error handling and edge cases:

- **Invalid Requests**: Missing parameters, wrong types, malformed JSON-RPC
- **File System Errors**: Non-existent files, permission errors, path traversal
- **Resource Limits**: Large files, timeouts, memory limits
- **Concurrent Operations**: Race conditions, file conflicts
- **Protocol Violations**: Invalid JSON-RPC versions, missing methods
- **Recovery Scenarios**: Retry logic, server restarts

### 3. Performance Benchmarks (`performance.test.ts`)

Measures performance metrics:

- **Latency**: Tool execution time distribution (p50, p95, p99)
- **Throughput**: Requests per second, concurrent handling
- **Resource Usage**: Memory consumption, file handle management
- **Scaling**: Performance with different file sizes and load levels

### 4. Python Tests (`test_python_tools.py`)

Python-specific testing:

- **Native Tools**: Testing Python tool implementations
- **Async Handling**: Asyncio integration and concurrency
- **Cross-Language**: Python client calling TypeScript tools
- **Error Handling**: Python-specific error scenarios

## Test Infrastructure

### Setup Functions

```typescript
// TypeScript setup
import { setupTestContext, teardownTestContext } from './setup';

const context = await setupTestContext({
  pythonPort: 8001,
  tsPort: 8002,
  timeout: 30000,
  verbose: true
});
```

```python
# Python setup
from test_python_tools import TestContext

context = TestContext()
await context.setup()
```

### Tool Execution

```typescript
// Execute a tool via JSON-RPC
const result = await executeTool(port, toolName, parameters, context);
```

### Test Utilities

- `createTestFile()`: Create temporary test files
- `readTestFile()`: Read test file contents
- `waitForEvent()`: Wait for async events with timeout
- `createMockTool()`: Create mock tools for testing

## Performance Metrics

### Expected Performance Baselines

| Metric | Target | Actual (typical) |
|--------|--------|------------------|
| Bash command latency (mean) | < 50ms | 15-25ms |
| File read latency (mean) | < 20ms | 5-10ms |
| File write latency (mean) | < 30ms | 10-20ms |
| Requests per second | > 50 | 100-200 |
| Concurrent RPS (20 threads) | > 100 | 200-400 |
| Memory overhead per operation | < 1MB | 0.1-0.5MB |

### Performance Tuning

1. **Connection Pooling**: Reuse HTTP connections
2. **Schema Caching**: Cache validated schemas
3. **Batch Operations**: Group multiple tool calls
4. **Async Execution**: Non-blocking I/O operations

## Debugging Tests

### Enable Verbose Logging

```bash
# TypeScript
VERBOSE_TESTS=true DEBUG=* bun test

# Python
pytest -v -s --log-cli-level=DEBUG
```

### Running Individual Tests

```bash
# Run a specific test
bun test -t "should execute bash commands from TypeScript"

# Run tests matching pattern
pytest -k "test_bash_tool"
```

### Inspecting Test Artifacts

Test artifacts are stored in:
- `tmp/tests/<session-id>/`: Temporary test files
- `coverage/`: Coverage reports
- `test-results/`: Test execution results

## CI/CD Integration

Tests run automatically on:
- Push to main/develop branches
- Pull requests
- Daily scheduled runs
- Multiple OS platforms (Linux, Windows, macOS)
- Multiple language versions (Node 18/20, Python 3.10/3.11/3.12)

### GitHub Actions Workflow

See `.github/workflows/integration-tests.yml` for the complete CI/CD configuration.

## Troubleshooting

### Common Issues

1. **Servers not starting**
   - Check ports 8001/8002 are available
   - Verify Python/Node.js installations
   - Check server logs for errors

2. **Test timeouts**
   - Increase timeout values in test config
   - Check for blocking operations
   - Verify network connectivity

3. **File permission errors**
   - Ensure test directory is writable
   - Check file system permissions
   - Run tests with appropriate user

4. **Cross-platform failures**
   - Check path separators (use `path.join()`)
   - Verify line ending handling
   - Test platform-specific commands

### Debug Commands

```bash
# Check server health
curl http://localhost:8001/health
curl http://localhost:8002/health

# Test JSON-RPC manually
curl -X POST http://localhost:8002/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test",
    "method": "tool.execute",
    "params": {
      "tool": "bash",
      "parameters": {"command": "echo test"}
    }
  }'
```

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Add tests for both success and failure cases
3. Include performance considerations
4. Update this documentation
5. Ensure tests pass on all platforms
6. Add appropriate test categories/tags

## Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] Stress testing with chaos engineering
- [ ] Security testing (fuzzing, injection)
- [ ] Load testing with distributed clients
- [ ] Integration with monitoring tools
- [ ] Automated performance regression detection