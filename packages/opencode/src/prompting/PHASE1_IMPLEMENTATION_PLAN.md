# Phase 1 Implementation Plan: DGMO Prompting Techniques Integration

## Overview

This document provides a detailed, actionable implementation plan for Phase 1 of integrating prompting techniques into DGMO. The focus is on establishing the core infrastructure and demonstrating functionality with Chain of Thought (CoT) as the pilot technique.

## Phase 1 Goals

1. Extract all 18 techniques from MCP server JSON files
2. Convert them to TypeScript modules with proper typing
3. Create a basic technique registry system
4. Implement a simple technique loader
5. Test integration with Chain of Thought (CoT)
6. Integrate with existing DGMO session system

## Success Criteria

- ✅ All 18 techniques loaded and accessible in <10ms
- ✅ CoT technique fully functional with DGMO sessions
- ✅ Type-safe TypeScript implementation
- ✅ Zero runtime dependencies on MCP server
- ✅ Comprehensive test coverage for CoT

## Implementation Timeline

- **Day 1-2**: Setup and JSON extraction
- **Day 3-4**: TypeScript conversion and types
- **Day 5-6**: Registry and loader implementation
- **Day 7-8**: CoT pilot implementation
- **Day 9-10**: Testing and integration

## Step-by-Step Implementation Guide

### Step 1: Project Structure Setup

Create the following directory structure:

```bash
src/prompting/
├── types/
│   ├── index.ts              # Core type definitions
│   └── technique.ts          # Technique-specific types
├── registry/
│   ├── technique-registry.ts # Registry implementation
│   ├── technique-loader.ts   # Loader implementation
│   └── index.ts             # Registry exports
├── techniques/
│   ├── base/
│   │   └── base-technique.ts # Base class for all techniques
│   ├── reasoning/
│   │   ├── chain-of-thought.ts
│   │   ├── tree-of-thoughts.ts
│   │   └── program-aided.ts
│   ├── generation/
│   │   ├── few-shot.ts
│   │   └── persona-based.ts
│   ├── multi-agent/
│   │   ├── coordination.ts
│   │   ├── communication-protocol.ts
│   │   ├── consensus-building.ts
│   │   └── hierarchical-decomposition.ts
│   ├── optimization/
│   │   ├── self-consistency.ts
│   │   ├── iterative-refinement.ts
│   │   └── active-prompt.ts
│   └── advanced/
│       ├── constitutional-ai.ts
│       ├── meta-prompting.ts
│       ├── generated-knowledge.ts
│       ├── prompt-chaining.ts
│       ├── react.ts
│       └── reflexion.ts
├── integration/
│   └── session-integration.ts # DGMO session integration
├── scripts/
│   └── migrate-json-to-ts.ts  # Migration script
└── index.ts                    # Main exports
```

### Step 2: Core Type Definitions

**File: `src/prompting/types/technique.ts`**

```typescript
import { z } from "zod"

// Enums for technique metadata
export enum TechniqueCategory {
  REASONING = "reasoning",
  GENERATION = "generation",
  MULTI_AGENT = "multi_agent",
  OPTIMIZATION = "optimization",
  ADVANCED = "advanced",
}

export enum ComplexityLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export enum TaskType {
  ANALYSIS = "analysis",
  GENERATION = "generation",
  REASONING = "reasoning",
  CODING = "coding",
  PLANNING = "planning",
  DEBUGGING = "debugging",
  RESEARCH = "research",
}

// Core technique interface
export interface PromptingTechnique {
  id: string
  name: string
  category: TechniqueCategory
  description: string

  // Implementation
  apply(context: TechniqueContext): Promise<EnhancedPrompt>
  validate(input: any): boolean

  // Metadata
  complexity: ComplexityLevel
  suitableFor: TaskType[]
  incompatibleWith?: string[]

  // Usage guidance
  whenToUse: string[]
  howToImplement: string
  examples: TechniqueExample[]
  variations?: string[]
  effectiveness: string
  limitations: string[]
  tips: string[]
}

export interface TechniqueContext {
  task: string
  sessionId: string
  agentId: string
  variables: Record<string, any>
  previousTechniques?: string[]
}

export interface EnhancedPrompt {
  content: string
  metadata: {
    techniqueId: string
    techniqueName: string
    confidence: number
    estimatedTokens: number
  }
  variables: Record<string, any>
}

export interface TechniqueExample {
  prompt: string
  response?: string
  explanation?: string
}

// Zod schemas for validation
export const TechniqueContextSchema = z.object({
  task: z.string(),
  sessionId: z.string(),
  agentId: z.string(),
  variables: z.record(z.any()),
  previousTechniques: z.array(z.string()).optional(),
})

export const EnhancedPromptSchema = z.object({
  content: z.string(),
  metadata: z.object({
    techniqueId: z.string(),
    techniqueName: z.string(),
    confidence: z.number().min(0).max(1),
    estimatedTokens: z.number().positive(),
  }),
  variables: z.record(z.any()),
})
```

