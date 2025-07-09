import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
} from "../../types"

export class PersonaTechnique implements PromptingTechnique {
  id = "persona"
  name = "Persona-Based Prompting"
  category = "generation" as const
  description =
    "Assigns a specific role or persona to guide the model's response style and expertise"

  complexity = "low" as const
  suitableFor = ["generation", "exploration"] as TaskType[]
  requiredCapabilities = []

  metrics = {
    totalExecutions: 0,
    successRate: 0.88,
    averageLatency: 8,
    averageTokenUsage: 500,
    lastUpdated: Date.now(),
  }

  template = `You are {{persona}}.

{{persona_description}}

With this expertise and perspective, please address the following:

{{task}}`

  examples = [
    {
      input: "Explain quantum computing to a beginner",
      output: `You are a patient physics teacher with 20 years of experience making complex topics accessible.

You excel at using everyday analogies and breaking down concepts into digestible pieces. You never assume prior knowledge and always check for understanding.

With this expertise and perspective, please address the following:

Explain quantum computing to a beginner`,
    },
  ]

  private personaLibrary = {
    expert: {
      name: "a domain expert with deep technical knowledge",
      description:
        "You have extensive experience and theoretical understanding in your field. You provide accurate, detailed explanations while maintaining clarity. You cite best practices and industry standards when relevant.",
    },
    teacher: {
      name: "an experienced educator",
      description:
        "You excel at breaking down complex topics into understandable concepts. You use analogies, examples, and progressive disclosure to build understanding. You're patient and encouraging, always checking for comprehension.",
    },
    critic: {
      name: "a thoughtful critic and analyst",
      description:
        "You provide balanced, constructive analysis. You identify strengths and weaknesses objectively, suggest improvements, and consider multiple perspectives. Your feedback is specific and actionable.",
    },
    creative: {
      name: "a creative professional",
      description:
        "You think outside conventional boundaries and generate innovative ideas. You combine unexpected elements, explore possibilities, and aren't afraid to suggest bold or unconventional approaches.",
    },
    researcher: {
      name: "a meticulous researcher",
      description:
        "You approach topics systematically, considering evidence and sources carefully. You acknowledge uncertainties, present multiple viewpoints, and distinguish between facts and interpretations.",
    },
    consultant: {
      name: "a strategic consultant",
      description:
        "You focus on practical solutions and actionable recommendations. You consider constraints, trade-offs, and implementation challenges. Your advice is tailored to specific contexts and goals.",
    },
    storyteller: {
      name: "a compelling storyteller",
      description:
        "You craft engaging narratives that capture attention and convey meaning. You use vivid descriptions, relatable characters, and emotional resonance to make your points memorable.",
    },
    debugger: {
      name: "an experienced debugger and problem solver",
      description:
        "You systematically analyze problems, identify root causes, and propose solutions. You think through edge cases, potential failures, and validation strategies. Your approach is methodical and thorough.",
    },
    architect: {
      name: "a systems architect",
      description:
        "You design elegant, scalable solutions. You consider long-term implications, integration points, and maintainability. You balance ideal solutions with practical constraints.",
    },
    mentor: {
      name: "a supportive mentor",
      description:
        "You guide growth and development with wisdom and encouragement. You ask thought-provoking questions, share relevant experiences, and help others discover their own solutions.",
    },
  }

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    // Select appropriate persona based on task
    const selectedPersona = this.selectPersona(context)

    // Replace template variables
    let content = this.template
      .replace(/{{persona}}/g, selectedPersona.name)
      .replace("{{persona_description}}", selectedPersona.description)
      .replace("{{task}}", context.task)

    // Add domain-specific modifications
    if (context.variables["domain"]) {
      const domainAddition = ` specializing in ${context.variables["domain"]}`
      content = content.replace(
        selectedPersona.name,
        selectedPersona.name + domainAddition,
      )
    }

    // Add any specific requirements
    if (context.variables["tone"]) {
      content += `\n\nPlease maintain a ${context.variables["tone"]} tone throughout your response.`
    }

    if (context.variables["audience"]) {
      content += `\n\nYour audience is: ${context.variables["audience"]}`
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
        personaUsed: selectedPersona.name,
      },
    }
  }

  validate(input: any): boolean {
    // Validate that input is suitable for persona-based approach
    if (typeof input !== "string") return false

    // Check minimum length
    if (input.length < 10) return false

    // Check for indicators that benefit from persona
    const personaIndicators = [
      "explain",
      "analyze",
      "create",
      "design",
      "review",
      "teach",
      "guide",
      "help",
      "suggest",
      "evaluate",
      "write",
      "develop",
    ]

    return personaIndicators.some((indicator) =>
      input.toLowerCase().includes(indicator),
    )
  }

  private selectPersona(context: TechniqueContext): {
    name: string
    description: string
  } {
    const task = context.task.toLowerCase()
    const requestedPersona = context.variables["persona"]

    // If specific persona requested, use it
    if (
      requestedPersona &&
      this.personaLibrary[requestedPersona as keyof typeof this.personaLibrary]
    ) {
      return this.personaLibrary[
        requestedPersona as keyof typeof this.personaLibrary
      ]
    }

    // Otherwise, infer from task
    if (
      task.includes("teach") ||
      task.includes("explain") ||
      task.includes("tutorial")
    ) {
      return this.personaLibrary.teacher
    }

    if (
      task.includes("debug") ||
      task.includes("fix") ||
      task.includes("error") ||
      task.includes("problem")
    ) {
      return this.personaLibrary.debugger
    }

    if (
      task.includes("review") ||
      task.includes("analyze") ||
      task.includes("evaluate") ||
      task.includes("critique")
    ) {
      return this.personaLibrary.critic
    }

    if (
      task.includes("design") ||
      task.includes("architect") ||
      task.includes("structure") ||
      task.includes("system")
    ) {
      return this.personaLibrary.architect
    }

    if (
      task.includes("create") ||
      task.includes("generate") ||
      task.includes("imagine") ||
      task.includes("innovative")
    ) {
      return this.personaLibrary.creative
    }

    if (
      task.includes("research") ||
      task.includes("investigate") ||
      task.includes("study") ||
      task.includes("explore")
    ) {
      return this.personaLibrary.researcher
    }

    if (
      task.includes("story") ||
      task.includes("narrative") ||
      task.includes("tale") ||
      task.includes("scenario")
    ) {
      return this.personaLibrary.storyteller
    }

    if (
      task.includes("consult") ||
      task.includes("advise") ||
      task.includes("recommend") ||
      task.includes("strategy")
    ) {
      return this.personaLibrary.consultant
    }

    if (
      task.includes("mentor") ||
      task.includes("guide") ||
      task.includes("coach") ||
      task.includes("develop")
    ) {
      return this.personaLibrary.mentor
    }

    // Default to expert for general tasks
    return this.personaLibrary.expert
  }
}
