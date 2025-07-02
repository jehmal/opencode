/**
 * Integration test demonstrating Evolution Engine with Agent Orchestrator
 * Shows how the two systems work together using 2 agents as requested
 */

import { EvolutionEngine } from '../evolution/evolution-engine';
import { AgentOrchestrator } from '../orchestrator/agent-orchestrator';
import { AgentCapabilities } from '../orchestrator/agent-orchestrator';

async function integrationTest() {
  console.log('Starting Evolution Engine + Agent Orchestrator integration test...\n');

  // Configuration for evolution engine
  const evolutionConfig = {
    populationSize: 2, // Using 2 agents as requested
    generations: 1,
    mutationRate: 0.1,
    crossoverRate: 0.1,
    eliteSize: 1,
    selectionMethod: 'score_child_prop' as const,
    evaluationMethod: 'swe-bench' as const,
    archiveStrategy: 'all' as const,
    parallelEvaluations: 2,
    timeout: 300000,
    outputDir: '/mnt/c/Users/jehma/Desktop/AI/DGMSTT/output_dgm/integration_test',
    redisUrl: 'redis://localhost:6379',
    rabbitMqUrl: 'amqp://localhost:5672',
    orchestratorUrl: 'http://localhost:3000',
    evolutionBridgeUrl: 'http://localhost:8000',
    checkpointInterval: 5,
    maxStagnationGenerations: 10,
    fitnessThreshold: 0.9,
  };

  try {
    // 1. Initialize Agent Orchestrator
    console.log('1. Initializing Agent Orchestrator...');
    const orchestrator = new AgentOrchestrator({
      redisUrl: evolutionConfig.redisUrl,
      amqpUrl: evolutionConfig.rabbitMqUrl,
      maxRetries: 3,
      taskTimeout: 300000,
    });

    // 2. Register 2 specialized agents with the orchestrator
    console.log('\n2. Registering 2 specialized agents...');
    
    // Agent 1: Evolution specialist
    const agent1Capabilities: AgentCapabilities = {
      agentId: 'evolution-agent-1',
      taskTypes: ['evolution', 'analysis', 'coding'],
      maxConcurrentTasks: 2,
      specializations: ['self-improvement', 'swe-bench'],
    };
    await orchestrator.registerAgent(agent1Capabilities);
    console.log('Registered Agent 1:', agent1Capabilities.agentId);

    // Agent 2: Evaluation specialist
    const agent2Capabilities: AgentCapabilities = {
      agentId: 'evolution-agent-2',
      taskTypes: ['evolution', 'analysis', 'tool_execution'],
      maxConcurrentTasks: 2,
      specializations: ['fitness-evaluation', 'polyglot'],
    };
    await orchestrator.registerAgent(agent2Capabilities);
    console.log('Registered Agent 2:', agent2Capabilities.agentId);

    // 3. Create Evolution Engine
    console.log('\n3. Creating Evolution Engine...');
    const evolutionEngine = new EvolutionEngine(evolutionConfig);

    // 4. Initialize Evolution Engine (will use the orchestrator internally)
    console.log('\n4. Initializing Evolution Engine...');
    await evolutionEngine.initialize();

    // 5. Create a workflow for evolution tasks
    console.log('\n5. Creating evolution workflow...');
    const evolutionWorkflow = await orchestrator.createWorkflow(
      'Evolution Generation 1',
      [
        {
          type: 'evolution',
          priority: 10,
          prompt: 'Initialize evolution with baseline agent',
          context: {
            task: 'initialize',
            generation: 0,
          },
          timeout: 60000,
        },
        {
          type: 'evolution',
          priority: 9,
          prompt: 'Generate first offspring through self-improvement',
          context: {
            task: 'self_improve',
            parentId: 'initial',
            generation: 1,
            requiredSpecializations: ['self-improvement'],
          },
          dependencies: [],
          timeout: 180000,
        },
        {
          type: 'evolution',
          priority: 9,
          prompt: 'Generate second offspring through self-improvement',
          context: {
            task: 'self_improve',
            parentId: 'initial',
            generation: 1,
            requiredSpecializations: ['self-improvement'],
          },
          dependencies: [],
          timeout: 180000,
        },
      ]
    );
    console.log('Created workflow:', evolutionWorkflow.id);

    // 6. Monitor agent status
    console.log('\n6. Monitoring agent status...');
    const agent1Status = await orchestrator.getAgentStatus('evolution-agent-1');
    const agent2Status = await orchestrator.getAgentStatus('evolution-agent-2');
    console.log('Agent 1 status:', agent1Status.runtime?.status);
    console.log('Agent 2 status:', agent2Status.runtime?.status);

    // 7. Run one generation
    console.log('\n7. Running one evolution generation...');
    const generationResult = await evolutionEngine.runGeneration();
    console.log('Generation completed:', {
      generation: generationResult.generation,
      children: generationResult.children.length,
      childrenCompiled: generationResult.childrenCompiled.length,
      archiveSize: generationResult.archive.length,
    });

    // 8. Check workflow completion
    console.log('\n8. Checking workflow status...');
    let workflowStatus = await orchestrator.getWorkflowStatus(evolutionWorkflow.id);
    
    // Wait for workflow to complete (with timeout)
    const maxWaitTime = 60000; // 1 minute
    const startTime = Date.now();
    while (workflowStatus?.status === 'running' && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
      workflowStatus = await orchestrator.getWorkflowStatus(evolutionWorkflow.id);
      console.log(`Workflow status: ${workflowStatus?.status}`);
    }

    // 9. Get evolution status
    console.log('\n9. Getting evolution engine status...');
    const evolutionStatus = await evolutionEngine.getStatus();
    console.log('Evolution status:', {
      generation: evolutionStatus.currentGeneration,
      bestFitness: evolutionStatus.bestFitness,
      populationSize: evolutionStatus.populationStats.totalAgents,
      health: evolutionStatus.health.isHealthy ? 'Healthy' : 'Issues detected',
    });

    // 10. Export results
    console.log('\n10. Exporting evolution data...');
    const exportPath = await evolutionEngine.exportData();
    console.log(`Evolution data exported to: ${exportPath}`);

    // 11. Cleanup
    console.log('\n11. Cleaning up...');
    await evolutionEngine.stop();
    await orchestrator.shutdown();

    console.log('\n✅ Integration test completed successfully!');
    console.log('\nKey achievements:');
    console.log('- Initialized Agent Orchestrator with 2 specialized agents');
    console.log('- Created and initialized Evolution Engine');
    console.log('- Orchestrated evolution tasks across multiple agents');
    console.log('- Completed one generation of evolution');
    console.log('- Exported results for analysis');

  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    throw error;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  integrationTest()
    .then(() => {
      console.log('\n🎉 Test completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { integrationTest };