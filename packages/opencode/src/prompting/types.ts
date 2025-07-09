// Core types for DGMO Native Prompting Techniques

export type TechniqueCategory =
  | "reasoning"
  | "generation"
  | "multi_agent"
  | "optimization"
  | "advanced"
export type ComplexityLevel = "low" | "medium" | "high" | "very_high"
export type TaskType =
  | "analysis"
  | "generation"
  | "problem_solving"
  | "coordination"
  | "refinement"
  | "exploration"
export type Capability =
  | "memory"
  | "tools"
  | "sub_agents"
  | "iteration"
  | "self_reflection"

export interface Constraint {
  type:
    | "token_limit"
    | "time_limit"
    | "technique_exclusion"
    | "capability_requirement"
  value: any
}

export interface TechniqueMetrics {
  totalExecutions: number
  successRate: number
  averageLatency: number
  averageTokenUsage: number
  lastUpdated: number
}

export interface PostProcessor {
  name: string
  process(output: string): string
}

export interface PromptingTechnique {
  id: string
  name: string
  category: TechniqueCategory
  description: string

  // Core functionality
  apply(context: TechniqueContext): Promise<EnhancedPrompt>
  validate(input: any): boolean

  // Metadata for selection
  complexity: ComplexityLevel
  suitableFor: TaskType[]
  incompatibleWith?: string[]
  requiredCapabilities?: Capability[]

  // Performance tracking
  metrics: TechniqueMetrics

  // Template and examples
  template?: string
  examples?: Example[]
}

export interface Example {
  input: string
  output: string
  explanation?: string
}

export interface TechniqueContext {
  task: string
  parentContext?: TechniqueContext
  sessionId: string
  agentId: string
  variables: Record<string, any>
  constraints: Constraint[]
  previousTechniques: string[]
  capabilities: Capability[]
}

export interface EnhancedPrompt {
  content: string
  metadata: {
    techniques: string[]
    confidence: number
    estimatedTokens: number
    compositionStrategy: string
  }
  variables: Record<string, any>
  postProcessing?: PostProcessor[]
}

export interface SelectionContext {
  sessionId: string
  agentId: string
  parentTechniques?: string[]
  constraints: Constraint[]
  performanceHistory?: PerformanceRecord[]
}

export interface TaskAnalysis {
  taskType: TaskType[]
  complexity: ComplexityLevel
  requiredCapabilities: Capability[]
  estimatedTokens: number
  suggestedTechniques: string[]
  confidence: number
}

export interface SelectedTechniques {
  primary: PromptingTechnique[]
  fallback: PromptingTechnique[]
  composition: CompositionStrategy
}

export interface CompositionStrategy {
  type: "sequential" | "parallel" | "nested" | "conditional"
  order?: string[]
  conditions?: CompositionCondition[]
}

export interface CompositionCondition {
  technique: string
  condition: string
  onTrue?: string
  onFalse?: string
}

export interface TechniqueScore {
  technique: PromptingTechnique
  score: number
  reasons: string[]
}

export interface ValidationResult {
  valid: boolean
  errors?: string[]
  warnings?: string[]
  suggestions?: string[]
}

export interface TechniqueSet {
  techniques: Map<string, PromptingTechnique>
  metadata: {
    agentId: string
    parentId?: string
    modifications: Modification[]
    created: number
  }
}

export interface Modification {
  techniqueId: string
  type: "parameter" | "template" | "example" | "remove"
  value: any
  reason?: string
}

export interface TechniqueModification extends Modification {
  timestamp: number
  agentId: string
}

export interface TechniqueLineage {
  agentId: string
  parent?: TechniqueLineage
  techniques: string[]
  modifications: TechniqueModification[]
  performance: PerformanceSnapshot
}

export interface PerformanceSnapshot {
  successRate: number
  averageLatency: number
  techniqueEffectiveness: Record<string, number>
}

export interface TechniqueExecution {
  taskId: string
  techniques: string[]
  duration: number
  success: boolean
  metrics: {
    tokensUsed: number
    latency: number
    memoryUsed?: number
    subAgentsCreated?: number
  }
  error?: string
}

export interface TimeFrame {
  start: number
  end: number
}

export interface PerformanceAnalysis {
  techniqueId: string
  timeframe: TimeFrame
  executions: number
  successRate: number
  averageLatency: number
  averageTokens: number
  trends: {
    successRateTrend: "improving" | "declining" | "stable"
    latencyTrend: "improving" | "declining" | "stable"
  }
  recommendations: string[]
}

export interface TechniqueRecommendation {
  techniqueId: string
  confidence: number
  reasoning: string[]
  alternativeIds?: string[]
}

export interface PerformanceRecord {
  techniqueId: string
  taskType: TaskType
  success: boolean
  latency: number
  timestamp: number
}

// Monitoring types
export interface ActiveTechnique {
  techniqueId: string
  agentId: string
  startTime: number
  status: "running" | "completed" | "failed"
}

export interface LatencyMetrics {
  p50: number
  p90: number
  p99: number
  average: number
}

export interface CompositionStats {
  totalCompositions: number
  averageTechniquesPerPrompt: number
  mostUsedCombinations: Array<{
    techniques: string[]
    count: number
  }>
}

export interface SelectionExplanation {
  taskId: string
  taskAnalysis: TaskAnalysis
  consideredTechniques: TechniqueScore[]
  selectedTechniques: string[]
  reasoning: string[]
}

export interface InheritanceTrace {
  agentId: string
  lineage: Array<{
    agentId: string
    techniques: string[]
    modifications: Modification[]
  }>
}

export interface PerformanceReport {
  techniqueId: string
  summary: {
    totalExecutions: number
    successRate: number
    averageLatency: number
    averageTokens: number
  }
  byTaskType: Record<TaskType, PerformanceAnalysis>
  recommendations: string[]
}
