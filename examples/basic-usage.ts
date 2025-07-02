import { createCommandSystem, CommandHandler } from '../src';

async function main() {
  // Create the command routing system
  const system = createCommandSystem({
    parser: {
      defaultTimeout: 5000,
      confidenceThreshold: 0.3,
    },
    router: {
      fallbackHandler: 'helpHandler',
    },
    dispatcher: {
      maxConcurrent: 10,
      enableMetrics: true,
    },
  });

  // Define handlers
  const fileCreateHandler: CommandHandler = {
    name: 'fileCreateHandler',
    description: 'Creates a new file',
    validate: async (params) => {
      return params.filename !== undefined;
    },
    execute: async (command, context) => {
      const { filename, content = '' } = command.parameters;
      
      context.logger.info(`Creating file: ${filename}`);
      
      // Simulate file creation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        commandId: command.id,
        success: true,
        data: {
          filename,
          content,
          size: content.length,
          created: true,
        },
        executionTime: 100,
        timestamp: new Date(),
      };
    },
  };

  const fileReadHandler: CommandHandler = {
    name: 'fileReadHandler',
    description: 'Reads a file',
    execute: async (command, context) => {
      const { filename } = command.parameters;
      
      context.logger.info(`Reading file: ${filename}`);
      
      // Simulate file reading
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        commandId: command.id,
        success: true,
        data: {
          filename,
          content: 'This is the file content',
          size: 24,
        },
        executionTime: 50,
        timestamp: new Date(),
      };
    },
  };

  const codeGenerateHandler: CommandHandler = {
    name: 'codeGenerateHandler',
    description: 'Generates code',
    execute: async (command, context) => {
      const { type, name, language = 'typescript' } = command.parameters;
      
      context.logger.info(`Generating ${type} ${name} in ${language}`);
      
      let code = '';
      switch (type) {
        case 'function':
          code = `function ${name}() {\n  // TODO: Implement\n}`;
          break;
        case 'class':
          code = `class ${name} {\n  constructor() {\n    // TODO: Initialize\n  }\n}`;
          break;
        default:
          code = `// Generated ${type} ${name}`;
      }
      
      return {
        commandId: command.id,
        success: true,
        data: { type, name, language, code },
        executionTime: 75,
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
        message: 'Available commands:\n' +
                 '- create file <filename> [with content "<content>"]\n' +
                 '- read file <filename>\n' +
                 '- generate <function|class> <name> [in <language>]\n' +
                 '- help',
        requestedCommand: command.intent.primary,
      },
      executionTime: 10,
      timestamp: new Date(),
    }),
  };

  // Register handlers
  system.registerHandler(fileCreateHandler);
  system.registerHandler(fileReadHandler);
  system.registerHandler(codeGenerateHandler);
  system.registerHandler(helpHandler);

  // Register routes
  system.registerRoute('file.create', 'fileCreateHandler');
  system.registerRoute('file.read', 'fileReadHandler');
  system.registerRoute('code.generate', 'codeGenerateHandler');
  system.registerRoute('help.*', 'helpHandler');
  system.registerRoute('unknown', 'helpHandler');

  // Example commands
  console.log('=== Basic Command Examples ===\n');

  // Example 1: Create a file
  console.log('1. Creating a file:');
  const result1 = await system.execute('create file hello.txt with content "Hello, World!"');
  console.log('Result:', JSON.stringify(result1.data, null, 2));
  console.log();

  // Example 2: Read a file
  console.log('2. Reading a file:');
  const result2 = await system.execute('read file config.json');
  console.log('Result:', JSON.stringify(result2.data, null, 2));
  console.log();

  // Example 3: Generate code
  console.log('3. Generating code:');
  const result3 = await system.execute('generate function calculateSum in typescript');
  console.log('Result:', JSON.stringify(result3.data, null, 2));
  console.log();

  // Example 4: Unknown command (fallback)
  console.log('4. Unknown command:');
  const result4 = await system.execute('do something random');
  console.log('Result:', JSON.stringify(result4.data, null, 2));
  console.log();

  // Example 5: Command with flags
  console.log('5. Command with flags:');
  const result5 = await system.execute('create file data.json --async --priority=high');
  console.log('Result:', JSON.stringify(result5.data, null, 2));
  console.log();

  // Show metrics
  console.log('=== System Metrics ===');
  const metrics = system.getMetrics();
  console.log('Execution metrics:', {
    total: metrics.execution.totalCommands,
    successful: metrics.execution.successfulCommands,
    failed: metrics.execution.failedCommands,
    averageTime: `${metrics.execution.averageExecutionTime.toFixed(2)}ms`,
  });
}

// Run the example
main().catch(console.error);