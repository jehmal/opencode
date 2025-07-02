# Performance Tracking in OpenCode

## Overview

OpenCode now includes integrated performance tracking capabilities powered by the DGM Integration package. This feature allows you to monitor and analyze the performance of tool executions within your sessions.

## Configuration

To enable performance tracking, add the following to your `opencode.json` configuration file:

```json
{
  "performance": {
    "enabled": true,
    "saveReports": true,
    "maxMetrics": 1000
  }
}
```

### Configuration Options

- **enabled** (boolean, default: false): Enables or disables performance tracking
- **saveReports** (boolean, default: true): Saves performance reports to storage when sessions end
- **maxMetrics** (number, default: 1000): Maximum number of metrics to keep in memory per session

## How It Works

1. **Automatic Tracking**: When enabled, all tool executions are automatically wrapped with performance tracking
2. **Minimal Overhead**: The wrapper pattern ensures minimal performance impact when tracking is disabled
3. **Session Scoped**: Performance data is tracked per session and cleaned up when sessions are removed
4. **Persistent Reports**: Performance reports are saved to storage for later analysis

## Performance Data

Each tracked operation includes:

- Operation type (e.g., 'tool-execution')
- Duration in milliseconds
- Success/failure status
- Tool-specific metadata
- Memory usage statistics

## Accessing Performance Data

Performance data can be accessed through:

1. **Session Performance API**: Programmatic access to performance reports
2. **Storage**: Reports are saved to `session/performance/{sessionId}` 
3. **Real-time Metrics**: Live performance data available during active sessions

## Example Usage

```typescript
// Get performance report for a session
const report = SessionPerformance.getReport(sessionId);

// Get stats for specific operation type
const toolStats = SessionPerformance.getOperationStats(sessionId, 'tool-execution');

// Access detailed metrics
console.log(`Total operations: ${report.totalOperations}`);
console.log(`Average latency: ${report.averageLatency}ms`);
console.log(`Tool execution stats:`, report.operationBreakdown['tool-execution']);
```

## Performance Report Structure

```typescript
interface PerformanceReport {
  totalOperations: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  operationBreakdown: {
    [operationType: string]: {
      count: number;
      avgLatency: number;
      totalTime: number;
    }
  };
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}
```

## Best Practices

1. **Enable Selectively**: Enable performance tracking only when needed to minimize overhead
2. **Monitor Memory**: Keep an eye on the `maxMetrics` setting to prevent excessive memory usage
3. **Analyze Reports**: Regularly review performance reports to identify bottlenecks
4. **Clean Up**: Performance data is automatically cleaned up when sessions are removed

## Integration with DGM

The performance tracking system is built on top of the DGM Integration package, providing:

- High-precision timing using `performance.now()`
- Statistical analysis (percentiles, standard deviation)
- Memory usage tracking
- Extensible operation types for future enhancements