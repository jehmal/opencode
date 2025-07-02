/**
 * Error handling middleware for cross-language tool execution
 */

import { 
  ToolError,
  ToolExecutionResult,
  ToolExecutionStatus,
  ToolContext
} from '../types/typescript/tool.types';

export interface ErrorContext {
  toolId: string;
  language: 'typescript' | 'python';
  parameters: any;
  context: ToolContext;
  startTime: Date;
}

export interface ErrorHandler {
  canHandle(error: any): boolean;
  handle(error: any, context: ErrorContext): ToolError;
}

/**
 * Base error handler
 */
export abstract class BaseErrorHandler implements ErrorHandler {
  abstract canHandle(error: any): boolean;
  abstract handle(error: any, context: ErrorContext): ToolError;
  
  protected createToolError(
    code: string,
    message: string,
    details: any,
    retryable: boolean = false
  ): ToolError {
    return {
      code,
      message,
      details,
      retryable,
      cause: details?.originalError
    };
  }
}

/**
 * Timeout error handler
 */
export class TimeoutErrorHandler extends BaseErrorHandler {
  canHandle(error: any): boolean {
    return error?.message?.includes('timeout') || 
           error?.code === 'ETIMEDOUT' ||
           error?.code === 'TIMEOUT_ERROR';
  }
  
  handle(error: any, context: ErrorContext): ToolError {
    return this.createToolError(
      'TOOL_TIMEOUT',
      `Tool execution timed out after ${context.context.timeout}ms`,
      {
        toolId: context.toolId,
        timeout: context.context.timeout,
        duration: Date.now() - context.startTime.getTime()
      },
      true // Timeouts are often retryable
    );
  }
}

/**
 * Validation error handler
 */
export class ValidationErrorHandler extends BaseErrorHandler {
  canHandle(error: any): boolean {
    return error?.name === 'ValidationError' ||
           error?.code === 'VALIDATION_ERROR' ||
           error?.message?.includes('Invalid parameters');
  }
  
  handle(error: any, context: ErrorContext): ToolError {
    return this.createToolError(
      'VALIDATION_ERROR',
      'Parameter validation failed',
      {
        toolId: context.toolId,
        parameters: context.parameters,
        validationErrors: error.errors || error.details || error.message
      },
      false // Validation errors are not retryable
    );
  }
}

/**
 * Python execution error handler
 */
export class PythonExecutionErrorHandler extends BaseErrorHandler {
  canHandle(error: any): boolean {
    return error?.code === 'PYTHON_EXECUTION_ERROR' ||
           error?.message?.includes('Python') ||
           error?.source === 'python';
  }
  
  handle(error: any, context: ErrorContext): ToolError {
    // Parse Python traceback if available
    const traceback = this.parsePythonTraceback(error);
    
    return this.createToolError(
      'PYTHON_EXECUTION_ERROR',
      error.message || 'Python tool execution failed',
      {
        toolId: context.toolId,
        language: 'python',
        traceback,
        originalError: error.toString()
      },
      this.isRetryable(error)
    );
  }
  
  private parsePythonTraceback(error: any): string[] {
    if (error.traceback) {
      return error.traceback.split('\n');
    }
    
    const errorString = error.toString();
    if (errorString.includes('Traceback')) {
      return errorString.split('\n').filter(line => line.trim());
    }
    
    return [];
  }
  
  private isRetryable(error: any): boolean {
    // Don't retry syntax errors or import errors
    if (error.message?.includes('SyntaxError') ||
        error.message?.includes('ImportError') ||
        error.message?.includes('ModuleNotFoundError')) {
      return false;
    }
    
    // Retry network or temporary errors
    if (error.message?.includes('ConnectionError') ||
        error.message?.includes('TimeoutError') ||
        error.message?.includes('TemporaryError')) {
      return true;
    }
    
    return false;
  }
}

/**
 * TypeScript execution error handler
 */
export class TypeScriptExecutionErrorHandler extends BaseErrorHandler {
  canHandle(error: any): boolean {
    return error?.code === 'TYPESCRIPT_EXECUTION_ERROR' ||
           error?.source === 'typescript';
  }
  
  handle(error: any, context: ErrorContext): ToolError {
    return this.createToolError(
      'TYPESCRIPT_EXECUTION_ERROR',
      error.message || 'TypeScript tool execution failed',
      {
        toolId: context.toolId,
        language: 'typescript',
        stack: error.stack,
        originalError: error.toString()
      },
      this.isRetryable(error)
    );
  }
  
