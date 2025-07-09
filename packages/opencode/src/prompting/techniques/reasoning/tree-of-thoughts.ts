import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
} from "../../types"

export class TreeOfThoughtsTechnique implements PromptingTechnique {
  id = "tot"
  name = "Tree of Thoughts (ToT)"
  category = "reasoning" as const
  description =
    "Explores multiple reasoning paths simultaneously, evaluates them, and selects the most promising approach"

  complexity = "high" as const
  suitableFor = ["problem_solving", "exploration", "analysis"] as TaskType[]
  requiredCapabilities = []

  metrics = {
    totalExecutions: 0,
    successRate: 0.88,
    averageLatency: 25,
    averageTokenUsage: 1200,
    lastUpdated: Date.now(),
  }

  template = `Let's explore multiple solution paths for this problem:

{{task}}

## Thought Generation Phase
I'll generate {{branches}} different approaches to solve this:

### Branch 1: {{approach1_name}}
[Describe the first approach and its key steps]
- Pros: [List advantages]
- Cons: [List disadvantages]
- Viability Score: [0-10]

### Branch 2: {{approach2_name}}
[Describe the second approach and its key steps]
- Pros: [List advantages]
- Cons: [List disadvantages]
- Viability Score: [0-10]

### Branch 3: {{approach3_name}}
[Describe the third approach and its key steps]
- Pros: [List advantages]
- Cons: [List disadvantages]
- Viability Score: [0-10]

## Evaluation Phase
Comparing all branches based on:
1. Feasibility
2. Efficiency
3. Completeness
4. Potential risks

## Selection and Deep Dive
Based on the evaluation, Branch {{selected}} appears most promising because:
[Explain selection rationale]

### Detailed Implementation of Selected Branch:
[Provide step-by-step implementation of the chosen approach]

## Alternative Paths
If the selected approach encounters issues, fallback order:
1. Branch {{fallback1}} - [Brief reason]
2. Branch {{fallback2}} - [Brief reason]`

