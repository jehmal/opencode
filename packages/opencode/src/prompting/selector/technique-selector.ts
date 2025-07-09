import type {
  PromptingTechnique,
  TaskAnalysis,
  SelectionContext,
  SelectedTechniques,
  TechniqueScore,
  TaskType,
  ComplexityLevel,
  Capability,
  CompositionStrategy,
} from "../types"
import { techniqueTracker } from "../learning/technique-tracker"
import { techniqueRecommender } from "../learning/technique-recommender"

export class TechniqueSelector {
  private techniqueScores: Map<string, Map<TaskType, number>> = new Map()

  async initialize(): Promise<void> {
    await techniqueTracker.initialize()
    await techniqueRecommender.initialize()
  }

  async analyze(
    task: string,
    context: SelectionContext,
  ): Promise<TaskAnalysis> {
    const start = performance.now()

    // Analyze task characteristics
    const taskTypes = this.identifyTaskTypes(task)
    const complexity = this.assessComplexity(task)
    const capabilities = this.identifyRequiredCapabilities(task, context)
    const estimatedTokens = this.estimateTokens(task)

    // Get suggested techniques based on analysis
    const suggestedTechniques = await this.getSuggestedTechniques(
      taskTypes,
      complexity,
      capabilities,
      context,
    )

    const confidence = this.calculateConfidence(taskTypes, suggestedTechniques)

    const duration = performance.now() - start

    return {
      taskType: taskTypes,
      complexity,
      requiredCapabilities: capabilities,
      estimatedTokens,
      suggestedTechniques,
      confidence,
    }
  }

  async select(
    analysis: TaskAnalysis,
    availableTechniques: PromptingTechnique[],
  ): Promise<SelectedTechniques> {
    // Score and rank techniques
    const scores = this.rank(availableTechniques, analysis)

    // Select primary techniques
    const primary = this.selectPrimary(scores, analysis)

    // Select fallback techniques
    const fallback = this.selectFallback(scores, primary, analysis)

    // Determine composition strategy
    const composition = this.determineComposition(primary, analysis)

    return {
      primary,
      fallback,
      composition,
    }
  }

