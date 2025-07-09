import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
} from "../../types"

export class ChainOfThoughtTechnique implements PromptingTechnique {
  id = "cot"
  name = "Chain of Thought (CoT)"
  category = "reasoning" as const
  description = "Encourages step-by-step reasoning to solve complex problems"

  complexity = "medium" as const
  suitableFor = ["problem_solving", "analysis", "exploration"] as const
  requiredCapabilities = []

  metrics = {
    totalExecutions: 0,
    successRate: 0.85,
    averageLatency: 15,
    averageTokenUsage: 800,
    lastUpdated: Date.now(),
  }

  template = `Let's approach this step-by-step:

{{task}}

Step 1: Understand the problem
[Analyze what is being asked]

Step 2: Identify key components
[Break down the main elements]

Step 3: Develop a solution approach
[Outline the methodology]

Step 4: Execute the solution
[Work through each part systematically]

Step 5: Verify and conclude
[Check the solution and summarize findings]`

  examples = [
    {
      input: "Calculate the total cost of items with a 15% discount and 8% tax",
      output: `Let's approach this step-by-step:

Step 1: Understand the problem
We need to calculate the final cost after applying a 15% discount and then adding 8% tax.

Step 2: Identify key components
- Original price (let's call it P)
- Discount: 15%
- Tax: 8%
- Order of operations: discount first, then tax

Step 3: Develop a solution approach
1. Calculate discounted price = P × (1 - 0.15) = P × 0.85
2. Calculate tax on discounted price = (P × 0.85) × 0.08
3. Final price = discounted price + tax

Step 4: Execute the solution
- Discounted price = P × 0.85
- Tax amount = (P × 0.85) × 0.08 = P × 0.068
- Final price = P × 0.85 + P × 0.068 = P × 0.918

Step 5: Verify and conclude
The final price is 91.8% of the original price. This makes sense because:
- 15% discount reduces to 85% of original
- 8% tax on 85% adds 6.8% of original
- Total: 85% + 6.8% = 91.8%`,
    },
  ]

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    // Replace template variables
    let content = this.template.replace("{{task}}", context.task)

    // Add any context-specific modifications
    if (context.variables.requiresCode) {
      content += "\n\nNote: Include code examples where appropriate."
    }

    if (context.variables.domain) {
      content = `Domain: ${context.variables.domain}\n\n${content}`
    }

    // Add examples if the task seems complex
    const taskComplexity = this.assessTaskComplexity(context.task)
    if (taskComplexity > 0.7 && this.examples.length > 0) {
      content = `Example of step-by-step reasoning:\n${this.examples[0].output}\n\nNow for your task:\n\n${content}`
    }

    return {
      content,
      metadata: {
        techniques: [this.id],
        confidence: 0.85,
        estimatedTokens: Math.ceil(content.split(/\s+/).length * 1.3),
        compositionStrategy: "single",
      },
      variables: {
        ...context.variables,
        techniqueApplied: this.id,
      },
    }
  }

  validate(input: any): boolean {
    // Validate that input is suitable for CoT
    if (typeof input !== "string") return false

    // Check minimum length (too short tasks don't benefit from CoT)
    if (input.length < 20) return false

    // Check for complexity indicators
    const complexityIndicators = [
      "calculate",
      "analyze",
      "solve",
      "determine",
      "explain",
      "compare",
      "evaluate",
      "design",
    ]

    const hasComplexity = complexityIndicators.some((indicator) =>
      input.toLowerCase().includes(indicator),
    )

    return hasComplexity || input.length > 100
  }

  private assessTaskComplexity(task: string): number {
    let score = 0

    // Length factor
    if (task.length > 100) score += 0.2
    if (task.length > 200) score += 0.2

    // Multiple steps indicated
    if (/\d+\.|step|first|then|finally/i.test(task)) score += 0.3

    // Technical terms
    if (/algorithm|optimize|implement|architecture/i.test(task)) score += 0.2

    // Questions
    if (task.includes("?")) score += 0.1

    return Math.min(score, 1)
  }
}
