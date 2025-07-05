/**
 * Base Types and Common Structures
 */

import { z } from 'zod';

// Version information
export const PROTOCOL_VERSION = '1.0.0';

// Language identifiers
export type Language = 'typescript' | 'python' | 'javascript' | 'go' | 'rust' | 'java';

// Common metadata structure
export interface Metadata {
  id: string;
  version: string;
  timestamp: string;
  correlationId?: string;
  source: string;
  environment?: string;
  tags?: string[];
  [key: string]: any;
}

// JSON Schema definition
export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema | JSONSchema[];
  required?: string[];
  enum?: any[];
  const?: any;
  description?: string;
  default?: any;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | JSONSchema;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  not?: JSONSchema;
  $ref?: string;
  $schema?: string;
  definitions?: Record<string, JSONSchema>;
  title?: string;
  examples?: any[];
}

// Priority levels
export type Priority = 'low' | 'normal' | 'high' | 'critical';

// Status types
export type Status = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

// Result wrapper
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: ErrorInfo;
  metadata?: Metadata;
}

// Error information
export interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  recoverable: boolean;
  retryAfter?: number;
}

// Pagination support
export interface PaginationParams {
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Zod schemas for validation
export const MetadataSchema = z.object({
  id: z.string(),
  version: z.string(),
  timestamp: z.string(),
  correlationId: z.string().optional(),
  source: z.string(),
  environment: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).passthrough();

export const ErrorInfoSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
  stack: z.string().optional(),
  recoverable: z.boolean(),
  retryAfter: z.number().optional(),
});

export const ResultSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: ErrorInfoSchema.optional(),
  metadata: MetadataSchema.optional(),
});

// Type guards
export function isError(value: any): value is ErrorInfo {
  return value && typeof value.code === 'string' && typeof value.message === 'string';
}

export function isSuccess<T>(result: Result<T>): result is Result<T> & { data: T } {
  return result.success === true && result.data !== undefined;
}