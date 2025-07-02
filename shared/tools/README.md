# Shared Tools - Cross-Language Tool Integration

This directory contains the unified tool system that enables seamless integration between TypeScript and Python tools in the DGMSTT project.

## Overview

The shared tools system provides:

1. **Tool Registry**: Unified registry for discovering and managing tools across languages
2. **Language Adapters**: Automatic wrappers for calling tools across language boundaries
3. **Type Conversion**: Automatic type conversion between TypeScript and Python
4. **Error Handling**: Consistent error handling across languages
5. **Protocol Bridge**: JSON-RPC 2.0 based communication between language runtimes

## Architecture

```
shared/tools/
├── typescript-adapter.ts   # TypeScript adapter for calling Python tools
├── python_adapter.py      # Python adapter for calling TypeScript tools
├── registry.ts/py         # Unified tool registry
├── type-converter.ts/py   # Type conversion utilities
├── error-handler.ts/py    # Error handling middleware
└── index.ts/__init__.py   # Module exports
```

## Usage

### TypeScript - Calling Python Tools

```typescript
import { loadPythonModule, callPythonTool } from '@dgmstt/shared/tools';

// Load Python tools from a module
await loadPythonModule('/path/to/python/tools.py');

// Call a Python tool
const result = await callPythonTool('python_tool_name', {
  param1: 'value1',
  param2: 123
});
```

### Python - Calling TypeScript Tools

```python
from shared.tools import load_typescript_module, call_typescript_tool

# Load TypeScript tools from a module
await load_typescript_module('/path/to/typescript/tools.ts')

# Call a TypeScript tool
result = await call_typescript_tool('typescript_tool_name', {
    'param1': 'value1',
    'param2': 123
})
```

### Tool Registry

```typescript
// TypeScript
import { toolRegistry } from '@dgmstt/shared/tools';

// List all available tools
const tools = await toolRegistry.list();

// Search for tools
const fileTools = await toolRegistry.search('file');

// Get a specific tool
const bashTool = await toolRegistry.get('bash');
```

```python
# Python
from shared.tools import tool_registry

# List all available tools
tools = await tool_registry.list()

# Search for tools
file_tools = await tool_registry.search('file')

# Get a specific tool
bash_tool = await tool_registry.get('bash')
```

## Type Conversion

The system automatically handles type conversion between languages:

### TypeScript to Python
- `null/undefined` → `None`
- `Date` → `datetime`
- `Set` → `set`
- `Map` → `dict`
- `Buffer` → `bytes`

### Python to TypeScript
- `None` → `null`
- `datetime` → `Date`
- `set` → `Set`
- `bytes` → `Buffer`
- `Decimal` → `number`

## Error Handling

The error handling middleware provides consistent error handling across languages:

```typescript
// TypeScript
import { errorHandler } from '@dgmstt/shared/tools';

try {
  const result = await callPythonTool('tool_name', params);
} catch (error) {
  const toolError = errorHandler.handleError(error, context);
  if (toolError.retryable) {
    // Retry logic
  }
}
```

```python
# Python
from shared.tools import error_handler

try:
    result = await call_typescript_tool('tool_name', params)
except Exception as error:
    tool_error = error_handler.handle_error(error, context)
    if tool_error.retryable:
        # Retry logic
```

## Creating Cross-Language Tools

### TypeScript Tool (callable from Python)

```typescript
import { Tool } from '@opencode/tool';
import { z } from 'zod';

export const MyTool = Tool.define({
  id: 'my-tool',
  description: 'My cross-language tool',
  parameters: z.object({
    input: z.string(),
    count: z.number()
  }),
  async execute(params, ctx) {
    // Tool implementation
    return {
      output: `Processed ${params.input} ${params.count} times`,
      metadata: { processedAt: new Date() }
    };
  }
});
```

### Python Tool (callable from TypeScript)

```python
def tool_info():
    return {
        "name": "my_tool",
        "description": "My cross-language tool",
        "input_schema": {
            "type": "object",
            "properties": {
                "input": {"type": "string"},
                "count": {"type": "integer"}
            },
            "required": ["input", "count"]
        }
    }

async def tool_function(input: str, count: int):
    # Tool implementation
    return f"Processed {input} {count} times"
```

## Protocol Details

The system uses JSON-RPC 2.0 for cross-language communication:

### Request Format
```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "tool.execute",
  "params": {
    "tool": "tool-name",
    "language": "python",
    "parameters": {},
    "context": {}
  }
}
```

### Response Format
```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "result": {
    "output": "...",
    "metadata": {}
  }
}
```

## Performance Considerations

1. **Lazy Loading**: Tools are loaded on-demand
2. **Schema Caching**: Converted schemas are cached
3. **Connection Pooling**: Language runtime connections are reused
4. **Batch Execution**: Multiple tool calls can be batched

## Security

1. **Input Validation**: All inputs are validated against schemas
2. **Sandboxing**: Tools execute in isolated environments
3. **Resource Limits**: Timeouts and memory limits are enforced
4. **Permission Model**: Tools require explicit permissions

## Debugging

Enable debug logging:

```typescript
// TypeScript
process.env.DGMSTT_DEBUG = 'tools:*';
```

```python
# Python
import os
os.environ['DGMSTT_DEBUG'] = 'tools:*'
```

## Contributing

When adding new tools:

1. Ensure tools have proper schema definitions
2. Include comprehensive error handling
3. Add type hints (Python) or type definitions (TypeScript)
4. Write tests for cross-language functionality
5. Document tool parameters and return values