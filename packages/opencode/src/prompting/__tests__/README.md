# Prompting Techniques Test Suite

This directory contains comprehensive tests for the DGMO Native Prompting Techniques system.

## Test Structure

### Core Test Files

1. **prompting.test.ts** - Main unit tests

   - Technique Registry tests
   - Individual technique validation
   - Technique selection logic
   - Prompt composition strategies
   - Learning system functionality
   - Error handling

2. **integration.test.ts** - Integration tests

   - Session integration
   - Task tool integration
   - Performance tracking
   - End-to-end workflows
   - Multi-agent coordination
   - Error recovery

3. **performance.test.ts** - Performance benchmarks

   - Technique selection overhead (<50ms target)
   - Composition performance
   - Concurrent operations
   - Memory usage stability
   - Edge cases and stress tests

4. **fixtures.ts** - Test data and utilities
   - Sample tasks (simple, complex, multi-agent)
   - Context builders
   - Constraint fixtures
   - Performance history generators
   - Mock configurations

## Running Tests

```bash
# Run all prompting tests
bun test src/prompting/__tests__

# Run specific test file
bun test src/prompting/__tests__/prompting.test.ts

# Run with coverage
bun test --coverage src/prompting/__tests__

# Run performance tests only
bun test src/prompting/__tests__/performance.test.ts
```

## Test Coverage Goals

- **Unit Tests**: >90% coverage of all techniques and core components
- **Integration Tests**: Cover all major workflows and integration points
- **Performance Tests**: Ensure <50ms overhead for technique selection/composition

## Key Test Scenarios

### 1. Technique Registry

- Initialization with all 18 techniques
- Retrieval by ID, category, and search criteria
- Validation and duplicate prevention
- Cache efficiency

### 2. Individual Techniques

Each technique is tested for:

- Correct metadata and configuration
- Input validation
- Prompt generation
- Context handling
- Error cases

### 3. Selection Logic

- Task analysis accuracy
- Constraint handling
- Capability matching
- Performance-based adaptation

### 4. Composition

- Single technique composition
- Multiple technique coordination
- Nested composition strategies
- Token limit compliance

### 5. Integration

- Session context preservation
- Sub-agent technique inheritance
- Performance tracking across sessions
- Multi-agent workflows

### 6. Performance

- Sub-50ms selection overhead
- Efficient concurrent handling
- Stable performance over time
- Memory efficiency

## Mock Implementations

The test suite includes several mock implementations to isolate components:

- **MockTechniqueCache**: In-memory cache with hit rate tracking
- **MockTechniqueLoader**: Pre-loaded techniques without file I/O
- **MockSession**: Simulated session with capabilities
- **MockPerformanceTracker**: In-memory performance recording

## Adding New Tests

When adding new techniques or features:

1. Add unit tests in `prompting.test.ts`
2. Add integration scenarios in `integration.test.ts`
3. Add performance benchmarks if relevant
4. Update fixtures with new test data
5. Ensure tests pass and meet coverage goals

## Performance Targets

- Technique selection: <50ms (p90)
- Single composition: <20ms (p90)
- Multiple composition: <50ms (p90)
- Concurrent operations: Linear scaling
- Cache hit rate: >80% after warmup

## Debugging Tests

Use these environment variables for debugging:

```bash
# Enable verbose logging
DEBUG=prompting:* bun test

# Run specific test
bun test -t "should select techniques within 50ms"

# Generate performance report
PERF_REPORT=true bun test performance.test.ts
```

## Known Issues

1. Some advanced techniques are exported as const objects rather than classes
2. The TechniqueSelector.analyzeTask method needs implementation
3. Integration with actual DGMO session requires mocking

## Future Improvements

1. Add visual regression tests for prompt output
2. Implement property-based testing for technique validation
3. Add benchmarks for real-world task scenarios
4. Create integration tests with actual LLM responses
5. Add tests for technique learning and adaptation
