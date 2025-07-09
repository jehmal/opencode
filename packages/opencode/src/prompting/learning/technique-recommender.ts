import type {
  TaskType,
  ComplexityLevel,
  PromptingTechnique,
  TaskAnalysis,
} from "../types"
import { techniqueTracker } from "./technique-tracker"
import { performanceAnalyzer } from "./performance-analyzer"
import { TechniqueRegistry } from "../registry/technique-registry"
import { Storage } from "../../storage/storage"
import { Log } from "../../util/log"

export interface RecommendationContext {
  task: string
  taskAnalysis: TaskAnalysis
  previousTechniques?: string[]
  userPreferences?: {
    preferredCategories?: string[]
    avoidCategories?: string[]
    maxComplexity?: ComplexityLevel
    prioritizeSpeed?: boolean
    prioritizeAccuracy?: boolean
  }
}

export interface TechniqueRecommendation {
  techniqueId: string
  score: number
  reasons: string[]
  confidence: number
  alternativeIf?: {
    condition: string
    alternative: string
  }
}

export interface RecommendationResult {
  primary: TechniqueRecommendation[]
  fallback: TechniqueRecommendation[]
  reasoning: string[]
  learningNotes?: string[]
}

interface SimilarTask {
  task: string
  similarity: number
  successfulTechniques: string[]
  taskTypes: TaskType[]
}

interface UserFeedback {
  techniqueId: string
  taskHash: string
  rating: number // 1-5
  timestamp: number
}

export class TechniqueRecommender {
  private log = Log.create({ service: "technique-recommender" })
  private registry = new TechniqueRegistry()
  private readonly TASK_HISTORY_KEY = "prompting:task-history"
  private readonly USER_FEEDBACK_KEY = "prompting:user-feedback"
  private readonly LEARNING_THRESHOLD = 0.7

  async initialize(): Promise<void> {
    await this.registry.initialize()
    await techniqueTracker.initialize()
    this.log.info("Technique recommender initialized")
  }

  async recommendTechniques(
    context: RecommendationContext,
  ): Promise<RecommendationResult> {
    const { task, taskAnalysis, previousTechniques, userPreferences } = context

    // Get all available techniques
    const allTechniques = await this.registry.getAll()

    // Find similar tasks from history
    const similarTasks = await this.findSimilarTasks(task, taskAnalysis)

    // Score each technique
    const scores = new Map<string, TechniqueRecommendation>()

    for (const technique of allTechniques) {
      const recommendation = await this.scoreTechnique(
        technique,
        taskAnalysis,
        similarTasks,
        previousTechniques,
        userPreferences,
      )

      if (recommendation.score > 0) {
        scores.set(technique.id, recommendation)
      }
    }

    // Sort by score
    const sorted = Array.from(scores.values()).sort((a, b) => b.score - a.score)

    // Select primary and fallback
    const primary = sorted.slice(0, 3)
    const fallback = sorted.slice(3, 5)

    // Generate reasoning
    const reasoning = this.generateReasoning(
      primary,
      taskAnalysis,
      similarTasks,
    )

    // Add learning notes if we found patterns
    const learningNotes = this.generateLearningNotes(similarTasks, primary)

    // Store this task for future learning
    await this.storeTaskHistory(
      task,
      taskAnalysis,
      primary.map((p) => p.techniqueId),
    )

    return {
      primary,
      fallback,
      reasoning,
      learningNotes: learningNotes.length > 0 ? learningNotes : undefined,
    }
  }