**File: `src/prompting/types/index.ts`**

```typescript
export * from "./technique"

// Registry types
export interface TechniqueRegistry {
  register(technique: PromptingTechnique): void
  get(id: string): PromptingTechnique | undefined
  getAll(): PromptingTechnique[]
  getByCategory(category: TechniqueCategory): PromptingTechnique[]
  search(query: string): PromptingTechnique[]
}

// Loader types
export interface TechniqueLoader {
  loadAll(): Promise<void>
  loadTechnique(id: string): Promise<PromptingTechnique>
  isLoaded(id: string): boolean
}

// Performance metrics
export interface TechniqueMetrics {
  loadTime: number
  applyTime: number
  totalExecutions: number
  averageConfidence: number
}
```

### Step 3: Base Technique Implementation

**File: `src/prompting/techniques/base/base-technique.ts`**

```typescript
import {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TechniqueCategory,
  ComplexityLevel,
  TaskType,
  TechniqueExample,
  TechniqueContextSchema,
} from "../../types"

export abstract class BaseTechnique implements PromptingTechnique {
  abstract id: string
  abstract name: string
  abstract category: TechniqueCategory
  abstract description: string
  abstract complexity: ComplexityLevel
  abstract suitableFor: TaskType[]
  abstract whenToUse: string[]
  abstract howToImplement: string
  abstract examples: TechniqueExample[]
  abstract effectiveness: string
  abstract limitations: string[]
  abstract tips: string[]

  incompatibleWith?: string[]
  variations?: string[]

  validate(input: any): boolean {
    try {
      TechniqueContextSchema.parse(input)
      return true
    } catch {
      return false
    }
  }

  abstract apply(context: TechniqueContext): Promise<EnhancedPrompt>

  protected estimateTokens(content: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(content.length / 4)
  }

  protected createEnhancedPrompt(
    content: string,
    confidence: number,
    variables: Record<string, any> = {},
  ): EnhancedPrompt {
    return {
      content,
      metadata: {
        techniqueId: this.id,
        techniqueName: this.name,
        confidence,
        estimatedTokens: this.estimateTokens(content),
      },
      variables,
    }
  }
}
```

### Step 4: Chain of Thought Implementation

**File: `src/prompting/techniques/reasoning/chain-of-thought.ts`**

