# Cross-Language Tool Protocol

A standardized protocol layer that enables seamless interoperability between TypeScript and Python tool implementations.

## Overview

The Tool Protocol Layer provides:
- **Unified Interface**: Call tools regardless of implementation language
- **Type Safety**: Automatic schema validation and conversion
- **Async Support**: Handles async/sync differences transparently
- **Error Handling**: Standardized error propagation across languages
- **Performance**: Optimized with caching and connection pooling

## Quick Start

### TypeScript

```typescript
import { ToolProtocol, ToolRegistry } from '@dgmstt/tool-protocol'

// Register a TypeScript tool
ToolRegistry.registerTypeScriptTool({
  id: 'my-tool',
  description: 'My TypeScript tool',
  parameters: z.object({
    message: z.string()
  }),
  execute: async (params, ctx) => ({
    output: `Processed: ${params.message}`,
    metadata: { title: 'Success' }
  })
})

// Call any tool (TypeScript or Python)
const result = await ToolProtocol.executeTool('bash', {
  command: 'echo "Hello from protocol!"'
})
```

### Python

```python
from protocol.python import ToolProtocol, ToolRegistry

# Register a Python tool
@tool_info
def my_tool_info():
    return {
        'name': 'my-tool',
        'description': 'My Python tool',
        'input_schema': {
            'type': 'object',
            'properties': {
                'message': {'type': 'string'}
            }
        }
    }

@tool_function
async def my_tool(message):
    return f"Processed: {message}"

# Register and use
ToolRegistry.register_python_tool(my_tool_module)

# Call any tool (Python or TypeScript)
result = await ToolProtocol.execute_tool('edit', {
    'filePath': '/tmp/test.txt',
    'oldString': 'foo',
    'newString': 'bar'
})
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   TypeScript    │     │     Python      │
│     Tools       │     │     Tools       │
└────────┬────────┘     └────────┬────────┘
         │                       │
    ┌────▼────────┐     ┌────────▼────┐
    │  TS Adapter │     │  PY Adapter │
    └────┬────────┘     └────────┬────┘
         │                       │
    ┌────▼────────────────────────▼────┐
    │        Protocol Layer            │
    │  • JSON-RPC Message Format       │
    │  • Schema Translation            │
    │  • Execution Bridge              │
    │  • Error Handling                │
    └──────────────────────────────────┘
```

## Features

### 1. Schema Translation

Automatic conversion between Zod (TypeScript) and JSON Schema (Python):

```typescript
// TypeScript: Zod schema
z.object({
  name: z.string().min(1),
  age: z.number().int().min(0).max(150)
})

// Automatically converted to JSON Schema for Python
{
  "type": "object",
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "age": { "type": "integer", "minimum": 0, "maximum": 150 }
  },
  "required": ["name", "age"]
}
```

### 2. Async/Sync Handling

All tools execute asynchronously, with automatic handling of sync Python functions:

```python
# Sync Python function
def sync_tool(param):
    return process(param)

# Automatically wrapped for async execution
result = await ToolProtocol.execute_tool('sync_tool', {'param': value})
```

### 3. Context Management

Rich context passed to all tools:

```typescript
interface ToolContext {
  sessionId: string      // Unique session identifier
  messageId: string      // Message correlation ID
  abort: AbortSignal     // For cancellation
  timeout: number        // Execution timeout
  metadata: Map          // Custom metadata
}
```

### 4. Error Handling

Standardized error codes and propagation:

- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Tool not found
- `-32602`: Invalid parameters
- `-32000`: Tool execution error
- `-32001`: Timeout error

## Migration Guide

### Migrating Python Tools

No changes required! Existing tools work as-is:

```python
# Existing DGM tool
from dgm.tools import bash

# Register with protocol
ToolRegistry.register_python_tool(bash)

# Now callable from TypeScript!
```

### Migrating TypeScript Tools

Simple registration for existing tools:

```typescript
import { EditTool } from './tools/edit'

// Register with protocol
ToolRegistry.registerTypeScriptTool({
  id: EditTool.id,
  description: EditTool.description,
  parameters: EditTool.parameters,
  execute: EditTool.execute
})

// Now callable from Python!
```

## Advanced Usage

### Custom Type Handlers

Register custom type converters:

```typescript
SchemaTranslator.registerCustomType('date', {
  toJsonSchema: (zodDate) => ({ type: 'string', format: 'date' }),
  fromJsonSchema: (schema) => z.string().datetime()
})
```

### Middleware

Add pre/post execution hooks:

```python
@ToolProtocol.middleware
async def log_execution(tool_id, params, execute):
    start = time.time()
    result = await execute()
    duration = time.time() - start
    logger.info(f"Tool {tool_id} took {duration}s")
    return result
```

### Performance Optimization

Enable caching for frequently used tools:

```typescript
ToolProtocol.enableCaching({
  maxSize: 100,
  ttl: 300, // 5 minutes
  tools: ['bash', 'edit'] // Tools to cache
})
```

## Testing

### Unit Tests

```bash
# TypeScript
cd protocol/typescript
npm test

# Python
cd protocol/python
pytest
```

### Integration Tests

```bash
# Run cross-language tests
python -m pytest protocol/tests/test_cross_language.py -v
```

## Performance

Benchmarks on typical operations:

| Operation | Time | Notes |
|-----------|------|-------|
| Tool Registration | <1ms | One-time cost |
| Schema Translation | ~5ms | Cached after first use |
| Cross-language Call | ~10ms | Includes serialization |
| Same-language Call | ~2ms | Direct execution |

## Troubleshooting

### Common Issues

1. **Bridge fails to start**
   - Check Node.js/Python paths
   - Verify permissions
   - Check port availability

2. **Schema validation errors**
   - Ensure schemas match exactly
   - Use schema simplification for debugging
   - Check required fields

3. **Timeout errors**
   - Increase timeout in context
   - Check for blocking operations
   - Verify async handling

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure cross-language compatibility

## License

MIT License - see LICENSE file for details