import type {
  TechniqueContext,
  SelectionContext,
  TaskType,
  Capability,
  Constraint,
  PerformanceRecord,
  Example,
} from "../types"

// Test task samples
export const testTasks = {
  simple: {
    analysis: "Analyze this data structure",
    generation: "Write a short story",
    problemSolving: "Calculate the optimal route",
  },
  complex: {
    analysis:
      "Analyze the performance characteristics of this distributed system architecture and identify potential bottlenecks",
    generation:
      "Create a comprehensive technical documentation for a machine learning pipeline including examples and best practices",
    problemSolving:
      "Design an algorithm to optimize resource allocation in a cloud computing environment with dynamic workloads",
    coordination:
      "Coordinate multiple teams to implement a microservices migration strategy",
    refinement:
      "Iteratively improve this codebase for better performance and maintainability",
    exploration:
      "Explore different architectural patterns for building a real-time collaborative editing system",
  },
  multiAgent: {
    distributed:
      "Build a distributed web scraper that processes data across multiple nodes",
    parallel:
      "Implement parallel data processing pipelines for large-scale analytics",
    coordinated:
      "Create a multi-agent system for automated trading with risk management",
  },
}

// Context fixtures
export const createTestContext = (
  overrides: Partial<TechniqueContext> = {},
): TechniqueContext => ({
  task: "Default test task",
  sessionId: "test-session-" + Math.random(),
  agentId: "test-agent-" + Math.random(),
  variables: {},
  constraints: [],
  previousTechniques: [],
  capabilities: [],
  ...overrides,
})

export const createSelectionContext = (
  overrides: Partial<SelectionContext> = {},
): SelectionContext => ({
  sessionId: "test-session-" + Math.random(),
  agentId: "test-agent-" + Math.random(),
  constraints: [],
  ...overrides,
})

// Constraint fixtures
export const testConstraints: Record<string, Constraint[]> = {
  tokenLimit: [{ type: "token_limit", value: 1000 }],
  timeLimit: [{ type: "time_limit", value: 30000 }],
  exclusions: [{ type: "technique_exclusion", value: ["cot", "tot"] }],
  capabilities: [
    { type: "capability_requirement", value: ["sub_agents", "memory"] },
  ],
  combined: [
    { type: "token_limit", value: 2000 },
    { type: "time_limit", value: 60000 },
    { type: "capability_requirement", value: ["tools"] },
  ],
}

// Performance history fixtures
export const createPerformanceHistory = (
  techniqueId: string,
  count: number = 5,
  successRate: number = 0.8,
): PerformanceRecord[] => {
  return Array.from({ length: count }, (_, i) => ({
    techniqueId,
    taskType: ["analysis", "problem_solving", "generation"][i % 3] as TaskType,
    success: Math.random() < successRate,
    latency: 50 + Math.random() * 100,
    timestamp: Date.now() - (count - i) * 60000, // Spread over last N minutes
  }))
}

// Example fixtures for techniques
export const techniqueExamples: Record<string, Example[]> = {
  cot: [
    {
      input: "Calculate the compound interest on $1000 at 5% for 3 years",
      output: `Let's approach this step-by-step:

Step 1: Understand the problem
We need to calculate compound interest where:
- Principal (P) = $1000
- Rate (r) = 5% = 0.05
- Time (t) = 3 years

Step 2: Identify the formula
Compound Interest formula: A = P(1 + r)^t

Step 3: Calculate
A = 1000(1 + 0.05)^3
A = 1000(1.05)^3
A = 1000 × 1.157625
A = $1157.63

Step 4: Find the interest
Interest = A - P = $1157.63 - $1000 = $157.63

Step 5: Verify
The compound interest earned is $157.63`,
    },
  ],
  tot: [
    {
      input: "Design a caching strategy for a high-traffic web application",
      output: `Let's explore multiple solution paths:

Branch 1: Multi-tier Caching
- Browser cache + CDN + Application cache + Database cache
- Pros: Maximum performance, reduced load at each tier
- Cons: Complex cache invalidation, higher cost

Branch 2: Distributed In-Memory Cache
- Redis/Memcached cluster with consistent hashing
- Pros: Fast, scalable, simple invalidation
- Cons: Memory cost, potential data loss

Branch 3: Hybrid Smart Caching
- ML-based predictive caching with hot/cold data separation
- Pros: Optimal resource usage, adaptive
- Cons: Complex implementation, training overhead

Evaluation: Branch 2 offers best balance...`,
    },
  ],
  fewShot: [
    {
      input: "Convert natural language to SQL",
      output: `Example 1:
Input: "Show all users"
Output: SELECT * FROM users;

Example 2:
Input: "Find orders from last week"
Output: SELECT * FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK);

Example 3:
Input: "Count products by category"
Output: SELECT category, COUNT(*) FROM products GROUP BY category;`,
    },
  ],
}

// Variable presets for different scenarios
export const variablePresets = {
  basic: {},
  withDomain: {
    domain: "Software Engineering",
  },
  withExamples: {
    examples: techniqueExamples["fewShot"],
  },
  withRequirements: {
    requirements: ["scalability", "security", "performance"],
    constraints: ["budget: $10000", "timeline: 3 months"],
  },
  complex: {
    domain: "Machine Learning",
    dataset: "ImageNet",
    modelType: "CNN",
    requirements: ["accuracy > 95%", "inference < 100ms"],
    hardware: "GPU cluster",
  },
}

