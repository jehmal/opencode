/**
 * Type definitions for DGM Integration
 */

export interface ToolMetrics {
  toolName: string;
  executionTime: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  userSatisfaction?: number;
  timestamp: Date;
  sessionId: string;
  parameters?: Record<string, any>;
}

export interface UsagePattern {
  toolName: string;
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  commonErrors: Array<{
    type: string;
    count: number;
    message: string;
  }>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface Improvement {
  toolName: string;
  type: 'optimization' | 'bug_fix' | 'feature' | 'refactor';
  description: string;
  confidence: number;
  expectedImprovement: number;
  code?: string;
  testResults?: {
    passed: boolean;
    details: string;
  };
}

export interface EvolutionResult {
  patterns: UsagePattern[];
  improvements: Improvement[];
  timestamp: Date;
  agentVersion: string;
}

export interface DGMConfig {
  enabled: boolean;
  pythonPath: string;
  agentPath: string;
  evolutionSchedule: 'manual' | 'daily' | 'weekly';
  trackingLevel: 'minimal' | 'standard' | 'detailed';
  autoApprove: boolean;
  maxExecutionTime?: number;
}

export interface ToolRegistration {
  id: string;
  name: string;
  description: string;
  version: string;
  handler: string; // Path to handler file
  schema: Record<string, any>; // JSON Schema
}

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
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}