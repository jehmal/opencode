import { HandlerRegistry } from '../../src/handlers/handler-registry';
import { CommandDispatcher } from '../../src/handlers/command-dispatcher';
import { CommandRouter } from '../../src/router/command-router';
import { Command, CommandHandler, CommandResult } from '../../src/types/command.types';

describe('HandlerRegistry', () => {
  let registry: HandlerRegistry;

  beforeEach(() => {
    registry = new HandlerRegistry();
  });

  const createTestHandler = (name: string): CommandHandler => ({
    name,
    execute: async () => ({
      commandId: 'test',
      success: true,
      executionTime: 0,
      timestamp: new Date(),
    }),
  });

  test('should register and retrieve handlers', () => {
    const handler = createTestHandler('testHandler');
    registry.register(handler);

    expect(registry.has('testHandler')).toBe(true);
    expect(registry.get('testHandler')).toBe(handler);
  });

  test('should handle aliases', () => {
    const handler = createTestHandler('originalHandler');
    registry.register(handler);
    registry.alias('aliasHandler', 'originalHandler');

    expect(registry.get('aliasHandler')).toBe(handler);
  });

  test('should enable and disable handlers', () => {
    const handler = createTestHandler('testHandler');
    registry.register(handler);

    expect(registry.has('testHandler')).toBe(true);
    
    registry.disable('testHandler');
    expect(registry.has('testHandler')).toBe(false);
    expect(registry.get('testHandler')).toBeUndefined();

    registry.enable('testHandler');
    expect(registry.has('testHandler')).toBe(true);
  });

  test('should search handlers by criteria', () => {
    registry.register(createTestHandler('fileHandler'), {
      tags: ['file', 'io'],
      capabilities: ['read', 'write'],
    });
    registry.register(createTestHandler('networkHandler'), {
      tags: ['network', 'http'],
      capabilities: ['fetch', 'request'],
    });

    const fileHandlers = registry.search({ tags: ['file'] });
    expect(fileHandlers).toHaveLength(1);
    expect(fileHandlers[0].name).toBe('fileHandler');

    const readCapableHandlers = registry.search({ capabilities: ['read'] });
    expect(readCapableHandlers).toHaveLength(1);
  });

  test('should validate dependencies', () => {
    registry.register(createTestHandler('baseHandler'));
    registry.register(createTestHandler('dependentHandler'), {
      dependencies: ['baseHandler', 'missingHandler'],
    });

    const validation = registry.validateDependencies('dependentHandler');
    expect(validation.valid).toBe(false);
    expect(validation.missing).toContain('missingHandler');
  });

  test('should get transitive dependencies', () => {
    registry.register(createTestHandler('handler1'));
    registry.register(createTestHandler('handler2'), {
      dependencies: ['handler1'],
    });
    registry.register(createTestHandler('handler3'), {
      dependencies: ['handler2'],
    });

    const deps = registry.getDependencies('handler3');
    expect(deps).toContain('handler1');
    expect(deps).toContain('handler2');
  });
});

