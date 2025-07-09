import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  CompositionStrategy,
  ValidationResult,
} from "../types"

export class PromptComposer {
  private compositionCache: Map<string, EnhancedPrompt> = new Map()

  async compose(
    techniques: PromptingTechnique[],
    context: TechniqueContext,
    strategy?: CompositionStrategy,
  ): Promise<EnhancedPrompt> {
    const start = performance.now()

    // Generate cache key
    const cacheKey = this.generateCacheKey(techniques, context)

    // Check cache
    const cached = this.compositionCache.get(cacheKey)
    if (cached) {
      return cached
    }

    // Determine composition strategy if not provided
    const compositionStrategy = strategy || this.inferStrategy(techniques)

    // Compose based on strategy
    let enhanced: EnhancedPrompt

    switch (compositionStrategy.type) {
      case "sequential":
        enhanced = await this.composeSequential(techniques, context)
        break
      case "parallel":
        enhanced = await this.composeParallel(techniques, context)
        break
      case "nested":
        enhanced = await this.composeNested(techniques, context)
        break
      case "conditional":
        enhanced = await this.composeConditional(
          techniques,
          context,
          compositionStrategy,
        )
        break
      default:
        enhanced = await this.composeSequential(techniques, context)
    }

    // Validate composition
    const validation = this.validate(enhanced)
    if (!validation.valid) {
      console.warn("Composition validation failed:", validation.errors)
      enhanced = await this.fallbackComposition(techniques, context)
    }

    // Optimize if needed
    if (enhanced.metadata.estimatedTokens > 4000) {
      enhanced = await this.optimize(enhanced)
    }

    // Cache result
    this.compositionCache.set(cacheKey, enhanced)

    const duration = performance.now() - start

    return enhanced
  }

  validate(prompt: EnhancedPrompt): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check content
    if (!prompt.content || prompt.content.trim().length === 0) {
      errors.push("Prompt content is empty")
    }

    // Check token estimate
    if (prompt.metadata.estimatedTokens > 8000) {
      warnings.push("Prompt may exceed model token limits")
      suggestions.push("Consider breaking into smaller prompts")
    }

    // Check technique metadata
    if (prompt.metadata.techniques.length === 0) {
      warnings.push("No techniques recorded in metadata")
    }

