# Safe Evolution Sandbox

**Agent ID**: safe-evolution-sandbox-003  
**Purpose**: Docker-based sandbox environment for safely testing evolved code before deployment

## Overview

The Safe Evolution Sandbox provides a secure, isolated environment for testing code that has been evolved by the AI system. It ensures that no evolved code can harm the production system through multiple layers of protection.

## Architecture

### Core Components

1. **SandboxManager**: Manages Docker container lifecycle
   - Creates isolated containers with resource limits
   - Monitors execution in real-time
   - Enforces timeouts and resource constraints

2. **CodeIsolator**: Provides code isolation and validation
   - Validates code against security policies
   - Creates VM contexts with restricted globals
   - Injects dependencies safely

3. **SafetyValidator**: Multi-layer safety validation
   - Detects dangerous patterns (eval, process.exit, etc.)
   - Analyzes code complexity
   - Checks resource usage patterns
   - Provides safety scoring (0-100)

4. **EvolutionTestRunner**: Automated testing framework
   - Runs unit tests against evolved code
   - Performs regression testing
   - Compares performance metrics
   - Generates coverage reports

5. **SnapshotManager**: Code state management
   - Creates snapshots before/after evolution
   - Enables rollback to previous states
   - Compares snapshots for differences
   - Manages snapshot lifecycle

## Security Features

### Defense in Depth

1. **Container Isolation**
   - Runs in Docker with minimal privileges
   - No network access by default
   - Read-only file system
   - Dropped capabilities

2. **Resource Limits**
   - CPU: 50% of one core
   - Memory: 512MB
   - Processes: 50 max
   - File descriptors: 1024
   - Execution timeout: 5 minutes

3. **Code Validation**
   - Pattern matching for dangerous functions
   - Syntax validation
   - Complexity analysis
   - Security policy enforcement

4. **Runtime Protection**
   - VM-based execution
   - Restricted global scope
   - No access to Node.js internals
   - Monitored resource usage

## Usage

### Basic Example

```typescript
import {
  SandboxManager,
  SafetyValidator,
  EvolutionTestRunner,
  SnapshotManager,
} from "./sandbox"

// Initialize components
const sandboxManager = new SandboxManager({
  tempDir: "/tmp/evolution-sandbox",
  maxConcurrentSandboxes: 5,
})

const validator = new SafetyValidator({
  allowedModules: [],
  blockedPatterns: [/eval\(/g],
  maxCodeSize: 100000,
  allowFileSystem: false,
  allowChildProcess: false,
  allowNetwork: false,
  allowedAPIs: ["console", "setTimeout"],
})

// Validate evolved code
const validation = await validator.validate(evolvedCode)
if (!validation.valid) {
  console.error("Code failed validation:", validation.errors)
  return
}

// Create sandbox and run tests
const sandbox = await sandboxManager.createSandbox(evolvedCode, testSuite, {
  cpuShares: 512,
  memoryMB: 256,
  executionTimeoutMs: 30000,
})

const result = await sandboxManager.execute(sandbox.id)
```

### Rollback Example

```typescript
const snapshotManager = new SnapshotManager("/tmp/snapshots")

// Create snapshot before evolution
const beforeSnapshot = await snapshotManager.createSnapshot(
  sandboxId,
  originalCode,
  tests,
  undefined,
  { description: "Before evolution" },
)

// ... evolution happens ...

// If evolution fails, rollback
if (!evolutionSuccessful) {
  await snapshotManager.rollback({
    snapshotId: beforeSnapshot,
    reason: "Evolution produced unsafe code",
    preserveCurrentState: true,
  })
}
```

## Docker Setup

### Building the Image

```bash
cd /opencode/packages/opencode/src/evolution/sandbox
docker build -t evolution-sandbox:latest .
```

### Running Manually

```bash
docker run --rm \
  --cpus="0.5" \
  --memory="512m" \
  --network=none \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  -v /path/to/code:/sandbox/code:ro \
  evolution-sandbox:latest
```

## Safety Validation Rules

### Critical Patterns (Instant Failure)

- `process.exit()` / `process.kill()`
- `require('child_process')`
- `eval()` / `new Function()`
- File system deletion operations
- `__proto__` manipulation

### Suspicious Patterns (Warnings)

- Infinite loops (`while(true)`)
- Very short intervals
- Directory traversal (`../`)
- Environment variable access
- Dynamic requires

### Resource Limits

- Code size: 100KB max
- Line count: 10,000 max
- Nesting depth: 5 levels max
- Complexity: 50 decision points max

## Integration with Evolution Bridge

The sandbox integrates with the Evolution Bridge to:

1. Receive evolved code for testing
2. Validate safety before deployment
3. Run comprehensive test suites
4. Report results back to the bridge
5. Enable/disable evolution based on safety

## Performance Monitoring

The sandbox tracks:

- Execution time
- Memory usage (RSS, heap)
- CPU usage
- Garbage collection metrics
- Network I/O (if enabled)

## Best Practices

1. **Always validate before execution**
   - Run SafetyValidator first
   - Check score threshold (recommend >80)

2. **Use appropriate resource limits**
   - Start with minimal resources
   - Increase only if needed

3. **Create snapshots frequently**
   - Before any evolution
   - After successful tests
   - Tag important milestones

4. **Monitor execution**
   - Watch for resource spikes
   - Check execution logs
   - Review security violations

5. **Clean up resources**
   - Destroy sandboxes after use
   - Clean old snapshots periodically
   - Monitor disk usage

## Troubleshooting

### Common Issues

1. **Docker not found**
   - Ensure Docker is installed
   - Check Docker daemon is running
   - Verify user has Docker permissions

2. **Resource limits hit**
   - Increase limits if legitimate
   - Check for infinite loops
   - Review memory allocations

3. **Validation failures**
   - Review error messages
   - Check against security policy
   - Simplify code if too complex

4. **Test failures**
   - Ensure tests are compatible
   - Check for timing issues
   - Verify test environment

## Future Enhancements

1. **Advanced Static Analysis**
   - AST-based pattern detection
   - Data flow analysis
   - Taint tracking

2. **Machine Learning Integration**
   - Learn from past validations
   - Predict safety scores
   - Suggest improvements

3. **Distributed Execution**
   - Multiple sandbox nodes
   - Load balancing
   - Fault tolerance

4. **Enhanced Monitoring**
   - Real-time dashboards
   - Alerting system
   - Historical analytics

## Security Considerations

This sandbox is designed for testing evolved code in a controlled environment. While it provides strong isolation, it should not be considered a complete security solution. Always:

- Run on isolated infrastructure
- Monitor for escape attempts
- Keep Docker and dependencies updated
- Review security logs regularly
- Have incident response plans

## License

Part of the DGMO Evolution System
