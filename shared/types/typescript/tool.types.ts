/**
 * Tool-related Type Definitions
 */

import { z } from 'zod';
import { JSONSchema, Language, Metadata, Result } from './base.types';

// Tool definition
export interface Tool {
  id: string;
  name: string;
  description: string;
  version: string;
  category: ToolCategory;
  language: Language;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  configuration?: ToolConfiguration;
  examples?: ToolExample[];
  metadata?: Metadata;
}

// Tool categories
export type ToolCategory = 
  | 'file-system'
  | 'network'
  | 'database'
  | 'computation'
  | 'text-processing'
  | 'code-generation'
  | 'testing'
  | 'deployment'
  | 'monitoring'
  | 'security'
  | 'ai-ml'
  | 'data-processing'
  | 'communication'
  | 'utility';

// Tool configuration
export interface ToolConfiguration {
  timeout?: number;
  retryable?: boolean;
  cacheable?: boolean;
  rateLimit?: RateLimit;
  authentication?: AuthConfiguration;
  environment?: Record<string, string>;
  dependencies?: ToolDependency[];
}

// Rate limiting
export interface RateLimit {
  requests: number;
  window: number;
  strategy: 'fixed-window' | 'sliding-window' | 'token-bucket';
}

// Authentication configuration
export interface AuthConfiguration {
  type: 'none' | 'api-key' | 'oauth2' | 'basic' | 'jwt';
  credentials?: any;
  scope?: string[];
}

// Tool dependency
export interface ToolDependency {
  name: string;
  version?: string;
  type: 'tool' | 'library' | 'service' | 'resource';
  optional?: boolean;
}

// Tool example
export interface ToolExample {
  name: string;
  description?: string;
  input: any;
  output: any;
  explanation?: string;
}

// Tool execution context
export interface ToolContext {
  sessionId: string;
  messageId: string;
  userId?: string;
  agentId?: string;
  environment: Record<string, string>;
  abortSignal: AbortSignal;
  timeout: number;
  metadata: Map<string, any>;
  logger: ToolLogger;
}

// Tool logger
export interface ToolLogger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: any): void;
  metric(name: string, value: number, tags?: Record<string, string>): void;
}

// Tool execution request
export interface ToolExecutionRequest {
  toolId: string;
  input: any;
  context?: Partial<ToolContext>;
  options?: ToolExecutionOptions;
}

// Tool execution options
export interface ToolExecutionOptions {
  async?: boolean;
  stream?: boolean;
  cache?: boolean;
  priority?: number;
  timeout?: number;
}

// Tool execution result
export interface ToolExecutionResult {
  toolId: string;
  executionId: string;
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  output?: any;
  error?: ToolError;
  performance: ToolPerformance;
  artifacts?: ToolArtifact[];
  logs?: ToolLog[];
}

// Tool error
export interface ToolError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  cause?: Error;
}

// Tool performance metrics
export interface ToolPerformance {
  startTime: string;
  endTime: string;
  duration: number;
  memory?: {
    used: number;
    peak: number;
  };
  cpu?: {
    user: number;
    system: number;
  };
  io?: {
    bytesRead: number;
    bytesWritten: number;
  };
}

// Tool artifact
export interface ToolArtifact {
  name: string;
  type: string;
  size?: number;
  content?: any;
  encoding?: string;
  checksum?: string;
}

// Tool log
export interface ToolLog {
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

// Tool registry
export interface ToolRegistry {
  register(tool: Tool): Promise<void>;
  unregister(toolId: string): Promise<void>;
  get(toolId: string): Promise<Tool | undefined>;
  list(filter?: ToolFilter): Promise<Tool[]>;
  search(query: string): Promise<Tool[]>;
}

// Tool filter
export interface ToolFilter {
  category?: ToolCategory;
  language?: Language;
  tags?: string[];
  capabilities?: string[];
}

// Tool handler type
export type ToolHandler<TInput = any, TOutput = any> = (
  input: TInput,
  context: ToolContext
) => Promise<Result<TOutput>>;

// Zod schemas
export const ToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  category: z.enum([
    'file-system',
    'network',
    'database',
    'computation',
    'text-processing',
    'code-generation',
    'testing',
    'deployment',
    'monitoring',
    'security',
    'ai-ml',
    'data-processing',
    'communication',
    'utility'
  ]),
  language: z.enum(['typescript', 'python', 'javascript', 'go', 'rust', 'java']),
  inputSchema: z.any(),
  outputSchema: z.any().optional(),
  configuration: z.any().optional(),
  examples: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    input: z.any(),
    output: z.any(),
    explanation: z.string().optional(),
  })).optional(),
  metadata: z.any().optional(),
});

export const ToolExecutionRequestSchema = z.object({
  toolId: z.string(),
  input: z.any(),
  context: z.any().optional(),
  options: z.object({
    async: z.boolean().optional(),
    stream: z.boolean().optional(),
    cache: z.boolean().optional(),
    priority: z.number().optional(),
    timeout: z.number().optional(),
  }).optional(),
});

// Type guards
export function isToolError(value: any): value is ToolError {
  return value &&
    typeof value.code === 'string' &&
    typeof value.message === 'string' &&
    typeof value.retryable === 'boolean';
}

export function isToolExecutionResult(value: any): value is ToolExecutionResult {
  return value &&
    typeof value.toolId === 'string' &&
    typeof value.executionId === 'string' &&
    ['success', 'error', 'timeout', 'cancelled'].includes(value.status);
}