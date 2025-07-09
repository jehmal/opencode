# Evolution System Integration Tests

## Overview

Comprehensive test suite validating the complete DGMO-DGM evolution cycle.

## Architecture

The integration test suite validates the interaction between all Phase 2 components:

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│ Evolution       │────▶│ Usage        │────▶│ Pattern     │
│ Orchestrator    │     │ Analyzer     │     │ Detection   │
└────────┬────────┘     └──────────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│ Evolution       │────▶│ Sandbox      │────▶│ Performance │
│ Bridge          │     │ Manager      │     │ Validator   │
└─────────────────┘     └──────────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│ Evolution       │────▶│ Deployment   │────▶│ Post-Deploy │
│ UI              │     │ Manager      │     │ Monitor     │
└─────────────────┘     └──────────────┘     └─────────────┘
```

## Test Categories

### 1. Component Integration

Tests the communication and data flow between components:

- Bridge ↔ Orchestrator communication
- Analyzer ↔ Bridge hypothesis flow
- Sandbox ↔ Validator interaction
- UI ↔ Orchestrator events

### 2. Evolution Lifecycle

Validates the complete evolution process:

- Pattern detection → Hypothesis generation
- Evolution creation → Sandbox testing
- Validation → Approval → Deployment
- Monitoring → Rollback (if needed)

### 3. Safety Validation

Ensures system safety and reliability:

- Dangerous pattern detection
- Resource limit enforcement
- API compatibility checking
- Rollback mechanism testing

### 4. Performance Regression

Prevents performance degradation:

- Baseline establishment
- Evolution performance comparison
- Statistical significance validation
- Long-term trend analysis

### 5. Deployment Strategies

Tests different deployment approaches:

- Direct deployment (low risk)
- Canary deployment (medium risk)
- Blue-green deployment (high risk)
- Rollback scenarios

### 6. Load Testing

Validates system behavior under stress:

- Concurrent evolution handling
- Queue management
- Performance under load
- Resource usage monitoring

## Running Tests

### Run All Integration Tests

```bash
# Run complete integration test suite
bun test:integration

# Run with coverage
bun test:integration --coverage

# CI mode (with reporting)
bun test:integration --ci
```

### Run Specific Test Suite

```bash
# Run a specific test category
bun test:integration --suite=evolution-lifecycle

# Available suites:
# - component-integration
# - evolution-lifecycle
# - safety-validation
# - performance-regression
# - deployment-strategies
# - load-testing
```

### Run Individual Test Files

```bash
# Run pattern detection tests
bun test src/evolution/__tests__/integration/test-phases/pattern-detection.test.ts

# Run performance scenario
bun test src/evolution/__tests__/integration/scenarios/performance-improvement.test.ts
```

### Watch Mode (Development)

```bash
# Run tests in watch mode
bun test:integration --watch

# Watch specific suite
bun test:integration --watch --suite=safety-validation
```

## Test Data and Fixtures

Test fixtures are located in `__fixtures__/`:

### `slow-performance.json`

Simulates performance bottlenecks:

```json
{
  "patterns": [
    {
      "type": "performance-hotspot",
      "tool": "bash",
      "avgDuration": 500,
      "occurrences": 100
    }
  ]
}
```

### `breaking-changes.json`

Examples of breaking evolutions:

```json
{
  "changes": [
    {
      "file": "api.js",
      "type": "signature-change",
      "risk": "high"
    }
  ]
}
```

### `success-patterns.json`

Successful evolution patterns:

```json
{
  "evolutions": [
    {
      "type": "performance",
      "improvement": 0.25,
      "risk": 0.1
    }
  ]
}
```

## Test Environment

### Required Services

- **DGM Service**: http://localhost:8000
  - Optional - tests run in offline mode if unavailable
- **Qdrant**: http://localhost:6333
  - Optional - memory tests skipped if unavailable

### Environment Variables

```bash
# Test mode
NODE_ENV=test
EVOLUTION_TEST_MODE=true

# Service configuration
DGM_API_URL=http://localhost:8000
QDRANT_URL=http://localhost:6333

# Test configuration
TEST_TIMEOUT=60000
TEST_CONCURRENCY=3
```

## Writing New Tests

### Test Structure

```typescript
describe("Feature Name", () => {
  let suite: EvolutionIntegrationTestSuite

  beforeAll(async () => {
    suite = new EvolutionIntegrationTestSuite()
    await suite.setup()
  })

  afterAll(async () => {
    await suite.teardown()
  })

  it("should test specific behavior", async () => {
    // Arrange
    const hypothesis = TestUtilities.createMockHypothesis("performance")

    // Act
    const result = await suite.components.bridge.requestEvolution({
      hypothesis,
      constraints: {},
    })

    // Assert
    expect(result).toBeDefined()
    expect(result.status).toBe("completed")
  })
})
```

### Test Utilities

The `TestUtilities` class provides helpers:

- `simulateUsagePattern()` - Create usage patterns
- `waitForEvolution()` - Wait for evolution completion
- `createMockHypothesis()` - Generate test hypotheses
- `createBottleneckPatterns()` - Simulate performance issues
- `percentile()` - Calculate statistical percentiles

## CI/CD Integration

### GitHub Actions

```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test:integration --ci
      - uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: test-reports/
```

### Test Reports

Reports are generated in `test-reports/`:

- `integration-test-report-{timestamp}.json` - Full test results
- `coverage/lcov-report/index.html` - Coverage report

## Troubleshooting

### Common Issues

1. **Tests timing out**
   - Increase timeout: `TEST_TIMEOUT=120000`
   - Check service availability
   - Reduce concurrent tests

2. **Service connection errors**
   - Ensure DGM and Qdrant are running
   - Check firewall/network settings
   - Tests run in offline mode automatically

3. **Resource exhaustion**
   - Reduce `TEST_CONCURRENCY`
   - Increase memory limits
   - Run suites individually

### Debug Mode

```bash
# Enable debug logging
DEBUG=evolution:* bun test:integration

# Verbose output
bun test:integration --verbose

# Single test with debugging
bun test:integration --grep="specific test name"
```

## Performance Benchmarks

Expected test execution times:

- Component Integration: ~5s
- Evolution Lifecycle: ~10s
- Safety Validation: ~8s
- Performance Regression: ~12s
- Deployment Strategies: ~15s
- Load Testing: ~20s

Total suite execution: ~70s

## Coverage Goals

Target coverage metrics:

- **Overall**: 90%+
- **Critical paths**: 100%
- **Error handling**: 95%+
- **Edge cases**: 85%+

## Contributing

When adding new features:

1. Write unit tests first
2. Add integration tests for component interactions
3. Include scenario tests for end-to-end flows
4. Update this documentation
5. Ensure CI passes before merging