  examples = [
    {
      input:
        "Design a system to efficiently process millions of log entries in real-time",
      output: `Let's explore multiple solution paths for this problem:

Design a system to efficiently process millions of log entries in real-time

## Thought Generation Phase
I'll generate 3 different approaches to solve this:

### Branch 1: Stream Processing Architecture
Build a distributed stream processing system using Apache Kafka and Spark Streaming
- Pros: 
  - Highly scalable and fault-tolerant
  - Built-in exactly-once processing guarantees
  - Rich ecosystem of connectors
- Cons: 
  - Complex infrastructure setup
  - Higher operational overhead
  - Requires specialized expertise
- Viability Score: 8/10

### Branch 2: Serverless Event-Driven Pipeline
Use AWS Lambda/Kinesis or similar cloud-native services
- Pros:
  - No infrastructure management
  - Auto-scaling built-in
  - Pay-per-use pricing model
- Cons:
  - Vendor lock-in
  - Cold start latency issues
  - Limited processing time per function
- Viability Score: 7/10

### Branch 3: Custom In-Memory Processing Engine
Build a lightweight, purpose-built processing engine
- Pros:
  - Full control over optimization
  - Minimal dependencies
  - Can be highly efficient for specific use case
- Cons:
  - Significant development effort
  - Need to handle scaling/fault tolerance
  - Maintenance burden
- Viability Score: 5/10

## Evaluation Phase
Comparing all branches based on:
1. Feasibility - Branch 2 wins (fastest to implement)
2. Efficiency - Branch 1 wins (best performance at scale)
3. Completeness - Branch 1 wins (most features out-of-box)
4. Potential risks - Branch 2 wins (least operational risk)

## Selection and Deep Dive
Based on the evaluation, Branch 1 appears most promising because:
- The scale (millions of logs) demands robust distributed processing
- Fault tolerance is critical for real-time systems
- Long-term scalability outweighs initial complexity

### Detailed Implementation of Selected Branch:
1. Set up Kafka cluster with appropriate partitioning strategy
2. Implement log producers with batching and compression
3. Create Spark Streaming jobs for:
   - Initial parsing and validation
   - Enrichment and transformation
   - Aggregation and analytics
4. Design output sinks (databases, monitoring systems)
5. Implement monitoring and alerting
6. Set up data retention policies

## Alternative Paths
If the selected approach encounters issues, fallback order:
1. Branch 2 - Faster to prototype and validate requirements
2. Branch 3 - If we need ultra-low latency for specific log types`,
    },
    {
      input:
        "Create an algorithm to find the optimal meeting time for a global team across multiple time zones",
      output: `Let's explore multiple solution paths for this problem:

Create an algorithm to find the optimal meeting time for a global team across multiple time zones

## Thought Generation Phase
I'll generate 3 different approaches to solve this:

### Branch 1: Overlap Maximization Algorithm
Find time slots that maximize the number of participants in working hours
- Pros:
  - Ensures most people are in comfortable hours
  - Simple to understand and implement
  - Fair distribution of inconvenience
- Cons:
  - May exclude some team members entirely
  - Doesn't consider individual preferences
  - Binary approach (in/out of working hours)
- Viability Score: 7/10

### Branch 2: Weighted Preference Scoring
Assign scores based on individual preferences and constraints
- Pros:
  - Highly personalized solution
  - Considers work-life balance
  - Can incorporate meeting importance
- Cons:
  - Requires extensive preference data
  - Computationally more complex
  - May favor certain individuals
- Viability Score: 9/10

### Branch 3: Rotation-Based Fairness System
Rotate meeting times to distribute inconvenience equally over time
- Pros:
  - Ensures long-term fairness
  - No one is permanently disadvantaged
  - Builds empathy across team
- Cons:
  - Some meetings will be suboptimal for many
  - Requires tracking historical data
  - May reduce overall attendance
- Viability Score: 6/10

## Evaluation Phase
Comparing all branches based on:
1. Feasibility - Branch 1 wins (simplest implementation)
2. Efficiency - Branch 2 wins (best outcomes per meeting)
3. Completeness - Branch 2 wins (most factors considered)
4. Potential risks - Branch 3 wins (guaranteed fairness)

## Selection and Deep Dive
Based on the evaluation, Branch 2 appears most promising because:
- It provides the most flexible and satisfactory solution
- Can be simplified initially and enhanced over time
- Balances individual needs with team requirements

### Detailed Implementation of Selected Branch:
1. Data Collection Phase:
   - Gather time zones for all participants
   - Collect preference data (preferred hours, hard constraints)
   - Define meeting priority levels

2. Scoring Algorithm:
   - For each possible time slot, calculate a score
   - Add points for participants in preferred hours
   - Add partial points for acceptable hours
   - Subtract penalty points for inconvenient times
   - Weight by participant priority and meeting importance

3. Optimization:
   - Use constraint satisfaction techniques
   - Apply genetic algorithms for large teams
   - Cache results for recurring meetings

4. Output:
   - Top 3 time slots with scores
   - Visualization of impact per person
   - Suggested rotation if scores are close

## Alternative Paths
If the selected approach encounters issues, fallback order:
1. Branch 1 - If preference data is unavailable
2. Branch 3 - For recurring meetings where fairness is paramount`,
    },
  ]

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    // Default number of branches
    const branches = context.variables["branches"] || 3

    // Replace template variables
    let content = this.template
      .replace("{{task}}", context.task)
      .replace(/{{branches}}/g, branches.toString())

    // Generate approach names based on task
    const approachNames = this.generateApproachNames(context.task, branches)
    approachNames.forEach((name, index) => {
      content = content.replace(`{{approach${index + 1}_name}}`, name)
    })

    // Set default selected branch and fallbacks
    content = content
      .replace("{{selected}}", "1")
      .replace("{{fallback1}}", "2")
      .replace("{{fallback2}}", "3")