    // Check for variable placeholders
    const unresolvedVars = this.findUnresolvedVariables(prompt.content)
    if (unresolvedVars.length > 0) {
      errors.push(`Unresolved variables: ${unresolvedVars.join(", ")}`)
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    }
  }

  async optimize(prompt: EnhancedPrompt): Promise<EnhancedPrompt> {
    let optimizedContent = prompt.content

    // Remove redundant whitespace
    optimizedContent = optimizedContent.replace(/\s+/g, " ").trim()

    // Remove duplicate instructions
    optimizedContent = this.removeDuplicateInstructions(optimizedContent)

    // Compress examples if present
    optimizedContent = this.compressExamples(optimizedContent)

    // Update token estimate
    const newTokenEstimate = this.estimateTokens(optimizedContent)

    return {
      ...prompt,
      content: optimizedContent,
      metadata: {
        ...prompt.metadata,
        estimatedTokens: newTokenEstimate,
      },
    }
  }

  private async composeSequential(
    techniques: PromptingTechnique[],
    context: TechniqueContext,
  ): Promise<EnhancedPrompt> {
    let composedContent = ""
    const allVariables: Record<string, any> = {}
    const techniqueIds: string[] = []

    // Apply each technique in sequence
    for (const technique of techniques) {
      const techniqueContext = {
        ...context,
        previousTechniques: techniqueIds,
      }

      const result = await technique.apply(techniqueContext)

      // Append content with separator
      if (composedContent) {
        composedContent += "\n\n"
      }
      composedContent += result.content

      // Merge variables
      Object.assign(allVariables, result.variables)

      // Track technique
      techniqueIds.push(technique.id)
    }

    return {
      content: composedContent,
      metadata: {
        techniques: techniqueIds,
        confidence: this.calculateCompositionConfidence(techniques),
        estimatedTokens: this.estimateTokens(composedContent),
        compositionStrategy: "sequential",
      },
      variables: allVariables,
    }
  }

  private async composeParallel(
    techniques: PromptingTechnique[],
    context: TechniqueContext,
  ): Promise<EnhancedPrompt> {
    // Apply all techniques in parallel
    const results = await Promise.all(
      techniques.map((technique) => technique.apply(context)),
    )

    // Merge results
    const sections: string[] = []
    const allVariables: Record<string, any> = {}

    for (let i = 0; i < techniques.length; i++) {
      const technique = techniques[i]
      const result = results[i]

      // Create section header
      sections.push(`## ${technique.name}\n\n${result.content}`)

      // Merge variables
      Object.assign(allVariables, result.variables)
    }

    const composedContent = sections.join("\n\n---\n\n")

    return {
      content: composedContent,
      metadata: {
        techniques: techniques.map((t) => t.id),
        confidence: this.calculateCompositionConfidence(techniques),
        estimatedTokens: this.estimateTokens(composedContent),
        compositionStrategy: "parallel",
      },
      variables: allVariables,
    }
  }

  private async composeNested(
    techniques: PromptingTechnique[],
    context: TechniqueContext,
  ): Promise<EnhancedPrompt> {
    if (techniques.length === 0) {
      throw new Error("No techniques provided for nested composition")
    }

    // Start with the first technique
    let currentResult = await techniques[0].apply(context)
    const techniqueIds = [techniques[0].id]

    // Nest each subsequent technique
    for (let i = 1; i < techniques.length; i++) {
      const technique = techniques[i]

      // Create nested context with previous result
      const nestedContext: TechniqueContext = {
        ...context,
        task: currentResult.content,
        variables: { ...context.variables, ...currentResult.variables },
        previousTechniques: techniqueIds,
      }

      currentResult = await technique.apply(nestedContext)
      techniqueIds.push(technique.id)
    }

    return {
      content: currentResult.content,
      metadata: {
        techniques: techniqueIds,
        confidence: this.calculateCompositionConfidence(techniques),
        estimatedTokens: this.estimateTokens(currentResult.content),
        compositionStrategy: "nested",
      },
      variables: currentResult.variables,
    }
  }

  private async composeConditional(
    techniques: PromptingTechnique[],
    context: TechniqueContext,
    strategy: CompositionStrategy,
  ): Promise<EnhancedPrompt> {
    // For now, fall back to sequential
    // In a full implementation, this would evaluate conditions
    return this.composeSequential(techniques, context)
  }

  private async fallbackComposition(
    techniques: PromptingTechnique[],
    context: TechniqueContext,
  ): Promise<EnhancedPrompt> {
    // Simple fallback: just use the task as-is with first technique
    if (techniques.length > 0) {
      return techniques[0].apply(context)
    }

    // Ultimate fallback
    return {
      content: context.task,
      metadata: {
        techniques: [],
        confidence: 0.3,
        estimatedTokens: this.estimateTokens(context.task),
        compositionStrategy: "fallback",
      },
      variables: context.variables,
    }
  }

  private generateCacheKey(
    techniques: PromptingTechnique[],
    context: TechniqueContext,
  ): string {
    const techniqueIds = techniques
      .map((t) => t.id)
      .sort()
      .join(",")
    const taskHash = this.simpleHash(context.task)
    return `${techniqueIds}:${taskHash}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  private inferStrategy(techniques: PromptingTechnique[]): CompositionStrategy {
    // Simple inference based on technique characteristics
    const hasMultiAgent = techniques.some((t) => t.category === "multi_agent")
    const hasChaining = techniques.some((t) => t.id === "prompt_chaining")

    if (hasChaining) {
      return { type: "nested" }
    }

    if (hasMultiAgent && techniques.length > 1) {
      return { type: "parallel" }
    }

    return { type: "sequential" }
  }

  private calculateCompositionConfidence(
    techniques: PromptingTechnique[],
  ): number {
    if (techniques.length === 0) return 0

    // Average the success rates of all techniques
    const totalSuccess = techniques.reduce(
      (sum, t) => sum + (t.metrics.successRate || 0.7),
      0,
    )

    return totalSuccess / techniques.length
  }

  private estimateTokens(content: string): number {
    // Rough estimation: ~1.3 tokens per word
    const words = content.split(/\s+/).length
    return Math.ceil(words * 1.3)
  }

  private findUnresolvedVariables(content: string): string[] {
    const variablePattern = /\{\{(\w+)\}\}/g
    const unresolved: string[] = []

    let match
    while ((match = variablePattern.exec(content)) !== null) {
      unresolved.push(match[1])
    }

    return unresolved
  }

  private removeDuplicateInstructions(content: string): string {
    const lines = content.split("\n")
    const seen = new Set<string>()
    const unique: string[] = []

    for (const line of lines) {
      const normalized = line.trim().toLowerCase()
      if (!seen.has(normalized) || line.trim() === "") {
        seen.add(normalized)
        unique.push(line)
      }
    }

    return unique.join("\n")
  }

  private compressExamples(content: string): string {
    // Simple compression: limit examples to first 2
    const examplePattern = /Example \d+:/gi
    const matches = content.match(examplePattern)

    if (matches && matches.length > 2) {
      // Find and remove examples after the second one
      let exampleCount = 0
      return content.replace(examplePattern, (match) => {
        exampleCount++
        return exampleCount > 2 ? "" : match
      })
    }

    return content
  }
}
