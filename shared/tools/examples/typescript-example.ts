/**
 * Example: Using Python tools from TypeScript
 */

import { 
  loadPythonModule, 
  callPythonTool, 
  toolRegistry,
  errorHandler
} from '../index';

async function example() {
  try {
    // Initialize the tool registry
    await toolRegistry.initialize();
    
    // Load Python tools from DGM
    console.log('Loading Python tools...');
    await loadPythonModule('/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm/tools/bash.py');
    await loadPythonModule('/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm/tools/edit.py');
    
    // List all available tools
    console.log('\nAvailable tools:');
    const tools = await toolRegistry.list();
    for (const tool of tools) {
      console.log(`- ${tool.name} (${tool.language}): ${tool.description}`);
    }
    
    // Call Python bash tool
    console.log('\nCalling Python bash tool...');
    const bashResult = await callPythonTool('bash', {
      command: 'echo "Hello from TypeScript calling Python!"'
    });
    
    console.log('Bash result:', bashResult);
    
    // Search for file-related tools
    console.log('\nSearching for file tools...');
    const fileTools = await toolRegistry.search('file');
    console.log(`Found ${fileTools.length} file-related tools`);
    
    // Demonstrate error handling
    console.log('\nDemonstrating error handling...');
    try {
      await callPythonTool('non_existent_tool', {});
    } catch (error) {
      const errorContext = {
        toolId: 'non_existent_tool',
        language: 'python' as const,
        parameters: {},
        context: {
          sessionId: 'test',
          messageId: 'test-msg',
          environment: {},
          abortSignal: new AbortController().signal,
          timeout: 30000,
          metadata: new Map(),
          logger: {
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            metric: () => {}
          }
        },
        startTime: new Date()
      };
      
      const handledError = errorHandler.handleError(error, errorContext);
      console.log('Handled error:', handledError);
    }
    
    // Get tool in specific language
    console.log('\nGetting bash tool in different languages...');
    const pythonBash = await toolRegistry.get('bash', 'python');
    const tsBash = await toolRegistry.get('bash', 'typescript');
    
    console.log('Python bash available:', !!pythonBash);
    console.log('TypeScript bash available:', !!tsBash);
    
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Run the example
if (require.main === module) {
  example().then(() => {
    console.log('\nExample completed!');
    process.exit(0);
  }).catch(error => {
    console.error('Example error:', error);
    process.exit(1);
  });
}