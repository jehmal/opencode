/**
 * Command-related Type Definitions
 */

import { z } from 'zod';
import { Priority, Status, Metadata } from './base.types';

// Command definition
export interface Command {
  id: string;
  type: CommandType;
  intent: CommandIntent;
  rawInput: string;
  parameters: Record<string, any>;
  options: CommandOptions;
  metadata: CommandMetadata;
  timestamp: string;
}

// Command types
export type CommandType = 
  | 'execution'
  | 'query'
  | 'configuration'
  | 'navigation'
  | 'generation'
  | 'analysis'
  | 'transformation'
  | 'workflow';

// Command intent
export interface CommandIntent {
  primary: string;
  secondary?: string;
  confidence: number;
  alternativeIntents?: Array<{
    intent: string;
    confidence: number;
  }>;
  entities?: CommandEntity[];
}

// Command entity
export interface CommandEntity {
  type: string;
  value: string;
  confidence: number;
  position: {
    start: number;
    end: number;
  };
}

// Command options
export interface CommandOptions {
  async?: boolean;
  timeout?: number;
  priority?: Priority;
  retryPolicy?: CommandRetryPolicy;
  executionMode?: 'immediate' | 'scheduled' | 'conditional';
  schedule?: CommandSchedule;
  conditions?: CommandCondition[];
}

// Command retry policy
export interface CommandRetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  exponentialBackoff?: boolean;
  retryableErrors?: string[];
}

// Command schedule
export interface CommandSchedule {
  type: 'once' | 'recurring' | 'cron';
  at?: string;
  interval?: number;
  cron?: string;
  timezone?: string;
}

// Command condition
export interface CommandCondition {
  type: 'dependency' | 'state' | 'time' | 'event';
  expression: string;
  timeout?: number;
}

// Command metadata
export interface CommandMetadata extends Metadata {
  source: 'cli' | 'api' | 'ui' | 'agent' | 'workflow' | 'internal';
  userId?: string;
  sessionId?: string;
  parentCommandId?: string;
  workflowId?: string;
}

// Command result
export interface CommandResult<T = any> {
  commandId: string;
  status: Status;
  data?: T;
  error?: CommandError;
  executionTime: number;
  timestamp: string;
  artifacts?: CommandArtifact[];
  subCommands?: SubCommandResult[];
}

// Command error
export interface CommandError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  recoverable: boolean;
  suggestions?: string[];
}

// Command artifact
export interface CommandArtifact {
  name: string;
  type: string;
  content?: any;
  path?: string;
  size?: number;
}

// Sub-command result
export interface SubCommandResult {
  commandId: string;
  status: Status;
  summary?: string;
}

// Command handler
export interface CommandHandler<TParams = any, TResult = any> {
  name: string;
  description: string;
  type: CommandType;
  schema?: CommandSchema;
  validate?: (params: TParams) => Promise<boolean>;
  execute: (command: Command, context: CommandContext) => Promise<CommandResult<TResult>>;
  rollback?: (command: Command, context: CommandContext) => Promise<void>;
}

// Command schema
export interface CommandSchema {
  parameters: z.ZodSchema<any>;
  options?: z.ZodSchema<any>;
  examples?: CommandExample[];
}

// Command example
export interface CommandExample {
  description: string;
  input: string;
  parameters?: Record<string, any>;
  expectedOutput?: any;
}

// Command context
export interface CommandContext {
  services: Map<string, any>;
  logger: CommandLogger;
  eventBus: CommandEventBus;
  abortSignal?: AbortSignal;
  user?: CommandUser;
  session?: CommandSession;
}

// Command logger
export interface CommandLogger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: any): void;
  audit(action: string, details?: any): void;
}

// Command event bus
export interface CommandEventBus {
  emit(event: string, data: any): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
  once(event: string, handler: (data: any) => void): void;
}

// Command user
export interface CommandUser {
  id: string;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

// Command session
export interface CommandSession {
  id: string;
  userId: string;
  startTime: string;
  context: Record<string, any>;
}

// Command router
export interface CommandRouter {
  register(pattern: string | RegExp, handler: CommandHandler): void;
  unregister(pattern: string | RegExp): void;
  route(command: Command): Promise<CommandHandler | undefined>;
  listRoutes(): CommandRoute[];
}

// Command route
export interface CommandRoute {
  pattern: string | RegExp;
  handler: string;
  middleware?: string[];
  description?: string;
  examples?: string[];
}

// Zod schemas
export const CommandIntentSchema = z.object({
  primary: z.string(),
  secondary: z.string().optional(),
  confidence: z.number().min(0).max(1),
  alternativeIntents: z.array(z.object({
    intent: z.string(),
    confidence: z.number().min(0).max(1),
  })).optional(),
  entities: z.array(z.object({
    type: z.string(),
    value: z.string(),
    confidence: z.number().min(0).max(1),
    position: z.object({
      start: z.number(),
      end: z.number(),
    }),
  })).optional(),
});

export const CommandOptionsSchema = z.object({
  async: z.boolean().optional(),
  timeout: z.number().positive().optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  retryPolicy: z.object({
    maxAttempts: z.number().positive(),
    backoffMs: z.number().positive(),
    exponentialBackoff: z.boolean().optional(),
    retryableErrors: z.array(z.string()).optional(),
  }).optional(),
  executionMode: z.enum(['immediate', 'scheduled', 'conditional']).optional(),
  schedule: z.any().optional(),
  conditions: z.array(z.any()).optional(),
});

export const CommandSchema = z.object({
  id: z.string(),
  type: z.enum([
    'execution',
    'query',
    'configuration',
    'navigation',
    'generation',
    'analysis',
    'transformation',
    'workflow'
  ]),
  intent: CommandIntentSchema,
  rawInput: z.string(),
  parameters: z.record(z.any()),
  options: CommandOptionsSchema,
  metadata: z.any(),
  timestamp: z.string(),
});

// Type guards
export function isCommandError(value: any): value is CommandError {
  return value &&
    typeof value.code === 'string' &&
    typeof value.message === 'string' &&
    typeof value.recoverable === 'boolean';
}

export function isCommandResult(value: any): value is CommandResult {
  return value &&
    typeof value.commandId === 'string' &&
    typeof value.status === 'string' &&
    typeof value.executionTime === 'number';
}