```typescript
import {
  TechniqueContext,
  EnhancedPrompt,
  TechniqueCategory,
  ComplexityLevel,
  TaskType,
  TechniqueExample,
} from "../../types"
import { BaseTechnique } from "../base/base-technique"

export class ChainOfThoughtTechnique extends BaseTechnique {
  id = "cot"
  name = "Chain of Thought (CoT)"
  category = TechniqueCategory.REASONING
  description =
    "Encourages step-by-step reasoning to solve complex problems by breaking them down into intermediate steps"
  complexity = ComplexityLevel.MEDIUM

  suitableFor = [
    TaskType.REASONING,
    TaskType.ANALYSIS,
    TaskType.DEBUGGING,
    TaskType.PLANNING,
  ]

  whenToUse = [
    "Complex mathematical problems",
    "Multi-step logical reasoning",
    "Problems requiring detailed explanations",
    "Debugging and troubleshooting tasks",
  ]

  howToImplement =
    "Add phrases like 'Let's think step by step', 'Show your reasoning', or 'Explain each step' to your prompts"

  examples: TechniqueExample[] = [
    {
      prompt:
        "Q: If a train travels 120 miles in 2 hours, then stops for 30 minutes, then travels another 90 miles in 1.5 hours, what was its average speed for the entire journey including the stop?\n\nLet's solve this step by step:",
      response:
        "Step 1: Calculate total distance\n- First segment: 120 miles\n- Second segment: 90 miles\n- Total distance: 120 + 90 = 210 miles\n\nStep 2: Calculate total time\n- First segment: 2 hours\n- Stop time: 30 minutes = 0.5 hours\n- Second segment: 1.5 hours\n- Total time: 2 + 0.5 + 1.5 = 4 hours\n\nStep 3: Calculate average speed\n- Average speed = Total distance ÷ Total time\n- Average speed = 210 miles ÷ 4 hours = 52.5 mph",
    },
  ]

  variations = [
    "Zero-shot CoT: No examples provided",
    "Few-shot CoT: Include examples",
    "Self-consistency CoT: Generate multiple reasoning paths",
  ]

  effectiveness =
    "Very high for reasoning tasks, mathematics, and logical problems. Reduces errors by 20-40% on complex problems."

  limitations = [
    "Increases token usage",
    "May overthink simple problems",
    "Can introduce errors in intermediate steps",
  ]

  tips = [
    "Be explicit about showing work",
    "Encourage verification of each step",
    "Use for problems with clear logical progression",
  ]

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    const { task, variables } = context

    // Determine the best CoT variant based on task analysis
    const useExamples = this.shouldUseExamples(task)
    const stepIndicator = this.getStepIndicator(task)

    let enhancedTask = task

    // Add CoT prompting based on task type
    if (
      !task.toLowerCase().includes("step by step") &&
      !task.toLowerCase().includes("show your reasoning")
    ) {
      enhancedTask = `${task}\n\n${stepIndicator}`
    }

    // Add examples if beneficial
    if (useExamples && this.examples.length > 0) {
      const example = this.examples[0]
      enhancedTask = `Example:\n${example.prompt}\n\nResponse:\n${example.response}\n\nNow, for your task:\n${enhancedTask}`
    }

    // Calculate confidence based on task suitability
    const confidence = this.calculateConfidence(task)

    return this.createEnhancedPrompt(enhancedTask, confidence, {
      ...variables,
      techniqueVariant: useExamples ? "few-shot" : "zero-shot",
      stepIndicator,
    })
  }

  private shouldUseExamples(task: string): boolean {
    const complexityIndicators = [
      "complex",
      "difficult",
      "multi-step",
      "calculate",
      "solve",
    ]
    return complexityIndicators.some((indicator) =>
      task.toLowerCase().includes(indicator),
    )
  }

  private getStepIndicator(task: string): string {
    const taskLower = task.toLowerCase()

    if (taskLower.includes("debug") || taskLower.includes("error")) {
      return "Let's debug this step by step:"
    }

    if (taskLower.includes("math") || taskLower.includes("calculate")) {
      return "Let's solve this step by step, showing all calculations:"
    }

    if (taskLower.includes("analyze")) {
      return "Let's analyze this step by step:"
    }

    return "Let's think through this step by step:"
  }

  private calculateConfidence(task: string): number {
    const taskLower = task.toLowerCase()
    let confidence = 0.7 // Base confidence

    // Increase confidence for highly suitable tasks
    const highConfidenceKeywords = [
      "step",
      "reason",
      "explain",
      "calculate",
      "solve",
      "debug",
    ]

    highConfidenceKeywords.forEach((keyword) => {
      if (taskLower.includes(keyword)) {
        confidence += 0.05
      }
    })

    // Decrease confidence for less suitable tasks
    const lowConfidenceKeywords = ["simple", "quick", "brief", "summarize"]

    lowConfidenceKeywords.forEach((keyword) => {
      if (taskLower.includes(keyword)) {
        confidence -= 0.1
      }
    })

    return Math.max(0.1, Math.min(1.0, confidence))
  }
}
```

