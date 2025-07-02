/**
 * Protocol-related Type Definitions
 */

import { z } from 'zod';
import { Language, Metadata } from './base.types';
import { ToolExecutionRequest, ToolExecutionResult } from './tool.types';
import { Command, CommandResult } from './command.types';
import { AgentTask, TaskResult } from './agent.types';

// Protocol message types
export interface ProtocolMessage {
  id: string;
  protocol: string;
  version: string;
  type: MessageType;
  payload: any;
  metadata?: Metadata;
  timestamp: string;
}

// Message types
export type MessageType = 
  | 'request'
  | 'response'
  | 'notification'
  | 'event'
  | 'error'
  | 'heartbeat';

// JSON-RPC 2.0 types
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

// OpenCode-DGM specific protocol messages
export interface OpenCodeDGMRequest {
  id: string;
  type: RequestType;
  payload: RequestPayload;
  context?: RequestContext;
  metadata?: Metadata;
}

export interface OpenCodeDGMResponse {
  id: string;
  requestId: string;
  type: ResponseType;
  payload: ResponsePayload;
  metadata?: Metadata;
}

// Request types
export type RequestType = 
  | 'code_generation'
  | 'test_generation'
  | 'prompt_optimization'
  | 'evaluation'
  | 'tool_execution'
  | 'command_execution'
  | 'agent_task'
  | 'workflow_execution';

// Request context
export interface RequestContext {
  sessionId?: string;
  userId?: string;
  workspaceId?: string;
  projectId?: string;
  environment?: Record<string, string>;
  timeout?: number;
  priority?: number;
}

// Request payloads
export type RequestPayload = 
  | CodeGenerationPayload
  | TestGenerationPayload
  | PromptOptimizationPayload
  | EvaluationPayload
  | ToolExecutionPayload
  | CommandExecutionPayload
  | AgentTaskPayload
  | WorkflowExecutionPayload;

// Response types
export type ResponseType = 
  | 'success'
  | 'error'
  | 'partial'
  | 'progress'
  | 'stream';

// Response payloads
export type ResponsePayload = 
  | CodeGenerationResult
  | TestGenerationResult
  | PromptOptimizationResult
  | EvaluationResult
  | ToolExecutionResult
  | CommandResult
  | TaskResult
  | WorkflowExecutionResult;

// Code generation
export interface CodeGenerationPayload {
  prompt: string;
  language: Language;
  context?: CodeContext;
  constraints?: CodeConstraints;
  examples?: CodeExample[];
}

export interface CodeContext {
  files?: string[];
  dependencies?: string[];
  imports?: string[];
  variables?: Record<string, any>;
}

export interface CodeConstraints {
  maxTokens?: number;
  temperature?: number;
  style?: string;
  patterns?: string[];
  antiPatterns?: string[];
}

export interface CodeExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface CodeGenerationResult {
  code: string;
  language: Language;
  explanation?: string;
  confidence: number;
  alternatives?: Array<{
    code: string;
    confidence: number;
  }>;
  metrics?: CodeMetrics;
}

export interface CodeMetrics {
  lines: number;
  complexity: number;
  tokens: number;
  estimatedTime?: number;
}

// Test generation
export interface TestGenerationPayload {
  code: string;
  language: Language;
  framework: TestFramework;
  coverage?: CoverageRequirements;
}

export type TestFramework = 
  | 'jest'
  | 'pytest'
  | 'junit'
  | 'go_test'
  | 'rspec'
  | 'mocha'
  | 'vitest';

export interface CoverageRequirements {
  target?: number;
  types?: ('unit' | 'integration' | 'e2e')[];
  focusAreas?: string[];
}

export interface TestGenerationResult {
  tests: string;
  framework: TestFramework;
  coverage: CoverageReport;
  suggestions?: string[];
}

export interface CoverageReport {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
}

// Prompt optimization
export interface PromptOptimizationPayload {
  originalPrompt: string;
  objective: string;
  technique?: string;
  examples?: PromptExample[];
  constraints?: PromptConstraints;
}

export interface PromptExample {
  input: string;
  output: string;
  score?: number;
}

export interface PromptConstraints {
  maxLength?: number;
  techniques?: string[];
  targetModel?: string;
}

export interface PromptOptimizationResult {
  optimizedPrompt: string;
  technique: string;
  improvements: string[];
  score: number;
  alternatives?: Array<{
    prompt: string;
    technique: string;
    score: number;
  }>;
}

// Evaluation
export interface EvaluationPayload {
  code: string;
  tests: string[];
  metrics?: EvaluationMetric[];
  environment?: EvaluationEnvironment;
}

export type EvaluationMetric = 
  | 'correctness'
  | 'performance'
  | 'readability'
  | 'maintainability'
  | 'security'
  | 'efficiency';

export interface EvaluationEnvironment {
  runtime: string;
  version: string;
  dependencies: Record<string, string>;
  configuration?: Record<string, any>;
}

export interface EvaluationResult {
  passed: boolean;
  score: number;
  metrics: Record<EvaluationMetric, MetricResult>;
  issues?: Issue[];
  suggestions?: string[];
}

export interface MetricResult {
  score: number;
  details: string;
  subMetrics?: Record<string, number>;
}

export interface Issue {
  type: 'error' | 'warning' | 'info';
  metric: EvaluationMetric;
  message: string;
  location?: CodeLocation;
  suggestion?: string;
}

export interface CodeLocation {
  file?: string;
  line: number;
  column?: number;
}

// Additional payload types
export type ToolExecutionPayload = ToolExecutionRequest;
export type CommandExecutionPayload = Command;
export type AgentTaskPayload = AgentTask;

export interface WorkflowExecutionPayload {
  workflowId: string;
  input: any;
  configuration?: Record<string, any>;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  executionId: string;
  status: 'completed' | 'failed' | 'partial';
  outputs: Record<string, any>;
  steps: WorkflowStepResult[];
}

export interface WorkflowStepResult {
  stepId: string;
  status: 'completed' | 'failed' | 'skipped';
  output?: any;
  error?: any;
  duration: number;
}

// Protocol error codes
export enum ProtocolErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  
  // Custom error codes
  AuthenticationRequired = -32000,
  AuthorizationFailed = -32001,
  RateLimitExceeded = -32002,
  ResourceNotFound = -32003,
  ResourceConflict = -32004,
  ValidationError = -32005,
  TimeoutError = -32006,
  ExecutionError = -32007,
}

// Zod schemas
export const ProtocolMessageSchema = z.object({
  id: z.string(),
  protocol: z.string(),
  version: z.string(),
  type: z.enum(['request', 'response', 'notification', 'event', 'error', 'heartbeat']),
  payload: z.any(),
  metadata: z.any().optional(),
  timestamp: z.string(),
});

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.any().optional(),
});

export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.any().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.any().optional(),
  }).optional(),
});

// Type guards
export function isJsonRpcRequest(value: any): value is JsonRpcRequest {
  return value &&
    value.jsonrpc === '2.0' &&
    (typeof value.id === 'string' || typeof value.id === 'number') &&
    typeof value.method === 'string';
}

export function isJsonRpcResponse(value: any): value is JsonRpcResponse {
  return value &&
    value.jsonrpc === '2.0' &&
    (typeof value.id === 'string' || typeof value.id === 'number') &&
    (value.result !== undefined || value.error !== undefined);
}