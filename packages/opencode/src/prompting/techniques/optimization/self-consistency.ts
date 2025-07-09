import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
} from "../../types"

export class SelfConsistencyTechnique implements PromptingTechnique {
  id = "self-consistency"
  name = "Self-Consistency"
  category = "optimization" as const
  description =
    "Generates multiple reasoning paths and selects the most consistent answer through voting"

  complexity = "high" as const
  suitableFor: TaskType[] = ["problem_solving", "analysis"]
  requiredCapabilities = []

  metrics = {
    totalExecutions: 0,
    successRate: 0.92,
    averageLatency: 45,
    averageTokenUsage: 2400,
    lastUpdated: Date.now(),
  }

  template = `I'll solve this problem using multiple independent reasoning paths and select the most consistent answer.

{{task}}

## Reasoning Path 1:
[First approach to solving the problem]
Answer 1: [conclusion]

## Reasoning Path 2:
[Second approach using different methodology]
Answer 2: [conclusion]

## Reasoning Path 3:
[Third approach from another perspective]
Answer 3: [conclusion]

## Consistency Analysis:
- Path 1 conclusion: [summary]
- Path 2 conclusion: [summary]
- Path 3 conclusion: [summary]

## Final Answer:
Based on the consistency across multiple reasoning paths, the most reliable answer is: [final answer with confidence level]`

  examples = [
    {
      input: "What is the next number in the sequence: 2, 6, 12, 20, 30, ?",
      output: `I'll solve this problem using multiple independent reasoning paths and select the most consistent answer.

## Reasoning Path 1: Difference Analysis
Looking at differences between consecutive terms:
- 6 - 2 = 4
- 12 - 6 = 6
- 20 - 12 = 8
- 30 - 20 = 10

The differences form a sequence: 4, 6, 8, 10...
This increases by 2 each time, so next difference is 12.
Answer 1: 30 + 12 = 42

## Reasoning Path 2: Pattern Recognition
Examining each term:
- 2 = 1 × 2
- 6 = 2 × 3
- 12 = 3 × 4
- 20 = 4 × 5
- 30 = 5 × 6

Pattern: n × (n+1) where n = 1, 2, 3, 4, 5...
Next term: 6 × 7 = 42
Answer 2: 42

## Reasoning Path 3: Quadratic Formula
Testing if this follows a quadratic pattern an² + bn + c:
Using first three terms to solve:
- When n=1: a + b + c = 2
- When n=2: 4a + 2b + c = 6
- When n=3: 9a + 3b + c = 12

Solving: a = 1, b = 1, c = 0
Formula: n² + n = n(n+1)
For n=6: 6² + 6 = 36 + 6 = 42
Answer 3: 42

## Consistency Analysis:
- Path 1 conclusion: 42 (using difference pattern)
- Path 2 conclusion: 42 (using multiplication pattern)
- Path 3 conclusion: 42 (using quadratic formula)

## Final Answer:
Based on the consistency across all three reasoning paths, the most reliable answer is: 42 (confidence: 100%)`,
    },
  ]

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    // Replace template variables
    let content = this.template.replace("{{task}}", context.task)

    // Add domain-specific guidance
    if (context.variables["domain"]) {
      content = `Domain: ${context.variables["domain"]}\n\n${content}`
    }

    // Add guidance for specific task types
    if (context.variables["taskType"] === "mathematical") {
      content +=
        "\n\nNote: Use different mathematical approaches in each path (algebraic, geometric, numerical)."
    } else if (context.variables["taskType"] === "logical") {
      content +=
        "\n\nNote: Apply different logical frameworks in each path (deductive, inductive, abductive)."
    }

    // Add example for complex tasks
    const taskComplexity = this.assessTaskComplexity(context.task)
    if (taskComplexity > 0.8 && this.examples.length > 0) {
      content = `Example of self-consistency reasoning:\n${this.examples[0].output}\n\nNow for your task:\n\n${content}`
    }

    return {
      content,
      metadata: {
        techniques: [this.id],
        confidence: 0.92,
        estimatedTokens: Math.ceil(content.split(/\s+/).length * 1.3),
        compositionStrategy: "single",
      },
      variables: {
        ...context.variables,
        techniqueApplied: this.id,
        reasoningPaths: 3,
      },
    }
  }

  validate(input: any): boolean {
    // Validate that input is suitable for self-consistency
    if (typeof input !== "string") return false

    // Check minimum length
    if (input.length < 30) return false

    // Check for problem-solving indicators
    const problemIndicators = [
      "solve",
      "calculate",
      "determine",
      "find",
      "what is",
      "analyze",
      "evaluate",
      "prove",
    ]

    const hasProblem = problemIndicators.some((indicator) =>
      input.toLowerCase().includes(indicator),
    )

    // Check if the task has a definitive answer (good for consistency checking)
    const hasDefinitiveAnswer = /\?|find|calculate|determine|what/i.test(input)

    return hasProblem && hasDefinitiveAnswer
  }

  private assessTaskComplexity(task: string): number {
    let score = 0

    // Length factor
    if (task.length > 100) score += 0.2
    if (task.length > 200) score += 0.2

    // Mathematical/logical complexity
    if (/equation|formula|sequence|pattern|proof/i.test(task)) score += 0.3

    // Multiple constraints
    if (/and|but|however|given|where/i.test(task)) score += 0.2

    // Technical depth
    if (/algorithm|optimize|analyze|evaluate/i.test(task)) score += 0.1

    return Math.min(score, 1)
  }
}