### Step 5: Registry Implementation

**File: `src/prompting/registry/technique-registry.ts`**

```typescript
import {
  PromptingTechnique,
  TechniqueCategory,
  TechniqueRegistry as ITechniqueRegistry,
} from "../types"
import { Log } from "../../util/log"

export class TechniqueRegistry implements ITechniqueRegistry {
  private techniques = new Map<string, PromptingTechnique>()
  private log = Log.create({ service: "technique-registry" })

  register(technique: PromptingTechnique): void {
    const startTime = performance.now()

    if (this.techniques.has(technique.id)) {
      this.log.warn(`Technique ${technique.id} already registered, overwriting`)
    }

    this.techniques.set(technique.id, technique)

    const loadTime = performance.now() - startTime
    this.log.info(
      `Registered technique ${technique.id} in ${loadTime.toFixed(2)}ms`,
    )
  }

  get(id: string): PromptingTechnique | undefined {
    return this.techniques.get(id)
  }

  getAll(): PromptingTechnique[] {
    return Array.from(this.techniques.values())
  }

  getByCategory(category: TechniqueCategory): PromptingTechnique[] {
    return this.getAll().filter((t) => t.category === category)
  }

  search(query: string): PromptingTechnique[] {
    const queryLower = query.toLowerCase()
    return this.getAll().filter(
      (technique) =>
        technique.name.toLowerCase().includes(queryLower) ||
        technique.description.toLowerCase().includes(queryLower) ||
        technique.id.toLowerCase().includes(queryLower),
    )
  }

  // Performance metrics
  getMetrics(): {
    totalTechniques: number
    byCategory: Record<string, number>
  } {
    const byCategory: Record<string, number> = {}

    for (const technique of this.techniques.values()) {
      byCategory[technique.category] = (byCategory[technique.category] || 0) + 1
    }

    return {
      totalTechniques: this.techniques.size,
      byCategory,
    }
  }
}

// Singleton instance
export const techniqueRegistry = new TechniqueRegistry()
```

**File: `src/prompting/registry/technique-loader.ts`**

```typescript
import {
  TechniqueLoader as ITechniqueLoader,
  PromptingTechnique,
} from "../types"
import { techniqueRegistry } from "./technique-registry"
import { Log } from "../../util/log"

// Import all techniques
import { ChainOfThoughtTechnique } from "../techniques/reasoning/chain-of-thought"
// Import other techniques as they're implemented...

export class TechniqueLoader implements ITechniqueLoader {
  private loaded = new Set<string>()
  private log = Log.create({ service: "technique-loader" })

  async loadAll(): Promise<void> {
    const startTime = performance.now()

    // List of all technique classes
    const techniqueClasses = [
      ChainOfThoughtTechnique,
      // Add other technique classes here as they're implemented
    ]

    // Load techniques in parallel
    const loadPromises = techniqueClasses.map((TechniqueClass) =>
      this.loadTechniqueClass(TechniqueClass),
    )

    await Promise.all(loadPromises)

    const totalTime = performance.now() - startTime
    this.log.info(
      `Loaded ${this.loaded.size} techniques in ${totalTime.toFixed(2)}ms`,
    )

    // Verify performance requirement
    if (totalTime > 10) {
      this.log.warn(
        `Technique loading exceeded 10ms target: ${totalTime.toFixed(2)}ms`,
      )
    }
  }

  async loadTechnique(id: string): Promise<PromptingTechnique> {
    const existing = techniqueRegistry.get(id)
    if (existing) {
      return existing
    }

    throw new Error(`Technique ${id} not found`)
  }

  isLoaded(id: string): boolean {
    return this.loaded.has(id)
  }

  private async loadTechniqueClass(
    TechniqueClass: new () => PromptingTechnique,
  ): Promise<void> {
    try {
      const technique = new TechniqueClass()
      techniqueRegistry.register(technique)
      this.loaded.add(technique.id)
    } catch (error) {
      this.log.error(`Failed to load technique`, { error })
    }
  }
}

// Singleton instance
export const techniqueLoader = new TechniqueLoader()
```

