# Cross-Language Tool Protocol Specification

## Overview

The Tool Protocol Layer provides a standardized interface for TypeScript and Python tools to be called interchangeably, maintaining type safety and handling async operations across language boundaries.

## Protocol Architecture

### Core Components

1. **Protocol Message Format** - JSON-RPC 2.0 based communication
2. **Schema Translation Layer** - Converts between Zod and JSON Schema
3. **Execution Bridge** - Handles async/sync differences
4. **Type Safety Layer** - Ensures parameter and return type validation
5. **Error Handling** - Standardized error propagation

### Message Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "tool.execute",
  "params": {
    "tool": "tool-name",
    "language": "typescript" | "python",
    "parameters": {},
    "context": {
      "sessionId": "session-id",
      "messageId": "message-id",
      "timeout": 120000
    }
  }
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    "output": "string output",
    "metadata": {
      "title": "Operation Title",
      "additionalData": {}
    },
    "diagnostics": []
  }
}
```

### Error Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "error": {
    "code": -32000,
    "message": "Tool execution failed",
    "data": {
      "tool": "tool-name",
      "language": "python",
      "details": "Specific error details"
    }
  }
}
```

## Schema Translation

### JSON Schema to Zod

```typescript
interface SchemaTranslator {
  jsonSchemaToZod(schema: JSONSchema): z.ZodSchema
  zodToJsonSchema(schema: z.ZodSchema): JSONSchema
}
```

### Supported Types

| JSON Schema | Zod | Python Type | TypeScript Type |
|-------------|-----|-------------|-----------------|
| string | z.string() | str | string |
| number | z.number() | float | number |
| integer | z.number().int() | int | number |
| boolean | z.boolean() | bool | boolean |
| array | z.array() | List | Array |
| object | z.object() | Dict | Object |
| null | z.null() | None | null |
| enum | z.enum() | Literal | enum/union |

## Execution Bridge

### Async Handling

All tools are executed asynchronously, regardless of source language:

- TypeScript: Native async/await
- Python: asyncio event loop integration

### Context Management

```typescript
interface ToolContext {
  sessionId: string
  messageId: string
  abort: AbortSignal
  timeout: number
  metadata: Map<string, any>
}
```

## Tool Registry

### Registration Format

```typescript
interface ToolRegistration {
  id: string
  description: string
  language: 'typescript' | 'python'
  schema: JSONSchema
  handler: ToolHandler
}
```

## Implementation Requirements

### TypeScript Adapter

1. Must convert Tool.Info to ToolRegistration
2. Handle Zod to JSON Schema conversion
3. Wrap execution in protocol messages
4. Handle AbortSignal propagation

### Python Adapter

1. Must convert tool_info() to ToolRegistration
2. Wrap sync functions in async handlers
3. Convert string output to structured format
4. Handle timeout and cancellation

## Security Considerations

1. **Input Validation**: All inputs validated against schema
2. **Sandboxing**: Tools execute in isolated environments
3. **Resource Limits**: Timeouts and memory limits enforced
4. **Permission Model**: Tools require explicit permissions

## Performance Optimizations

1. **Schema Caching**: Converted schemas cached
2. **Connection Pooling**: Reuse language runtime connections
3. **Lazy Loading**: Tools loaded on-demand
4. **Batch Execution**: Multiple tool calls batched

## Error Handling

### Error Codes

- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Tool not found
- `-32602`: Invalid parameters
- `-32603`: Internal error
- `-32000`: Tool execution error
- `-32001`: Timeout error
- `-32002`: Permission denied

## Versioning

Protocol version included in all messages:

```json
{
  "jsonrpc": "2.0",
  "protocol": "1.0.0",
  ...
}
```

## Extension Points

1. **Custom Type Handlers**: Register custom type converters
2. **Middleware**: Pre/post execution hooks
3. **Metrics**: Performance and usage tracking
4. **Caching**: Result caching strategies

## Migration Guide

### For TypeScript Tools

1. No changes required to tool implementation
2. Tools automatically discoverable
3. Protocol adapter handles conversion

### For Python Tools

1. Keep existing tool_info() and tool_function()
2. Add async variant if beneficial
3. Protocol adapter handles wrapping