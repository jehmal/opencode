# OpenCode + DGM Evolution Demo

This document demonstrates how the self-improving OpenCode CLI works with DGM integration.

## 🚀 Quick Start

### 1. Basic Usage

```bash
# Use OpenCode normally
opencode run "create a fibonacci function in Python"
opencode run "add unit tests to the fibonacci function"
opencode run "optimize the fibonacci function for performance"

# After multiple sessions, analyze performance
opencode evolve --analyze
```

### 2. Evolution Analysis

The `evolve` command analyzes your usage patterns:

```bash
# Full evolution analysis with verbose output
opencode evolve --verbose

# Analyze specific session
opencode evolve --session=abc123 --verbose

# Automatically apply high-impact improvements
opencode evolve --auto-apply
```

### 3. Background Evolution

Enable continuous improvement in your OpenCode config:

```json
{
  "evolution": {
    "enabled": true,
    "interval": 86400000,  // 24 hours
    "minSamples": 100,
    "autoApply": false,
    "sandboxTesting": true
  }
}
```

## 📊 What Gets Analyzed

The evolution engine tracks:

1. **Tool Usage Patterns**
   - Which tools are used most frequently
   - Success/failure rates per tool
   - Average execution times
   - Common parameter patterns

2. **Error Patterns**
   - Recurring error types
   - Tools that frequently fail
   - Error contexts and examples

3. **Performance Metrics**
   - Slow operations
   - Resource-intensive tasks
   - Optimization opportunities

## 🧬 Evolution Process

1. **Data Collection**: OpenCode tracks performance metrics during normal usage
2. **Pattern Analysis**: DGM analyzes patterns to identify improvement opportunities
3. **Evolution**: DGM generates adaptations based on patterns
4. **Testing**: Improvements are tested in sandbox environment
5. **Deployment**: Validated improvements are applied to tools

## 📈 Example Evolution Scenarios

### Scenario 1: Bash Command Optimization
```
Pattern Detected: Frequent "permission denied" errors in bash tool
Evolution: Add automatic sudo detection and privilege escalation handling
Result: 90% reduction in permission-related failures
```

### Scenario 2: File Edit Enhancement
```
Pattern Detected: Multiple sequential edits to same file
Evolution: Batch edit operations for better performance
Result: 3x faster file modification operations
```

### Scenario 3: Error Recovery
```
Pattern Detected: Network timeouts in web fetch operations
Evolution: Add retry logic with exponential backoff
Result: 95% success rate improvement for network operations
```

## 🎯 Benefits

1. **Adaptive Performance**: Tools improve based on your specific usage
2. **Error Reduction**: Common failure patterns are automatically addressed
3. **Personalized Optimization**: Evolution tailored to your workflow
4. **Continuous Improvement**: Gets better the more you use it

## 🔧 Advanced Configuration

### Manual Evolution Trigger

```typescript
// In your code
import { evolutionManager } from '@opencode/dgm-integration';

// Force immediate evolution
await evolutionManager.runNow();

// Check evolution state
const state = evolutionManager.getState();
console.log(`Improvements applied: ${state.improvementsApplied}`);
```

### Custom Evolution Handlers

```typescript
evolutionManager.on('improvement-applied', (event) => {
  console.log(`New improvement: ${event.description}`);
});

evolutionManager.on('evolution-completed', (event) => {
  console.log(`Evolution complete: ${event.suggestions} suggestions`);
});
```

## 🛡️ Safety Features

1. **Sandboxed Testing**: All improvements tested before deployment
2. **Rollback Support**: Revert to previous versions if needed
3. **Manual Approval**: Option to review before applying changes
4. **Version History**: Track all evolution changes

## 📝 Commands Reference

```bash
# Basic evolution
opencode evolve

# Analysis only (no changes)
opencode evolve --analyze

# Auto-apply improvements
opencode evolve --auto-apply

# Set minimum samples
opencode evolve --min-samples=50

# Verbose output
opencode evolve --verbose

# Specific session analysis
opencode evolve --session=<session-id>
```

## 🚀 Getting Started

1. Install OpenCode with DGM integration
2. Use OpenCode for your normal coding tasks
3. After ~10-20 sessions, run `opencode evolve`
4. Review suggested improvements
5. Apply improvements with `--auto-apply` or manually

The more you use OpenCode, the smarter it becomes!