// Capability combinations
export const capabilitySets: Record<string, Capability[]> = {
  none: [],
  basic: ["memory"],
  tools: ["memory", "tools"],
  subAgents: ["memory", "sub_agents"],
  full: ["memory", "tools", "sub_agents", "iteration", "self_reflection"],
}

// Task type combinations for testing
export const taskTypeCombinations: TaskType[][] = [
  ["analysis"],
  ["generation"],
  ["problem_solving"],
  ["analysis", "problem_solving"],
  ["generation", "refinement"],
  ["coordination", "exploration"],
  ["analysis", "problem_solving", "refinement"],
]

// Mock technique configurations
export const mockTechniqueConfig = {
  simple: {
    id: "mock_simple",
    name: "Mock Simple Technique",
    category: "reasoning" as const,
    complexity: "low" as const,
    suitableFor: ["analysis"] as TaskType[],
  },
  complex: {
    id: "mock_complex",
    name: "Mock Complex Technique",
    category: "advanced" as const,
    complexity: "very_high" as const,
    suitableFor: ["problem_solving", "exploration", "refinement"] as TaskType[],
    requiredCapabilities: ["sub_agents", "iteration"] as Capability[],
  },
}

// Test scenarios for integration testing
export const integrationScenarios = [
  {
    name: "Simple Analysis",
    task: testTasks.simple.analysis,
    expectedCategory: "reasoning",
    expectedComplexity: "low" as const,
  },
  {
    name: "Complex Problem Solving",
    task: testTasks.complex.problemSolving,
    expectedCategory: "reasoning",
    expectedComplexity: "high" as const,
  },
  {
    name: "Multi-Agent Coordination",
    task: testTasks.multiAgent.coordinated,
    expectedCategory: "multi_agent",
    expectedComplexity: "very_high" as const,
    requiredCapabilities: ["sub_agents"] as Capability[],
  },
  {
    name: "Creative Generation",
    task: testTasks.complex.generation,
    expectedCategory: "generation",
    expectedComplexity: "medium" as const,
  },
]

// Batch test data generator
export function generateBatchTasks(count: number): string[] {
  const templates = [
    "Analyze the {noun} and identify {attribute}",
    "Generate a {type} for {purpose}",
    "Optimize the {system} to improve {metric}",
    "Design a {solution} that handles {requirement}",
    "Implement {feature} with {constraint}",
  ]

  const nouns = ["system", "algorithm", "database", "network", "application"]
  const attributes = [
    "bottlenecks",
    "patterns",
    "anomalies",
    "trends",
    "issues",
  ]
  const types = ["report", "dashboard", "API", "interface", "workflow"]
  const purposes = [
    "monitoring",
    "analytics",
    "automation",
    "integration",
    "optimization",
  ]
  const systems = ["cache", "queue", "pipeline", "cluster", "service"]
  const metrics = [
    "latency",
    "throughput",
    "reliability",
    "scalability",
    "efficiency",
  ]
  const solutions = ["architecture", "framework", "platform", "tool", "process"]
  const requirements = [
    "high load",
    "real-time updates",
    "fault tolerance",
    "security",
    "compliance",
  ]
  const features = [
    "authentication",
    "logging",
    "caching",
    "routing",
    "validation",
  ]
  const constraints = [
    "low latency",
    "high availability",
    "cost efficiency",
    "backward compatibility",
    "minimal resources",
  ]

  const tasks: string[] = []

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length]
    const task = template
      .replace("{noun}", nouns[Math.floor(Math.random() * nouns.length)])
      .replace(
        "{attribute}",
        attributes[Math.floor(Math.random() * attributes.length)],
      )
      .replace("{type}", types[Math.floor(Math.random() * types.length)])
      .replace(
        "{purpose}",
        purposes[Math.floor(Math.random() * purposes.length)],
      )
      .replace("{system}", systems[Math.floor(Math.random() * systems.length)])
      .replace("{metric}", metrics[Math.floor(Math.random() * metrics.length)])
      .replace(
        "{solution}",
        solutions[Math.floor(Math.random() * solutions.length)],
      )
      .replace(
        "{requirement}",
        requirements[Math.floor(Math.random() * requirements.length)],
      )
      .replace(
        "{feature}",
        features[Math.floor(Math.random() * features.length)],
      )
      .replace(
        "{constraint}",
        constraints[Math.floor(Math.random() * constraints.length)],
      )

    tasks.push(task)
  }

  return tasks
}

// Performance benchmark configurations
export const benchmarkConfigs = {
  small: {
    iterations: 10,
    concurrency: 5,
    taskComplexity: "simple",
  },
  medium: {
    iterations: 50,
    concurrency: 20,
    taskComplexity: "complex",
  },
  large: {
    iterations: 100,
    concurrency: 50,
    taskComplexity: "mixed",
  },
}

// Error injection scenarios for resilience testing
export const errorScenarios = {
  invalidTask: {
    task: "",
    expectedError: "Task cannot be empty",
  },
  missingCapabilities: {
    task: "Coordinate multiple agents",
    constraints: [
      { type: "capability_requirement", value: ["unknown_capability"] },
    ],
    expectedBehavior: "fallback",
  },
  conflictingConstraints: {
    constraints: [
      { type: "technique_exclusion", value: ["cot", "tot", "pal"] },
      { type: "capability_requirement", value: ["reasoning"] },
    ],
    expectedBehavior: "best_effort",
  },
}
