import { describe, it, expect } from "bun:test"
import { Bus } from "../src/bus"
import {
  emitPromptingTechniqueSelected,
  emitPromptingTechniqueApplied,
  emitPromptingTechniquePerformance,
  emitPromptingTechniqueEvaluation,
} from "../src/events/prompting-technique-events"

describe("Prompting Technique Events", () => {
  it("should emit technique selected event", async () => {
    const events: any[] = []
    const unsub = Bus.subscribeAll((event) => {
      if (event.type === "prompting.technique.selected") {
        events.push(event)
      }
    })

    emitPromptingTechniqueSelected({
      sessionID: "test-session",
      taskID: "test-task",
      techniques: [
        {
          id: "cot",
          name: "Chain of Thought",
          category: "reasoning",
          confidence: 0.95,
        },
      ],
      selectionMode: "auto",
      context: "Test context",
      timestamp: Date.now(),
    })

    // Wait for event to be processed
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(events.length).toBe(1)
    expect(events[0].type).toBe("prompting.technique.selected")
    expect(events[0].payload.sessionID).toBe("test-session")
    expect(events[0].payload.techniques[0].id).toBe("cot")

    unsub()
  })

  it("should emit technique applied event", async () => {
    const events: any[] = []
    const unsub = Bus.subscribeAll((event) => {
      if (event.type === "prompting.technique.applied") {
        events.push(event)
      }
    })

    emitPromptingTechniqueApplied({
      sessionID: "test-session",
      taskID: "test-task",
      techniqueID: "cot",
      techniqueName: "Chain of Thought",
      originalPrompt: "Solve this",
      enhancedPrompt: "Let's solve this step by step",
      enhancementDetails: {
        addedElements: ["step-by-step"],
        structureChanges: "Added structure",
        confidenceScore: 0.9,
      },
      timestamp: Date.now(),
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(events.length).toBe(1)
    expect(events[0].type).toBe("prompting.technique.applied")
    expect(events[0].payload.techniqueID).toBe("cot")

    unsub()
  })

  it("should emit performance event", async () => {
    const events: any[] = []
    const unsub = Bus.subscribeAll((event) => {
      if (event.type === "prompting.technique.performance") {
        events.push(event)
      }
    })

    emitPromptingTechniquePerformance({
      sessionID: "test-session",
      techniqueID: "cot",
      techniqueName: "Chain of Thought",
      metrics: {
        successRate: 0.95,
        averageConfidence: 0.9,
        usageCount: 10,
        lastUsed: Date.now(),
        taskTypes: ["problem_solving"],
        averageResponseTime: 2000,
      },
      timestamp: Date.now(),
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(events.length).toBe(1)
    expect(events[0].type).toBe("prompting.technique.performance")
    expect(events[0].payload.metrics.successRate).toBe(0.95)

    unsub()
  })

  it("should emit evaluation event", async () => {
    const events: any[] = []
    const unsub = Bus.subscribeAll((event) => {
      if (event.type === "prompting.technique.evaluation") {
        events.push(event)
      }
    })

    emitPromptingTechniqueEvaluation({
      sessionID: "test-session",
      taskID: "test-task",
      techniqueID: "cot",
      techniqueName: "Chain of Thought",
      evaluation: {
        effectiveness: 0.9,
        clarity: 0.95,
        completeness: 0.88,
        overallScore: 0.91,
        feedback: "Very effective",
      },
      timestamp: Date.now(),
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(events.length).toBe(1)
    expect(events[0].type).toBe("prompting.technique.evaluation")
    expect(events[0].payload.evaluation.effectiveness).toBe(0.9)

    unsub()
  })
})
