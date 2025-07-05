/**
 * OpenCode-DGM Communication Protocol TypeScript Definitions
 */

export interface TaskRequest {
  id: string;
  type: 'code_generation' | 'test_generation' | 'prompt_optimization' | 'evaluation';
  payload: TaskPayload;
  metadata?: {
    timestamp: string;
    source: string;
    priority: 'low' | 'medium' | 'high';
    timeout?: number;
  };
}

export interface TaskResponse {
  id: string;
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  result: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    startTime: string;
    endTime: string;
    duration: number;
  };
}

export interface CodeGenerationPayload {
  prompt: string;
  language: string;
  context?: {
    files?: string[];
    dependencies?: string[];
  };
  constraints?: {
    maxTokens?: number;
    temperature?: number;
    style?: string;
  };
}

export interface TestGenerationPayload {
  code: string;
  framework: 'jest' | 'pytest' | 'go_test' | 'junit';
  coverage?: {
    target?: number;
    types?: ('unit' | 'integration' | 'e2e')[];
  };
}

export interface PromptOptimizationPayload {
  originalPrompt: string;
  objective: string;
  examples?: Array<{
    input: string;
    output: string;
    score?: number;
  }>;
  constraints?: {
    maxLength?: number;
    techniques?: string[];
  };
}

export interface EvaluationPayload {
  code: string;
  tests: string[];
  metrics?: ('correctness' | 'performance' | 'readability' | 'maintainability')[];
  environment?: {
    runtime?: string;
    version?: string;
    dependencies?: Record<string, string>;
  };
}

export type TaskPayload = 
  | CodeGenerationPayload 
  | TestGenerationPayload 
  | PromptOptimizationPayload 
  | EvaluationPayload;

// Helper type guards
export function isCodeGenerationPayload(payload: TaskPayload): payload is CodeGenerationPayload {
  return 'prompt' in payload && 'language' in payload;
}

export function isTestGenerationPayload(payload: TaskPayload): payload is TestGenerationPayload {
  return 'code' in payload && 'framework' in payload;
}

export function isPromptOptimizationPayload(payload: TaskPayload): payload is PromptOptimizationPayload {
  return 'originalPrompt' in payload && 'objective' in payload;
}

export function isEvaluationPayload(payload: TaskPayload): payload is EvaluationPayload {
  return 'code' in payload && 'tests' in payload && Array.isArray(payload.tests);
}