  rank(techniques: PromptingTechnique[], task: TaskAnalysis): TechniqueScore[] {
    const scores: TechniqueScore[] = []

    for (const technique of techniques) {
      const score = this.scoreTechnique(technique, task)
      const reasons = this.explainScore(technique, task, score)

      scores.push({
        technique,
        score,
        reasons,
      })
    }

    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score)
  }

  private identifyTaskTypes(task: string): TaskType[] {
    const types: TaskType[] = []
    const taskLower = task.toLowerCase()

    // Pattern matching for task types
    if (taskLower.includes("analyze") || taskLower.includes("examine")) {
      types.push("analysis")
    }
    if (
      taskLower.includes("create") ||
      taskLower.includes("generate") ||
      taskLower.includes("write")
    ) {
      types.push("generation")
    }
    if (
      taskLower.includes("solve") ||
      taskLower.includes("fix") ||
      taskLower.includes("debug")
    ) {
      types.push("problem_solving")
    }
    if (
      taskLower.includes("coordinate") ||
      taskLower.includes("agents") ||
      taskLower.includes("parallel")
    ) {
      types.push("coordination")
    }
    if (
      taskLower.includes("improve") ||
      taskLower.includes("refine") ||
      taskLower.includes("optimize")
    ) {
      types.push("refinement")
    }
    if (taskLower.includes("explore") || taskLower.includes("investigate")) {
      types.push("exploration")
    }

    // Default to problem_solving if no specific type identified
    if (types.length === 0) {
      types.push("problem_solving")
    }

    return types
  }

  private assessComplexity(task: string): ComplexityLevel {
    // Simple heuristics for complexity assessment
    const wordCount = task.split(/\s+/).length
    const hasMultipleSteps = /\d+\.|step|first|then|finally/i.test(task)
    const hasConditions = /if|when|unless|depending/i.test(task)
    const hasIterations = /each|all|every|iterate/i.test(task)

    let complexityScore = 0

    if (wordCount > 50) complexityScore++
    if (wordCount > 100) complexityScore++
    if (hasMultipleSteps) complexityScore++
    if (hasConditions) complexityScore++
    if (hasIterations) complexityScore++

    if (complexityScore >= 4) return "very_high"
    if (complexityScore >= 3) return "high"
    if (complexityScore >= 1) return "medium"
    return "low"
  }

  private identifyRequiredCapabilities(
    task: string,
    _context: SelectionContext,
  ): Capability[] {
    const capabilities: Capability[] = []
    const taskLower = task.toLowerCase()

    if (
      taskLower.includes("remember") ||
      taskLower.includes("recall") ||
      taskLower.includes("previous")
    ) {
      capabilities.push("memory")
    }
    if (
      taskLower.includes("tool") ||
      taskLower.includes("execute") ||
      taskLower.includes("run")
    ) {
      capabilities.push("tools")
    }
    if (
      taskLower.includes("agent") ||
      taskLower.includes("delegate") ||
      taskLower.includes("parallel")
    ) {
      capabilities.push("sub_agents")
    }
    if (
      taskLower.includes("iterate") ||
      taskLower.includes("repeat") ||
      taskLower.includes("improve")
    ) {
      capabilities.push("iteration")
    }
    if (
      taskLower.includes("reflect") ||
      taskLower.includes("evaluate") ||
      taskLower.includes("critique")
    ) {
      capabilities.push("self_reflection")
    }

    return capabilities
  }

  private estimateTokens(task: string): number {
    // Rough estimation based on task length and complexity
    const words = task.split(/\s+/).length
    const baseTokens = words * 1.3 // Average tokens per word

    // Add overhead for technique application
    const overhead = 500 // Base overhead for prompting

    return Math.ceil(baseTokens + overhead)
  }

  private async getSuggestedTechniques(
    taskTypes: TaskType[],
    complexity: ComplexityLevel,
    capabilities: Capability[],
    _context: SelectionContext,
  ): Promise<string[]> {
    const suggestions: string[] = []

    // Task type based suggestions
    for (const taskType of taskTypes) {
      switch (taskType) {
        case "analysis":
          suggestions.push("cot", "tot")
          break
        case "generation":
          suggestions.push("few_shot", "persona")
          break
        case "problem_solving":
          suggestions.push("cot", "react", "pal")
          break
        case "coordination":
          suggestions.push(
            "multi_agent_coordination",
            "hierarchical_decomposition",
          )
          break
        case "refinement":
          suggestions.push("iterative_refinement", "self_consistency")
          break
        case "exploration":
          suggestions.push("tot", "generated_knowledge")
          break
      }
    }

    // Complexity based additions
    if (complexity === "high" || complexity === "very_high") {
      suggestions.push("prompt_chaining", "meta_prompting")
    }

    // Capability based additions
    if (capabilities.includes("self_reflection")) {
      suggestions.push("reflexion", "constitutional_ai")
    }

    // Remove duplicates
    return [...new Set(suggestions)]
  }

  private calculateConfidence(
    taskTypes: TaskType[],
    suggestions: string[],
  ): number {
    // Base confidence
    let confidence = 0.7

    // Increase confidence if we have clear task types
    if (taskTypes.length > 0 && taskTypes[0] !== "problem_solving") {
      confidence += 0.1
    }

    // Increase confidence if we have multiple matching techniques
    if (suggestions.length >= 3) {
      confidence += 0.1
    }

    // Cap at 0.95
    return Math.min(confidence, 0.95)
  }

  private scoreTechnique(
    technique: PromptingTechnique,
    task: TaskAnalysis,
  ): number {
    let score = 0

    // Task type matching
    for (const taskType of task.taskType) {
      if (technique.suitableFor.includes(taskType)) {
        score += 30
      }
    }

    // Complexity matching
    const complexityMatch = this.matchComplexity(
      technique.complexity,
      task.complexity,
    )
    score += complexityMatch * 20

    // Capability matching
    const capabilityMatch = this.matchCapabilities(
      technique.requiredCapabilities || [],
      task.requiredCapabilities,
    )
    score += capabilityMatch * 25

    // Historical performance bonus
    const performanceBonus = this.getPerformanceBonus(
      technique.id,
      task.taskType,
    )
    score += performanceBonus

    // Suggested technique bonus
    if (task.suggestedTechniques.includes(technique.id)) {
      score += 15
    }

    return Math.max(0, Math.min(100, score))
  }

  private matchComplexity(
    techniqueComplexity: ComplexityLevel,
    taskComplexity: ComplexityLevel,
  ): number {
    const levels: ComplexityLevel[] = ["low", "medium", "high", "very_high"]
    const techIndex = levels.indexOf(techniqueComplexity)
    const taskIndex = levels.indexOf(taskComplexity)

    const diff = Math.abs(techIndex - taskIndex)

    // Perfect match
    if (diff === 0) return 1
    // One level off
    if (diff === 1) return 0.7
    // Two levels off
    if (diff === 2) return 0.3
    // Three levels off
    return 0
  }

  private matchCapabilities(
    required: Capability[],
    available: Capability[],
  ): number {
    if (required.length === 0) return 1

    const matched = required.filter((cap) => available.includes(cap)).length
    return matched / required.length
  }

  private getPerformanceBonus(
    techniqueId: string,
    taskTypes: TaskType[],
  ): number {
    let totalBonus = 0

    const techniquePerf = this.techniqueScores.get(techniqueId)
    if (!techniquePerf) return 0

    for (const taskType of taskTypes) {
      const score = techniquePerf.get(taskType)
      if (score) {
        totalBonus += score * 10 // Convert to 0-10 range
      }
    }

    return totalBonus / taskTypes.length
  }

  private explainScore(
    technique: PromptingTechnique,
    task: TaskAnalysis,
    score: number,
  ): string[] {
    const reasons: string[] = []

    // Task type matches
    const matchingTypes = task.taskType.filter((t) =>
      technique.suitableFor.includes(t),
    )
    if (matchingTypes.length > 0) {
      reasons.push(`Suitable for ${matchingTypes.join(", ")}`)
    }

    // Complexity match
    if (technique.complexity === task.complexity) {
      reasons.push(`Complexity level matches (${task.complexity})`)
    }

    // Suggested technique
    if (task.suggestedTechniques.includes(technique.id)) {
      reasons.push("Recommended for this task pattern")
    }

    // High score
    if (score >= 80) {
      reasons.push("Excellent match for task requirements")
    } else if (score >= 60) {
      reasons.push("Good match for task requirements")
    }

    return reasons
  }

  private selectPrimary(
    scores: TechniqueScore[],
    analysis: TaskAnalysis,
  ): PromptingTechnique[] {
    const primary: PromptingTechnique[] = []
    const used = new Set<string>()

    // Select top scoring compatible techniques
    for (const score of scores) {
      if (score.score < 50) break // Minimum threshold

      const technique = score.technique

      // Check compatibility with already selected
      const compatible = primary.every(
        (p) =>
          !technique.incompatibleWith?.includes(p.id) &&
          !p.incompatibleWith?.includes(technique.id),
      )

      if (compatible && !used.has(technique.id)) {
        primary.push(technique)
        used.add(technique.id)

        // Limit based on complexity
        const limit =
          analysis.complexity === "very_high"
            ? 4
            : analysis.complexity === "high"
              ? 3
              : analysis.complexity === "medium"
                ? 2
                : 1

        if (primary.length >= limit) break
      }
    }

    return primary
  }

  private selectFallback(
    scores: TechniqueScore[],
    primary: PromptingTechnique[],
    analysis: TaskAnalysis,
  ): PromptingTechnique[] {
    const fallback: PromptingTechnique[] = []
    const primaryIds = new Set(primary.map((p) => p.id))

    // Select alternative techniques
    for (const score of scores) {
      if (score.score < 40) break // Lower threshold for fallbacks

      const technique = score.technique

      // Skip if already in primary
      if (primaryIds.has(technique.id)) continue

      // Add as fallback
      fallback.push(technique)

      if (fallback.length >= 2) break // Max 2 fallbacks
    }

    return fallback
  }

  private determineComposition(
    techniques: PromptingTechnique[],
    analysis: TaskAnalysis,
  ): CompositionStrategy {
    // Single technique - no composition needed
    if (techniques.length === 1) {
      return { type: "sequential", order: [techniques[0].id] }
    }

    // Check for natural ordering
    const hasChaining = techniques.some((t) => t.id === "prompt_chaining")
    const hasHierarchical = techniques.some(
      (t) => t.id === "hierarchical_decomposition",
    )

    if (hasChaining || hasHierarchical) {
      return {
        type: "nested",
        order: techniques.map((t) => t.id),
      }
    }

    // Check for parallel potential
    const hasMultiAgent = techniques.some((t) => t.category === "multi_agent")
    if (hasMultiAgent && analysis.taskType.includes("coordination")) {
      return {
        type: "parallel",
        order: techniques.map((t) => t.id),
      }
    }

    // Default to sequential
    return {
      type: "sequential",
      order: techniques.map((t) => t.id),
    }
  }

  // Update performance scores based on execution results
  updatePerformance(
    techniqueId: string,
    taskType: TaskType,
    success: boolean,
  ): void {
    if (!this.techniqueScores.has(techniqueId)) {
      this.techniqueScores.set(techniqueId, new Map())
    }

    const scores = this.techniqueScores.get(techniqueId)!
    const current = scores.get(taskType) || 0.5

    // Exponential moving average
    const alpha = 0.1
    const newScore = current * (1 - alpha) + (success ? 1 : 0) * alpha

    scores.set(taskType, newScore)
  }
}
