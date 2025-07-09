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