describe('CommandDispatcher', () => {
  let dispatcher: CommandDispatcher;
  let registry: HandlerRegistry;
  let router: CommandRouter;

  beforeEach(() => {
    registry = new HandlerRegistry();
    router = new CommandRouter();
    dispatcher = new CommandDispatcher(registry, router);
  });

  const createTestCommand = (intent: string, options = {}): Command => ({
    id: 'test-id',
    intent: { primary: intent, confidence: 1 },
    rawInput: 'test command',
    parameters: {},
    options: { ...options },
    metadata: { source: 'cli' },
    timestamp: new Date(),
  });

  test('should dispatch commands to handlers', async () => {
    const handler: CommandHandler = {
      name: 'testHandler',
      execute: async (cmd) => ({
        commandId: cmd.id,
        success: true,
        data: { message: 'Test successful' },
        executionTime: 100,
        timestamp: new Date(),
      }),
    };

    registry.register(handler);
    router.route('test.command', 'testHandler');

    const command = createTestCommand('test.command');
    const result = await dispatcher.dispatch(command);

    expect(result.success).toBe(true);
    expect(result.data.message).toBe('Test successful');
  });

  test('should handle missing routes', async () => {
    const command = createTestCommand('unknown.command');
    const result = await dispatcher.dispatch(command);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NO_ROUTE');
  });

  test('should handle missing handlers', async () => {
    router.route('test.command', 'missingHandler');

    const command = createTestCommand('test.command');
    const result = await dispatcher.dispatch(command);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NO_HANDLER');
  });

  test('should validate parameters', async () => {
    const handler: CommandHandler = {
      name: 'validatingHandler',
      validate: async (params) => params.required !== undefined,
      execute: async (cmd) => ({
        commandId: cmd.id,
        success: true,
        executionTime: 0,
        timestamp: new Date(),
      }),
    };

    registry.register(handler);
    router.route('test.validate', 'validatingHandler');

    const invalidCommand = createTestCommand('test.validate');
    const invalidResult = await dispatcher.dispatch(invalidCommand);

    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error?.code).toBe('VALIDATION_ERROR');
  });

  test('should handle command timeout', async () => {
    const slowHandler: CommandHandler = {
      name: 'slowHandler',
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
          commandId: 'test',
          success: true,
          executionTime: 1000,
          timestamp: new Date(),
        };
      },
    };

    registry.register(slowHandler);
    router.route('test.slow', 'slowHandler');

    const command = createTestCommand('test.slow', { timeout: 100 });
    const result = await dispatcher.dispatch(command);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TIMEOUT');
  });

  test('should emit dispatch events', async () => {
    const events: any[] = [];

    dispatcher.on('command.start', (e) => events.push({ type: 'start', ...e }));
    dispatcher.on('command.complete', (e) => events.push({ type: 'complete', ...e }));
    dispatcher.on('handler.start', (e) => events.push({ type: 'handler.start', ...e }));
    dispatcher.on('handler.complete', (e) => events.push({ type: 'handler.complete', ...e }));

    const handler: CommandHandler = {
      name: 'eventHandler',
      execute: async (cmd) => ({
        commandId: cmd.id,
        success: true,
        executionTime: 0,
        timestamp: new Date(),
      }),
    };

    registry.register(handler);
    router.route('test.events', 'eventHandler');

    await dispatcher.dispatch(createTestCommand('test.events'));

    expect(events.some(e => e.type === 'start')).toBe(true);
    expect(events.some(e => e.type === 'complete')).toBe(true);
    expect(events.some(e => e.type === 'handler.start')).toBe(true);
    expect(events.some(e => e.type === 'handler.complete')).toBe(true);
  });

  test('should track execution metrics', async () => {
    const handler: CommandHandler = {
      name: 'metricsHandler',
      execute: async (cmd) => ({
        commandId: cmd.id,
        success: true,
        executionTime: 50,
        timestamp: new Date(),
      }),
    };

    registry.register(handler);
    router.route('test.metrics', 'metricsHandler');

    // Execute multiple commands
    await dispatcher.dispatch(createTestCommand('test.metrics'));
    await dispatcher.dispatch(createTestCommand('test.metrics'));

    const metrics = dispatcher.getMetrics();
    expect(metrics.totalCommands).toBe(2);
    expect(metrics.successfulCommands).toBe(2);
    expect(metrics.handlerMetrics.get('metricsHandler')?.invocations).toBe(2);
  });

  test('should handle concurrent command limit', async () => {
    const limitedDispatcher = new CommandDispatcher(registry, router, {
      maxConcurrent: 1,
    });

    const slowHandler: CommandHandler = {
      name: 'concurrentHandler',
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          commandId: 'test',
          success: true,
          executionTime: 100,
          timestamp: new Date(),
        };
      },
    };

    registry.register(slowHandler);
    router.route('test.concurrent', 'concurrentHandler');

    const command1 = createTestCommand('test.concurrent');
    const command2 = createTestCommand('test.concurrent');

    // Start first command
    const promise1 = limitedDispatcher.dispatch(command1);
    
    // Try to start second command immediately
    const result2 = await limitedDispatcher.dispatch(command2);

    expect(result2.success).toBe(false);
    expect(result2.error?.code).toBe('RATE_LIMIT');

    await promise1; // Clean up
  });
});