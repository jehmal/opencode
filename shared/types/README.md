# OpenCode-DGM Shared Types

This directory contains shared type definitions and utilities for seamless integration between OpenCode and DGM systems across TypeScript and Python.

## Overview

The shared types system provides:

1. **Type Definitions**: Common data structures in both TypeScript and Python
2. **JSON Schemas**: Language-agnostic schema specifications
3. **Type Converters**: Utilities for cross-language data transformation
4. **Validators**: Runtime validation across language boundaries

## Directory Structure

```
shared/types/
├── typescript/          # TypeScript type definitions
│   ├── index.ts
│   ├── base.types.ts    # Common base types
│   ├── agent.types.ts   # Agent-related types
│   ├── tool.types.ts    # Tool-related types
│   ├── command.types.ts # Command types
│   ├── response.types.ts # Response types
│   ├── protocol.types.ts # Protocol types
│   ├── error.types.ts   # Error types
│   └── utils.types.ts   # Utility types
├── python/             # Python type definitions
│   ├── __init__.py
│   ├── base.py         # Common base types
│   ├── agent.py        # Agent-related types
│   ├── tool.py         # Tool-related types
│   ├── command.py      # Command types
│   ├── response.py     # Response types
│   ├── protocol.py     # Protocol types
│   ├── error.py        # Error types
│   └── utils.py        # Utility types
├── schemas/            # JSON Schema definitions
│   ├── agent.schema.json
│   └── tool.schema.json
├── converters/         # Type conversion utilities
│   ├── index.ts
│   ├── json-converter.ts
│   ├── camel-snake-converter.ts
│   ├── type-mapper.ts
│   ├── validator.ts
│   └── python/
│       ├── __init__.py
│       ├── json_converter.py
│       └── case_converter.py
└── README.md          # This file
```

## Usage Examples

### TypeScript

```typescript
import { 
  Agent, 
  Tool, 
  Command, 
  CommandResult,
  CaseConverter,
  createValidator 
} from '@shared/types';

// Create an agent
const agent: Agent = {
  id: 'agent-001',
  name: 'Code Generator',
  description: 'Generates code from natural language',
  version: '1.0.0',
  role: {
    id: 'generator',
    name: 'Generator',
    description: 'Code generation specialist',
    capabilities: ['code_generation', 'test_generation']
  },
  capabilities: [],
  tools: ['opencode-generator', 'test-runner']
};

// Create a command
const command: Command = {
  id: 'cmd-001',
  type: 'generation',
  intent: {
    primary: 'generate_code',
    confidence: 0.95
  },
  rawInput: 'Create a React component for a todo list',
  parameters: {
    language: 'typescript',
    framework: 'react'
  },
  options: {
    timeout: 30000,
    priority: 'high'
  },
  metadata: {
    id: 'meta-001',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    source: 'cli'
  },
  timestamp: new Date().toISOString()
};

// Convert to Python format
const pythonData = CaseConverter.fromTypeScriptToPython(command);

// Validate data
const validator = createValidator({
  zodSchema: CommandSchema
});
const result = validator.validate(command);
```

### Python

```python
from shared.types import (
    Agent,
    Tool,
    Command,
    CommandResult,
    CaseConverter,
    CrossLanguageValidator
)

# Create an agent
agent = Agent(
    id="agent-001",
    name="Code Generator",
    description="Generates code from natural language",
    version="1.0.0",
    role=AgentRole(
        id="generator",
        name="Generator",
        description="Code generation specialist",
        capabilities=["code_generation", "test_generation"]
    ),
    capabilities=[],
    tools=["opencode-generator", "test-runner"]
)

# Create a command
command = Command(
    id="cmd-001",
    type="generation",
    intent=CommandIntent(
        primary="generate_code",
        confidence=0.95
    ),
    raw_input="Create a React component for a todo list",
    parameters={
        "language": "typescript",
        "framework": "react"
    },
    options=CommandOptions(
        timeout=30000,
        priority="high"
    ),
    metadata=CommandMetadata(
        id="meta-001",
        version="1.0.0",
        timestamp=datetime.now().isoformat(),
        source="cli"
    ),
    timestamp=datetime.now().isoformat()
)

# Convert to TypeScript format
typescript_data = CaseConverter.from_python_to_typescript(command.dict())

# Validate data
validator = CrossLanguageValidator(command.__class__)
result = validator.validate(command.dict())
```

## Type Conversion

### Case Conversion

TypeScript uses camelCase while Python uses snake_case. The converters handle this automatically:

```typescript
// TypeScript
const data = {
  userId: '123',
  userName: 'John',
  createdAt: new Date()
};

// Convert to Python format
const pythonData = CaseConverter.fromTypeScriptToPython(data);
// Result: { user_id: '123', user_name: 'John', created_at: '2024-01-01T00:00:00.000Z' }
```

