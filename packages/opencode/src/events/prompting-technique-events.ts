import { z } from "zod"
import { Bus } from "../bus"

// Define prompting technique event types
export const PromptingTechniqueSelectedEvent = Bus.event(
  "prompting.technique.selected",
  z.object({
    sessionID: z.string(),
    taskID: z.string().optional(),
    techniques: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string().optional(),
        confidence: z.number().min(0).max(1),
      }),
    ),
    selectionMode: z.enum(["auto", "manual"]),
    context: z.string().optional(),
    timestamp: z.number(),
  }),
)

export const PromptingTechniqueAppliedEvent = Bus.event(
  "prompting.technique.applied",
  z.object({
    sessionID: z.string(),
    taskID: z.string().optional(),
    techniqueID: z.string(),
    techniqueName: z.string(),
    originalPrompt: z.string(),
    enhancedPrompt: z.string(),
    enhancementDetails: z
      .object({
        addedElements: z.array(z.string()).optional(),
        structureChanges: z.string().optional(),
        confidenceScore: z.number().min(0).max(1),
      })
      .optional(),
    timestamp: z.number(),
  }),
)

export const PromptingTechniquePerformanceEvent = Bus.event(
  "prompting.technique.performance",
  z.object({
    sessionID: z.string(),
    techniqueID: z.string(),
    techniqueName: z.string(),
    metrics: z.object({
      successRate: z.number().min(0).max(1),
      averageConfidence: z.number().min(0).max(1),
      usageCount: z.number().int().min(0),
      lastUsed: z.number(),
      taskTypes: z.array(z.string()).optional(),
      averageResponseTime: z.number().optional(),
    }),
    timestamp: z.number(),
  }),
)

export const PromptingTechniqueEvaluationEvent = Bus.event(
  "prompting.technique.evaluation",
  z.object({
    sessionID: z.string(),
    taskID: z.string().optional(),
    techniqueID: z.string(),
    techniqueName: z.string(),
    evaluation: z.object({
      effectiveness: z.number().min(0).max(1),
      clarity: z.number().min(0).max(1),
      completeness: z.number().min(0).max(1),
      overallScore: z.number().min(0).max(1),
      feedback: z.string().optional(),
    }),
    timestamp: z.number(),
  }),
)

// Helper functions to emit prompting technique events
export function emitPromptingTechniqueSelected(
  data: z.infer<typeof PromptingTechniqueSelectedEvent.properties>,
) {
  Bus.publish(PromptingTechniqueSelectedEvent, data)
}

export function emitPromptingTechniqueApplied(
  data: z.infer<typeof PromptingTechniqueAppliedEvent.properties>,
) {
  Bus.publish(PromptingTechniqueAppliedEvent, data)
}

export function emitPromptingTechniquePerformance(
  data: z.infer<typeof PromptingTechniquePerformanceEvent.properties>,
) {
  Bus.publish(PromptingTechniquePerformanceEvent, data)
}

export function emitPromptingTechniqueEvaluation(
  data: z.infer<typeof PromptingTechniqueEvaluationEvent.properties>,
) {
  Bus.publish(PromptingTechniqueEvaluationEvent, data)
}
