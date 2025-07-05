import { CommandError } from '../types/command.types';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error categories
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  PERMISSION = 'permission',
  RESOURCE = 'resource',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

/**
 * Enhanced error with additional metadata
 */
export interface EnhancedError extends CommandError {
  severity: ErrorSeverity;
  category: ErrorCategory;
  timestamp: Date;
  context?: Record<string, any>;
  suggestions?: string[];
}

/**
 * Error recovery strategy
 */
export interface RecoveryStrategy {
  name: string;
  applicable: (error: EnhancedError) => boolean;
  execute: (error: EnhancedError) => Promise<boolean>;
}

/**
 * Error handler for managing and recovering from errors
 */
export class ErrorHandler {
  private strategies: RecoveryStrategy[] = [];
  private errorLog: EnhancedError[] = [];
  private maxLogSize: number = 1000;

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
   * Register default recovery strategies
   */
  private registerDefaultStrategies(): void {
    // Retry strategy for network errors
    this.registerStrategy({
      name: 'network-retry',
      applicable: (error) => 
        error.category === ErrorCategory.NETWORK && error.recoverable,
      execute: async (error) => {
        // Implement exponential backoff retry logic
        const maxRetries = 3;
        const baseDelay = 1000;
        
        for (let i = 0; i < maxRetries; i++) {
          await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, i)));
          // Return true if retry should be attempted
          return true;
        }
        return false;
      },
    });

    // Timeout extension strategy
    this.registerStrategy({
      name: 'timeout-extension',
      applicable: (error) => 
        error.category === ErrorCategory.TIMEOUT && error.recoverable,
      execute: async (error) => {
        // Suggest extending timeout
        error.suggestions = error.suggestions || [];
        error.suggestions.push('Consider increasing the command timeout');
        return false; // Don't auto-recover, just provide suggestion
      },
    });

    // Permission elevation strategy
    this.registerStrategy({
      name: 'permission-elevation',
      applicable: (error) => 
        error.category === ErrorCategory.PERMISSION,
      execute: async (error) => {
        error.suggestions = error.suggestions || [];
        error.suggestions.push('Try running with elevated permissions');
        error.suggestions.push('Check file/resource permissions');
        return false;
      },
    });

    // Resource cleanup strategy
    this.registerStrategy({
      name: 'resource-cleanup',
      applicable: (error) => 
        error.category === ErrorCategory.RESOURCE && 
        error.code === 'RESOURCE_EXHAUSTED',
      execute: async (error) => {
        // Attempt to free resources
        if (global.gc) {
          global.gc();
        }
        error.suggestions = error.suggestions || [];
        error.suggestions.push('Resources have been cleaned up, retry the operation');
        return true;
      },
    });
  }

  /**
   * Register a recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Handle an error
   */
  async handle(error: Error | CommandError, context?: Record<string, any>): Promise<EnhancedError> {
    const enhanced = this.enhanceError(error, context);
    
    // Log the error
    this.logError(enhanced);

    // Try recovery strategies
    const applicableStrategies = this.strategies.filter(s => s.applicable(enhanced));
    
    for (const strategy of applicableStrategies) {
      try {
        const recovered = await strategy.execute(enhanced);
        if (recovered) {
          enhanced.recoverable = true;
          enhanced.suggestions = enhanced.suggestions || [];
          enhanced.suggestions.push(`Recovery strategy '${strategy.name}' can be applied`);
        }
      } catch (strategyError) {
        // Strategy failed, continue with next
        console.error(`Recovery strategy '${strategy.name}' failed:`, strategyError);
      }
    }

    return enhanced;
  }

  /**
   * Enhance error with additional metadata
   */
  private enhanceError(error: Error | CommandError, context?: Record<string, any>): EnhancedError {
    const commandError = this.isCommandError(error) ? error : {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      details: error,
      stack: error.stack,
      recoverable: false,
    };

    return {
      ...commandError,
      severity: this.determineSeverity(commandError),
      category: this.categorizeError(commandError),
      timestamp: new Date(),
      context,
      suggestions: [],
    };
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: CommandError): ErrorSeverity {
    // Critical errors
    if (
      error.code === 'SYSTEM_ERROR' ||
      error.code === 'FATAL_ERROR' ||
      error.message.toLowerCase().includes('fatal')
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity
    if (
      error.code === 'PERMISSION_DENIED' ||
      error.code === 'AUTHENTICATION_FAILED' ||
      !error.recoverable
    ) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity
    if (
      error.code === 'VALIDATION_ERROR' ||
      error.code === 'TIMEOUT'
    ) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity
    return ErrorSeverity.LOW;
  }

  /**
   * Categorize error
   */
  private categorizeError(error: CommandError): ErrorCategory {
    const code = error.code.toLowerCase();
    const message = error.message.toLowerCase();

    if (code.includes('validation') || code.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }

    if (
      code.includes('network') || 
      code.includes('connection') ||
      message.includes('network') ||
      message.includes('connection')
    ) {
      return ErrorCategory.NETWORK;
    }

    if (code.includes('timeout') || message.includes('timeout')) {
      return ErrorCategory.TIMEOUT;
    }

    if (
      code.includes('permission') || 
      code.includes('denied') ||
      code.includes('unauthorized')
    ) {
      return ErrorCategory.PERMISSION;
    }

    if (
      code.includes('resource') || 
      code.includes('memory') ||
      code.includes('disk')
    ) {
      return ErrorCategory.RESOURCE;
    }

    if (
      code.includes('system') || 
      code.includes('fatal') ||
      code.includes('critical')
    ) {
      return ErrorCategory.SYSTEM;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Log error
   */
  private logError(error: EnhancedError): void {
    this.errorLog.push(error);
    
    // Maintain log size limit
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
  }

  /**
   * Get error log
   */
  getErrorLog(filter?: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    since?: Date;
  }): EnhancedError[] {
    let errors = [...this.errorLog];

    if (filter) {
      if (filter.severity) {
        errors = errors.filter(e => e.severity === filter.severity);
      }
      if (filter.category) {
        errors = errors.filter(e => e.category === filter.category);
      }
      if (filter.since) {
        errors = errors.filter(e => e.timestamp >= filter.since!);
      }
    }

    return errors;
  }

  /**
   * Get error statistics
   */
  getStatistics(): {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byCategory: Record<ErrorCategory, number>;
    recoverable: number;
    recent: number;
  } {
    const stats = {
      total: this.errorLog.length,
      bySeverity: {} as Record<ErrorSeverity, number>,
      byCategory: {} as Record<ErrorCategory, number>,
      recoverable: 0,
      recent: 0,
    };

    // Initialize counters
    Object.values(ErrorSeverity).forEach(severity => {
      stats.bySeverity[severity] = 0;
    });
    Object.values(ErrorCategory).forEach(category => {
      stats.byCategory[category] = 0;
    });

    const recentThreshold = new Date();
    recentThreshold.setMinutes(recentThreshold.getMinutes() - 5);

    for (const error of this.errorLog) {
      stats.bySeverity[error.severity]++;
      stats.byCategory[error.category]++;
      if (error.recoverable) stats.recoverable++;
      if (error.timestamp >= recentThreshold) stats.recent++;
    }

    return stats;
  }

  /**
   * Clear error log
   */
  clearLog(): void {
    this.errorLog = [];
  }

  /**
   * Type guard for CommandError
   */
  private isCommandError(error: any): error is CommandError {
    return error && 
           typeof error.code === 'string' &&
           typeof error.message === 'string' &&
           typeof error.recoverable === 'boolean';
  }

  /**
   * Create standardized error response
   */
  createErrorResponse(
    code: string,
    message: string,
    details?: any,
    recoverable: boolean = false
  ): CommandError {
    return {
      code,
      message,
      details,
      recoverable,
    };
  }
}