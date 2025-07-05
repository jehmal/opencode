# OpenCode-DGM Command Routing System

A robust, extensible TypeScript command routing system designed for the OpenCode-DGM integration. This system provides intelligent command parsing, flexible routing, async task management, and comprehensive error handling.

## Features

- **Intent Recognition**: Automatically identifies user intent from natural language commands
- **Parameter Extraction**: Intelligently extracts parameters, flags, and options from commands
- **Flexible Routing**: Pattern-based routing with support for wildcards and regex
- **Handler Management**: Registry system for command handlers with dependency validation
- **Async Support**: Built-in support for long-running tasks with progress tracking
- **Middleware System**: Extensible middleware for cross-cutting concerns
- **Error Recovery**: Comprehensive error handling with recovery strategies
- **Event-Driven**: Full event system for monitoring command execution
- **Metrics & Monitoring**: Built-in metrics collection for performance tracking

## Installation

```bash
npm install @opencode-dgm/command-router
```

## Quick Start

```typescript
import { createCommandSystem } from '@opencode-dgm/command-router';

// Create the command system
const system = createCommandSystem();

// Register a handler
system.registerHandler({
  name: 'fileCreateHandler',
  execute: async (command, context) => {
    const { filename, content } = command.parameters;
    context.logger.info(`Creating file: ${filename}`);
    
    // Your file creation logic here
    
    return {
      commandId: command.id,
      success: true,
      data: { filename, created: true },
      executionTime: Date.now() - command.timestamp.getTime(),
      timestamp: new Date(),
    };
  },
});

// Register a route
system.registerRoute('file.create', 'fileCreateHandler');

// Execute a command
const result = await system.execute('create file test.txt with content "Hello World"');
console.log(result);
```

## Core Concepts

### Commands

Commands are structured representations of user input:

```typescript
interface Command {
  id: string;
  intent: CommandIntent;
  rawInput: string;
  parameters: Record<string, any>;
  options: CommandOptions;
  metadata: CommandMetadata;
  timestamp: Date;
}
```

### Intent Recognition

The system automatically recognizes intent from natural language:

```typescript
// These all map to 'file.create' intent
"create file test.txt"
"new file test.txt"
"touch test.txt"
```

### Routing

Routes map intents to handlers using patterns:

```typescript
// Exact match
system.registerRoute('file.create', 'fileHandler');

// Wildcard match
system.registerRoute('file.*', 'fileHandler');

// Regex match
system.registerRoute(/^file\.(create|update)$/, 'fileWriteHandler');

// Parameterized routes
system.registerRoute('api.:resource.:action', 'apiHandler');
```

### Handlers

Handlers process commands and return results:

```typescript
const handler: CommandHandler = {
  name: 'myHandler',
  description: 'Handles specific commands',
  
  // Optional validation
  validate: async (params) => {
    return params.requiredField !== undefined;
  },
  
  // Main execution
  execute: async (command, context) => {
    // Access services
    const db = context.services.get('database');
    
    // Log information
    context.logger.info('Processing command');
    
    // Emit events
    context.eventBus.emit('custom.event', { data: 'value' });
    
    // Check for cancellation
    if (context.abortSignal?.aborted) {
      throw new Error('Command cancelled');
    }
    
    return {
      commandId: command.id,
      success: true,
      data: { /* your data */ },
      executionTime: 100,
      timestamp: new Date(),
    };
  },
  
  // Optional rollback
  rollback: async (command, context) => {
    // Cleanup logic
  },
};
```

## Advanced Usage

### Async Commands

Handle long-running tasks with progress updates:

```typescript
// Execute async command
const result = await system.execute('process large dataset --async');
const taskId = result.data.taskId;

// Monitor progress
system.asyncResponseManager.on('task.progress', ({ task, progress }) => {
  console.log(`Task ${task.id}: ${progress}% complete`);
});

// Wait for completion
const finalResult = await system.waitForTask(taskId);
```

### Middleware

Add cross-cutting concerns with middleware:

```typescript
system.registerMiddleware({
  name: 'authentication',
  execute: async (command, next) => {
    // Check authentication
    if (!isAuthenticated(command)) {
      return {
        commandId: command.id,
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          recoverable: false,
        },
        executionTime: 0,
        timestamp: new Date(),
      };
    }
    
    // Continue to next middleware/handler
    return next();
  },
});

// Apply middleware to routes
system.registerRoute('protected.*', 'protectedHandler', {
  middleware: ['authentication'],
});
```

### Error Handling

The system includes comprehensive error handling:

