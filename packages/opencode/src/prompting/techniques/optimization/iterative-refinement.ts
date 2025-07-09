import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
  Capability,
} from "../../types"

export class IterativeRefinementTechnique implements PromptingTechnique {
  id = "iterative-refinement"
  name = "Iterative Refinement"
  category = "optimization" as const
  description =
    "Progressively improves outputs through multiple refinement passes with targeted feedback"

  complexity = "medium" as const
  suitableFor: TaskType[] = [
    "generation",
    "refinement",
    "analysis",
    "problem_solving",
  ]
  requiredCapabilities: Capability[] = ["iteration"]

  metrics = {
    totalExecutions: 0,
    successRate: 0.88,
    averageLatency: 30,
    averageTokenUsage: 1800,
    lastUpdated: Date.now(),
  }

  template = `I'll solve this task through iterative refinement, progressively improving the solution.

{{task}}

## Initial Attempt:
[First version of the solution]

## Self-Critique Round 1:
Strengths:
- [What works well]
- [Strong points]

Areas for improvement:
- [What could be better]
- [Missing elements]
- [Quality issues]

## Refined Version 1:
[Improved solution addressing the critiques]

## Self-Critique Round 2:
Remaining issues:
- [Any lingering problems]
- [Further optimizations possible]

Quality check:
- Completeness: [score/10]
- Accuracy: [score/10]
- Clarity: [score/10]

## Final Refined Version:
[Final polished solution incorporating all improvements]

## Summary of Improvements:
- [Key enhancement 1]
- [Key enhancement 2]
- [Key enhancement 3]`

  examples = [
    {
      input: "Write a function to validate email addresses",
      output: `I'll solve this task through iterative refinement, progressively improving the solution.

## Initial Attempt:
\`\`\`javascript
function validateEmail(email) {
  return email.includes('@') && email.includes('.');
}
\`\`\`

## Self-Critique Round 1:
Strengths:
- Simple and readable
- Checks for basic email components

Areas for improvement:
- Too simplistic - many invalid emails would pass
- No regex pattern matching
- Doesn't check for proper structure
- No input validation

## Refined Version 1:
\`\`\`javascript
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
\`\`\`

## Self-Critique Round 2:
Remaining issues:
- Regex could be more comprehensive
- Doesn't handle edge cases (consecutive dots, special characters)
- No length validation
- Could add more specific error feedback

Quality check:
- Completeness: 7/10
- Accuracy: 8/10
- Clarity: 9/10

## Final Refined Version:
\`\`\`javascript
function validateEmail(email) {
  // Input validation
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email must be a non-empty string' };
  }
  
  // Length constraints
  if (email.length > 254) {
    return { valid: false, error: 'Email exceeds maximum length' };
  }
  
  // Comprehensive regex pattern
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  // Additional checks
  const [localPart, domain] = email.split('@');
  if (localPart.length > 64) {
    return { valid: false, error: 'Local part exceeds maximum length' };
  }
  
  return { valid: true, email: email.toLowerCase() };
}
\`\`\`

## Summary of Improvements:
- Added comprehensive input validation with error messages
- Implemented RFC-compliant regex pattern
- Added length constraints per email standards
- Returned detailed validation results instead of just boolean
- Made the function more robust and production-ready`,
    },
  ]

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    // Replace template variables
    let content = this.template.replace("{{task}}", context.task)

    // Add domain-specific guidance
    if (context.variables["domain"]) {
      content = `Domain: ${context.variables["domain"]}\n\n${content}`
    }

    // Add refinement focus based on task type
    if (context.variables["refinementFocus"]) {
      content += `\n\nRefinement Focus: ${context.variables["refinementFocus"]}`
    } else if (context.task.toLowerCase().includes("code")) {
      content +=
        "\n\nRefinement Focus: Code quality, error handling, performance, and documentation"
    } else if (context.task.toLowerCase().includes("write")) {
      content += "\n\nRefinement Focus: Clarity, coherence, grammar, and impact"
    }

    // Add iteration count guidance
    const iterationCount = context.variables["iterations"] || 2
    if (iterationCount > 2) {
      content = content.replace(
        "## Self-Critique Round 2:",
        `## Self-Critique Round 2:\n[Continue with ${iterationCount - 2} more refinement rounds]\n\n## Self-Critique Round ${iterationCount}:`,
      )
    }

    // Add example for complex tasks
    const taskComplexity = this.assessTaskComplexity(context.task)
    if (taskComplexity > 0.7 && this.examples.length > 0) {
      content = `Example of iterative refinement:\n${this.examples[0].output}\n\nNow for your task:\n\n${content}`
    }

    return {
      content,
      metadata: {
        techniques: [this.id],
        confidence: 0.88,
        estimatedTokens: Math.ceil(content.split(/\s+/).length * 1.3),
        compositionStrategy: "single",
      },
      variables: {
        ...context.variables,
        techniqueApplied: this.id,
        refinementRounds: iterationCount,
      },
    }
  }

  validate(input: any): boolean {
    // Validate that input is suitable for iterative refinement
    if (typeof input !== "string") return false

    // Check minimum length
    if (input.length < 20) return false

    // Check for generation/creation indicators
    const generationIndicators = [
      "write",
      "create",
      "generate",
      "design",
      "develop",
      "implement",
      "build",
      "compose",
      "draft",
      "improve",
      "refine",
      "optimize",
    ]

    const hasGeneration = generationIndicators.some((indicator) =>
      input.toLowerCase().includes(indicator),
    )

    return hasGeneration
  }

  private assessTaskComplexity(task: string): number {
    let score = 0

    // Length factor
    if (task.length > 100) score += 0.2
    if (task.length > 200) score += 0.2

    // Multiple requirements
    if (/and|with|including|must|should/i.test(task)) score += 0.2

    // Quality indicators
    if (/quality|robust|production|professional|comprehensive/i.test(task))
      score += 0.2

    // Technical complexity
    if (/algorithm|architecture|system|framework/i.test(task)) score += 0.2

    return Math.min(score, 1)
  }
}