### Step 6: Migration Script

**File: `src/prompting/scripts/migrate-json-to-ts.ts`**

```typescript
#!/usr/bin/env bun

import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

// This script extracts technique data from MCP server and generates TypeScript files

interface MCPTechnique {
  id: string
  name: string
  category: string
  description: string
  when_to_use: string[]
  how_to_implement: string
  examples: Array<{
    prompt: string
    response?: string
  }>
  variations?: string[]
  effectiveness: string
  limitations: string[]
  tips: string[]
}

const categoryMap: Record<string, string> = {
  reasoning: "reasoning",
  generation: "generation",
  multi_agent: "multi-agent",
  optimization: "optimization",
  advanced: "advanced",
}

const complexityMap: Record<string, string> = {
  cot: "MEDIUM",
  tot: "HIGH",
  few_shot: "LOW",
  persona: "LOW",
  multi_agent_coordination: "HIGH",
  self_consistency: "HIGH",
  constitutional_ai: "HIGH",
  meta_prompting: "HIGH",
  iterative_refinement: "MEDIUM",
  agent_communication_protocol: "MEDIUM",
  consensus_building: "HIGH",
  hierarchical_decomposition: "HIGH",
  generated_knowledge: "MEDIUM",
  prompt_chaining: "MEDIUM",
  active_prompt: "HIGH",
  pal: "HIGH",
  react: "HIGH",
  reflexion: "HIGH",
}

const taskTypeMap: Record<string, string[]> = {
  cot: ["REASONING", "ANALYSIS", "DEBUGGING", "PLANNING"],
  tot: ["REASONING", "PLANNING", "ANALYSIS"],
  few_shot: ["GENERATION", "CODING"],
  persona: ["GENERATION", "RESEARCH"],
  // Add mappings for other techniques...
}

function generateTechniqueClass(technique: MCPTechnique): string {
  const className =
    technique.id
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("") + "Technique"

  const category = categoryMap[technique.category] || technique.category
  const complexity = complexityMap[technique.id] || "MEDIUM"
  const taskTypes = taskTypeMap[technique.id] || ["ANALYSIS"]

  return `import { 
  TechniqueContext, 
  EnhancedPrompt,
  TechniqueCategory,
  ComplexityLevel,
  TaskType,
  TechniqueExample
} from "../../types"
import { BaseTechnique } from "../base/base-technique"

export class ${className} extends BaseTechnique {
  id = "${technique.id}"
  name = "${technique.name}"
  category = TechniqueCategory.${category.toUpperCase()}
  description = "${technique.description}"
  complexity = ComplexityLevel.${complexity}
  
  suitableFor = [
    ${taskTypes.map((t) => `TaskType.${t}`).join(",\n    ")}
  ]
  
  whenToUse = ${JSON.stringify(technique.when_to_use, null, 4).split("\n").join("\n  ")}
  
  howToImplement = "${technique.how_to_implement}"
  
  examples: TechniqueExample[] = ${JSON.stringify(technique.examples, null, 4).split("\n").join("\n  ")}
  
  ${technique.variations ? `variations = ${JSON.stringify(technique.variations, null, 4).split("\n").join("\n  ")}` : ""}
  
  effectiveness = "${technique.effectiveness}"
  
  limitations = ${JSON.stringify(technique.limitations, null, 4).split("\n").join("\n  ")}
  
  tips = ${JSON.stringify(technique.tips, null, 4).split("\n").join("\n  ")}
  
  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    const { task, variables } = context
    
    // TODO: Implement technique-specific logic
    const enhancedTask = task
    const confidence = 0.8
    