  private isRetryable(error: any): boolean {
    // Don't retry type errors or reference errors
    if (error instanceof TypeError || error instanceof ReferenceError) {
      return false;
    }
    
    // Retry network errors
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT') {
      return true;
    }
    
    return false;
  }
}

/**
 * Permission error handler
 */
export class PermissionErrorHandler extends BaseErrorHandler {
  canHandle(error: any): boolean {
    return error?.code === 'EACCES' ||
           error?.code === 'EPERM' ||
           error?.message?.includes('Permission denied') ||
           error?.message?.includes('Access denied');
  }
  
  handle(error: any, context: ErrorContext): ToolError {
    return this.createToolError(
      'PERMISSION_DENIED',
      'Permission denied for tool execution',
      {
        toolId: context.toolId,
        operation: context.parameters,
        error: error.message
      },
      false // Permission errors are not retryable
    );
  }
}

/**
 * Resource error handler
 */
export class ResourceErrorHandler extends BaseErrorHandler {
  canHandle(error: any): boolean {
    return error?.code === 'ENOENT' ||
           error?.code === 'ENOTFOUND' ||
           error?.message?.includes('not found') ||
           error?.message?.includes('does not exist');
  }
  
  handle(error: any, context: ErrorContext): ToolError {
    return this.createToolError(
      'RESOURCE_NOT_FOUND',
      'Required resource not found',
      {
        toolId: context.toolId,
        resource: error.path || error.resource || 'unknown',
        error: error.message
      },
      false // Resource not found errors are not retryable
    );
  }
}

/**
 * Default error handler (fallback)
 */
export class DefaultErrorHandler extends BaseErrorHandler {
  canHandle(error: any): boolean {
    return true; // Always handles as fallback
  }
  
  handle(error: any, context: ErrorContext): ToolError {
    return this.createToolError(
      'UNKNOWN_ERROR',
      error.message || 'An unknown error occurred',
      {
        toolId: context.toolId,
        language: context.language,
        error: error.toString(),
        stack: error.stack
      },
      false // Unknown errors are not retryable by default
    );
  }
}

/**
 * Error handling middleware
 */
export class ErrorHandlingMiddleware {
  private handlers: ErrorHandler[] = [
    new TimeoutErrorHandler(),
    new ValidationErrorHandler(),
    new PythonExecutionErrorHandler(),
    new TypeScriptExecutionErrorHandler(),
    new PermissionErrorHandler(),
    new ResourceErrorHandler(),
    new DefaultErrorHandler() // Must be last
  ];
  
  /**
   * Handle an error and convert to ToolExecutionResult
   */
  handleError(
    error: any,
    context: ErrorContext
  ): ToolExecutionResult {
    // Find appropriate handler
    const handler = this.handlers.find(h => h.canHandle(error));
    const toolError = handler!.handle(error, context);
    
    // Log error for debugging
    this.logError(toolError, context);
    
    // Create execution result
    const endTime = new Date();
    const duration = endTime.getTime() - context.startTime.getTime();
    
    return {
      toolId: context.toolId,
      executionId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: ToolExecutionStatus.ERROR,
      error: toolError,
      performance: {
        startTime: context.startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration
      }
    };
  }
  
  /**
   * Add a custom error handler
   */
  addHandler(handler: ErrorHandler, priority: 'high' | 'low' = 'low'): void {
    if (priority === 'high') {
      // Add at the beginning (but before DefaultErrorHandler)
      this.handlers.splice(this.handlers.length - 1, 0, handler);
    } else {
      // Add before DefaultErrorHandler
      this.handlers.splice(this.handlers.length - 1, 0, handler);
    }
  }
  
  /**
   * Log error for debugging
   */
  private logError(error: ToolError, context: ErrorContext): void {
    console.error(`[Tool Error] ${error.code}: ${error.message}`, {
      toolId: context.toolId,
      language: context.language,
      retryable: error.retryable,
      details: error.details
    });
  }
  
  /**
   * Check if an error is retryable
   */
  isRetryable(error: ToolError): boolean {
    return error.retryable === true;
  }
  
  /**
   * Create a retry strategy
   */
  createRetryStrategy(error: ToolError): RetryStrategy | null {
    if (!this.isRetryable(error)) {
      return null;
    }
    
    // Default retry strategy
    return {
      maxAttempts: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
      maxDelay: 30000,
      shouldRetry: (attempt: number, lastError: ToolError) => {
        return attempt < 3 && lastError.retryable === true;
      }
    };
  }
}

export interface RetryStrategy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  shouldRetry: (attempt: number, lastError: ToolError) => boolean;
}

// Export singleton instance
export const errorHandler = new ErrorHandlingMiddleware();