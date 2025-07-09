import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
} from "../../types"

export class ActivePromptTechnique implements PromptingTechnique {
  id = "active-prompt"
  name = "Active Prompt"
  category = "optimization" as const
  description = "Dynamically selects the most relevant examples based on task similarity and uncertainty sampling"

  complexity = "high" as const
  suitableFor: TaskType[] = ["problem_solving", "analysis", "generation", "refinement"]
  requiredCapabilities = []

  metrics = {
    totalExecutions: 0,
    successRate: 0.90,
    averageLatency: 35,
    averageTokenUsage: 2000,
    lastUpdated: Date.now(),
  }

  template = `I'll solve this using active prompting, selecting the most relevant examples for your specific task.

{{task}}

## Task Analysis:
- Task Type: [identified type]
- Key Requirements: [main requirements]
- Complexity Level: [assessed complexity]
- Domain: [identified domain]

## Selected Examples:
Based on your task, here are the most relevant examples:

{{selectedExamples}}

## Solution Approach:
Drawing from the selected examples, I'll apply the following strategy:

1. [Key insight from examples]
2. [Adapted approach for this task]
3. [Specific techniques to use]

## Implementation:
[Solution tailored to the specific task using insights from selected examples]

## Confidence Assessment:
- Example Relevance: [score/10]
- Approach Confidence: [score/10]
- Expected Success Rate: [percentage]`

  // Rich example pool for dynamic selection
  private examplePool = [
    {
      category: "algorithm",
      domain: "optimization",
      input: "Optimize a sorting algorithm for nearly sorted data",
      output: `For nearly sorted data, adaptive algorithms perform best:
1. Insertion Sort: O(n) for nearly sorted data
2. TimSort: Detects and exploits existing order
3. Bubble Sort with early termination: Simple but effective

Implementation: Use insertion sort with binary search for optimal performance.`,
      features: ["sorting", "optimization", "algorithm", "performance"],
    },
    {
      category: "data_structure",
      domain: "design",
      input: "Design a data structure for autocomplete functionality",
      output: `Trie (Prefix Tree) is ideal for autocomplete:
- Fast prefix matching: O(m) where m is prefix length
- Memory efficient for shared prefixes
- Supports ranking and frequency tracking

Enhanced with: Priority queue for top-k suggestions, caching for common queries.`,
      features: ["data structure", "search", "autocomplete", "trie"],
    },
    {
      category: "system_design",
      domain: "architecture",
      input: "Design a rate limiting system",
      output: `Token Bucket algorithm with Redis:
- Distributed rate limiting across servers
- Configurable burst capacity
- Sliding window for smooth throttling

Components: Redis for state, middleware for enforcement, monitoring for analytics.`,
      features: ["rate limiting", "distributed", "system design", "redis"],
    },
    {
      category: "debugging",
      domain: "problem_solving",
      input: "Debug a memory leak in a web application",
      output: `Systematic approach:
1. Profile with Chrome DevTools heap snapshots
2. Identify retained objects and reference chains
3. Common culprits: event listeners, closures, DOM references
4. Fix: Proper cleanup in lifecycle methods

Tools: Memory profiler, heap dump analysis, weak references where appropriate.`,
      features: ["debugging", "memory", "web", "performance"],
    },
    {
      category: "refactoring",
      domain: "code_quality",
      input: "Refactor a complex nested conditional structure",
      output: `Strategy Pattern approach:
1. Extract condition checks to predicate functions
2. Map conditions to strategy objects
3. Use polymorphism over conditionals

Result: Extensible, testable, and readable code with single responsibility.`,
      features: ["refactoring", "design patterns", "clean code", "conditionals"],
    },
  ]

  examples = [
    {
      input: "Create a caching strategy for a high-traffic API",
      output: `I'll solve this using active prompting, selecting the most relevant examples for your specific task.

## Task Analysis:
- Task Type: System design and optimization
- Key Requirements: Caching, high-traffic handling, API performance
- Complexity Level: High
- Domain: Backend architecture

## Selected Examples:
Based on your task, here are the most relevant examples:

1. **Rate Limiting System** (Relevance: 85%)
   - Shows distributed state management with Redis
   - Demonstrates high-traffic handling patterns
   - Provides performance optimization insights

2. **Autocomplete Data Structure** (Relevance: 70%)
   - Illustrates caching strategies for frequent queries
   - Shows memory-efficient design patterns
   - Demonstrates response time optimization

## Solution Approach:
Drawing from the selected examples, I'll apply the following strategy:

1. Use Redis for distributed caching (from rate limiting example)
2. Implement multi-tier caching (from autocomplete optimization)
3. Apply intelligent cache invalidation strategies

## Implementation:
Multi-tier caching strategy:

**L1 Cache: Application Memory (LRU)**
- Size: 1000 entries
- TTL: 60 seconds
- For hot data and frequent queries

**L2 Cache: Redis Cluster**
- TTL: 5 minutes
- Distributed across nodes
- Supports cache warming and preloading

**L3 Cache: CDN**
- For static and semi-static content
- Geographic distribution
- 24-hour TTL with purge API

**Cache Key Strategy:**
\`\`\`
api:v1:{endpoint}:{hash(params)}:{user_segment}
\`\`\`

**Invalidation Strategy:**
- Tag-based invalidation
- Event-driven updates
- Graceful degradation on cache miss

## Confidence Assessment:
- Example Relevance: 8/10
- Approach Confidence: 9/10
- Expected Success Rate: 95%`,
    },
  ]

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    // Select most relevant examples based on task
    const selectedExamples = this.selectRelevantExamples(context.task, 2)
    