    return this.createEnhancedPrompt(enhancedTask, confidence, variables)
  }
}
`
}

async function migrateTechniques() {
  console.log("Starting technique migration...")

  // In a real implementation, fetch this from MCP server
  // For now, using the CoT example
  const techniques: MCPTechnique[] = [
    {
      id: "cot",
      name: "Chain of Thought (CoT)",
      category: "reasoning",
      description:
        "Encourages step-by-step reasoning to solve complex problems by breaking them down into intermediate steps",
      when_to_use: [
        "Complex mathematical problems",
        "Multi-step logical reasoning",
        "Problems requiring detailed explanations",
        "Debugging and troubleshooting tasks",
      ],
      how_to_implement:
        "Add phrases like 'Let's think step by step', 'Show your reasoning', or 'Explain each step' to your prompts",
      examples: [
        {
          prompt:
            "Q: If a train travels 120 miles in 2 hours, then stops for 30 minutes, then travels another 90 miles in 1.5 hours, what was its average speed for the entire journey including the stop?\n\nLet's solve this step by step:",
          response:
            "Step 1: Calculate total distance\n- First segment: 120 miles\n- Second segment: 90 miles\n- Total distance: 120 + 90 = 210 miles\n\nStep 2: Calculate total time\n- First segment: 2 hours\n- Stop time: 30 minutes = 0.5 hours\n- Second segment: 1.5 hours\n- Total time: 2 + 0.5 + 1.5 = 4 hours\n\nStep 3: Calculate average speed\n- Average speed = Total distance ÷ Total time\n- Average speed = 210 miles ÷ 4 hours = 52.5 mph",
        },
      ],
      variations: [
        "Zero-shot CoT: No examples provided",
        "Few-shot CoT: Include examples",
        "Self-consistency CoT: Generate multiple reasoning paths",
      ],
      effectiveness:
        "Very high for reasoning tasks, mathematics, and logical problems. Reduces errors by 20-40% on complex problems.",
      limitations: [
        "Increases token usage",
        "May overthink simple problems",
        "Can introduce errors in intermediate steps",
      ],
      tips: [
        "Be explicit about showing work",
        "Encourage verification of each step",
        "Use for problems with clear logical progression",
      ],
    },
  ]

  for (const technique of techniques) {
    const categoryDir = categoryMap[technique.category] || technique.category
    const fileName = technique.id.replace(/_/g, "-") + ".ts"
    const filePath = join(
      process.cwd(),
      "src/prompting/techniques",
      categoryDir,
      fileName,
    )

    // Create directory if it doesn't exist
    await mkdir(join(process.cwd(), "src/prompting/techniques", categoryDir), {
      recursive: true,
    })

    // Generate and write the TypeScript file
    const content = generateTechniqueClass(technique)
    await writeFile(filePath, content)

    console.log(`✅ Generated ${filePath}`)
  }

  console.log("\nMigration complete! Remember to:")
  console.log("1. Update the technique loader with all technique imports")
  console.log("2. Implement the apply() method for each technique")
  console.log("3. Run tests to verify everything works")
}

// Run the migration
migrateTechniques().catch(console.error)
```

### Step 7: DGMO Session Integration

**File: `src/prompting/integration/session-integration.ts`**

