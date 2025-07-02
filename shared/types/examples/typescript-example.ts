/**
 * Example usage of OpenCode-DGM shared types in TypeScript
 */

import {
  Agent,
  AgentTask,
  Tool,
  ToolExecutionRequest,
  ToolExecutionResult,
  Command,
  CommandResult,
  OpenCodeDGMRequest,
  OpenCodeDGMResponse,
  ResponseBuilder,
  CaseConverter,
  createValidator,
  TypeMapper,
  Priority,
  Status
} from '../typescript';

// Example 1: Creating and executing a tool
async function toolExample() {
  // Define a tool
  const codeTool: Tool = {
    id: 'code-generator-v1',
    name: 'Code Generator',
    description: 'Generates code from natural language descriptions',
    version: '1.0.0',
    category: 'code-generation',
    language: 'typescript',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        language: { type: 'string', enum: ['typescript', 'python', 'java'] },
        style: { type: 'string' }
      },
      required: ['prompt', 'language']
    },
    configuration: {
      timeout: 30000,
      retryable: true,
      cacheable: true,
      rateLimit: {
        requests: 10,
        window: 60000,
        strategy: 'sliding-window'
      }
    }
  };

  // Create execution request
  const request: ToolExecutionRequest = {
    toolId: codeTool.id,
    input: {
      prompt: 'Create a function to calculate fibonacci numbers',
      language: 'typescript',
      style: 'functional'
    },
    options: {
      cache: true,
      timeout: 15000
    }
  };

  // Simulate execution and result
  const result: ToolExecutionResult = {
    toolId: codeTool.id,
    executionId: 'exec-001',
    status: 'success',
    output: {
      code: `const fibonacci = (n: number): number => {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
};`,
      language: 'typescript'
    },
    performance: {
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 1250
    }
  };

  console.log('Tool execution result:', result);
}

// Example 2: Agent coordination
async function agentExample() {
  // Create a code review agent
  const reviewAgent: Agent = {
    id: 'code-reviewer-v1',
    name: 'Code Reviewer',
    description: 'Reviews code for quality and best practices',
    version: '1.0.0',
    role: {
      id: 'reviewer',
      name: 'Code Reviewer',
      description: 'Analyzes code quality',
      capabilities: ['code-analysis', 'suggestion-generation'],
      promptingTechnique: 'cot' // Chain of Thought
    },
    capabilities: [
      {
        id: 'analyze-typescript',
        name: 'TypeScript Analysis',
        description: 'Analyzes TypeScript code',
        category: 'analysis',
        requiredTools: ['ast-parser', 'linter']
      }
    ],
    tools: ['eslint-tool', 'typescript-compiler'],
    configuration: {
      maxConcurrentTasks: 5,
      timeout: 60000,
      modelPreferences: {
        preferredModels: ['gpt-4', 'claude-3'],
        temperature: 0.3,
        maxTokens: 2000
      }
    }
  };

  // Create a task for the agent
  const task: AgentTask = {
    id: 'task-001',
    agentId: reviewAgent.id,
    type: 'code-review',
    priority: Priority.HIGH,
    input: {
      code: 'const add = (a, b) => a + b;',
      language: 'typescript',
      context: 'utility function'
    },
    status: Status.PENDING,
    createdAt: new Date().toISOString()
  };

  console.log('Agent task created:', task);
}

// Example 3: Command processing
async function commandExample() {
  const command: Command = {
    id: 'cmd-001',
    type: 'generation',
    intent: {
      primary: 'create_api',
      confidence: 0.92,
      entities: [
        {
          type: 'framework',
          value: 'express',
          confidence: 0.95,
          position: { start: 10, end: 17 }
        }
      ]
    },
    rawInput: 'Create an Express REST API for user management',
    parameters: {
      framework: 'express',
      features: ['authentication', 'crud', 'validation'],
      database: 'postgresql'
    },
    options: {
      priority: Priority.NORMAL,
      timeout: 45000,
      retryPolicy: {
        maxAttempts: 3,
        backoffMs: 1000,
        exponentialBackoff: true
      }
    },
    metadata: {
      id: 'meta-001',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      source: 'cli',
      userId: 'user-123',
      sessionId: 'session-456'
    },
    timestamp: new Date().toISOString()
  };

  // Build a response
  const response = new ResponseBuilder<any>()
    .status(Status.COMPLETED)
    .data({
      files: ['index.ts', 'routes/users.ts', 'models/User.ts'],
      instructions: 'Run npm install and npm start'
    })
    .metadata({
      duration: 3500,
      cached: false
    })
    .build();

  console.log('Command response:', response);
}

// Example 4: Cross-language communication
async function crossLanguageExample() {
  const request: OpenCodeDGMRequest = {
    id: 'req-001',
    type: 'code_generation',
    payload: {
      prompt: 'Create a data processing pipeline',
      language: 'python',
      context: {
        files: ['data_loader.py', 'processor.py'],
        dependencies: ['pandas', 'numpy']
      },
      constraints: {
        maxTokens: 1500,
        style: 'functional'
      }
    },
    context: {
      sessionId: 'session-789',
      userId: 'user-123',
      priority: 1
    }
  };

  // Convert to Python format
  const pythonRequest = CaseConverter.fromTypeScriptToPython(request);
  console.log('Python-formatted request:', pythonRequest);

  // Simulate Python response
  const pythonResponse = {
    id: 'res-001',
    request_id: 'req-001',
    type: 'success',
    payload: {
      code: 'def process_data(df):\n    return df.apply(transform)',
      language: 'python',
      confidence: 0.94,
      metrics: {
        lines: 2,
        complexity: 1,
        tokens: 25
      }
    }
  };

  // Convert back to TypeScript format
  const tsResponse = CaseConverter.fromPythonToTypeScript(pythonResponse);
  console.log('TypeScript-formatted response:', tsResponse);
}

// Example 5: Validation
async function validationExample() {
  const command = {
    id: 'cmd-001',
    type: 'invalid-type', // This will fail validation
    intent: {
      primary: 'test',
      confidence: 1.5 // This exceeds max value
    },
    rawInput: 'test command',
    parameters: {},
    options: {},
    metadata: {
      id: 'meta-001',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      source: 'test'
    },
    timestamp: new Date().toISOString()
  };

  const validator = createValidator({
    zodSchema: CommandSchema
  });

  const result = validator.validate(command);
  if (!result.valid) {
    console.log('Validation errors:', result.errors);
  }
}

// Run examples
async function main() {
  console.log('=== Tool Example ===');
  await toolExample();

  console.log('\n=== Agent Example ===');
  await agentExample();

  console.log('\n=== Command Example ===');
  await commandExample();

  console.log('\n=== Cross-Language Example ===');
  await crossLanguageExample();

  console.log('\n=== Validation Example ===');
  await validationExample();
}

main().catch(console.error);