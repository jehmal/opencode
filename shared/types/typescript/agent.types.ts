/**
 * Agent-related Type Definitions
 */

import { z } from 'zod';
import { JSONSchema, Metadata, Priority, Status } from './base.types';

// Agent capability definitions
export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  category: 'reasoning' | 'generation' | 'analysis' | 'transformation' | 'io' | 'coordination';
  requiredTools?: string[];
  requiredAgents?: string[];
  inputSchema?: JSONSchema;
  outputSchema?: JSONSchema;
}

// Agent role definitions
export interface AgentRole {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  constraints?: string[];
  expertise?: string[];
  promptingTechnique?: string;
}

// Agent definition
export interface Agent {
  id: string;
  name: string;
  description: string;
  version: string;
  role: AgentRole;
  capabilities: AgentCapability[];
  tools: string[];
  subAgents?: string[];
  configuration?: AgentConfiguration;
  metadata?: Metadata;
}

// Agent configuration
export interface AgentConfiguration {
  maxConcurrentTasks?: number;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  memory?: MemoryConfiguration;
  communication?: CommunicationConfiguration;
  promptTemplate?: string;
  modelPreferences?: ModelPreferences;
}

// Retry policy
export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  exponentialBackoff?: boolean;
  retryableErrors?: string[];
}

// Memory configuration
export interface MemoryConfiguration {
  type: 'short-term' | 'long-term' | 'working' | 'episodic';
  maxItems?: number;
  ttl?: number;
  persistToDisk?: boolean;
  vectorStore?: {
    provider: string;
    dimensions: number;
    similarityThreshold: number;
  };
}

// Communication configuration
export interface CommunicationConfiguration {
  protocol: 'json-rpc' | 'grpc' | 'http' | 'websocket';
  format: 'json' | 'protobuf' | 'msgpack';
  compression?: boolean;
  encryption?: boolean;
}

// Model preferences
export interface ModelPreferences {
  preferredModels: string[];
  fallbackModels?: string[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

// Agent task definition
export interface AgentTask {
  id: string;
  agentId: string;
  type: string;
  priority: Priority;
  input: any;
  constraints?: TaskConstraints;
  dependencies?: string[];
  status: Status;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: TaskResult;
}

// Task constraints
export interface TaskConstraints {
  timeout?: number;
  maxRetries?: number;
  requiredCapabilities?: string[];
  resourceLimits?: {
    maxMemory?: number;
    maxCpu?: number;
    maxTokens?: number;
  };
}

// Task result
export interface TaskResult {
  output: any;
  performance: {
    duration: number;
    tokensUsed?: number;
    retries?: number;
  };
  artifacts?: TaskArtifact[];
  logs?: LogEntry[];
}

// Task artifact
export interface TaskArtifact {
  name: string;
  type: string;
  size?: number;
  content?: any;
  url?: string;
  hash?: string;
}

// Log entry
export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

// Agent coordination message
export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'event' | 'broadcast';
  subject: string;
  content: any;
  metadata?: Metadata;
  replyTo?: string;
  expiresAt?: string;
}

// Multi-agent workflow
export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  agents: WorkflowAgent[];
  connections: WorkflowConnection[];
  triggers?: WorkflowTrigger[];
  outputs?: WorkflowOutput[];
}

// Workflow agent node
export interface WorkflowAgent {
  id: string;
  agentId: string;
  position?: { x: number; y: number };
  configuration?: any;
}

// Workflow connection
export interface WorkflowConnection {
  from: string;
  to: string;
  condition?: string;
  transform?: string;
}

// Workflow trigger
export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'event' | 'webhook';
  configuration: any;
}

// Workflow output
export interface WorkflowOutput {
  name: string;
  source: string;
  transform?: string;
}

// Zod schemas
export const AgentCapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['reasoning', 'generation', 'analysis', 'transformation', 'io', 'coordination']),
  requiredTools: z.array(z.string()).optional(),
  requiredAgents: z.array(z.string()).optional(),
  inputSchema: z.any().optional(),
  outputSchema: z.any().optional(),
});

export const AgentRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  capabilities: z.array(z.string()),
  constraints: z.array(z.string()).optional(),
  expertise: z.array(z.string()).optional(),
  promptingTechnique: z.string().optional(),
});

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  role: AgentRoleSchema,
  capabilities: z.array(AgentCapabilitySchema),
  tools: z.array(z.string()),
  subAgents: z.array(z.string()).optional(),
  configuration: z.any().optional(),
  metadata: z.any().optional(),
});

// Type guards
export function isAgentMessage(value: any): value is AgentMessage {
  return value && 
    typeof value.id === 'string' &&
    typeof value.from === 'string' &&
    typeof value.to === 'string' &&
    ['request', 'response', 'event', 'broadcast'].includes(value.type);
}