```typescript
import { Session } from "../../session"
import { techniqueRegistry, techniqueLoader } from "../registry"
import { TechniqueContext, EnhancedPrompt } from "../types"
import { Log } from "../../util/log"

export class PromptingIntegration {
  private static instance: PromptingIntegration
  private initialized = false
  private log = Log.create({ service: "prompting-integration" })

  static getInstance(): PromptingIntegration {
    if (!this.instance) {
      this.instance = new PromptingIntegration()
    }
    return this.instance
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    const startTime = performance.now()
    await techniqueLoader.loadAll()

    const loadTime = performance.now() - startTime
    this.log.info(`Prompting system initialized in ${loadTime.toFixed(2)}ms`)

    this.initialized = true
  }

  async enhancePrompt(
    sessionId: string,
    task: string,
    techniqueId?: string,
  ): Promise<EnhancedPrompt> {
    if (!this.initialized) {
      await this.initialize()
    }

    // Get technique (default to CoT for now)
    const technique = techniqueRegistry.get(techniqueId || "cot")
    if (!technique) {
      throw new Error(`Technique ${techniqueId} not found`)
    }

    // Build context
    const context: TechniqueContext = {
      task,
      sessionId,
      agentId: sessionId, // For now, use session ID as agent ID
      variables: {},
    }

    // Apply technique
    const enhancedPrompt = await technique.apply(context)

    this.log.info(`Enhanced prompt with ${technique.name}`, {
      sessionId,
      techniqueId: technique.id,
      confidence: enhancedPrompt.metadata.confidence,
      estimatedTokens: enhancedPrompt.metadata.estimatedTokens,
    })

    return enhancedPrompt
  }

  // Helper method to integrate with existing session system
  async enhanceSessionMessage(
    session: Session,
    message: string,
    techniqueId?: string,
  ): Promise<string> {
    const enhanced = await this.enhancePrompt(session.id, message, techniqueId)
    return enhanced.content
  }
}

// Export singleton instance
export const promptingIntegration = PromptingIntegration.getInstance()
```

### Step 8: Test Implementation

**File: `test/prompting/chain-of-thought.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from "bun:test"
import { ChainOfThoughtTechnique } from "../../src/prompting/techniques/reasoning/chain-of-thought"
import {
  techniqueRegistry,
  techniqueLoader,
} from "../../src/prompting/registry"
import { promptingIntegration } from "../../src/prompting/integration/session-integration"
import { TechniqueContext } from "../../src/prompting/types"

describe("Chain of Thought Integration", () => {
  beforeAll(async () => {
    await techniqueLoader.loadAll()
  })

  describe("ChainOfThoughtTechnique", () => {
    it("should be registered in the registry", () => {
      const cot = techniqueRegistry.get("cot")
      expect(cot).toBeDefined()
      expect(cot?.name).toBe("Chain of Thought (CoT)")
    })

    it("should enhance a mathematical problem", async () => {
      const cot = new ChainOfThoughtTechnique()
      const context: TechniqueContext = {
        task: "Calculate the sum of all prime numbers between 1 and 20",
        sessionId: "test-session",
        agentId: "test-agent",
        variables: {},
      }

      const enhanced = await cot.apply(context)

      expect(enhanced.content).toContain("step by step")
      expect(enhanced.metadata.techniqueId).toBe("cot")
      expect(enhanced.metadata.confidence).toBeGreaterThan(0.7)
    })

    it("should adapt step indicator based on task type", async () => {
      const cot = new ChainOfThoughtTechnique()

      // Debug task
      const debugContext: TechniqueContext = {
        task: "Debug why the function is returning null",
        sessionId: "test-session",
        agentId: "test-agent",
        variables: {},
      }

      const debugEnhanced = await cot.apply(debugContext)
      expect(debugEnhanced.content).toContain("debug this step by step")

      // Analysis task
      const analysisContext: TechniqueContext = {
        task: "Analyze the performance bottlenecks in this code",
        sessionId: "test-session",
        agentId: "test-agent",
        variables: {},
      }

      const analysisEnhanced = await cot.apply(analysisContext)
      expect(analysisEnhanced.content).toContain("analyze this step by step")
    })

    it("should calculate confidence based on task suitability", async () => {
      const cot = new ChainOfThoughtTechnique()

      // High confidence task
      const complexTask: TechniqueContext = {
        task: "Solve this complex mathematical equation and explain your reasoning",
        sessionId: "test-session",
        agentId: "test-agent",
        variables: {},
      }

      const complexEnhanced = await cot.apply(complexTask)
      expect(complexEnhanced.metadata.confidence).toBeGreaterThan(0.8)

      // Low confidence task
      const simpleTask: TechniqueContext = {
        task: "Give me a quick simple answer",
        sessionId: "test-session",
        agentId: "test-agent",
        variables: {},
      }

      const simpleEnhanced = await cot.apply(simpleTask)
      expect(simpleEnhanced.metadata.confidence).toBeLessThan(0.7)
    })
  })

  describe("Registry Performance", () => {
    it("should load all techniques in under 10ms", async () => {
      const startTime = performance.now()
      await techniqueLoader.loadAll()
      const loadTime = performance.now() - startTime

      expect(loadTime).toBeLessThan(10)
    })

    it("should retrieve techniques in under 1ms", () => {
      const startTime = performance.now()
      const technique = techniqueRegistry.get("cot")
      const retrieveTime = performance.now() - startTime

      expect(technique).toBeDefined()
      expect(retrieveTime).toBeLessThan(1)
    })
  })

  describe("Session Integration", () => {
    it("should enhance prompts through the integration layer", async () => {
      const enhanced = await promptingIntegration.enhancePrompt(
        "test-session",
        "Calculate the factorial of 10",
      )

      expect(enhanced.content).toContain("step by step")
      expect(enhanced.metadata.techniqueId).toBe("cot")
    })

    it("should handle technique not found gracefully", async () => {
      await expect(
        promptingIntegration.enhancePrompt(
          "test-session",
          "Test task",
          "non-existent-technique",
        ),
      ).rejects.toThrow("Technique non-existent-technique not found")
    })
  })
})
```

