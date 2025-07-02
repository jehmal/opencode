/**
 * Error-related Type Definitions
 */

import { z } from 'zod';

// Base error class
export class BaseError extends Error {
  code: string;
  details?: any;
  recoverable: boolean;
  timestamp: string;

  constructor(message: string, code: string, recoverable = false, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.recoverable = recoverable;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      recoverable: this.recoverable,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// Specific error types
export class ValidationError extends BaseError {
  fields?: ValidationField[];

  constructor(message: string, fields?: ValidationField[], details?: any) {
    super(message, 'VALIDATION_ERROR', true, details);
    this.fields = fields;
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHENTICATION_ERROR', false, details);
  }
}

export class AuthorizationError extends BaseError {
  requiredPermissions?: string[];

  constructor(message: string, requiredPermissions?: string[], details?: any) {
    super(message, 'AUTHORIZATION_ERROR', false, details);
    this.requiredPermissions = requiredPermissions;
  }
}

export class NotFoundError extends BaseError {
  resource?: string;
  id?: string;

  constructor(message: string, resource?: string, id?: string, details?: any) {
    super(message, 'NOT_FOUND_ERROR', false, details);
    this.resource = resource;
    this.id = id;
  }
}

export class ConflictError extends BaseError {
  conflictingResource?: string;

  constructor(message: string, conflictingResource?: string, details?: any) {
    super(message, 'CONFLICT_ERROR', true, details);
    this.conflictingResource = conflictingResource;
  }
}

export class RateLimitError extends BaseError {
  retryAfter?: number;
  limit?: number;

  constructor(message: string, retryAfter?: number, limit?: number, details?: any) {
    super(message, 'RATE_LIMIT_ERROR', true, details);
    this.retryAfter = retryAfter;
    this.limit = limit;
  }
}

export class TimeoutError extends BaseError {
  timeout: number;
  operation?: string;

  constructor(message: string, timeout: number, operation?: string, details?: any) {
    super(message, 'TIMEOUT_ERROR', true, details);
    this.timeout = timeout;
    this.operation = operation;
  }
}

export class NetworkError extends BaseError {
  statusCode?: number;
  url?: string;

  constructor(message: string, statusCode?: number, url?: string, details?: any) {
    super(message, 'NETWORK_ERROR', true, details);
    this.statusCode = statusCode;
    this.url = url;
  }
}

export class ExecutionError extends BaseError {
  phase?: string;
  context?: any;

  constructor(message: string, phase?: string, context?: any, details?: any) {
    super(message, 'EXECUTION_ERROR', false, details);
    this.phase = phase;
    this.context = context;
  }
}

export class ConfigurationError extends BaseError {
  configKey?: string;
  expectedType?: string;

  constructor(message: string, configKey?: string, expectedType?: string, details?: any) {
    super(message, 'CONFIGURATION_ERROR', false, details);
    this.configKey = configKey;
    this.expectedType = expectedType;
  }
}

// Validation field error
export interface ValidationField {
  field: string;
  message: string;
  code?: string;
  value?: any;
}

// Error handler interface
export interface ErrorHandler {
  canHandle(error: Error): boolean;
  handle(error: Error): Promise<ErrorHandlerResult>;
}

// Error handler result
export interface ErrorHandlerResult {
  handled: boolean;
  retry?: boolean;
  fallback?: any;
  transformed?: Error;
}

// Error context
export interface ErrorContext {
  operation: string;
  input?: any;
  userId?: string;
  sessionId?: string;
  timestamp: string;
  environment?: Record<string, string>;
}

// Error recovery strategy
export interface ErrorRecoveryStrategy {
  type: 'retry' | 'fallback' | 'circuit-breaker' | 'ignore';
  config: RecoveryConfig;
}

// Recovery configuration
export type RecoveryConfig = 
  | RetryConfig
  | FallbackConfig
  | CircuitBreakerConfig
  | IgnoreConfig;

export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoff: 'linear' | 'exponential';
  jitter?: boolean;
}

export interface FallbackConfig {
  value?: any;
  handler?: () => any;
}

export interface CircuitBreakerConfig {
  threshold: number;
  timeout: number;
  resetTimeout: number;
}

export interface IgnoreConfig {
  log?: boolean;
}

// Error reporter
export interface ErrorReporter {
  report(error: Error, context?: ErrorContext): Promise<void>;
  reportBatch(errors: Error[], context?: ErrorContext): Promise<void>;
}

// Error aggregator
export class ErrorAggregator {
  private errors: Map<string, AggregatedError> = new Map();

  add(error: Error, context?: ErrorContext): void {
    const key = this.getErrorKey(error);
    const existing = this.errors.get(key);
    
    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date();
      existing.contexts.push(context);
    } else {
      this.errors.set(key, {
        error,
        count: 1,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        contexts: context ? [context] : [],
      });
    }
  }

  getErrors(): AggregatedError[] {
    return Array.from(this.errors.values());
  }

  clear(): void {
    this.errors.clear();
  }

  private getErrorKey(error: Error): string {
    return `${error.name}-${error.message}`;
  }
}

// Aggregated error
export interface AggregatedError {
  error: Error;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  contexts: (ErrorContext | undefined)[];
}

// Zod schemas
export const ValidationFieldSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string().optional(),
  value: z.any().optional(),
});

export const ErrorContextSchema = z.object({
  operation: z.string(),
  input: z.any().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string(),
  environment: z.record(z.string()).optional(),
});

// Error utilities
export function isRecoverable(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.recoverable;
  }
  
  // Check for common recoverable error patterns
  const recoverablePatterns = [
    /timeout/i,
    /rate limit/i,
    /temporary/i,
    /retry/i,
  ];
  
  return recoverablePatterns.some(pattern => 
    pattern.test(error.message) || pattern.test(error.name)
  );
}

export function getErrorCode(error: Error): string {
  if (error instanceof BaseError) {
    return error.code;
  }
  
  // Map common error types to codes
  const errorMap: Record<string, string> = {
    TypeError: 'TYPE_ERROR',
    ReferenceError: 'REFERENCE_ERROR',
    SyntaxError: 'SYNTAX_ERROR',
    RangeError: 'RANGE_ERROR',
  };
  
  return errorMap[error.name] || 'UNKNOWN_ERROR';
}

export function createErrorResponse(error: Error, requestId?: string): any {
  return {
    id: requestId || generateId(),
    error: {
      code: getErrorCode(error),
      message: error.message,
      details: error instanceof BaseError ? error.details : undefined,
      recoverable: isRecoverable(error),
      timestamp: new Date().toISOString(),
    },
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}