    // Format selected examples
    const examplesText = selectedExamples
      .map((ex, idx) => `${idx + 1}. **${ex.input}** (Relevance: ${ex.relevance}%)
   ${ex.output}`)
      .join("\n\n")

    // Replace template variables
    let content = this.template
      .replace("{{task}}", context.task)
      .replace("{{selectedExamples}}", examplesText)

    // Add domain-specific guidance
    if (context.variables["domain"]) {
      content = `Domain: ${context.variables["domain"]}\n\n${content}`
    }

    // Add uncertainty sampling guidance
    if (context.variables["uncertaintyThreshold"]) {
      content += `\n\nUncertainty Threshold: ${context.variables["uncertaintyThreshold"]}
Note: Additional examples will be selected if confidence drops below threshold.`
    }

    // Add example for demonstration
    const taskComplexity = this.assessTaskComplexity(context.task)
    if (taskComplexity > 0.8 && this.examples.length > 0) {
      content = `Example of active prompting:\n${this.examples[0].output}\n\nNow for your task:\n\n${content}`
    }

    return {
      content,
      metadata: {
        techniques: [this.id],
        confidence: 0.90,
        estimatedTokens: Math.ceil(content.split(/\s+/).length * 1.3),
        compositionStrategy: "single",
      },
      variables: {
        ...context.variables,
        techniqueApplied: this.id,
        selectedExampleCount: selectedExamples.length,
      },
    }
  }

  validate(input: any): boolean {
    // Validate that input is suitable for active prompting
    if (typeof input !== "string") return false

    // Check minimum length
    if (input.length < 20) return false

    // Active prompting works well for most task types
    // but needs sufficient complexity to benefit from example selection
    return input.length > 50 || /how|what|create|design|implement|solve/i.test(input)
  }

  private selectRelevantExamples(task: string, count: number): Array<any> {
    // Calculate relevance scores for each example
    const scoredExamples = this.examplePool.map(example => {
      const score = this.calculateRelevance(task, example)
      return { ...example, relevance: Math.round(score * 100) }
    })

    // Sort by relevance and select top examples
    return scoredExamples
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, count)
  }

  private calculateRelevance(task: string, example: any): number {
    const taskLower = task.toLowerCase()
    let score = 0

    // Check feature overlap
    const featureMatches = example.features.filter((feature: string) =>
      taskLower.includes(feature.toLowerCase())
    ).length
    score += featureMatches * 0.3

    // Check domain similarity
    if (example.domain && taskLower.includes(example.domain)) {
      score += 0.2
    }

    // Check category match
    if (example.category) {
      const categoryKeywords = {
        algorithm: ["algorithm", "optimize", "performance", "complexity"],
        data_structure: ["structure", "store", "organize", "access"],
        system_design: ["design", "scale", "distributed", "architecture"],
        debugging: ["debug", "fix", "error", "issue", "problem"],
        refactoring: ["refactor", "improve", "clean", "maintain"],
      }

      const keywords = categoryKeywords[example.category as keyof typeof categoryKeywords] || []
      const keywordMatches = keywords.filter(keyword => taskLower.includes(keyword)).length
      score += (keywordMatches / keywords.length) * 0.3
    }

    // Length similarity bonus
    const lengthRatio = Math.min(task.length, example.input.length) / 
                       Math.max(task.length, example.input.length)
    score += lengthRatio * 0.2

    return Math.min(score, 1)
  }

  private assessTaskComplexity(task: string): number {
    let score = 0

    // Length factor
    if (task.length > 100) score += 0.2
    if (task.length > 200) score += 0.2

    // Technical indicators
    if (/algorithm|optimize|scale|distributed|architecture/i.test(task)) score += 0.3

    // Multiple requirements
    if (/and|with|including|must|should/i.test(task)) score += 0.2

    // Domain complexity
    if (/system|design|debug|refactor/i.test(task)) score += 0.1

    return Math.min(score, 1)
  }
}