  private async scoreTechnique(
    technique: PromptingTechnique,
    taskAnalysis: TaskAnalysis,
    similarTasks: SimilarTask[],
    previousTechniques?: string[],
    userPreferences?: RecommendationContext["userPreferences"],
  ): Promise<TechniqueRecommendation> {
    let score = 0
    const reasons: string[] = []

    // Base score from task type matching
    const taskTypeMatch = this.calculateTaskTypeMatch(
      technique,
      taskAnalysis.taskType,
    )
    score += taskTypeMatch * 30
    if (taskTypeMatch > 0.8) {
      reasons.push(
        `Excellent match for ${taskAnalysis.taskType.join(", ")} tasks`,
      )
    }

    // Complexity matching
    const complexityMatch = this.calculateComplexityMatch(
      technique.complexity,
      taskAnalysis.complexity,
    )
    score += complexityMatch * 20

    // Historical performance
    const metrics = await techniqueTracker.getMetrics(technique.id)
    if (metrics) {
      // Overall performance
      score += metrics.successRate * 25

      // Task-specific performance
      for (const taskType of taskAnalysis.taskType) {
        if (metrics.taskTypePerformance.has(taskType)) {
          const perf = metrics.taskTypePerformance.get(taskType)!
          if (perf.count >= 5) {
            score += perf.successRate * 15
            if (perf.successRate > 0.8) {
              reasons.push(
                `Proven success with ${taskType} (${(perf.successRate * 100).toFixed(0)}%)`,
              )
            }
          }
        }
      }

      // Trend bonus
      if (metrics.recentTrend === "improving") {
        score += 5
        reasons.push("Performance improving over time")
      }
    }

    // Similar task performance
    const similarPerformance = this.calculateSimilarTaskPerformance(
      technique.id,
      similarTasks,
    )
    score += similarPerformance * 20
    if (similarPerformance > 0.7) {
      reasons.push("Successful on similar tasks")
    }

    // User preferences
    if (userPreferences) {
      // Category preferences
      if (userPreferences.preferredCategories?.includes(technique.category)) {
        score += 10
        reasons.push("Matches preferred category")
      }
      if (userPreferences.avoidCategories?.includes(technique.category)) {
        score -= 20
      }

      // Speed vs accuracy
      if (userPreferences.prioritizeSpeed && metrics) {
        const speedScore = 1 - metrics.averageDuration / 5000 // Normalize to 5s
        score += speedScore * 10
      }
      if (userPreferences.prioritizeAccuracy && metrics) {
        score += metrics.successRate * 10
      }
    }

    // Avoid repetition
    if (previousTechniques?.includes(technique.id)) {
      score *= 0.7
      reasons.push("Recently used (score reduced)")
    }

    // User feedback
    const userFeedback = await this.getUserFeedback(
      technique.id,
      taskAnalysis.taskType.join("-"),
    )
    if (userFeedback) {
      score += (userFeedback - 3) * 10 // -20 to +20 based on 1-5 rating
      if (userFeedback >= 4) {
        reasons.push("Positive user feedback")
      } else if (userFeedback <= 2) {
        reasons.push("Negative user feedback")
      }
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(
      technique.id,
      metrics?.totalUsages || 0,
      similarTasks.length,
    )

    // Determine alternatives
    const alternativeIf = this.suggestAlternative(technique, taskAnalysis)

    return {
      techniqueId: technique.id,
      score: Math.max(0, Math.min(100, score)),
      reasons,
      confidence,
      alternativeIf,
    }
  }

  private calculateTaskTypeMatch(
    technique: PromptingTechnique,
    taskTypes: TaskType[],
  ): number {
    const matches = taskTypes.filter((t) => technique.suitableFor.includes(t))
    return (
      matches.length / Math.max(taskTypes.length, technique.suitableFor.length)
    )
  }

  private calculateComplexityMatch(
    techniqueComplexity: ComplexityLevel,
    taskComplexity: ComplexityLevel,
  ): number {
    const levels: ComplexityLevel[] = ["low", "medium", "high", "very_high"]
    const techIndex = levels.indexOf(techniqueComplexity)
    const taskIndex = levels.indexOf(taskComplexity)
    const diff = Math.abs(techIndex - taskIndex)

    if (diff === 0) return 1
    if (diff === 1) return 0.7
    if (diff === 2) return 0.3
    return 0
  }

  private calculateSimilarTaskPerformance(
    techId: string,
    similarTasks: SimilarTask[],
  ): number {
    if (similarTasks.length === 0) return 0

    const relevantTasks = similarTasks.filter((t) =>
      t.successfulTechniques.includes(techniqueId),
    )

    if (relevantTasks.length === 0) return 0

    // Weight by similarity
    const weightedScore = relevantTasks.reduce(
      (sum, task) => sum + task.similarity,
      0,
    )

    return weightedScore / similarTasks.length
  }

  private calculateConfidence(
    techniqueId: string,
    totalUsages: number,
    similarTaskCount: number,
  ): number {
    // Base confidence on usage data
    const usageConfidence = Math.min(1, Math.log10(totalUsages + 1) / 2)

    // Boost confidence if we have similar task data
    const similarityBoost = Math.min(0.3, similarTaskCount * 0.1)

    return Math.min(1, usageConfidence + similarityBoost)
  }

  private suggestAlternative(
    technique: PromptingTechnique,
    taskAnalysis: TaskAnalysis,
  ): TechniqueRecommendation["alternativeIf"] | undefined {
    // Suggest alternatives for specific conditions
    if (technique.id === "cot" && taskAnalysis.complexity === "low") {
      return {
        condition: "Task is too simple",
        alternative: "few_shot",
      }
    }

    if (
      technique.complexity === "very_high" &&
      taskAnalysis.estimatedTokens < 500
    ) {
      return {
        condition: "Task may be too simple for complex technique",
        alternative: "cot",
      }
    }

    return undefined
  }

  private async findSimilarTasks(
    task: string,
    taskAnalysis: TaskAnalysis,
  ): Promise<SimilarTask[]> {
    try {
      const history = await Storage.readJSON<
        Array<{
          task: string
          taskTypes: TaskType[]
          complexity: ComplexityLevel
          techniques: string[]
          timestamp: number
        }>
      >(this.TASK_HISTORY_KEY)

      const similar: SimilarTask[] = []

      for (const historical of history) {
        const similarity = this.calculateTaskSimilarity(
          task,
          taskAnalysis,
          historical.task,
          historical.taskTypes,
          historical.complexity,
        )

        if (similarity > this.LEARNING_THRESHOLD) {
          // Get successful techniques from metrics
          const successfulTechniques: string[] = []
          for (const techniqueId of historical.techniques) {
            const metrics = await techniqueTracker.getMetrics(techniqueId)
            if (metrics && metrics.successRate > 0.7) {
              successfulTechniques.push(techniqueId)
            }
          }

          if (successfulTechniques.length > 0) {
            similar.push({
              task: historical.task,
              similarity,
              successfulTechniques,
              taskTypes: historical.taskTypes,
            })
          }
        }
      }

      return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 5)
    } catch {
      return []
    }
  }