### Step 9: Integration with Existing DGMO

**File: `src/prompting/index.ts`**

```typescript
// Main exports for the prompting system
export * from "./types"
export { techniqueRegistry, techniqueLoader } from "./registry"
export { promptingIntegration } from "./integration/session-integration"

// Export all technique classes
export { ChainOfThoughtTechnique } from "./techniques/reasoning/chain-of-thought"
// Add other techniques as they're implemented...

// Initialize on import
import { promptingIntegration } from "./integration/session-integration"
promptingIntegration.initialize().catch(console.error)
```

**Update `src/session/session.ts`** to integrate prompting:

```typescript
import { promptingIntegration } from "../prompting"

// Add to Session class
export class Session {
  // ... existing code ...

  async enhancePrompt(message: string, techniqueId?: string): Promise<string> {
    try {
      const enhanced = await promptingIntegration.enhancePrompt(
        this.id,
        message,
        techniqueId,
      )
      return enhanced.content
    } catch (error) {
      this.log.warn("Failed to enhance prompt, using original", { error })
      return message
    }
  }

  // ... rest of the class ...
}
```

### Step 10: Usage Example

```typescript
// Example usage in DGMO
import { Session } from "./session"
import { techniqueRegistry } from "./prompting"

async function example() {
  const session = await Session.create()

  // List available techniques
  const techniques = techniqueRegistry.getAll()
  console.log(
    `Available techniques: ${techniques.map((t) => t.name).join(", ")}`,
  )

  // Enhance a prompt with CoT
  const task = "Debug why my React component is re-rendering infinitely"
  const enhanced = await session.enhancePrompt(task, "cot")

  console.log("Original task:", task)
  console.log("Enhanced prompt:", enhanced)
}
```

## Testing Strategy

1. **Unit Tests**: Test each technique in isolation
2. **Integration Tests**: Test registry, loader, and session integration
3. **Performance Tests**: Verify <10ms loading and <50ms total overhead
4. **E2E Tests**: Test full flow from session to enhanced prompt

## Success Metrics Verification

Run these commands to verify success:

```bash
# Run all tests
bun test test/prompting/

# Check performance
bun run src/prompting/scripts/performance-check.ts

# Verify type safety
bun run typecheck
```

## Next Steps

After Phase 1 completion:

1. Implement remaining 17 techniques following the CoT pattern
2. Add technique selection logic based on task analysis
3. Implement composition engine for multi-technique prompts
4. Add performance tracking and metrics collection
5. Create technique inheritance system for sub-agents

This implementation provides a solid foundation for the DGMO prompting system with clear patterns for extending to all 18 techniques.
