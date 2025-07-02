/**
 * Example usage of DGM Integration
 */

import { DGMBridge, PerformanceTracker, ToolSynchronizer } from './index';

async function main() {
  // Initialize performance tracking
  const perfTracker = new PerformanceTracker();
  
  // Create and initialize the bridge
  const bridge = new DGMBridge({
    pythonPath: 'python3',
    timeout: 30000
  });

  console.log('Initializing DGM Bridge...');
  const initMetric = perfTracker.startOperation('bridge-init');
  
  try {
    await bridge.initialize();
    initMetric.end();
    console.log('Bridge initialized successfully');

    // Create tool synchronizer
    const toolSync = new ToolSynchronizer(bridge);

    // Register some example tools
    toolSync.registerTools([
      {
        name: 'calculator',
        description: 'Performs basic arithmetic operations',
        parameters: {
          type: 'object',
          properties: {
            operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['operation', 'a', 'b']
        }
      },
      {
        name: 'text_analyzer',
        description: 'Analyzes text for various metrics',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            metrics: { 
              type: 'array', 
              items: { type: 'string', enum: ['length', 'words', 'sentences'] }
            }
          },
          required: ['text']
        }
      }
    ]);

    // Sync tools
    console.log('Syncing tools...');
    await toolSync.syncAll();

    // Store some memory
    console.log('\nStoring memory...');
    const storeMetric = perfTracker.startOperation('memory-store');
    const storeResult = await bridge.storeMemory(
      'TypeScript performance optimization tips: Use const assertions, avoid any type, leverage type inference',
      {
        category: 'programming',
        language: 'typescript',
        type: 'tips'
      }
    );
    storeMetric.end();
    console.log('Store result:', storeResult);

    // Search memory
    console.log('\nSearching memory...');
    const searchMetric = perfTracker.startOperation('memory-search');
    const searchResult = await bridge.searchMemory('TypeScript performance');
    searchMetric.end();
    console.log('Search result:', searchResult);

    // Get statistics
    console.log('\nGetting DGM stats...');
    const stats = await bridge.getStats();
    console.log('DGM Stats:', stats);

    // Get performance report
    console.log('\nPerformance Report:');
    const perfReport = perfTracker.getReport();
    console.log(JSON.stringify(perfReport, null, 2));

    // Get detailed operation stats
    const searchStats = perfTracker.getOperationStats('memory-search');
    if (searchStats) {
      console.log('\nSearch Operation Stats:', searchStats);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Cleanup
    await bridge.close();
    console.log('\nBridge closed');
  }
}

// Run the example
if (import.meta.main) {
  main().catch(console.error);
}