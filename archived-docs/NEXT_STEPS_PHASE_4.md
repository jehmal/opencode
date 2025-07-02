You are implementing the next phase of DGMSTT (Darwin Gödel Machine Self-Testing Tool). The Evolution Engine is now complete (Phase 3). Your task is to implement the Agent Evaluation and Benchmarking System (Phase 4).

Project Context

- Working Directory: /mnt/c/Users/jehma/Desktop/AI/DGMSTT/
- Main Evolution Directory: /mnt/c/Users/jehma/Desktop/AI/DGMSTT/shared/orchestration/evolution/
- DGM Source: /mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm/
- SWE-Bench Data: /mnt/c/Users/jehma/Desktop/AI/DGMSTT/swe_bench/
- Polyglot Data: /mnt/c/Users/jehma/Desktop/AI/DGMSTT/polyglot/

Qdrant Memory Search Commands

First, retrieve the current project state and patterns:
1. Search: "DGMSTT Evolution Engine Phase 3 Complete"
2. Search: "fitness-evaluator.ts benchmark integration patterns"
3. Search: "swe-bench evaluation Docker container setup"
4. Search: "polyglot benchmark multi-language support"
5. Search: "agent performance metrics Prometheus"

Completed Components (From Phase 3)

✅ Evolution Engine Core:
  - evolution-engine.ts - Full orchestration of evolution cycles
  - dgm_adapter.py - DGM functionality wrapper
  - evolution_bridge.py - Python-TypeScript bridge
  - population-manager.ts - DGM parent selection algorithms
  - archive-manager.ts - Agent archive management
  - Integration tests with 2-agent orchestration

✅ Infrastructure:
  - RabbitMQ event system configured
  - Redis state persistence
  - Prometheus metrics collection
  - Docker containers for agents

Critical Files to Reference

1. Evaluation System:
   - /shared/orchestration/evolution/fitness-evaluator.ts - Partially implemented
   - /dgm/swe_bench_docker.py - Docker-based evaluation
   - /dgm/run_eval_swe_bench.py - SWE-bench evaluation logic
   - /dgm/eval_polyglot.py - Polyglot evaluation logic

2. Benchmark Data:
   - /swe_bench/subsets/small.json - Small test set
   - /swe_bench/subsets/medium.json - Medium test set
   - /polyglot/subsets/small.json - Polyglot small set

3. Docker Infrastructure:
   - /shared/orchestration/docker/ - Container definitions
   - /dgm/docker/ - DGM Docker utilities

Required Tasks (Phase 4 - Agent Evaluation System)

Task 1: Complete fitness-evaluator.ts

Enhance /shared/orchestration/evolution/fitness-evaluator.ts:
- Implement evaluate() method with Docker container execution
- Support both swe-bench and polyglot evaluation methods
- Parse evaluation results into FitnessScore format
- Handle timeouts and resource limits
- Integrate with existing metrics system

Task 2: Create evaluation-runner.py

Create /shared/orchestration/evolution/evaluation-runner.py:
- Bridge between TypeScript evaluator and Python evaluation scripts
- Handle Docker container lifecycle for evaluations
- Support parallel evaluations with resource management
- Parse SWE-bench and Polyglot results
- Return structured results to fitness-evaluator.ts

Task 3: Implement benchmark-manager.ts

Create /shared/orchestration/evolution/benchmark-manager.ts:
- Load and manage benchmark datasets (SWE-bench, Polyglot)
- Select appropriate test instances based on agent performance
- Track which benchmarks have been used
- Implement progressive difficulty scaling
- Cache benchmark results for efficiency

Task 4: Create evaluation-metrics.ts

Create /shared/orchestration/evolution/evaluation-metrics.ts:
- Track detailed evaluation metrics per agent
- Export metrics to Prometheus format
- Calculate aggregate statistics (success rate, avg time, etc.)
- Track resource usage (CPU, memory, execution time)
- Generate performance reports

Integration Requirements

1. Docker Integration:
   - Each evaluation runs in isolated Docker container
   - Resource limits enforced (CPU, memory, time)
   - Clean container teardown after evaluation
   - Support for both Python and polyglot environments

2. Result Processing:
   - Parse SWE-bench JSON results
   - Extract resolved/unresolved instance IDs
   - Calculate accuracy scores
   - Detect compilation failures
   - Identify context length issues

3. Performance Optimization:
   - Parallel evaluation support (configured in evolution-config.ts)
   - Result caching for repeated evaluations
   - Efficient benchmark data loading
   - Resource pooling for Docker containers

Success Criteria

1. Fitness evaluator can run SWE-bench evaluations
2. Polyglot benchmarks are supported
3. Docker containers are properly managed
4. Evaluation metrics appear in Prometheus
5. Results integrate with evolution engine
6. Parallel evaluations work efficiently
7. Resource limits are enforced

Testing Approach

Create comprehensive tests:
1. Unit test for fitness-evaluator with mock Docker
2. Integration test running actual SWE-bench evaluation
3. Performance test with parallel evaluations
4. Resource limit enforcement test
5. Metrics export verification

Important Notes

- Docker daemon must be running for evaluations
- SWE-bench evaluations can take 5-10 minutes per instance
- Polyglot evaluations are typically faster (1-2 minutes)
- Memory usage can spike during evaluations
- Consider implementing evaluation queuing for resource management
- All evaluation results must be stored for analysis

Next Phase Preview (Phase 5)

After completing the evaluation system, Phase 5 will focus on:
- Self-improvement strategies based on evaluation results
- Automated mutation generation
- Cross-agent knowledge transfer
- Performance optimization techniques
- Advanced archive management strategies