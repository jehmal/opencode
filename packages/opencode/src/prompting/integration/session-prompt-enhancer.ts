import { promptingIntegration } from "./dgmo-integration"
import { Log } from "../../util/log"
import { Bus } from "../../bus"
import { z } from "zod"

export class SessionPromptEnhancer {
  private static log = Log.create({ service: "prompt-enhancer" })
  private static enabled = true
  private static sessionTechniques = new Map<string, string[]>()

  // Event for prompt enhancement
  static PromptEnhanced = Bus.event(
    "prompting.prompt.enhanced",
    z.object({
      sessionId: z.string(),
      originalLength: z.number(),
      enhancedLength: z.number(),
      techniques: z.array(z.string()),
      timestamp: z.number(),
    }),
  )

  static async enhance(
    sessionId: string,
    prompt: string,
    options?: {
      forceEnable?: boolean
      techniques?: string[]
      autoSelect?: boolean
    },
  ): Promise<string> {
    // Check if enhancement is enabled
    if (!this.enabled && !options?.forceEnable) {
      return prompt
    }

    try {
      const startTime = performance.now()

      // Get or use provided techniques
      const techniques =
        options?.techniques || this.sessionTechniques.get(sessionId) || []

      // Enhance the prompt
      const enhanced = await promptingIntegration.enhancePrompt(
        sessionId,
        prompt,
        {
          techniques,
          autoSelect: options?.autoSelect ?? techniques.length === 0,
          strategy: "balanced",
        },
      )

      const duration = performance.now() - startTime

      // Emit enhancement event
      Bus.publish(this.PromptEnhanced, {
        sessionId,
        originalLength: prompt.length,
        enhancedLength: enhanced.length,
        techniques,
        timestamp: Date.now(),
      })

      this.log.info("Prompt enhanced", {
        sessionId,
        originalLength: prompt.length,
        enhancedLength: enhanced.length,
        duration: `${duration.toFixed(2)}ms`,
        techniques,
      })

      return enhanced
    } catch (error) {
      this.log.error("Failed to enhance prompt", {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Return original prompt on error
      return prompt
    }
  }

  static setSessionTechniques(sessionId: string, techniques: string[]): void {
    this.sessionTechniques.set(sessionId, techniques)
  }

  static clearSessionTechniques(sessionId: string): void {
    this.sessionTechniques.delete(sessionId)
  }

  static enable(): void {
    this.enabled = true
    this.log.info("Prompt enhancement enabled")
  }

  static disable(): void {
    this.enabled = false
    this.log.info("Prompt enhancement disabled")
  }

  static isEnabled(): boolean {
    return this.enabled
  }

  // Initialize the enhancer
  static async initialize(): Promise<void> {
    await promptingIntegration.initialize()
    this.log.info("Session prompt enhancer initialized")
  }
}
