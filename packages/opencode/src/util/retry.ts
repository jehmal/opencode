import { Log } from "./log"

const log = Log.create({ service: "retry" })

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts. Default: 10 */
  maxRetries?: number
  /** Initial delay in milliseconds before first retry. Default: 1000 */
  initialDelay?: number
  /** Maximum delay in milliseconds between retries. Default: 60000 */
  maxDelay?: number
  /** Backoff multiplier for exponential backoff. Default: 2 */
  backoffMultiplier?: number
  /** Jitter factor (0-1) to randomize delays. Default: 0.1 */
  jitterFactor?: number
  /** Custom error filter to determine if error is retryable */
  isRetryable?: (error: any) => boolean
  /** Callback for each retry attempt */
  onRetry?: (error: any, attempt: number, delay: number) => void
  /** AbortSignal to cancel retry operation */
  signal?: AbortSignal
}

/**
 * Get retry configuration from environment variables
 */
function getEnvConfig(): Partial<RetryOptions> {
  const config: Partial<RetryOptions> = {}
  
  if (process.env.OPENCODE_RETRY_MAX_RETRIES) {
    const maxRetries = parseInt(process.env.OPENCODE_RETRY_MAX_RETRIES, 10)
    if (!isNaN(maxRetries) && maxRetries > 0) {
      config.maxRetries = maxRetries
    }
  }
  
  if (process.env.OPENCODE_RETRY_INITIAL_DELAY) {
    const initialDelay = parseInt(process.env.OPENCODE_RETRY_INITIAL_DELAY, 10)
    if (!isNaN(initialDelay) && initialDelay > 0) {
      config.initialDelay = initialDelay
    }
  }
  
  if (process.env.OPENCODE_RETRY_MAX_DELAY) {
    const maxDelay = parseInt(process.env.OPENCODE_RETRY_MAX_DELAY, 10)
    if (!isNaN(maxDelay) && maxDelay > 0) {
      config.maxDelay = maxDelay
    }
  }
  
  if (process.env.OPENCODE_RETRY_BACKOFF_MULTIPLIER) {
    const backoffMultiplier = parseFloat(process.env.OPENCODE_RETRY_BACKOFF_MULTIPLIER)
    if (!isNaN(backoffMultiplier) && backoffMultiplier > 1) {
      config.backoffMultiplier = backoffMultiplier
    }
  }
  
  if (process.env.OPENCODE_RETRY_JITTER_FACTOR) {
    const jitterFactor = parseFloat(process.env.OPENCODE_RETRY_JITTER_FACTOR)
    if (!isNaN(jitterFactor) && jitterFactor >= 0 && jitterFactor <= 1) {
      config.jitterFactor = jitterFactor
    }
  }
  
  return config
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'signal' | 'onRetry'>> = {
  maxRetries: 10,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  isRetryable: isRetryableError,
  ...getEnvConfig(),
}

/**
 * Error thrown when retry operation is aborted
 */
export class RetryAbortedError extends Error {
  constructor(public readonly attempts: number) {
    super("Retry operation aborted")
    this.name = "RetryAbortedError"
  }
}

/**
 * Error thrown when max retries exceeded
 */
export class MaxRetriesExceededError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastError: any
  ) {
    super(`Operation failed after ${attempts} attempts`)
    this.name = "MaxRetriesExceededError"
  }
}

/**
 * Check if an error is retryable (specifically looking for 529 overloaded errors)
 */
export function isRetryableError(error: any): boolean {
  // Check for HTTP 529 Too Many Requests / Service Overloaded
  if (error?.status === 529 || error?.statusCode === 529) {
    return true
  }

  // Check error message for overloaded indication
  const message = error?.message?.toLowerCase() || ""
  if (message.includes("overloaded") || message.includes("529")) {
    return true
  }

  // Check for specific Anthropic error structure
  if (error?.error?.type === "overloaded_error") {
    return true
  }

  // Check nested error properties
  if (error?.cause?.status === 529 || error?.cause?.statusCode === 529) {
    return true
  }

  // Check for rate limit errors (sometimes these come as 429)
  if (error?.status === 429 || error?.statusCode === 429) {
    return true
  }

  return false
}

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateDelay(
  attempt: number,
  options: Required<Pick<RetryOptions, 'initialDelay' | 'maxDelay' | 'backoffMultiplier' | 'jitterFactor'>>
): number {
  const { initialDelay, maxDelay, backoffMultiplier, jitterFactor } = options
  
  // Calculate base exponential backoff
  const baseDelay = Math.min(
    initialDelay * Math.pow(backoffMultiplier, attempt - 1),
    maxDelay
  )
  
  // Add jitter to prevent thundering herd
  const jitter = baseDelay * jitterFactor * (Math.random() * 2 - 1)
  const delayWithJitter = baseDelay + jitter
  
  // Ensure delay is within bounds
  return Math.max(0, Math.min(delayWithJitter, maxDelay))
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generic retry wrapper for any async operation
 * 
 * @param operation - Async function to retry
 * @param options - Retry configuration options
 * @returns Result of the operation
 * @throws {RetryAbortedError} If operation is aborted via signal
 * @throws {MaxRetriesExceededError} If max retries exceeded
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: any
  
  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      // Check if aborted before attempting
      if (opts.signal?.aborted) {
        throw new RetryAbortedError(attempt - 1)
      }
      
      // Attempt the operation
      const result = await operation()
      
      // Success - log if this was a retry
      if (attempt > 1) {
        log.info("Operation succeeded after retry", {
          attempt,
          totalAttempts: attempt,
        })
      }
      
      return result
    } catch (error) {
      lastError = error
      
      // Check if error is retryable
      if (!opts.isRetryable(error)) {
        log.warn("Non-retryable error encountered", {
          error: error?.toString(),
          attempt,
        })
        throw error
      }
      
      // Check if we've exhausted retries
      if (attempt >= opts.maxRetries) {
        log.error("Max retries exceeded", {
          maxRetries: opts.maxRetries,
          lastError: error?.toString(),
        })
        throw new MaxRetriesExceededError(opts.maxRetries, error)
      }
      
      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, opts)
      
      log.info("Retrying after error", {
        error: error?.toString(),
        attempt,
        nextAttempt: attempt + 1,
        delayMs: delay,
        maxRetries: opts.maxRetries,
      })
      
      // Call retry callback if provided
      opts.onRetry?.(error, attempt, delay)
      
      // Wait before retrying
      await sleep(delay)
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw new MaxRetriesExceededError(opts.maxRetries, lastError)
}

/**
 * Retry wrapper specifically for streaming operations
 * This maintains the streaming interface while adding retry logic
 */
export async function retryStream<T extends AsyncIterable<any>>(
  operation: () => T,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  // For streaming, we need to be more careful about retries
  // We can only retry if the stream fails before yielding any data
  return retry(operation, {
    ...opts,
    // Streaming operations might need different retry logic
    isRetryable: (error) => {
      // Only retry if stream hasn't started yielding
      // This prevents partial data issues
      return opts.isRetryable(error)
    },
  })
}