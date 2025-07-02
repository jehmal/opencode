/**
 * Test the Evolution Engine
 * Simple test to verify one generation cycle works
 */

import { EvolutionEngine } from './evolution-engine';
import { EvolutionConfig } from './evolution-types';

async function testEvolutionEngine() {
  console.log('Starting Evolution Engine test...\n');

  // Test configuration
  const config = {
    populationSize: 3, // Start with 3 agents for testing
    generations: 1, // Just one generation for test
    mutationRate: 0.1,
    crossoverRate: 0.1,
    eliteSize: 1,
    selectionMethod: 'score_child_prop' as const,
    evaluationMethod: 'swe-bench' as const,
    archiveStrategy: 'all' as const,
    parallelEvaluations: 2,
    timeout: 300000, // 5 minutes
    outputDir: '/mnt/c/Users/jehma/Desktop/AI/DGMSTT/output_dgm/test_run',
    redisUrl: 'redis://localhost:6379',
    rabbitMqUrl: 'amqp://localhost:5672',
    orchestratorUrl: 'http://localhost:3000',
    evolutionBridgeUrl: 'http://localhost:8000',
    checkpointInterval: 5,
    maxStagnationGenerations: 10,
    fitnessThreshold: 0.9,
  };

  try {
    // Create evolution engine
    const engine = new EvolutionEngine(config);
    
    // Initialize
    console.log('Initializing Evolution Engine...');
    await engine.initialize();
    
    // Get initial status
    const initialStatus = await engine.getStatus();
    console.log('\nInitial Status:', JSON.stringify(initialStatus, null, 2));
    
    // Run one generation
    console.log('\nRunning one generation...');
    const result = await engine.runGeneration();
    
    console.log('\nGeneration Result:', JSON.stringify(result, null, 2));
    
    // Get final status
    const finalStatus = await engine.getStatus();
    console.log('\nFinal Status:', JSON.stringify(finalStatus, null, 2));
    
    // Export data
    console.log('\nExporting data...');
    const exportPath = await engine.exportData();
    console.log(`Data exported to: ${exportPath}`);
    
    // Stop engine
    await engine.stop();
    
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testEvolutionEngine()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { testEvolutionEngine };