  private calculateTaskSimilarity(
    task1: string,
    analysis1: TaskAnalysis,
    task2: string,
    taskTypes2: TaskType[],
    complexity2: ComplexityLevel,
  ): number {
    let similarity = 0

    // Task type overlap
    const typeOverlap = analysis1.taskType.filter((t) => taskTypes2.includes(t))
    similarity +=
      (typeOverlap.length /
        Math.max(analysis1.taskType.length, taskTypes2.length)) *
      0.4

    // Complexity similarity
    if (analysis1.complexity === complexity2) {
      similarity += 0.3
    } else if (
      Math.abs(
        ["low", "medium", "high", "very_high"].indexOf(analysis1.complexity) -
          ["low", "medium", "high", "very_high"].indexOf(complexity2),
      ) === 1
    ) {
      similarity += 0.15
    }

    // Text similarity (simple word overlap)
    const words1 = new Set(task1.toLowerCase().split(/\s+/))
    const words2 = new Set(task2.toLowerCase().split(/\s+/))
    const intersection = new Set([...words1].filter((w) => words2.has(w)))
    const union = new Set([...words1, ...words2])
    similarity += (intersection.size / union.size) * 0.3

    return similarity
  }

  private generateReasoning(
    recommendations: TechniqueRecommendation[],
    taskAnalysis: TaskAnalysis,
    similarTasks: SimilarTask[],
  ): string[] {
    const reasoning: string[] = []

    // Task analysis reasoning
    reasoning.push(
      `Task identified as ${taskAnalysis.taskType.join("/")} with ${taskAnalysis.complexity} complexity`,
    )

    // Similar task reasoning
    if (similarTasks.length > 0) {
      reasoning.push(
        `Found ${similarTasks.length} similar tasks with successful patterns`,
      )
    }

    // Top recommendation reasoning
    if (recommendations.length > 0) {
      const top = recommendations[0]
      reasoning.push(
        `${top.techniqueId} recommended (${top.score.toFixed(0)}/100) - ${top.reasons[0]}`,
      )
    }

    // Capability matching
    if (taskAnalysis.requiredCapabilities.length > 0) {
      reasoning.push(
        `Techniques selected for ${taskAnalysis.requiredCapabilities.join(", ")} capabilities`,
      )
    }

    return reasoning
  }

  private generateLearningNotes(
    similarTasks: SimilarTask[],
    recommendations: TechniqueRecommendation[],
  ): string[] {
    const notes: string[] = []

    // Pattern recognition
    if (similarTasks.length >= 3) {
      const commonTechniques = this.findCommonTechniques(similarTasks)
      if (commonTechniques.length > 0) {
        notes.push(
          `Pattern detected: ${commonTechniques.join(", ")} consistently successful for this task type`,
        )
      }
    }

    // New combination discovery
    const recommendedIds = recommendations.map((r) => r.techniqueId)
    const isNovelCombination = !similarTasks.some((task) =>
      recommendedIds.every((id) => task.successfulTechniques.includes(id)),
    )

    if (isNovelCombination && recommendations.length > 1) {
      notes.push("Trying new technique combination - will track effectiveness")
    }

    return notes
  }

