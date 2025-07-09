# Retry Logic Infrastructure for DGMO

This document describes the retry logic infrastructure implemented to handle Anthropic API overloaded errors (529) and other transient failures.

## Overview

The retry logic provides a robust mechanism to automatically retry failed API calls with exponential backoff and jitter. It's specifically designed to handle:

- **529 Too Many Requests / Service Overloaded errors** from Anthropic API
- **429 Rate Limit errors**
- Other transient network failures

## Architecture

### Level 1: Core Retry Utility (`src/util/retry.ts`)

The core retry utility provides:

1. **Exponential Backoff with Jitter**: Prevents thundering herd problem
2. **Error Type Detection**: Specifically identifies retryable errors (529, 429, etc.)
3. **Configurable Options**: Customizable retry behavior
4. **Generic Retry Wrapper**: Can wrap any async operation
5. **Stream Support**: Special handling for streaming operations

### Level 2: API Integration (`src/session/index.ts`)

The retry logic is integrated at three key points:

1. **Main Chat Stream** (`streamText` in `chat` function)
2. **Title Generation** (`generateText` for session titles)
3. **Summarization** (`streamText` in `summarize` function)

### Level 3: Configuration (`src/config/config.ts`)

Configuration options added to the config schema:

```typescript
retry: {
  maxRetries: number        // Default: 10
  initialDelay: number      // Default: 1000ms
  maxDelay: number          // Default: 60000ms (60s)
  backoffMultiplier: number // Default: 2
  jitterFactor: number      // Default: 0.1 (10% jitter)
}
```

## Usage

### Configuration

#### Via Config File (`dgmo.json` or `dgmo.jsonc`)

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

#### Via Environment Variables

```bash
export OPENCODE_RETRY_MAX_RETRIES=10
export OPENCODE_RETRY_INITIAL_DELAY=1000
export OPENCODE_RETRY_MAX_DELAY=60000
export OPENCODE_RETRY_BACKOFF_MULTIPLIER=2
export OPENCODE_RETRY_JITTER_FACTOR=0.1
```

### Error Detection

The system automatically detects retryable errors by checking:

1. HTTP status codes (529, 429)
2. Error messages containing "overloaded" or "529"
3. Anthropic-specific error structures (`type: "overloaded_error"`)
4. Nested error properties

### User Experience

When a retry occurs:

1. **Logging**: Detailed retry information is logged
2. **User Notification**: A system message is displayed in the chat showing retry attempts
3. **Graceful Degradation**: If all retries fail, the error is properly propagated

Example user notification:
```
[System: Retrying due to API overload. Attempt 2/10. Waiting 2s...]
```

## Implementation Details

### Exponential Backoff Calculation

```typescript
delay = min(initialDelay * (backoffMultiplier ^ (attempt - 1)), maxDelay)
finalDelay = delay ± (delay * jitterFactor)
```

### Retry Flow

1. Attempt the operation
2. If successful, return result
3. If error occurs:
   - Check if error is retryable
   - If not retryable, throw immediately
   - If retryable and attempts remaining:
     - Calculate backoff delay
     - Log retry attempt
     - Call onRetry callback
     - Wait for delay
     - Retry operation
   - If max retries exceeded, throw `MaxRetriesExceededError`

### Stream Handling

For streaming operations, the retry logic ensures:
- The stream hasn't started yielding data before retrying
- Proper cleanup between retry attempts
- Maintains streaming interface compatibility

## Testing

Run tests with:
```bash
bun test src/util/__tests__/retry.test.ts
```

Tests cover:
- Error detection logic
- Backoff calculation
- Retry behavior
- Abort signal handling
- Stream compatibility

## Performance Considerations

1. **No Impact on Successful Calls**: Retry logic adds minimal overhead
2. **Efficient Backoff**: Prevents overwhelming the API during outages
3. **Jitter**: Prevents synchronized retry storms
4. **Abort Support**: Can cancel long-running retry sequences

## Future Enhancements

Potential improvements:
1. Circuit breaker pattern for prolonged outages
2. Retry budget to limit total retry time
3. Metrics collection for retry patterns
4. Provider-specific retry strategies
5. Adaptive backoff based on error patterns