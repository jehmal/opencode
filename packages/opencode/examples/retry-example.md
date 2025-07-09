# Retry Logic Example

This example demonstrates how the retry logic handles API overloaded errors.

## Scenario: Anthropic API Returns 529 Error

When the Anthropic API is overloaded and returns a 529 error, the retry logic automatically kicks in:

### User Experience

```
User: Please help me write a Python function to calculate fibonacci numbers.

[System: Retrying due to API overload. Attempt 2/10. Waiting 2s...]

[System: Retrying due to API overload. Attempt 3/10. Waiting 4s...]

Assistant: I'll help you create a Python function to calculate Fibonacci numbers. Here's an efficient implementation:

```python
def fibonacci(n):
    """Calculate the nth Fibonacci number."""
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    else:
        a, b = 0, 1
        for _ in range(2, n + 1):
            a, b = b, a + b
        return b
```
```

### Behind the Scenes

Here's what happened in the logs:

```
WARN  2025-07-09T01:30:15 service=session sessionID=session_123 error=Error: 529 Too Many Requests attempt=1 delayMs=2000 providerID=anthropic modelID=claude-3-opus Retrying API call due to error
INFO  2025-07-09T01:30:17 service=retry error=Error: 529 Too Many Requests attempt=1 nextAttempt=2 delayMs=2000 maxRetries=10 Retrying after error
WARN  2025-07-09T01:30:17 service=session sessionID=session_123 error=Error: 529 Too Many Requests attempt=2 delayMs=4000 providerID=anthropic modelID=claude-3-opus Retrying API call due to error
INFO  2025-07-09T01:30:21 service=retry error=Error: 529 Too Many Requests attempt=2 nextAttempt=3 delayMs=4000 maxRetries=10 Retrying after error
INFO  2025-07-09T01:30:25 service=retry attempt=3 totalAttempts=3 Operation succeeded after retry
```

## Configuration Options

### Default Configuration

```json
{
  "retry": {
    "maxRetries": 10,
    "initialDelay": 1000,
    "maxDelay": 60000,
    "backoffMultiplier": 2,
    "jitterFactor": 0.1
  }
}
```

### Aggressive Retry (for high-priority workloads)

```json
{
  "retry": {
    "maxRetries": 20,
    "initialDelay": 500,
    "maxDelay": 30000,
    "backoffMultiplier": 1.5,
    "jitterFactor": 0.2
  }
}
```

### Conservative Retry (to minimize API pressure)

```json
{
  "retry": {
    "maxRetries": 5,
    "initialDelay": 2000,
    "maxDelay": 120000,
    "backoffMultiplier": 3,
    "jitterFactor": 0.3
  }
}
```

## Error Types Handled

1. **529 Too Many Requests**: API is overloaded
2. **429 Rate Limited**: Too many requests from your account
3. **Anthropic Overloaded Error**: Specific error type from Anthropic
4. **Network Timeouts**: When properly configured

## Benefits

- **Automatic Recovery**: No manual intervention needed
- **User Transparency**: Users see retry status
- **Configurable**: Adapt to your needs
- **Exponential Backoff**: Prevents overwhelming the API
- **Jitter**: Prevents synchronized retry storms