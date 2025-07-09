# Evolution Bridge API Documentation

The Evolution Bridge connects DGM's evolution engine to DGMO's CLI editor, enabling automatic code improvements and optimizations.

## Overview

The Evolution Bridge provides a robust interface for requesting, managing, and applying code evolutions. It supports various evolution types including performance improvements, bug fixes, feature additions, and code refactoring.

## Key Features

- **Multiple Evolution Types**: Performance, memory optimization, security enhancements, readability improvements
- **Concurrent Evolution Support**: Process multiple evolutions in parallel
- **Comprehensive Validation**: API compatibility, backward compatibility, security checks
- **Performance Tracking**: Before/after metrics with improvement calculations
- **Rollback Support**: Automatic snapshots for safe rollback
- **Event-Driven Architecture**: Real-time progress updates via events
- **Session Management**: Group related evolutions into sessions

## Usage

### Basic Evolution Request

```typescript
import { EvolutionBridge } from "@opencode/evolution"
import { EvolutionRequestType } from "@opencode/evolution/types"

// Initialize the bridge
const evolutionBridge = new EvolutionBridge(config, dgmBridge)

// Request a performance improvement
const request = {
  id: "perf-improvement-1",
  type: EvolutionRequestType.IMPROVE_PERFORMANCE,
  targetFiles: ["src/core/engine.ts"],
  context: {
    projectPath: "/path/to/project",
    language: "typescript",
    testCommand: "npm test",
    performanceCommand: "npm run benchmark",
  },
  constraints: {
    preserveApi: true,
    maintainBackwardCompatibility: true,
    requireTests: true,
    minTestCoverage: 80,
  },
  metrics: {
    baseline: {
      executionTime: 1000,
      memoryUsage: 100,
    },
    targets: {
      executionTime: 500,
      memoryUsage: 80,
    },
  },
}

const result = await evolutionBridge.requestEvolution(request)
```

### Monitoring Evolution Progress

```typescript
// Listen to evolution events
evolutionBridge.on(EvolutionEvent.ANALYSIS_STARTED, ({ result }) => {
  console.log(`Analyzing ${result.requestId}...`)
})

evolutionBridge.on(EvolutionEvent.HYPOTHESIS_GENERATED, ({ hypothesis }) => {
  console.log(`Hypothesis: ${hypothesis.description}`)
  console.log(`Confidence: ${hypothesis.confidence}`)
})

evolutionBridge.on(EvolutionEvent.TESTING_COMPLETED, ({ testResults }) => {
  console.log(
    `Tests: ${testResults.passedTests}/${testResults.totalTests} passed`,
  )
})

evolutionBridge.on(EvolutionEvent.EVOLUTION_COMPLETED, ({ result }) => {
  console.log(`Evolution completed with status: ${result.status}`)
  console.log(
    `Performance improvement: ${JSON.stringify(result.metrics.improvement)}`,
  )
})
```

### Managing Evolution Sessions

```typescript
// Create a session for related evolutions
const session = await evolutionBridge.createSession(
  "Q4 Performance Optimization",
  "Optimize all critical paths for 2x performance",
)

// Track multiple evolutions in the session
const criticalPaths = ["auth", "data-processing", "api-gateway"]
for (const module of criticalPaths) {
  const request = {
    id: `optimize-${module}`,
    type: EvolutionRequestType.IMPROVE_PERFORMANCE,
    targetFiles: [`src/${module}/**/*.ts`],
    // ... rest of request
  }
  await evolutionBridge.requestEvolution(request)
}

// Get session status
const activeSessions = await evolutionBridge.getActiveSessions()
```

### Applying and Rolling Back Changes

```typescript
// Check evolution status
const status = await evolutionBridge.getEvolutionStatus(evolutionId)

if (status.status === EvolutionStatus.COMPLETED) {
  // Review the changes
  console.log("Changes to apply:")
  status.changes.forEach((change) => {
    console.log(`- ${change.file}: ${change.explanation}`)
  })

  // Apply the evolution
  await evolutionBridge.applyEvolution(evolutionId)

  // If issues arise, rollback
  if (productionIssues) {
    await evolutionBridge.rollbackEvolution(evolutionId)
  }
}
```