  private findCommonTechniques(tasks: SimilarTask[]): string[] {
    if (tasks.length === 0) return []

    const techniqueCount = new Map<string, number>()

    for (const task of tasks) {
      for (const technique of task.successfulTechniques) {
        techniqueCount.set(technique, (techniqueCount.get(technique) || 0) + 1)
      }
    }

    // Find techniques that appear in at least 60% of tasks
    const threshold = tasks.length * 0.6
    return Array.from(techniqueCount.entries())
      .filter(([, count]) => count >= threshold)
      .map(([technique]) => technique)
  }

  private async storeTaskHistory(
    task: string,
    analysis: TaskAnalysis,
    techniques: string[],
  ): Promise<void> {
    try {
      const history = await Storage.readJSON<any[]>(
        this.TASK_HISTORY_KEY,
      ).catch(() => [])

      history.push({
        task: task.substring(0, 200), // Limit task length
        taskTypes: analysis.taskType,
        complexity: analysis.complexity,
        techniques,
        timestamp: Date.now(),
      })

      // Keep only recent history
      const recentHistory = history.slice(-1000)

      await Storage.writeJSON(this.TASK_HISTORY_KEY, recentHistory)
    } catch (error) {
      this.log.error("Failed to store task history", error)
    }
  }

  async recordUserFeedback(
    techniqueId: string,
    task: string,
    rating: number,
  ): Promise<void> {
    try {
      const feedback = await Storage.readJSON<UserFeedback[]>(
        this.USER_FEEDBACK_KEY,
      ).catch(() => [])

      feedback.push({
        techniqueId,
        taskHash: this.hashTask(task),
        rating: Math.max(1, Math.min(5, rating)),
        timestamp: Date.now(),
      })

      // Keep only recent feedback
      const recentFeedback = feedback.slice(-5000)

      await Storage.writeJSON(this.USER_FEEDBACK_KEY, recentFeedback)
    } catch (error) {
      this.log.error("Failed to store user feedback", error)
    }
  }

  private async getUserFeedback(
    techniqueId: string,
    task: string,
  ): Promise<number | null> {
    try {
      const feedback = await Storage.readJSON<UserFeedback[]>(
        this.USER_FEEDBACK_KEY,
      )
      const taskHash = this.hashTask(task)

      // Find most recent feedback for this technique and similar task
      const relevant = feedback
        .filter((f) => f.techniqueId === techniqueId && f.taskHash === taskHash)
        .sort((a, b) => b.timestamp - a.timestamp)

      return relevant.length > 0 ? relevant[0].rating : null
    } catch {
      return null
    }
  }

  private hashTask(task: string): string {
    // Simple hash for task similarity
    return task
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .sort()
      .slice(0, 10)
      .join("-")
  }

  async improveRecommendations(): Promise<{
    insights: string[]
    adjustments: Array<{
      techniqueId: string
      adjustment: string
      reason: string
    }>
  }> {
    const insights: string[] = []
    const adjustments: Array<{
      techniqueId: string
      adjustment: string
      reason: string
    }> = []

    // Analyze performance patterns
    const patterns = await performanceAnalyzer.identifyPatterns()

    // Successful combinations
    for (const combo of patterns.successfulCombinations) {
      if (combo.successRate > 0.8 && combo.usageCount >= 10) {
        insights.push(
          `Strong combination: ${combo.techniques.join(" + ")} for ${combo.taskTypes.join(", ")}`,
        )
      }
    }

    // Failure patterns
    for (const failure of patterns.failurePatterns) {
      adjustments.push({
        techniqueId: failure.technique,
        adjustment: "reduce_score",
        reason: `Common failures: ${failure.commonFailureReasons.join(", ")}`,
      })
    }

    // Performance report
    const report = await performanceAnalyzer.generatePerformanceReport()

    // Underperformers
    for (const underperformer of report.summary.underperformers) {
      adjustments.push({
        techniqueId: underperformer,
        adjustment: "deprecate",
        reason: "Consistently underperforming",
      })
    }

    // Task type insights
    for (const analysis of report.taskTypeAnalysis) {
      if (analysis.bestTechniques.length > 0) {
        const best = analysis.bestTechniques[0]
        if (best.successRate > 0.85) {
          insights.push(
            `${best.techniqueId} excels at ${analysis.taskType} (${(best.successRate * 100).toFixed(0)}%)`,
          )
        }
      }
    }

    return { insights, adjustments }
  }
}

// Singleton instance
export const techniqueRecommender = new TechniqueRecommender()