```python
# Python
data = {
    'user_id': '123',
    'user_name': 'John',
    'created_at': datetime.now()
}

# Convert to TypeScript format
typescript_data = CaseConverter.from_python_to_typescript(data)
# Result: { userId: '123', userName: 'John', createdAt: '2024-01-01T00:00:00.000Z' }
```

### Type Mapping

The system handles type differences between languages:

| TypeScript | Python | JSON Schema | Notes |
|------------|--------|-------------|-------|
| string | str | string | |
| number | float | number | |
| boolean | bool | boolean | |
| Date | datetime | string | ISO 8601 format |
| Buffer | bytes | string | Base64 encoded |
| Map | Dict | object | |
| Set | Set | array | |
| null | None | null | |
| undefined | None | null | |

## Validation

### Cross-Language Validation

```typescript
// TypeScript
import { createValidator, CommandSchema } from '@shared/types';

const validator = createValidator({
  zodSchema: CommandSchema,
  jsonSchema: commandJsonSchema
});

const result = validator.validate(data);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

```python
# Python
from shared.types.converters import CrossLanguageValidator
from shared.types import Command

validator = CrossLanguageValidator(Command)
result = validator.validate(data)

if not result['valid']:
    print(f"Validation errors: {result['errors']}")
```

## Protocol Communication

### Request/Response Pattern

```typescript
// TypeScript - Send request
const request: OpenCodeDGMRequest = {
  id: 'req-001',
  type: 'code_generation',
  payload: {
    prompt: 'Create a REST API endpoint',
    language: 'python',
    constraints: {
      maxTokens: 1000
    }
  },
  context: {
    sessionId: 'session-001',
    userId: 'user-001'
  }
};

// Convert and send
const pythonRequest = CaseConverter.fromTypeScriptToPython(request);
await sendToPython(pythonRequest);
```

```python
# Python - Receive and process
from shared.types import OpenCodeDGMRequest, CodeGenerationResult

# Receive request
request_data = receive_from_typescript()
request = OpenCodeDGMRequest.parse_obj(request_data)

# Process and create response
result = CodeGenerationResult(
    code="def hello_world():\n    return 'Hello, World!'",
    language="python",
    confidence=0.98,
    metrics=CodeMetrics(
        lines=2,
        complexity=1,
        tokens=15
    )
)

# Convert and send response
response_data = CaseConverter.from_python_to_typescript(result.dict())
send_to_typescript(response_data)
```

## Error Handling

### Type-Safe Error Handling

```typescript
// TypeScript
import { BaseError, ValidationError, isRecoverable } from '@shared/types';

try {
  // Some operation
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.fields);
  }
  
  if (isRecoverable(error)) {
    // Retry operation
  }
  
  // Convert for Python
  const pythonError = createErrorResponse(error);
}
```

```python
# Python
from shared.types.error import ValidationError, is_recoverable

try:
    # Some operation
    pass
except ValidationError as e:
    print(f"Validation failed: {e.fields}")
    
    if is_recoverable(e):
        # Retry operation
        pass
    
    # Convert for TypeScript
    typescript_error = create_error_response(e)
```

## Best Practices

1. **Always validate data at boundaries**: When receiving data from another language, validate it first
2. **Use type guards**: Check types before casting to ensure type safety
3. **Handle case conversion**: Always convert between camelCase and snake_case at language boundaries
4. **Serialize special types**: Dates, Buffers, etc. need special handling for cross-language compatibility
5. **Version your schemas**: Include version information in metadata for backward compatibility

## Adding New Types

To add a new type:

1. Define the TypeScript interface in the appropriate `.types.ts` file
2. Define the Python Pydantic model in the corresponding `.py` file
3. Create a JSON Schema if needed
4. Add converters if the type has special serialization needs
5. Update the documentation

Example:

```typescript
// TypeScript - mytype.types.ts
export interface MyNewType {
  id: string;
  name: string;
  data: any;
  createdAt: Date;
}
```

```python
# Python - mytype.py
from pydantic import BaseModel
from datetime import datetime

class MyNewType(BaseModel):
    id: str
    name: str
    data: Any
    created_at: datetime
```

## Testing

Always test cross-language compatibility:

```typescript
// TypeScript test
import { MyNewType } from '@shared/types';
import { CaseConverter } from '@shared/types/converters';

const data: MyNewType = {
  id: '123',
  name: 'Test',
  data: { foo: 'bar' },
  createdAt: new Date()
};

const pythonData = CaseConverter.fromTypeScriptToPython(data);
const roundTrip = CaseConverter.fromPythonToTypeScript(pythonData);

expect(roundTrip).toEqual(data);
```

```python
# Python test
from shared.types import MyNewType
from shared.types.converters import CaseConverter

data = MyNewType(
    id='123',
    name='Test',
    data={'foo': 'bar'},
    created_at=datetime.now()
)

typescript_data = CaseConverter.from_python_to_typescript(data.dict())
round_trip = CaseConverter.from_typescript_to_python(typescript_data)

assert round_trip == data.dict()
```