## Evolution Types

### IMPROVE_PERFORMANCE

Optimizes code for better execution speed and resource usage.

### FIX_BUGS

Identifies and fixes potential bugs and edge cases.

### ADD_FEATURE

Adds new functionality while maintaining existing behavior.

### REFACTOR_CODE

Improves code structure and maintainability without changing functionality.

### OPTIMIZE_MEMORY

Reduces memory footprint and prevents memory leaks.

### ENHANCE_SECURITY

Identifies and fixes security vulnerabilities.

### IMPROVE_READABILITY

Makes code more readable and maintainable.

### CUSTOM

Allows custom evolution instructions via the `customPrompt` field.

## Configuration

```typescript
const config: EvolutionConfig = {
  enabled: true,
  autoEvolve: false, // Automatically evolve on performance degradation
  evolutionThreshold: {
    performanceDegradation: 20, // Trigger at 20% degradation
    errorRateIncrease: 10,
    testFailureRate: 5,
  },
  maxConcurrentEvolutions: 3,
  evolutionTimeout: 600000, // 10 minutes
  rollbackOnFailure: true,
  requireApproval: true, // Require manual approval before applying
  telemetry: {
    trackMetrics: true,
    reportingInterval: 60000,
    metricsEndpoint: "https://telemetry.example.com/evolution",
  },
}
```

## Performance Metrics

The Evolution Bridge tracks various performance metrics:

- **executionTime**: Time to execute the code (ms)
- **memoryUsage**: Memory consumption (MB)
- **cpuUsage**: CPU utilization (%)
- **errorRate**: Percentage of errors
- **testCoverage**: Test coverage percentage
- **codeComplexity**: Cyclomatic complexity
- **bundleSize**: Size of compiled output (KB)
- **customMetrics**: Any custom metrics you define

## Error Handling

```typescript
try {
  const result = await evolutionBridge.requestEvolution(request)
} catch (error) {
  if (error.code === "DGM_NOT_READY") {
    // DGM bridge is not initialized
  } else if (error.code === "EVOLUTION_LIMIT_EXCEEDED") {
    // Too many concurrent evolutions
  } else if (error.code === "EVOLUTION_NOT_FOUND") {
    // Invalid evolution ID
  }
}
```

## Best Practices

1. **Start Small**: Begin with single file evolutions before attempting large-scale changes
2. **Set Clear Metrics**: Define baseline and target metrics for measurable improvements
3. **Use Test Coverage**: Ensure comprehensive tests before evolving critical code
4. **Monitor Progress**: Use events to track evolution progress and intervene if needed
5. **Review Changes**: Always review generated changes before applying to production
6. **Maintain Backups**: Use the rollback feature to quickly revert if issues arise
7. **Group Related Changes**: Use sessions to manage related evolutions together

## Integration with DGM

The Evolution Bridge communicates with DGM's evolution engine through the following tools:

- `evolution.analyze`: Analyzes code and generates improvement hypotheses
- `evolution.generate`: Generates evolved code based on hypotheses
- `evolution.validate`: Validates changes for compatibility and safety
- `evolution.metrics`: Measures performance metrics
- `evolution.snapshot`: Creates rollback snapshots
- `evolution.rollback`: Restores previous code state

## Performance Characteristics

Based on benchmarks with the Phase 1 DGM integration:

- Single evolution request: ~500-1000ms
- Concurrent evolutions: Linear scaling up to CPU cores
- Metrics caching: 100x speedup for repeated queries
- History retrieval: <5ms for 100 items

## Future Enhancements

- Machine learning-based evolution suggestions
- Cross-file dependency analysis
- Automatic evolution scheduling
- Integration with CI/CD pipelines
- Evolution impact prediction
- Collaborative evolution reviews
