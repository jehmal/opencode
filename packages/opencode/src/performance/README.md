# Performance Tracking System

A comprehensive performance tracking system for DGMO-DGM integration that collects metrics, analyzes usage patterns, and provides insights for tool execution optimization.

## Features

- **Tool Execution Metrics**: Track execution time, success rates, memory usage, and I/O sizes
- **Usage Pattern Analysis**: Identify common tool sequences and predict next likely tools
- **Performance Analytics**: Generate insights about bottlenecks, error-prone tools, and optimization opportunities
- **Persistent Storage**: Save and load performance data for historical analysis
- **Decorators**: Easy-to-use decorators for wrapping tools with performance tracking
- **Integration with DGM**: Compatible with DGM evolution analysis for AI system improvement

## Architecture

```
performance/
├── metrics-collector.ts    # Core metrics collection
├── decorators.ts          # Performance tracking decorators
├── usage-patterns.ts      # Pattern analysis and prediction
├── analytics.ts           # Analytics engine
├── storage.ts             # Persistence layer
├── integration.ts         # High-level API
└── types.ts              # Type definitions
```

## Usage

### 1. Initialize Performance Tracking

```typescript
import { PerformanceIntegration } from "@opencode/opencode/performance"

// Initialize the system
await PerformanceIntegration.initialize()
```

### 2. Wrap Tools with Performance Tracking

```typescript
import { PerformanceIntegration } from "@opencode/opencode/performance"
import { tools } from "./tools"

// Wrap all tools with performance tracking
const trackedTools = await PerformanceIntegration.wrapTools(tools)
```

### 3. Track Custom Metrics

```typescript
import { MetricsCollector } from "@opencode/opencode/performance"

// Start tracking
const executionId = MetricsCollector.startToolExecution(
  "my-tool",
  sessionId,
  messageId,
  inputData,
)

try {
  // Execute your tool
  const result = await executeMyTool(inputData)

  // Complete tracking with success
  MetricsCollector.completeToolExecution(executionId, true, result)
} catch (error) {
  // Complete tracking with failure
  MetricsCollector.completeToolExecution(executionId, false, null, error)
}
```

### 4. Get Performance Insights

```typescript
import { PerformanceIntegration } from "@opencode/opencode/performance"

// Get insights for current sessions
const insights = await PerformanceIntegration.getInsights()

console.log("Top tools:", insights.topTools)
console.log("Bottlenecks:", insights.bottlenecks)
console.log("Error-prone tools:", insights.errorProne)
console.log("Recommendations:", insights.recommendations)
```

### 5. Analyze Usage Patterns

```typescript
import { UsagePatternTracker } from "@opencode/opencode/performance"

// Get most common patterns
const patterns = UsagePatternTracker.getMostCommonPatterns(10)

// Predict next tools based on current sequence
const predictions = UsagePatternTracker.predictNextTools(["read", "grep"], 5)

// Find error-prone patterns
const errorPatterns = UsagePatternTracker.getErrorPronePatterns()
```

### 6. Generate Analytics Reports

```typescript
import { PerformanceIntegration } from "@opencode/opencode/performance"

// Get comprehensive report for a session
const report = await PerformanceIntegration.getSessionReport(sessionId)

// Export all data
const allData = await PerformanceIntegration.exportAllData()
```

## Configuration

Add to your config file:

```typescript
{
  performance: {
    enabled: true,              // Enable performance tracking
    saveReports: true,          // Save reports to storage
    maxMetrics: 1000,          // Max metrics to keep in memory
    trackMemory: true,         // Track memory usage
    trackPatterns: true,       // Track usage patterns
    analyticsInterval: 300000  // Analytics interval (5 minutes)
  }
}
```

## Decorator Options

```typescript
import { trackPerformance } from '@opencode/opencode/performance';

// Basic tracking
@trackPerformance()
export const MyTool = Tool.define({...});

// With options
@trackPerformance({
  sampleRate: 0.1,        // Sample 10% of executions
  trackMemory: true,      // Track memory usage
  trackInputOutput: true, // Track I/O sizes
  customMetadata: {       // Add custom metadata
    version: '1.0.0'
  }
})
export const MyHighFrequencyTool = Tool.define({...});
```

## Storage Structure

Performance data is stored in:

```
performance/
├── metrics/
│   └── {sessionId}        # Tool execution metrics
├── patterns/
│   └── {sessionId}        # Usage patterns
└── analytics/
    └── {sessionId}        # Analytics reports
```

## Integration with SessionPerformance

The system integrates with the existing SessionPerformance module:

```typescript
import { SessionPerformance } from "@opencode/opencode/session/performance"

// Get tracker for session
const tracker = SessionPerformance.getTracker(sessionId)

// Performance tracking automatically updates session tracker
```

## Best Practices

1. **Selective Tracking**: Use sampling for high-frequency tools to reduce overhead
2. **Memory Tracking**: Enable memory tracking only for memory-intensive tools
3. **Pattern Analysis**: Run pattern analysis periodically, not on every execution
4. **Storage Cleanup**: Use `PerformanceStorage.cleanup()` to remove old data
5. **Export Data**: Regularly export data for backup and external analysis

## Performance Impact

The tracking system is designed to have minimal impact:

- Async operations don't block tool execution
- Configurable sampling reduces overhead
- Memory tracking is optional
- Storage operations are batched

## Future Enhancements

- Real-time performance dashboards
- Machine learning for anomaly detection
- Integration with external monitoring systems
- Cost estimation based on resource usage
- Automatic optimization suggestions
