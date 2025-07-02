// Core types
export * from './types/command.types';

// Parser components
export { CommandParser, ParserConfig } from './parser/command-parser';
export { IntentRecognizer } from './parser/intent-recognizer';
export { ParameterExtractor } from './parser/parameter-extractor';

// Router components
export { CommandRouter, RouterConfig, RouterEvent, SubRouter } from './router/command-router';
export { RouteMatcher, RouteMatch } from './router/route-matcher';

// Handler components
export { HandlerRegistry, HandlerMetadata } from './handlers/handler-registry';
export { CommandDispatcher, DispatcherConfig, DispatchEvents, ExecutionMetrics } from './handlers/command-dispatcher';

// Manager components
export { 
  AsyncResponseManager, 
  AsyncTask, 
  AsyncTaskState, 
  AsyncResponseEvents,
  AsyncContext,
  ProgressCallback 
} from './managers/async-response-manager';

// Utility components
export { 
  ErrorHandler, 
  ErrorSeverity, 
  ErrorCategory, 
  EnhancedError, 
  RecoveryStrategy 
} from './utils/error-handler';

// Main facade class for easy usage
import { CommandParser, ParserConfig } from './parser/command-parser';
import { CommandRouter, RouterConfig } from './router/command-router';
import { HandlerRegistry } from './handlers/handler-registry';
import { CommandDispatcher, DispatcherConfig } from './handlers/command-dispatcher';
import { AsyncResponseManager } from './managers/async-response-manager';
import { ErrorHandler } from './utils/error-handler';
import { Command, CommandHandler, CommandResult, Middleware, Route } from './types/command.types';
import { HandlerMetadata } from './handlers/handler-registry';
import { AsyncTask } from './managers/async-response-manager';
import { ExecutionMetrics } from './handlers/command-dispatcher';

/**
 * Configuration for the command routing system
 */
export interface CommandSystemConfig {
  parser?: ParserConfig;
  router?: RouterConfig;
  dispatcher?: DispatcherConfig;
}

/**
 * Main command routing system
 */
export class CommandRoutingSystem {
  private parser: CommandParser;
  private router: CommandRouter;
  private registry: HandlerRegistry;
  private dispatcher: CommandDispatcher;
  private asyncManager: AsyncResponseManager;
  private _errorHandler: ErrorHandler;

  constructor(config: CommandSystemConfig = {}) {
    this.parser = new CommandParser(config.parser);
    this.router = new CommandRouter(config.router);
    this.registry = new HandlerRegistry();
    this.dispatcher = new CommandDispatcher(this.registry, this.router, config.dispatcher);
    this.asyncManager = new AsyncResponseManager();
    this._errorHandler = new ErrorHandler();

    // Set up error handling
    this.setupErrorHandling();
  }

  /**
   * Parse and execute a command
   */
  async execute(input: string, metadata?: Partial<Command['metadata']>): Promise<CommandResult> {
    try {
      // Parse command
      const command = this.parser.parse(input, metadata);

      // Handle async commands
      if (command.options.async) {
        return this.executeAsync(command);
      }

      // Execute synchronously
      return await this.dispatcher.dispatch(command);

    } catch (error) {
      const enhanced = await this._errorHandler.handle(error as Error);
      return {
        commandId: 'error',
        success: false,
        error: enhanced,
        executionTime: 0,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Execute command asynchronously
   */
  private async executeAsync(command: Command): Promise<CommandResult> {
    const task = this.asyncManager.createTask(command);
    
    // Start execution in background
    this.asyncManager.startTask(task.id);
    
    // Execute command
    this.dispatcher.dispatch(command).then(result => {
      this.asyncManager.completeTask(task.id, result);
    }).catch(error => {
      this.asyncManager.failTask(task.id, error);
    });

    // Return immediate response
    return {
      commandId: command.id,
      success: true,
      data: {
        taskId: task.id,
        message: 'Command is being executed asynchronously',
      },
      executionTime: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Register a command handler
   */
  registerHandler(handler: CommandHandler, metadata?: Partial<HandlerMetadata>): this {
    this.registry.register(handler, metadata);
    return this;
  }

  /**
   * Register a route
   */
  registerRoute(pattern: string | RegExp, handler: string, options?: Partial<Route>): this {
    this.router.route(pattern, handler, options);
    return this;
  }

  /**
   * Register middleware
   */
  registerMiddleware(middleware: Middleware): this {
    this.router.use(middleware);
    return this;
  }

  /**
   * Get async task status
   */
  getTaskStatus(taskId: string): AsyncTask | undefined {
    return this.asyncManager.getTask(taskId);
  }

  /**
   * Cancel a running task
   */
  cancelTask(taskId: string): boolean {
    return this.asyncManager.cancelTask(taskId);
  }

  /**
   * Wait for task completion
   */
  waitForTask(taskId: string, timeoutMs?: number): Promise<CommandResult> {
    return this.asyncManager.waitForTask(taskId, timeoutMs);
  }

  /**
   * Get system metrics
   */
  getMetrics(): {
    execution: ExecutionMetrics;
    errors: ReturnType<ErrorHandler['getStatistics']>;
    tasks: ReturnType<AsyncResponseManager['getStatistics']>;
  } {
    return {
      execution: this.dispatcher.getMetrics(),
      errors: this._errorHandler.getStatistics(),
      tasks: this.asyncManager.getStatistics(),
    };
  }

  /**
   * Set up error handling
   */
  private setupErrorHandling(): void {
    // Handle dispatcher errors
    this.dispatcher.on('command.error', ({ command, error }) => {
      this._errorHandler.handle(error, { command });
    });

    // Handle async task errors
    this.asyncManager.on('task.failed', ({ task, error }) => {
      this._errorHandler.handle(error, { task });
    });
  }

  // Expose underlying components for advanced usage
  get commandParser(): CommandParser {
    return this.parser;
  }

  get commandRouter(): CommandRouter {
    return this.router;
  }

  get handlerRegistry(): HandlerRegistry {
    return this.registry;
  }

  get commandDispatcher(): CommandDispatcher {
    return this.dispatcher;
  }

  get asyncResponseManager(): AsyncResponseManager {
    return this.asyncManager;
  }

  get errorHandler(): ErrorHandler {
    return this._errorHandler;
  }
}

// Export a factory function for convenience
export function createCommandSystem(config?: CommandSystemConfig): CommandRoutingSystem {
  return new CommandRoutingSystem(config);
}