```typescript
// Register custom recovery strategies
system.errorHandler.registerStrategy({
  name: 'retry-on-timeout',
  applicable: (error) => error.category === 'timeout',
  execute: async (error) => {
    // Implement retry logic
    return true; // Return true if recovery possible
  },
});

// Access error statistics
const errorStats = system.getMetrics().errors;
console.log(`Total errors: ${errorStats.total}`);
console.log(`By severity:`, errorStats.bySeverity);
```

### Custom Intent Patterns

Register custom intent patterns:

```typescript
system.commandParser.registerIntent('deploy', 
  [/^deploy\s+(.+)\s+to\s+(.+)$/i],
  ['deploy', 'deployment'],
  15 // priority
);

system.commandParser.registerParameterPatterns('deploy', [
  {
    name: 'application',
    pattern: /deploy\s+([^\s]+)/i,
    transform: (value) => value.toLowerCase(),
  },
  {
    name: 'environment',
    pattern: /to\s+([^\s]+)$/i,
    transform: (value) => value.toLowerCase(),
  },
]);
```

### Event Monitoring

Monitor system events:

```typescript
// Command events
system.commandDispatcher.on('command.start', ({ command }) => {
  console.log(`Command started: ${command.id}`);
});

system.commandDispatcher.on('command.complete', ({ command, result }) => {
  console.log(`Command completed: ${command.id}, success: ${result.success}`);
});

// Router events
system.commandRouter.on('route.notfound', ({ command }) => {
  console.log(`No route found for: ${command.intent.primary}`);
});

// Task events
system.asyncResponseManager.on('task.progress', ({ task, progress }) => {
  console.log(`Task ${task.id}: ${progress}%`);
});
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Parser    │────▶│    Router    │────▶│ Dispatcher  │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │                     │
       ▼                    ▼                     ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Intent    │     │Route Matcher │     │  Registry   │
│ Recognizer  │     └──────────────┘     └─────────────┘
└─────────────┘                                   │
       │                                          ▼
       ▼                                  ┌─────────────┐
┌─────────────┐                          │  Handlers   │
│ Parameter   │                          └─────────────┘
│ Extractor   │
└─────────────┘
```

## API Reference

### CommandRoutingSystem

Main facade class for the command routing system.

#### Methods

- `execute(input: string, metadata?: Partial<CommandMetadata>): Promise<CommandResult>`
- `registerHandler(handler: CommandHandler, metadata?: Partial<HandlerMetadata>): this`
- `registerRoute(pattern: string | RegExp, handler: string, options?: Partial<Route>): this`
- `registerMiddleware(middleware: Middleware): this`
- `getTaskStatus(taskId: string): AsyncTask | undefined`
- `cancelTask(taskId: string): boolean`
- `waitForTask(taskId: string, timeoutMs?: number): Promise<CommandResult>`
- `getMetrics(): SystemMetrics`

### CommandParser

Parses user input into structured commands.

#### Methods

- `parse(input: string, metadata?: Partial<CommandMetadata>): Command`
- `parseBatch(inputs: string[], metadata?: Partial<CommandMetadata>): Command[]`
- `tryParse(input: string, metadata?: Partial<CommandMetadata>): { command?: Command; error?: Error }`
- `registerIntent(intent: string, patterns: RegExp[], keywords: string[], priority?: number): void`

### CommandRouter

Routes commands to appropriate handlers.

#### Methods

- `route(pattern: string | RegExp, handler: string, options?: Partial<Route>): this`
- `use(middleware: Middleware): this`
- `resolve(command: Command): Promise<RouteMatch | null>`
- `createSubRouter(prefix: string): SubRouter`

### HandlerRegistry

Manages command handlers.

#### Methods

- `register(handler: CommandHandler, metadata?: Partial<HandlerMetadata>): void`
- `get(name: string): CommandHandler | undefined`
- `search(criteria: SearchCriteria): HandlerMetadata[]`
- `validateDependencies(name: string): ValidationResult`

## Testing

The system includes comprehensive unit and integration tests:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Performance Considerations

- Handler registry uses Map for O(1) lookups
- Route matching is optimized with compiled regex patterns
- Async tasks are automatically cleaned up after completion
- Metrics collection can be disabled for performance
- Event emitters use efficient EventEmitter3 implementation

## Best Practices

1. **Intent Design**: Keep intents hierarchical (category.action)
2. **Handler Granularity**: One handler per specific action
3. **Error Handling**: Always provide recoverable flag in errors
4. **Async Operations**: Use async commands for operations > 1s
5. **Middleware Order**: Authentication → Validation → Logging
6. **Parameter Validation**: Validate in handler, not parser
7. **Event Usage**: Use events for monitoring, not control flow

## License

MIT