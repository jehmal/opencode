import { 
  createCommandSystem, 
  CommandHandler, 
  Middleware,
  AsyncTask,
  ErrorCategory,
  ErrorSeverity 
} from '../src';

async function main() {
  const system = createCommandSystem();

  // === Advanced Handler with Progress Updates ===
  const dataProcessHandler: CommandHandler = {
    name: 'dataProcessHandler',
    description: 'Processes large datasets with progress updates',
    execute: async (command, context) => {
      const { dataset, operations = ['clean', 'transform', 'analyze'] } = command.parameters;
      
      // For async commands, we need to get the task context
      const taskId = command.metadata.taskId;
      if (taskId && command.options.async) {
        const asyncContext = system.asyncResponseManager.createAsyncContext(taskId);
        
        for (let i = 0; i < operations.length; i++) {
          // Check for cancellation
          if (asyncContext.checkCancellation()) {
            throw new Error('Processing cancelled');
          }
          
          // Update progress
          const progress = ((i + 1) / operations.length) * 100;
          asyncContext.updateProgress(progress, `Processing: ${operations[i]}`);
          
          // Simulate processing
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      return {
        commandId: command.id,
        success: true,
        data: {
          dataset,
          operations,
          recordsProcessed: 1000,
          duration: operations.length * 500,
        },
        executionTime: operations.length * 500,
        timestamp: new Date(),
      };
    },
  };

  // === Authentication Middleware ===
  const authMiddleware: Middleware = {
    name: 'authentication',
    execute: async (command, next) => {
      // Check for auth token in metadata
      const token = command.metadata.authToken;
      
      if (!token) {
        return {
          commandId: command.id,
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication token required',
            recoverable: true,
          },
          executionTime: 0,
          timestamp: new Date(),
        };
      }
      
      // Validate token (simplified)
      if (token !== 'valid-token') {
        return {
          commandId: command.id,
          success: false,
          error: {
            code: 'AUTH_INVALID',
            message: 'Invalid authentication token',
            recoverable: true,
          },
          executionTime: 0,
          timestamp: new Date(),
        };
      }
      
      // Continue to next middleware/handler
      return next();
    },
  };

  // === Logging Middleware ===
  const loggingMiddleware: Middleware = {
    name: 'logging',
    execute: async (command, next) => {
      const startTime = Date.now();
      console.log(`[LOG] Command started: ${command.intent.primary} (${command.id})`);
      
      try {
        const result = await next();
        const duration = Date.now() - startTime;
        console.log(`[LOG] Command completed: ${command.id} - ${result.success ? 'SUCCESS' : 'FAILED'} (${duration}ms)`);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`[LOG] Command error: ${command.id} - ${error} (${duration}ms)`);
        throw error;
      }
    },
  };

  // === Rate Limiting Middleware ===
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  
  const rateLimitMiddleware: Middleware = {
    name: 'rateLimit',
    execute: async (command, next) => {
      const userId = command.metadata.userId || 'anonymous';
      const now = Date.now();
      const limit = 10; // 10 requests per minute
      const window = 60000; // 1 minute
      
      let userLimit = rateLimitMap.get(userId);
      
      if (!userLimit || now > userLimit.resetTime) {
        userLimit = { count: 0, resetTime: now + window };
        rateLimitMap.set(userId, userLimit);
      }
      
      if (userLimit.count >= limit) {
        return {
          commandId: command.id,
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded. Try again in ${Math.ceil((userLimit.resetTime - now) / 1000)} seconds`,
            recoverable: true,
          },
          executionTime: 0,
          timestamp: new Date(),
        };
      }
      
      userLimit.count++;
      return next();
    },
  };

  // === Complex Handler with Dependencies ===
  const deploymentHandler: CommandHandler = {
    name: 'deploymentHandler',
    description: 'Handles application deployment',
    execute: async (command, context) => {
      const { app, environment, version } = command.parameters;
      
      // Access services
      const configService = context.services.get('config');
      const deployService = context.services.get('deploy');
      
      // Multi-step deployment process
      const steps = [
        'Validating configuration',
        'Building application',
        'Running tests',
        'Creating deployment package',
        'Deploying to environment',
        'Health check',
      ];
      
      for (const step of steps) {
        context.logger.info(`Deployment step: ${step}`);
        context.eventBus.emit('deployment.step', { app, step });
        
        // Check abort signal
        if (context.abortSignal?.aborted) {
          throw new Error('Deployment aborted');
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      return {
        commandId: command.id,
        success: true,
        data: {
          app,
          environment,
          version,
          deploymentId: `deploy-${Date.now()}`,
          url: `https://${app}.${environment}.example.com`,
        },
        executionTime: steps.length * 200,
        timestamp: new Date(),
      };
    },
    rollback: async (command, context) => {
      context.logger.warn(`Rolling back deployment for ${command.parameters.app}`);
      // Rollback logic here
    },
  };

  // Register everything
  system.registerHandler(dataProcessHandler);
  system.registerHandler(deploymentHandler);
  
  system.registerMiddleware(authMiddleware);
  system.registerMiddleware(loggingMiddleware);
  system.registerMiddleware(rateLimitMiddleware);
  
  // Register routes with middleware
  system.registerRoute('data.process', 'dataProcessHandler', {
    middleware: ['logging'],
    description: 'Process large datasets',
    examples: ['process dataset sales-2024', 'analyze data customer-feedback'],
  });
  
  system.registerRoute('deploy.:action', 'deploymentHandler', {
    middleware: ['authentication', 'rateLimit', 'logging'],
    description: 'Handle deployment operations',
  });

  // Register services
  system.commandDispatcher.registerService('config', { 
    get: (key: string) => ({ key, value: 'mock-value' }) 
  });
  system.commandDispatcher.registerService('deploy', { 
    deploy: async () => true 
  });

  // === Custom Error Recovery Strategy ===
  system.errorHandler.registerStrategy({
    name: 'deployment-retry',
    applicable: (error) => 
      error.category === ErrorCategory.NETWORK && 
      error.context?.handler === 'deploymentHandler',
    execute: async (error) => {
      console.log('[RECOVERY] Attempting to recover from deployment error');
      // Implement recovery logic
      return true;
    },
  });

  // === Example Usage ===
  console.log('=== Advanced Command Examples ===\n');

  // Example 1: Async data processing with progress
  console.log('1. Async data processing:');
  const asyncResult = await system.execute('process dataset sales-2024 --async');
  
  if (asyncResult.data.taskId) {
    // Monitor progress
    system.asyncResponseManager.on('task.progress', ({ task, progress, message }) => {
      if (task.id === asyncResult.data.taskId) {
        console.log(`  Progress: ${progress}% - ${message}`);
      }
    });
    
    // Wait for completion
    const finalResult = await system.waitForTask(asyncResult.data.taskId);
    console.log('  Final result:', JSON.stringify(finalResult.data, null, 2));
  }
  console.log();

  // Example 2: Protected route without auth
  console.log('2. Protected route without auth:');
  const noAuthResult = await system.execute('deploy app myapp to production');
  console.log('  Result:', noAuthResult.error?.message);
  console.log();

  // Example 3: Protected route with auth
  console.log('3. Protected route with auth:');
  const authResult = await system.execute('deploy app myapp to production', {
    authToken: 'valid-token',
    userId: 'user123',
  });
  console.log('  Result:', JSON.stringify(authResult.data, null, 2));
  console.log();

  // Example 4: Rate limiting
  console.log('4. Testing rate limiting:');
  for (let i = 0; i < 12; i++) {
    const result = await system.execute('deploy app test to staging', {
      authToken: 'valid-token',
      userId: 'rateLimitTest',
    });
    
    if (!result.success) {
      console.log(`  Request ${i + 1}: ${result.error?.message}`);
      break;
    } else {
      console.log(`  Request ${i + 1}: Success`);
    }
  }
  console.log();

  // Example 5: Custom intent patterns
  console.log('5. Custom intent patterns:');
  
  // Register custom pattern
  system.commandParser.registerIntent('backup',
    [/^backup\s+(.+)\s+to\s+(.+)$/i, /^create\s+backup\s+of\s+(.+)$/i],
    ['backup', 'save', 'archive'],
    20
  );
  
  system.commandParser.registerParameterPatterns('backup', [
    {
      name: 'source',
      pattern: /backup\s+([^\s]+)/i,
      transform: (value) => value.toLowerCase(),
    },
    {
      name: 'destination',
      pattern: /to\s+([^\s]+)$/i,
      transform: (value) => value.toLowerCase(),
    },
  ]);
  
  const backupCommand = system.commandParser.parse('backup database to s3://backups/');
  console.log('  Parsed intent:', backupCommand.intent.primary);
  console.log('  Parameters:', backupCommand.parameters);
  console.log();

  // Show final metrics
  console.log('=== Final System Metrics ===');
  const metrics = system.getMetrics();
  console.log('Execution:', metrics.execution);
  console.log('Errors:', metrics.errors);
  console.log('Tasks:', metrics.tasks);
}

// Run the example
main().catch(console.error);