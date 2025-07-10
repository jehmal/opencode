# Evolution System Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common issues with the DGMO-DGM Evolution System. The evolution system enables self-improving code through automated analysis, generation, testing, and validation phases.

## Quick Diagnostics

### 1. Test Evolution Without TUI

Run the debug script to test evolution directly:

```bash
# Run debug test
bun run /opencode/packages/opencode/src/evolution/__tests__/debug-evolution.ts

# Expected output:
# ✓ Created test directory
# ✓ Created test file with inefficient code
# ✓ Created evolution bridge
# ℹ Phase: Analysis started
# ℹ Phase: Generation started
# ℹ Phase: Testing started
# ℹ Phase: Validation started
# ✓ Evolution completed successfuly
```

### 2. Check Bridge Connection

Verify DGM bridge is connected:

```bash
# In your code or REPL
const bridge = await getDGMBridge()
console.log('Bridge status:', bridge.status)
// Should output: Bridge status: ready
```

## Common Issues and Solutions

### Issue 1: Evolution Not Starting

**Symptoms:**

- No evolution suggestions appear
- `dgmo evolve --analyze` shows no output
- Evolution commands seem to do nothing

**Diagnosis:**

```typescript
// Check if evolution is enabled
const config = await evolutionConfigManager.getConfig()
console.log("Evolution enabled:", config.enabled)
console.log("Auto-evolve:", config.autoEvolve)
```

**Solutions:**

1. Enable evolution in config:

   ```typescript
   await evolutionConfigManager.updateConfig({
     enabled: true,
     autoEvolve: true,
   })
   ```

2. Ensure minimum samples:

   ```bash
   dgmo evolve --analyze --min-samples 1
   ```

3. Check performance data exists:
   ```typescript
   const metrics = await bridge.getPerformanceMetrics(["target-file.ts"])
   console.log("Metrics:", metrics)
   ```

### Issue 2: DGM Bridge Not Connected

**Symptoms:**

- Error: "DGM bridge is not ready"
- Evolution requests fail immediately
- No communication with DGM

**Diagnosis:**

```typescript
// Check bridge initialization
console.log("DGM Bridge:", dgmBridge)
console.log("Status:", dgmBridge?.status)
console.log("Tools available:", dgmBridge?.availableTools)
```

**Solutions:**

1. Ensure DGM is running:

   ```bash
   # Check DGM process
   ps aux | grep dgm

   # Start DGM if needed
   dgm start
   ```

2. Verify bridge configuration:

   ```typescript
   const bridgeConfig = {
     endpoint: process.env.DGM_ENDPOINT || "http://localhost:3000",
     apiKey: process.env.DGM_API_KEY,
   }
   ```

3. Test bridge connection:
   ```typescript
   const health = await dgmBridge.healthCheck()
   console.log("DGM Health:", health)
   ```

### Issue 3: Evolution Phases Not Executing

**Symptoms:**

- Evolution starts but doesn't complete
- Stuck in "analyzing" or "generating" phase
- No hypothesis generated

**Diagnosis:**

```typescript
// Track phase execution
bridge.on("evolution:analysis:started", () => console.log("Analysis started"))
bridge.on("evolution:generation:started", () =>
  console.log("Generation started"),
)
bridge.on("evolution:testing:started", () => console.log("Testing started"))
bridge.on("evolution:validation:started", () =>
  console.log("Validation started"),
)
```

**Solutions:**

1. Check tool implementations:

   ```typescript
   // Verify DGM tools are registered
   const analyzeResult = await dgmBridge.executeTool("evolution.analyze", {
     type: "improve_performance",
     targetFiles: ["test.js"],
     context: { projectPath: "." },
   })
   ```

2. Enable verbose logging:

   ```bash
   export DEBUG=evolution:*
   dgmo evolve --verbose
   ```

3. Check for timeouts:
   ```typescript
   // Increase timeout if needed
   const config = {
     evolutionTimeout: 60000, // 60 seconds
   }
   ```

### Issue 4: No Performance Data

**Symptoms:**

- "No patterns detected" message
- Evolution can't find improvement opportunities
- Metrics are empty

**Diagnosis:**

```typescript
// Check performance data collection
const analyzer = new UsageAnalyzer()
const patterns = await analyzer.detectPatterns()
console.log("Patterns found:", patterns.length)
```

**Solutions:**

1. Generate mock data for testing:

   ```typescript
   import { mockPerformanceData } from "./__tests__/mock-performance-data"
   const data = mockPerformanceData.generateMultipleExecutions(10)
   analyzer.injectPerformanceData(data)
   ```

2. Lower detection thresholds:

   ```typescript
   const config = {
     evolutionThreshold: {
       performanceDegradation: 0.1, // 10% threshold
       errorRateIncrease: 0.05,
       testFailureRate: 0.01,
     },
   }
   ```

3. Manually trigger analysis:
   ```typescript
   const request = {
     type: EvolutionRequestType.IMPROVE_PERFORMANCE,
     targetFiles: ["slow-function.js"],
     metrics: { baseline: { executionTime: 100 } },
   }
   const result = await bridge.requestEvolution(request)
   ```

### Issue 5: Evolution Changes Not Applied

**Symptoms:**

- Evolution completes but code doesn't change
- "Completed" status but no file modifications
- Rollback happens immediately

**Diagnosis:**

```typescript
// Check evolution result
const status = await bridge.getEvolutionStatus(evolutionId)
console.log("Status:", status.status)
console.log("Test results:", status.testResults)
console.log("Validation:", status.validationResults)
```

**Solutions:**

