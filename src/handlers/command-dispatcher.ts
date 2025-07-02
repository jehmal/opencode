import { EventEmitter } from 'eventemitter3';
import { 
  Command, 
  CommandResult, 
  CommandError, 
  HandlerContext,
  Logger,
  EventBus 
} from '../types/command.types';
import { HandlerRegistry } from './handler-registry';
import { CommandRouter } from '../router/command-router';

/**
 * Dispatcher configuration
 */
export interface DispatcherConfig {
  maxConcurrent?: number;
  defaultTimeout?: number;
  logger?: Logger;
  enableMetrics?: boolean;
}

/**
 * Dispatch event types
 */
export interface DispatchEvents {
  'command.start': { command: Command };
  'command.complete': { command: Command; result: CommandResult };
  'command.error': { command: Command; error: CommandError };
  'handler.start': { command: Command; handler: string };
  'handler.complete': { command: Command; handler: string; result: CommandResult };
  'handler.error': { command: Command; handler: string; error: Error };
}

/**
 * Execution metrics
 */
export interface ExecutionMetrics {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageExecutionTime: number;
  handlerMetrics: Map<string, {
    invocations: number;
    successes: number;
    failures: number;
    averageTime: number;
  }>;
}

/**
 * Command dispatcher for executing commands through handlers
 */
export class CommandDispatcher extends EventEmitter<DispatchEvents> {
  private registry: HandlerRegistry;
  private router: CommandRouter;
  private config: Required<DispatcherConfig>;
  private services: Map<string, any> = new Map();
  private executingCommands: Map<string, AbortController> = new Map();
  private metrics: ExecutionMetrics = {
    totalCommands: 0,
    successfulCommands: 0,
    failedCommands: 0,
    averageExecutionTime: 0,
    handlerMetrics: new Map(),
  };

  constructor(
    registry: HandlerRegistry,
    router: CommandRouter,
    config: DispatcherConfig = {}
  ) {
    super();
    this.registry = registry;
    this.router = router;
    this.config = {
      maxConcurrent: config.maxConcurrent || 10,
      defaultTimeout: config.defaultTimeout || 30000,
      logger: config.logger || this.createDefaultLogger(),
      enableMetrics: config.enableMetrics ?? true,
    };
  }

  /**
   * Dispatch a command for execution
   */
  async dispatch(command: Command): Promise<CommandResult> {
    const startTime = Date.now();

    // Check concurrent execution limit
    if (this.executingCommands.size >= this.config.maxConcurrent) {
      return this.createErrorResult(command, {
        code: 'RATE_LIMIT',
        message: 'Maximum concurrent commands reached',
        recoverable: true,
      });
    }

    // Create abort controller for cancellation
    const abortController = new AbortController();
    this.executingCommands.set(command.id, abortController);

    try {
      // Emit command start event
      this.emit('command.start', { command });

      // Resolve route
      const routeMatch = await this.router.resolve(command);
      if (!routeMatch) {
        return this.createErrorResult(command, {
          code: 'NO_ROUTE',
          message: `No route found for intent: ${command.intent.primary}`,
          recoverable: false,
        });
      }

      // Get handler
      const handler = this.registry.get(routeMatch.route.handler);
      if (!handler) {
        return this.createErrorResult(command, {
          code: 'NO_HANDLER',
          message: `Handler not found: ${routeMatch.route.handler}`,
          recoverable: false,
        });
      }

      // Validate handler dependencies
      const depValidation = this.registry.validateDependencies(handler.name);
      if (!depValidation.valid) {
        return this.createErrorResult(command, {
          code: 'MISSING_DEPENDENCIES',
          message: `Missing handler dependencies: ${depValidation.missing.join(', ')}`,
          recoverable: false,
        });
      }

      // Create handler context
      const context = this.createHandlerContext(abortController.signal);

      // Emit handler start event
      this.emit('handler.start', { command, handler: handler.name });

      // Execute through middleware if any
      let result: CommandResult;
      if (routeMatch.route.middleware && routeMatch.route.middleware.length > 0) {
        result = await this.router.executeMiddleware(
          command,
          routeMatch.route.middleware,
          () => this.executeHandler(handler, command, context)
        );
      } else {
        result = await this.executeHandler(handler, command, context);
      }

      // Update metrics
      if (this.config.enableMetrics) {
        this.updateMetrics(handler.name, result.success, Date.now() - startTime);
      }

      // Emit completion events
      this.emit('handler.complete', { command, handler: handler.name, result });
      this.emit('command.complete', { command, result });

      return result;

    } catch (error) {
      const errorResult = this.createErrorResult(command, {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
        stack: error instanceof Error ? error.stack : undefined,
        recoverable: false,
      });

      // Emit error events
      this.emit('command.error', { command, error: errorResult.error! });

      return errorResult;

    } finally {
      // Clean up
      this.executingCommands.delete(command.id);
    }
  }

