import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
} from "../../types"

export class FewShotTechnique implements PromptingTechnique {
  id = "few-shot"
  name = "Few-Shot Learning"
  category = "generation" as const
  description = "Provides examples to guide the model's output format and style"

  complexity = "low" as const
  suitableFor = ["generation", "refinement"] as TaskType[]
  requiredCapabilities = []

  metrics = {
    totalExecutions: 0,
    successRate: 0.92,
    averageLatency: 10,
    averageTokenUsage: 600,
    lastUpdated: Date.now(),
  }

  template = `Here are some examples of the desired output:

{{examples}}

Now, based on these examples, complete the following task:

{{task}}`

  examples = [
    {
      input: "Generate product descriptions for an e-commerce site",
      output: `Here are some examples of the desired output:

Example 1:
Product: Wireless Bluetooth Headphones
Description: "Experience crystal-clear audio with our premium wireless headphones. Featuring 40-hour battery life, active noise cancellation, and ergonomic design for all-day comfort. Perfect for music lovers and professionals alike."

Example 2:
Product: Stainless Steel Water Bottle
Description: "Stay hydrated in style with our eco-friendly water bottle. Double-wall insulation keeps drinks cold for 24 hours or hot for 12. Leak-proof design and durable construction make it ideal for any adventure."

Example 3:
Product: Organic Cotton T-Shirt
Description: "Comfort meets sustainability in our soft organic cotton tee. Breathable fabric, classic fit, and ethically sourced materials. Available in 12 colors to match your personal style."

Now, based on these examples, complete the following task:

Generate a product description for a smartwatch`,
    },
  ]

  private exampleLibrary = {
    generation: [
      {
        category: "product_description",
        examples: [
          {
            input: "Laptop",
            output:
              "Powerful performance meets portability. Intel i7 processor, 16GB RAM, and 512GB SSD deliver lightning-fast computing. 14-inch display and 10-hour battery perfect for work anywhere.",
          },
          {
            input: "Coffee Maker",
            output:
              "Start your day right with barista-quality coffee at home. Programmable brewing, adjustable strength settings, and thermal carafe keep coffee hot for hours. Simple one-touch operation.",
          },
        ],
      },
      {
        category: "code_generation",
        examples: [
          {
            input: "Function to calculate factorial",
            output:
              "function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}",
          },
          {
            input: "Function to reverse string",
            output:
              "function reverseString(str) {\n  return str.split('').reverse().join('');\n}",
          },
        ],
      },
      {
        category: "email_writing",
        examples: [
          {
            input: "Meeting request",
            output:
              "Subject: Request for Project Discussion\n\nDear [Name],\n\nI hope this email finds you well. I would like to schedule a meeting to discuss our upcoming project milestones.\n\nWould you be available next Tuesday at 2 PM? Please let me know if another time works better.\n\nBest regards,\n[Your name]",
          },
          {
            input: "Follow-up",
            output:
              "Subject: Following Up on Our Discussion\n\nHi [Name],\n\nThank you for taking the time to meet yesterday. As discussed, I'm attaching the project proposal for your review.\n\nPlease feel free to reach out if you have any questions.\n\nBest,\n[Your name]",
          },
        ],
      },
    ],
    refinement: [
      {
        category: "text_improvement",
        examples: [
          {
            input: "The product is good",
            output:
              "This exceptional product exceeds expectations with its superior quality and outstanding performance.",
          },
          {
            input: "The meeting was productive",
            output:
              "The meeting yielded valuable insights and actionable outcomes, advancing our project goals significantly.",
          },
        ],
      },
    ],
  }

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    // Select appropriate examples based on task
    const selectedExamples = this.selectExamples(context)

    // Format examples for the template
    const formattedExamples = selectedExamples
      .map(
        (ex, idx) =>
          `Example ${idx + 1}:\nInput: ${ex.input}\nOutput: ${ex.output}`,
      )
      .join("\n\n")

    // Replace template variables
    let content = this.template
      .replace("{{examples}}", formattedExamples)
      .replace("{{task}}", context.task)

    // Add domain-specific context
    if (context.variables["domain"]) {
      content = `Domain: ${context.variables["domain"]}\n\n${content}`
    }

    // Add format specifications if provided
    if (context.variables["outputFormat"]) {
      content += `\n\nPlease format your response as: ${context.variables["outputFormat"]}`
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
        examplesProvided: selectedExamples.length,
      },
    }
  }

  validate(input: any): boolean {
    // Validate that input is suitable for few-shot learning
    if (typeof input !== "string") return false

    // Check minimum length
    if (input.length < 10) return false

    // Check for generation/creation indicators
    const generationIndicators = [
      "generate",
      "create",
      "write",
      "produce",
      "draft",
      "compose",
      "make",
      "build",
      "design",
      "format",
      "style",
    ]

    return generationIndicators.some((indicator) =>
      input.toLowerCase().includes(indicator),
    )
  }

  private selectExamples(
    context: TechniqueContext,
  ): Array<{ input: string; output: string }> {
    const task = context.task.toLowerCase()
    const purpose = context.variables["purpose"] || "generation"

    // Try to find category-specific examples
    const categoryExamples =
      this.exampleLibrary[purpose as keyof typeof this.exampleLibrary] || []

    for (const category of categoryExamples) {
      // Check if task matches category
      if (task.includes(category.category.replace("_", " "))) {
        return category.examples.slice(0, 3) // Return up to 3 examples
      }
    }

    // Fallback: select based on task keywords

    if (
      task.includes("code") ||
      task.includes("function") ||
      task.includes("program")
    ) {
      const codeExamples = categoryExamples.find(
        (c) => c.category === "code_generation",
      )
      if (codeExamples) return codeExamples.examples.slice(0, 3)
    }

    if (
      task.includes("email") ||
      task.includes("message") ||
      task.includes("letter")
    ) {
      const emailExamples = categoryExamples.find(
        (c) => c.category === "email_writing",
      )
      if (emailExamples) return emailExamples.examples.slice(0, 3)
    }

    if (
      task.includes("product") ||
      task.includes("description") ||
      task.includes("item")
    ) {
      const productExamples = categoryExamples.find(
        (c) => c.category === "product_description",
      )
      if (productExamples) return productExamples.examples.slice(0, 3)
    }

    // Default: return generic examples
    return [
      {
        input: "Task 1",
        output: "Completed output following the required format and style",
      },
      {
        input: "Task 2",
        output: "Another example demonstrating consistency and quality",
      },
      {
        input: "Task 3",
        output: "Final example showing attention to detail and requirements",
      },
    ]
  }
}