1. Check auto-approval settings:

   ```typescript
   const config = {
     requireApproval: false, // Auto-apply changes
     autoApprove: {
       enabled: true,
       maxRiskLevel: 0.5,
       types: ["performance", "refactoring"],
     },
   }
   ```

2. Verify test results:

   ```typescript
   // Ensure tests pass
   if (!status.testResults.passed) {
     console.log("Test failures:", status.testResults.details)
   }
   ```

3. Check validation results:
   ```typescript
   if (status.validationResults.performanceRegression) {
     console.log("Performance regression detected!")
   }
   ```

## Debugging Commands

### 1. Test Evolution End-to-End

```bash
# Run comprehensive test
bun test evolution/test-evolution-e2e.ts

# Run with specific pattern
bun test evolution --grep "hypothesis generation"
```

### 2. Monitor Evolution Events

```typescript
// Create event monitor
const monitor = new EvolutionMonitor(bridge)
monitor.on("phase-change", (phase) => {
  console.log(`Evolution phase: ${phase}`)
})
monitor.start()
```

### 3. Analyze Performance Bottlenecks

```bash
# Generate performance report
dgmo evolve --analyze --report

# Export metrics
dgmo evolve --export-metrics metrics.json
```

### 4. Force Evolution on Specific Files

```bash
# Target specific files
dgmo evolve --files "src/slow-*.ts" --force

# With custom prompt
dgmo evolve --files "api/handlers.ts" --prompt "Optimize for concurrent requests"
```

## Advanced Debugging

### Enable Debug Mode

```typescript
// In your code
process.env.EVOLUTION_DEBUG = 'true'
process.env.LOG_LEVEL = 'debug'

// Or via command line
EVOLUTION_DEBUG=true LOG_LEVEL=debug dgmo evolve
```

### Trace Evolution Execution

```typescript
import { EvolutionTracer } from "./debug/tracer"

const tracer = new EvolutionTracer()
tracer.attach(bridge)
tracer.on("trace", (event) => {
  console.log(`[${event.timestamp}] ${event.phase}: ${event.message}`)
})
```

### Inspect Evolution State

```typescript
// Get orchestrator status
const status = orchestrator.getStatus()
console.log("Orchestrator:", {
  running: status.isRunning,
  paused: status.isPaused,
  cycles: status.cycleCount,
  active: status.activeEvolutions,
  queued: status.queuedEvolutions,
  successRate: status.successRate,
})

// Get active evolutions
const active = orchestrator.getActiveEvolutions()
active.forEach((evo) => {
  console.log(`Evolution ${evo.id}: ${evo.state} (started ${evo.startTime})`)
})
```

## Error Reference

### EvolutionBridgeError Codes

| Code                       | Description                    | Solution                              |
| -------------------------- | ------------------------------ | ------------------------------------- |
| `DGM_NOT_READY`            | DGM bridge not initialized     | Start DGM service                     |
| `EVOLUTION_LIMIT_EXCEEDED` | Too many concurrent evolutions | Wait or increase limit                |
| `EVOLUTION_NOT_FOUND`      | Invalid evolution ID           | Check ID or use getEvolutionHistory() |
| `ROLLBACK_NOT_AVAILABLE`   | No snapshot for rollback       | Enable rollback in config             |
| `INVALID_STATUS`           | Wrong status for operation     | Check evolution lifecycle             |

### Common Error Messages

1. **"No patterns detected"**
   - Cause: Insufficient performance data
   - Fix: Lower thresholds or generate more data

2. **"Evolution timeout"**
   - Cause: Long-running analysis or generation
   - Fix: Increase evolutionTimeout in config

3. **"Validation failed: API compatibility"**
   - Cause: Breaking changes detected
   - Fix: Set preserveApi: false or modify constraints

4. **"Test command not configured"**
   - Cause: Missing test configuration
   - Fix: Add testCommand to context

## Performance Tips

1. **Batch Evolution Requests**

   ```typescript
   // Process multiple files together
   const requests = files.map((file) => ({
     type: EvolutionRequestType.IMPROVE_PERFORMANCE,
     targetFiles: [file],
     // ... other config
   }))
   ```

2. **Cache Performance Metrics**

   ```typescript
   // Metrics are cached for 5 minutes by default
   const metrics = await bridge.getPerformanceMetrics(files)
   ```

3. **Use Targeted Evolution**
   ```typescript
   // Focus on specific improvements
   const request = {
     type: EvolutionRequestType.OPTIMIZE_MEMORY,
     customPrompt: "Focus on reducing array allocations",
   }
   ```

## Getting Help

1. **Check Logs**

   ```bash
   # View evolution logs
   tail -f ~/.dgmo/logs/evolution.log

   # Filter by severity
   grep ERROR ~/.dgmo/logs/evolution.log
   ```

2. **Export Debug Info**

   ```bash
   # Create debug bundle
   dgmo evolve --debug-export debug-bundle.zip
   ```

3. **Community Support**
   - GitHub Issues: https://github.com/dgmo/evolution/issues
   - Discord: https://discord.gg/dgmo
   - Documentation: https://docs.dgmo.dev/evolution

## Appendix: Test Data Generation

For testing without real performance data:

```typescript
import { mockPerformanceData } from "./evolution/__tests__/mock-performance-data"

// Generate test scenarios
const scenarios = {
  performance: mockPerformanceData.generateEvolutionScenario("performance"),
  memory: mockPerformanceData.generateEvolutionScenario("memory"),
  error: mockPerformanceData.generateEvolutionScenario("error"),
}

// Inject into system
const analyzer = new UsageAnalyzer()
analyzer.injectTestData(scenarios.performance)
```

This allows testing evolution features without waiting for real usage data to accumulate.
