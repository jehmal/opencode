import { CommandRoutingSystem, createCommandSystem } from '../../src/index';
import { CommandHandler } from '../../src/types/command.types';

describe('CommandRoutingSystem Integration', () => {
  let system: CommandRoutingSystem;

  beforeEach(() => {
    system = createCommandSystem({
      parser: {
        defaultTimeout: 5000,
        confidenceThreshold: 0.3,
      },
      router: {
        fallbackHandler: 'helpHandler',
      },
      dispatcher: {
        maxConcurrent: 5,
        enableMetrics: true,
      },
    });
  });

  // Sample handlers
  const fileCreateHandler: CommandHandler = {
    name: 'fileCreateHandler',
    description: 'Creates a new file',
    validate: async (params) => {
      return params.filename !== undefined;
    },
    execute: async (command, context) => {
      context.logger.info(`Creating file: ${command.parameters.filename}`);
      return {
        commandId: command.id,
        success: true,
        data: {
          filename: command.parameters.filename,
          created: true,
        },
        executionTime: 50,
        timestamp: new Date(),
      };
    },
  };

  const helpHandler: CommandHandler = {
    name: 'helpHandler',
    description: 'Provides help information',
    execute: async (command) => ({
      commandId: command.id,
      success: true,
      data: {
        message: 'Available commands: file.create, file.read, code.generate, etc.',
        intent: command.intent.primary,
      },
      executionTime: 10,
      timestamp: new Date(),
    }),
  };

  const asyncTaskHandler: CommandHandler = {
    name: 'asyncTaskHandler',
    description: 'Handles long-running tasks',
    execute: async (command, context) => {
      // Simulate long-running task
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        commandId: command.id,
        success: true,
        data: { processed: true },
        executionTime: 100,
        timestamp: new Date(),
      };
    },
  };

  beforeEach(() => {
    // Register handlers
    system.registerHandler(fileCreateHandler);
    system.registerHandler(helpHandler);
    system.registerHandler(asyncTaskHandler);

    // Register routes
    system.registerRoute('file.create', 'fileCreateHandler');
    system.registerRoute('help.*', 'helpHandler');
    system.registerRoute('async.task', 'asyncTaskHandler');
  });

  test('should execute file creation command', async () => {
    const result = await system.execute('create file test.txt');

    expect(result.success).toBe(true);
    expect(result.data.filename).toBe('test.txt');
    expect(result.data.created).toBe(true);
  });

  test('should handle validation errors', async () => {
    const result = await system.execute('create file'); // Missing filename

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  test('should fallback to help handler for unknown commands', async () => {
    const result = await system.execute('unknown command here');

    expect(result.success).toBe(true);
    expect(result.data.message).toContain('Available commands');
  });

  test('should handle async commands', async () => {
    const result = await system.execute('execute async task --async');

    expect(result.success).toBe(true);
    expect(result.data.taskId).toBeDefined();
    expect(result.data.message).toContain('asynchronously');

    // Wait for task completion
    const taskResult = await system.waitForTask(result.data.taskId, 1000);
    expect(taskResult.success).toBe(true);
    expect(taskResult.data.processed).toBe(true);
  });

  test('should track task status', async () => {
    const result = await system.execute('execute async task --async');
    const taskId = result.data.taskId;

    // Check initial status
    let status = system.getTaskStatus(taskId);
    expect(status?.state).toMatch(/pending|running/);

    // Wait for completion
    await system.waitForTask(taskId);

    // Check final status
    status = system.getTaskStatus(taskId);
    expect(status?.state).toBe('completed');
  });

  test('should handle middleware', async () => {
    const executionLog: string[] = [];

    // Register logging middleware
    system.registerMiddleware({
      name: 'logging',
      execute: async (command, next) => {
        executionLog.push(`Before: ${command.intent.primary}`);
        const result = await next();
        executionLog.push(`After: ${command.intent.primary}`);
        return result;
      },
    });

    // Update route to use middleware
    system.registerRoute('file.create', 'fileCreateHandler', {
      middleware: ['logging'],
    });

    await system.execute('create file logged.txt');

    expect(executionLog).toEqual([
      'Before: file.create',
      'After: file.create',
    ]);
  });

  test('should collect system metrics', async () => {
    // Execute several commands
    await system.execute('create file test1.txt');
    await system.execute('create file test2.txt');
    await system.execute('unknown command'); // This will use fallback
    await system.execute('create file'); // This will fail validation

    const metrics = system.getMetrics();

    expect(metrics.execution.totalCommands).toBe(4);
    expect(metrics.execution.successfulCommands).toBe(3);
    expect(metrics.execution.failedCommands).toBe(1);
    expect(metrics.errors.total).toBeGreaterThan(0);
  });

  test('should handle command cancellation', async () => {
    const result = await system.execute('execute async task --async');
    const taskId = result.data.taskId;

    // Cancel the task
    const cancelled = system.cancelTask(taskId);
    expect(cancelled).toBe(true);

    // Try to wait for it
    await expect(system.waitForTask(taskId)).rejects.toThrow('cancelled');
  });

  test('should parse complex commands with multiple parameters', async () => {
    const complexHandler: CommandHandler = {
      name: 'complexHandler',
      execute: async (command) => ({
        commandId: command.id,
        success: true,
        data: command.parameters,
        executionTime: 0,
        timestamp: new Date(),
      }),
    };

    system.registerHandler(complexHandler);
    system.registerRoute('complex.command', 'complexHandler');

    const result = await system.execute(
      'execute complex command --timeout=5000 --priority=high -v --tags #important #urgent'
    );

    expect(result.success).toBe(true);
    expect(system.commandParser.parse(
      'execute complex command --timeout=5000 --priority=high -v --tags #important #urgent'
    ).options.timeout).toBe(5000);
    expect(system.commandParser.parse(
      'execute complex command --timeout=5000 --priority=high -v --tags #important #urgent'
    ).options.priority).toBe('high');
  });

  test('should handle error recovery', async () => {
    const unreliableHandler: CommandHandler = {
      name: 'unreliableHandler',
      execute: async (command) => {
        throw new Error('Network timeout');
      },
    };

    system.registerHandler(unreliableHandler);
    system.registerRoute('unreliable.command', 'unreliableHandler');

    const result = await system.execute('execute unreliable command');

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Network timeout');
    
    // Check that error was logged and categorized
    const errorStats = system.getMetrics().errors;
    expect(errorStats.total).toBeGreaterThan(0);
  });
});