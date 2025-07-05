/**
 * @opencode-dgm/core - Core utilities and types
 */

// Re-export protocols
export * from '../../../shared/protocols';

// Utility functions
export function createTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: number;
    backoff?: number;
  } = {}
): Promise<T> {
  const { attempts = 3, delay = 1000, backoff = 2 } = options;
  
  return new Promise(async (resolve, reject) => {
    let lastError: Error;
    
    for (let i = 0; i < attempts; i++) {
      try {
        const result = await fn();
        return resolve(result);
      } catch (error) {
        lastError = error as Error;
        
        if (i < attempts - 1) {
          await sleep(delay * Math.pow(backoff, i));
        }
      }
    }
    
    reject(lastError!);
  });
}

// Type utilities
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type AsyncReturnType<T extends (...args: any) => Promise<any>> =
  T extends (...args: any) => Promise<infer R> ? R : any;

// Constants
export const DEFAULT_TIMEOUT = 300000; // 5 minutes
export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_RETRY_DELAY = 1000;

// Error classes
export class TaskError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TaskError';
  }
}

export class TimeoutError extends TaskError {
  constructor(message: string, details?: any) {
    super(message, 'TIMEOUT', details);
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends TaskError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION', details);
    this.name = 'ValidationError';
  }
}