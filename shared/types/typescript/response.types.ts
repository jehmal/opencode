/**
 * Response-related Type Definitions
 */

import { z } from 'zod';
import { Status, ErrorInfo, Metadata } from './base.types';

// Base response
export interface Response<T = any> {
  id: string;
  type: ResponseType;
  status: Status;
  data?: T;
  error?: ErrorInfo;
  metadata: ResponseMetadata;
  timestamp: string;
}

// Response types
export type ResponseType = 
  | 'success'
  | 'error'
  | 'partial'
  | 'stream'
  | 'redirect'
  | 'acknowledgment';

// Response metadata
export interface ResponseMetadata extends Metadata {
  duration?: number;
  retries?: number;
  cached?: boolean;
  truncated?: boolean;
}

// Streaming response
export interface StreamingResponse<T = any> {
  id: string;
  chunks: AsyncIterable<StreamChunk<T>>;
  metadata: ResponseMetadata;
}

// Stream chunk
export interface StreamChunk<T = any> {
  sequenceNumber: number;
  data: T;
  isFinal: boolean;
  timestamp: string;
}

// Batch response
export interface BatchResponse<T = any> {
  id: string;
  responses: Response<T>[];
  summary: BatchSummary;
  metadata: ResponseMetadata;
}

// Batch summary
export interface BatchSummary {
  total: number;
  successful: number;
  failed: number;
  partial: number;
  averageDuration: number;
}

// Paginated response
export interface PaginatedResponse<T = any> {
  id: string;
  items: T[];
  pagination: PaginationInfo;
  metadata: ResponseMetadata;
}

// Pagination info
export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Progress response
export interface ProgressResponse {
  id: string;
  taskId: string;
  progress: ProgressInfo;
  metadata: ResponseMetadata;
}

// Progress info
export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  message?: string;
  estimatedTimeRemaining?: number;
  subTasks?: SubTaskProgress[];
}

// Sub-task progress
export interface SubTaskProgress {
  name: string;
  status: Status;
  progress: number;
}

// File response
export interface FileResponse {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  content?: Buffer | string;
  url?: string;
  checksum?: string;
  metadata: ResponseMetadata;
}

// Error response
export interface ErrorResponse {
  id: string;
  error: DetailedError;
  metadata: ResponseMetadata;
}

// Detailed error
export interface DetailedError extends ErrorInfo {
  type: ErrorType;
  context?: Record<string, any>;
  suggestions?: string[];
  documentation?: string;
}

// Error types
export type ErrorType = 
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'timeout'
  | 'internal'
  | 'external_service'
  | 'network';

// Response builder
export class ResponseBuilder<T = any> {
  private response: Partial<Response<T>> = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    metadata: {
      id: generateId(),
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      source: 'system'
    }
  };

  type(type: ResponseType): this {
    this.response.type = type;
    return this;
  }

  status(status: Status): this {
    this.response.status = status;
    return this;
  }

  data(data: T): this {
    this.response.data = data;
    return this;
  }

  error(error: ErrorInfo): this {
    this.response.error = error;
    return this;
  }

  metadata(metadata: Partial<ResponseMetadata>): this {
    this.response.metadata = { ...this.response.metadata!, ...metadata };
    return this;
  }

  build(): Response<T> {
    if (!this.response.type) {
      this.response.type = this.response.error ? 'error' : 'success';
    }
    if (!this.response.status) {
      this.response.status = this.response.error ? 'failed' : 'completed';
    }
    return this.response as Response<T>;
  }
}

// Zod schemas
export const ResponseMetadataSchema = z.object({
  id: z.string(),
  version: z.string(),
  timestamp: z.string(),
  correlationId: z.string().optional(),
  source: z.string(),
  environment: z.string().optional(),
  tags: z.array(z.string()).optional(),
  duration: z.number().optional(),
  retries: z.number().optional(),
  cached: z.boolean().optional(),
  truncated: z.boolean().optional(),
}).passthrough();

export const ResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  id: z.string(),
  type: z.enum(['success', 'error', 'partial', 'stream', 'redirect', 'acknowledgment']),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'timeout']),
  data: dataSchema.optional(),
  error: z.any().optional(),
  metadata: ResponseMetadataSchema,
  timestamp: z.string(),
});

export const PaginationInfoSchema = z.object({
  page: z.number().positive(),
  pageSize: z.number().positive(),
  totalItems: z.number().nonnegative(),
  totalPages: z.number().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

// Utility functions
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Type guards
export function isErrorResponse(response: Response): response is Response & { error: ErrorInfo } {
  return response.type === 'error' && response.error !== undefined;
}

export function isStreamingResponse<T>(value: any): value is StreamingResponse<T> {
  return value &&
    typeof value.id === 'string' &&
    value.chunks &&
    typeof value.chunks[Symbol.asyncIterator] === 'function';
}

export function isPaginatedResponse<T>(value: any): value is PaginatedResponse<T> {
  return value &&
    Array.isArray(value.items) &&
    value.pagination &&
    typeof value.pagination.page === 'number';
}