    // Add domain-specific context
    if (context.variables["domain"]) {
      content = `Domain: ${context.variables["domain"]}\n\n${content}`
    }

    // Add constraints if specified
    if (context.variables["constraints"]) {
      content = content.replace(
        "## Evaluation Phase",
        `## Constraints to Consider\n${context.variables["constraints"]}\n\n## Evaluation Phase`,
      )
    }

    // For complex tasks, prepend an example
    const taskComplexity = this.assessTaskComplexity(context.task)
    if (taskComplexity > 0.8 && this.examples.length > 0) {
      const example = this.examples[0]
      content = `Example of Tree of Thoughts reasoning:\n\nInput: ${example.input}\n\n${example.output}\n\n---\n\nNow applying to your task:\n\n${content}`
    }

    return {
      content,
      metadata: {
        techniques: [this.id],
        confidence: 0.88,
        estimatedTokens: Math.ceil(content.split(/\s+/).length * 1.3),
        compositionStrategy: "tree_exploration",
      },
      variables: {
        ...context.variables,
        techniqueApplied: this.id,
        branchCount: branches,
      },
    }
  }

  validate(input: any): boolean {
    // Validate that input is suitable for ToT
    if (typeof input !== "string") return false

    // ToT is best for complex problems requiring exploration
    if (input.length < 30) return false

    // Check for complexity indicators
    const complexityIndicators = [
      "design",
      "optimize",
      "choose",
      "decide",
      "compare",
      "evaluate",
      "trade-off",
      "alternative",
      "approach",
      "solution",
      "implement",
      "architecture",
      "strategy",
    ]

    const hasComplexity = complexityIndicators.some((indicator) =>
      input.toLowerCase().includes(indicator),
    )

    // Also good for problems with multiple valid solutions
    const multiSolutionIndicators = [
      "best way",
      "optimal",
      "efficient",
      "effective",
      "should i",
      "how to",
      "options",
    ]

    const hasMultiplePaths = multiSolutionIndicators.some((indicator) =>
      input.toLowerCase().includes(indicator),
    )

    return hasComplexity || hasMultiplePaths || input.length > 150
  }

  private assessTaskComplexity(task: string): number {
    let score = 0

    // Length factor
    if (task.length > 100) score += 0.2
    if (task.length > 200) score += 0.3

    // Multiple requirements
    if (/and|with|while|but|however/i.test(task)) score += 0.2

    // Technical complexity
    if (/algorithm|system|architecture|optimize|scale/i.test(task)) score += 0.2

    // Decision-making indicators
    if (/choose|decide|compare|evaluate|trade-off/i.test(task)) score += 0.1

    return Math.min(score, 1)
  }

  private generateApproachNames(task: string, count: number): string[] {
    const taskLower = task.toLowerCase()

    // Domain-specific approach names
    if (taskLower.includes("system") || taskLower.includes("architecture")) {
      return [
        "Distributed Architecture",
        "Monolithic Solution",
        "Microservices Approach",
        "Serverless Design",
        "Hybrid Architecture",
      ].slice(0, count)
    }

    if (taskLower.includes("algorithm") || taskLower.includes("optimize")) {
      return [
        "Greedy Algorithm",
        "Dynamic Programming",
        "Heuristic Approach",
        "Machine Learning Solution",
        "Hybrid Optimization",
      ].slice(0, count)
    }

    if (taskLower.includes("data") || taskLower.includes("process")) {
      return [
        "Batch Processing",
        "Stream Processing",
        "Hybrid ETL Pipeline",
        "Real-time Analytics",
        "Distributed Computing",
      ].slice(0, count)
    }

    // Generic approach names
    return [
      "Direct Approach",
      "Iterative Solution",
      "Comprehensive Framework",
      "Modular Design",
      "Adaptive Strategy",
    ].slice(0, count)
  }
}
