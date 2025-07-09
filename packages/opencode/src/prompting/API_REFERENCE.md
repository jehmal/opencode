# DGMO Prompting Techniques API Reference

This document provides comprehensive API documentation for all public interfaces, methods, and types in the DGMO Prompting Techniques system.

## Table of Contents

1. [Core Types](#core-types)
2. [Main Integration API](#main-integration-api)
3. [Registry API](#registry-api)
4. [Selector API](#selector-api)
5. [Composer API](#composer-api)
6. [Inheritance API](#inheritance-api)
7. [Learning API](#learning-api)
8. [Technique Interfaces](#technique-interfaces)

---

## Core Types

### TechniqueCategory

```typescript
type TechniqueCategory =
  | "reasoning"
  | "generation"
  | "multi_agent"
  | "optimization"
  | "advanced"
```

### ComplexityLevel

```typescript
type ComplexityLevel = "low" | "medium" | "high" | "very_high"
```

### TaskType

```typescript
type TaskType =
  | "analysis"
  | "generation"
  | "problem_solving"
  | "coordination"
  | "refinement"
  | "exploration"
```

### Capability

```typescript
type Capability =
  | "memory"
  | "tools"
  | "sub_agents"
  | "iteration"
  | "self_reflection"
```

### TechniqueContext

```typescript
interface TechniqueContext {
  task: string
  parentContext?: TechniqueContext
  sessionId: string
  agentId: string
  variables: Record<string, any>
  constraints: Constraint[]
  previousTechniques: string[]
  capabilities: Capability[]
}
```

### EnhancedPrompt

```typescript
interface EnhancedPrompt {
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
```

### PromptingTechnique

```typescript
interface PromptingTechnique {
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
```

---

## Main Integration API

### PromptingIntegration

The main entry point for integrating prompting techniques into DGMO.

#### initialize()

```typescript
async initialize(): Promise<void>
```

Initializes the prompting system. Must be called once at startup.

**Example:**

```typescript
import { promptingIntegration } from "./prompting/integration/dgmo-integration"

await promptingIntegration.initialize()
```

#### enhanceSessionPrompt()

```typescript
async enhanceSessionPrompt(
  sessionId: string,
  task: string,
  constraints?: Constraint[]
): Promise<EnhancedPrompt>
```

Enhances a session prompt with automatically selected techniques.

**Parameters:**

- `sessionId`: Unique session identifier
- `task`: The task description to enhance
- `constraints`: Optional constraints (token limits, excluded techniques, etc.)

**Returns:** Enhanced prompt with applied techniques

**Example:**

```typescript
const enhanced = await promptingIntegration.enhanceSessionPrompt(
  "session-123",
  "Analyze this codebase for security vulnerabilities",
  [{ type: "token_limit", value: 4000 }],
)
```

#### composePrompt()

```typescript
async composePrompt(
  sessionId: string,
  task: string,
  techniqueIds: string[],
  strategy?: CompositionStrategy
): Promise<EnhancedPrompt>
```

Manually compose a prompt with specific techniques.

**Parameters:**

- `sessionId`: Unique session identifier
- `task`: The task description
- `techniqueIds`: Array of technique IDs to apply
- `strategy`: Optional composition strategy (defaults to sequential)

**Returns:** Enhanced prompt with specified techniques

**Example:**

```typescript
const enhanced = await promptingIntegration.composePrompt(
  "session-123",
  "Debug this function",
  ["chain_of_thought", "reflexion"],
  { type: "sequential" },
)
```

#### prepareSubAgentTechniques()

```typescript
async prepareSubAgentTechniques(
  parentAgentId: string,
  task: string,
  modifications?: Modification[]
): Promise<TechniqueSet>
```

Prepares techniques for a sub-agent, inheriting from parent with modifications.

**Parameters:**

- `parentAgentId`: Parent agent's ID
- `task`: Sub-agent's specific task
- `modifications`: Optional modifications to parent techniques

**Returns:** Technique set for the sub-agent

**Example:**

```typescript
const techniques = await promptingIntegration.prepareSubAgentTechniques(
  "parent-agent-123",
  "Focus on database optimization",
  [
    {
      techniqueId: "chain_of_thought",
      type: "parameter",
      value: { focusArea: "sql_performance" },
    },
  ],
)
```

#### onTaskComplete()

```typescript
async onTaskComplete(event: TaskCompleteEvent): Promise<void>
```

Records task completion for learning and performance tracking.

**Parameters:**

- `event`: Task completion event with metrics

**Example:**

```typescript
await promptingIntegration.onTaskComplete({
  taskId: "task-123",
  sessionId: "session-123",
  agentId: "agent-123",
  techniques: ["chain_of_thought", "few_shot"],
  duration: 5000,
  success: true,
  metrics: {
    tokensUsed: 1500,
    latency: 45,
  },
})
```

#### getPerformanceMetrics()

```typescript
async getPerformanceMetrics(): Promise<SystemMetrics>
```

Retrieves system-wide performance metrics.

**Returns:** Comprehensive performance metrics

**Example:**

```typescript
const metrics = await promptingIntegration.getPerformanceMetrics()
console.log(`Cache hit rate: ${metrics.registry.cacheHitRate}`)
```

---

## Registry API

### TechniqueRegistry

Manages technique storage and retrieval.

#### register()

```typescript
register(technique: PromptingTechnique): void
```

Registers a new technique.

**Parameters:**

- `technique`: The technique to register

**Throws:** Error if technique ID already exists

**Example:**

```typescript
registry.register({
  id: "custom_technique",
  name: "Custom Technique",
  category: "advanced",
  // ... other properties
})
```

#### get()

```typescript
get(id: string): PromptingTechnique | undefined
```

Retrieves a technique by ID.

**Parameters:**

- `id`: Technique identifier

**Returns:** The technique or undefined if not found

**Example:**

```typescript
const technique = registry.get("chain_of_thought")
if (technique) {
  console.log(technique.description)
}
```

#### getAll()

```typescript
getAll(): PromptingTechnique[]
```

Retrieves all registered techniques.

**Returns:** Array of all techniques

**Example:**

```typescript
const allTechniques = registry.getAll()
console.log(`Total techniques: ${allTechniques.length}`)
```

#### getByCategory()

```typescript
getByCategory(category: TechniqueCategory): PromptingTechnique[]
```

Retrieves techniques by category.

**Parameters:**

- `category`: The category to filter by

**Returns:** Array of techniques in the category

**Example:**

```typescript
const reasoningTechniques = registry.getByCategory("reasoning")
```

#### search()

```typescript
search(criteria: SearchCriteria): PromptingTechnique[]
```

Searches techniques by multiple criteria.

**Parameters:**

- `criteria`: Search criteria object

**Returns:** Array of matching techniques

**Example:**

```typescript
const techniques = registry.search({
  taskTypes: ["analysis", "problem_solving"],
  maxComplexity: "medium",
  requiredCapabilities: ["tools"],
})
```

---

## Selector API

### TechniqueSelector

Intelligently selects techniques based on task analysis.

#### analyzeTask()

```typescript
async analyzeTask(task: string): Promise<TaskAnalysis>
```

Analyzes a task to determine its characteristics.

**Parameters:**

- `task`: Task description to analyze

**Returns:** Detailed task analysis

**Example:**

```typescript
const analysis = await selector.analyzeTask(
  "Debug why the API returns 500 errors",
)
console.log(`Task type: ${analysis.taskType}`)
console.log(`Complexity: ${analysis.complexity}`)
```

#### selectTechniques()

```typescript
async selectTechniques(
  analysis: TaskAnalysis,
  context: SelectionContext
): Promise<SelectedTechniques>
```

Selects optimal techniques based on task analysis.

**Parameters:**

- `analysis`: Task analysis result
- `context`: Selection context with constraints

**Returns:** Selected techniques with composition strategy

**Example:**

```typescript
const selected = await selector.selectTechniques(analysis, {
  sessionId: "session-123",
  agentId: "agent-123",
  constraints: [{ type: "token_limit", value: 4000 }],
})
```

#### rankTechniques()

```typescript
rankTechniques(
  techniques: PromptingTechnique[],
  analysis: TaskAnalysis
): TechniqueScore[]
```

Ranks techniques by suitability for a task.

**Parameters:**

- `techniques`: Techniques to rank
- `analysis`: Task analysis

**Returns:** Ranked techniques with scores

**Example:**

```typescript
const ranked = selector.rankTechniques(registry.getAll(), analysis)
console.log(`Best technique: ${ranked[0].technique.name}`)
```

---

## Composer API

### PromptComposer

Composes multiple techniques into a single enhanced prompt.

#### compose()

```typescript
async compose(
  techniques: PromptingTechnique[],
  context: TechniqueContext,
  strategy?: CompositionStrategy
): Promise<EnhancedPrompt>
```

Composes techniques into an enhanced prompt.

**Parameters:**

- `techniques`: Techniques to compose
- `context`: Technique context
- `strategy`: Composition strategy (defaults to sequential)

**Returns:** Composed enhanced prompt

**Example:**

```typescript
const enhanced = await composer.compose([cotTechnique, fewShotTechnique], {
  task: "Solve this problem",
  sessionId: "session-123",
  agentId: "agent-123",
  variables: {},
  constraints: [],
  previousTechniques: [],
  capabilities: ["tools"],
})
```

#### validateComposition()

```typescript
validateComposition(techniques: PromptingTechnique[]): ValidationResult
```

Validates if techniques can be composed together.

**Parameters:**

- `techniques`: Techniques to validate

**Returns:** Validation result with any errors/warnings

**Example:**

```typescript
const validation = composer.validateComposition([technique1, technique2])
if (!validation.valid) {
  console.error(validation.errors)
}
```

#### optimizeOrder()

```typescript
optimizeOrder(techniques: PromptingTechnique[]): PromptingTechnique[]
```

Optimizes the order of techniques for composition.

**Parameters:**

- `techniques`: Techniques to order

**Returns:** Optimally ordered techniques

**Example:**

```typescript
const ordered = composer.optimizeOrder(techniques)
```

---

## Inheritance API

### TechniqueInheritance

Manages technique inheritance for sub-agents.

#### createInheritedSet()

```typescript
async createInheritedSet(
  parentAgentId: string,
  childAgentId: string,
  modifications?: Modification[]
): Promise<TechniqueSet>
```

Creates an inherited technique set for a child agent.

**Parameters:**

- `parentAgentId`: Parent agent ID
- `childAgentId`: Child agent ID
- `modifications`: Optional modifications

**Returns:** Inherited technique set

**Example:**

```typescript
const inherited = await inheritance.createInheritedSet(
  "parent-123",
  "child-456",
  [
    {
      techniqueId: "few_shot",
      type: "example",
      value: { examples: customExamples },
    },
  ],
)
```

#### getLineage()

```typescript
getLineage(agentId: string): TechniqueLineage
```

Retrieves the complete technique lineage for an agent.

**Parameters:**

- `agentId`: Agent ID

**Returns:** Complete lineage tree

**Example:**

```typescript
const lineage = inheritance.getLineage("agent-123")
console.log(`Inheritance depth: ${lineage.depth}`)
```

---

## Learning API

### PerformanceTracker

Tracks and analyzes technique performance.

#### recordExecution()

```typescript
async recordExecution(execution: TechniqueExecution): Promise<void>
```

Records a technique execution.

**Parameters:**

- `execution`: Execution details

**Example:**

```typescript
await tracker.recordExecution({
  taskId: "task-123",
  techniques: ["chain_of_thought"],
  duration: 1500,
  success: true,
  metrics: {
    tokensUsed: 500,
    latency: 45,
  },
})
```

#### getPerformanceReport()

```typescript
async getPerformanceReport(
  techniqueId: string,
  timeframe?: TimeFrame
): Promise<PerformanceReport>
```

Generates a performance report for a technique.

**Parameters:**

- `techniqueId`: Technique ID
- `timeframe`: Optional time range

**Returns:** Detailed performance report

**Example:**

```typescript
const report = await tracker.getPerformanceReport("chain_of_thought", {
  start: Date.now() - 86400000,
  end: Date.now(),
})
```

#### getRecommendations()

```typescript
async getRecommendations(
  taskAnalysis: TaskAnalysis
): Promise<TechniqueRecommendation[]>
```

Gets technique recommendations based on historical performance.

**Parameters:**

- `taskAnalysis`: Task analysis

**Returns:** Ranked recommendations

**Example:**

```typescript
const recommendations = await tracker.getRecommendations(analysis)
console.log(`Top recommendation: ${recommendations[0].techniqueId}`)
```

---

## Technique Interfaces

Each technique implements the `PromptingTechnique` interface. Here's an example implementation:

### Example: Custom Technique Implementation

```typescript
import { PromptingTechnique, TechniqueContext, EnhancedPrompt } from "../types"

export class CustomTechnique implements PromptingTechnique {
  id = "custom_technique"
  name = "Custom Technique"
  category = "advanced" as const
  description = "A custom prompting technique"
  complexity = "medium" as const
  suitableFor = ["analysis", "generation"] as const

  metrics = {
    totalExecutions: 0,
    successRate: 0,
    averageLatency: 0,
    averageTokenUsage: 0,
    lastUpdated: Date.now(),
  }

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    // Implementation logic
    const enhancedContent = `
      Using custom technique for: ${context.task}
      
      [Custom logic here]
    `

    return {
      content: enhancedContent,
      metadata: {
        techniques: [this.id],
        confidence: 0.85,
        estimatedTokens: 100,
        compositionStrategy: "single",
      },
      variables: context.variables,
    }
  }

  validate(input: any): boolean {
    // Validation logic
    return typeof input === "object" && input.task
  }
}
```

---

## Error Handling

All API methods follow consistent error handling patterns:

### Common Errors

#### TechniqueNotFoundError

```typescript
class TechniqueNotFoundError extends Error {
  constructor(techniqueId: string) {
    super(`Technique not found: ${techniqueId}`)
  }
}
```

#### CompositionError

```typescript
class CompositionError extends Error {
  constructor(message: string, techniques: string[]) {
    super(`Composition error: ${message}`)
    this.techniques = techniques
  }
}
```

#### ValidationError

```typescript
class ValidationError extends Error {
  constructor(errors: string[]) {
    super(`Validation failed: ${errors.join(", ")}`)
    this.errors = errors
  }
}
```

### Error Handling Example

```typescript
try {
  const enhanced = await promptingIntegration.enhanceSessionPrompt(
    sessionId,
    task,
  )
} catch (error) {
  if (error instanceof TechniqueNotFoundError) {
    // Handle missing technique
  } else if (error instanceof CompositionError) {
    // Handle composition failure
  } else {
    // Handle unexpected error
  }
}
```

---

## Best Practices

### 1. Initialize Once

```typescript
// In your app initialization
await promptingIntegration.initialize()
```

### 2. Use Automatic Selection

```typescript
// Let the system choose techniques
const enhanced = await promptingIntegration.enhanceSessionPrompt(
  sessionId,
  task,
)
```

### 3. Handle Constraints

```typescript
// Set appropriate constraints
const constraints = [
  { type: "token_limit", value: 4000 },
  { type: "technique_exclusion", value: ["tree_of_thoughts"] },
]
```

### 4. Track Performance

```typescript
// Always record task completion
await promptingIntegration.onTaskComplete(event)
```

### 5. Cache Results

```typescript
// Reuse enhanced prompts for similar tasks
const cacheKey = `${task.substring(0, 50)}_${techniqueIds.join(",")}`
```

---

## Migration Guide

### From Manual Prompting

Before:

```typescript
const prompt = `Analyze this code: ${code}`
```

After:

```typescript
const enhanced = await promptingIntegration.enhanceSessionPrompt(
  sessionId,
  `Analyze this code: ${code}`,
)
const prompt = enhanced.content
```

### From Custom Techniques

Before:

```typescript
const prompt = applyCustomLogic(task)
```

After:

```typescript
// Register your custom technique
registry.register(new CustomTechnique())

// Use it through the system
const enhanced = await promptingIntegration.composePrompt(sessionId, task, [
  "custom_technique",
])
```

---

## Performance Considerations

### Caching

- Techniques are cached in memory after first load
- Composed prompts can be cached by task similarity
- Performance metrics are aggregated asynchronously

### Latency

- Technique loading: <10ms (cached)
- Task analysis: <20ms
- Technique selection: <10ms
- Composition: <20ms per technique
- Total overhead: <50ms (95th percentile)

### Memory Usage

- ~100KB per loaded technique
- ~10MB for full system with all techniques
- LRU cache eviction for composed prompts

---

## Debugging

### Enable Debug Logging

```typescript
process.env.DGMO_PROMPTING_DEBUG = "true"
```

### Trace Technique Selection

```typescript
const enhanced = await promptingIntegration.enhanceSessionPrompt(
  sessionId,
  task,
  [{ type: "debug", value: true }],
)
console.log(enhanced.metadata.selectionTrace)
```

### Monitor Performance

```typescript
const metrics = await promptingIntegration.getPerformanceMetrics()
console.log(JSON.stringify(metrics, null, 2))
```
