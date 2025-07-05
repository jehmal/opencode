import { z } from 'zod';

/**
 * Base command structure
 */
export interface Command {
  id: string;
  intent: CommandIntent;
  rawInput: string;
  parameters: Record<string, any>;
  options: CommandOptions;
  metadata: CommandMetadata;
  timestamp: Date;
}

/**
 * Command intent represents the parsed action the user wants to perform
 */
export interface CommandIntent {
  primary: string;
  secondary?: string;
  confidence: number;
  alternativeIntents?: Array<{
    intent: string;
    confidence: number;
  }>;
}

/**
 * Command options for execution control
 */
export interface CommandOptions {
  async?: boolean;
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
  retryPolicy?: RetryPolicy;
}

/**
 * Retry policy for failed commands
 */
export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  exponentialBackoff?: boolean;
}

/**
 * Command metadata for tracking and analytics
 */
export interface CommandMetadata {
  source: 'cli' | 'api' | 'ui' | 'internal';
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  tags?: string[];
}

/**
 * Command execution result
 */
export interface CommandResult<T = any> {
  commandId: string;
  success: boolean;
  data?: T;
  error?: CommandError;
  executionTime: number;
  timestamp: Date;
}

/**
 * Command error structure
 */
export interface CommandError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  recoverable: boolean;
}

/**
 * Command handler interface
 */
export interface CommandHandler<TParams = any, TResult = any> {
  name: string;
  description?: string;
  validate?: (params: TParams) => Promise<boolean>;
  execute: (command: Command, context: HandlerContext) => Promise<CommandResult<TResult>>;
  rollback?: (command: Command, context: HandlerContext) => Promise<void>;
}

/**
 * Handler execution context
 */
export interface HandlerContext {
  services: Map<string, any>;
  logger: Logger;
  eventBus: EventBus;
  abortSignal?: AbortSignal;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: any): void;
}

/**
 * Event bus interface
 */
export interface EventBus {
  emit(event: string, data: any): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

/**
 * Route definition
 */
export interface Route {
  pattern: string | RegExp;
  handler: string;
  middleware?: string[];
  description?: string;
  examples?: string[];
}

/**
 * Middleware interface
 */
export interface Middleware {
  name: string;
  execute: (command: Command, next: () => Promise<CommandResult>) => Promise<CommandResult>;
}

// Zod schemas for validation
export const CommandIntentSchema = z.object({
  primary: z.string(),
  secondary: z.string().optional(),
  confidence: z.number().min(0).max(1),
  alternativeIntents: z.array(z.object({
    intent: z.string(),
    confidence: z.number().min(0).max(1),
  })).optional(),
});

export const CommandOptionsSchema = z.object({
  async: z.boolean().optional(),
  timeout: z.number().positive().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  retryPolicy: z.object({
    maxAttempts: z.number().positive(),
    backoffMs: z.number().positive(),
    exponentialBackoff: z.boolean().optional(),
  }).optional(),
});

export const CommandMetadataSchema = z.object({
  source: z.enum(['cli', 'api', 'ui', 'internal']),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  correlationId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const CommandSchema = z.object({
  id: z.string(),
  intent: CommandIntentSchema,
  rawInput: z.string(),
  parameters: z.record(z.any()),
  options: CommandOptionsSchema,
  metadata: CommandMetadataSchema,
  timestamp: z.date(),
});