  /**
   * Execute handler with timeout and validation
   */
  private async executeHandler(
    handler: any,
    command: Command,
    context: HandlerContext
  ): Promise<CommandResult> {
    const timeout = command.options.timeout || this.config.defaultTimeout;

    // Validate parameters if validator provided
    if (handler.validate) {
      const isValid = await handler.validate(command.parameters);
      if (!isValid) {
        return this.createErrorResult(command, {
          code: 'VALIDATION_ERROR',
          message: 'Invalid command parameters',
          recoverable: true,
        });
      }
    }

    // Execute with timeout
    const timeoutPromise = new Promise<CommandResult>((_, reject) => {
      setTimeout(() => reject(new Error('Command execution timeout')), timeout);
    });

    const executionPromise = handler.execute(command, context);

    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === 'Command execution timeout') {
        // Try to rollback if available
        if (handler.rollback) {
          try {
            await handler.rollback(command, context);
          } catch (rollbackError) {
            this.config.logger.error('Rollback failed', rollbackError);
          }
        }

        return this.createErrorResult(command, {
          code: 'TIMEOUT',
          message: `Command execution exceeded timeout of ${timeout}ms`,
          recoverable: true,
        });
      }
      throw error;
    }
  }

  /**
   * Cancel a running command
   */
  cancel(commandId: string): boolean {
    const controller = this.executingCommands.get(commandId);
    if (controller) {
      controller.abort();
      this.executingCommands.delete(commandId);
      return true;
    }
    return false;
  }

  /**
   * Register a service for handlers to use
   */
  registerService(name: string, service: any): void {
    this.services.set(name, service);
  }

  /**
   * Get execution metrics
   */
  getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      averageExecutionTime: 0,
      handlerMetrics: new Map(),
    };
  }

  /**
   * Create handler execution context
   */
  private createHandlerContext(abortSignal: AbortSignal): HandlerContext {
    const eventBus: EventBus = {
      emit: (event, data) => this.emit(event as any, data),
      on: (event, handler) => this.on(event as any, handler),
      off: (event, handler) => this.off(event as any, handler),
    };

    return {
      services: this.services,
      logger: this.config.logger,
      eventBus,
      abortSignal,
    };
  }

  /**
   * Create error result
   */
  private createErrorResult(command: Command, error: Omit<CommandError, 'code'> & { code: string }): CommandResult {
    return {
      commandId: command.id,
      success: false,
      error: error as CommandError,
      executionTime: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Update execution metrics
   */
  private updateMetrics(handlerName: string, success: boolean, executionTime: number): void {
    this.metrics.totalCommands++;
    if (success) {
      this.metrics.successfulCommands++;
    } else {
      this.metrics.failedCommands++;
    }

    // Update average execution time
    const currentTotal = this.metrics.averageExecutionTime * (this.metrics.totalCommands - 1);
    this.metrics.averageExecutionTime = (currentTotal + executionTime) / this.metrics.totalCommands;

    // Update handler metrics
    let handlerMetric = this.metrics.handlerMetrics.get(handlerName);
    if (!handlerMetric) {
      handlerMetric = {
        invocations: 0,
        successes: 0,
        failures: 0,
        averageTime: 0,
      };
      this.metrics.handlerMetrics.set(handlerName, handlerMetric);
    }

    handlerMetric.invocations++;
    if (success) {
      handlerMetric.successes++;
    } else {
      handlerMetric.failures++;
    }

    const currentHandlerTotal = handlerMetric.averageTime * (handlerMetric.invocations - 1);
    handlerMetric.averageTime = (currentHandlerTotal + executionTime) / handlerMetric.invocations;
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, data?: any) => console.debug(message, data),
      info: (message: string, data?: any) => console.info(message, data),
      warn: (message: string, data?: any) => console.warn(message, data),
      error: (message: string, error?: any) => console.error(message, error),
    };
  }
}