import { promptingIntegration } from "./dgmo-integration"
import { SessionPromptEnhancer } from "./session-prompt-enhancer"
import { Bus } from "../../bus"
import { Session } from "../../session"
import { Log } from "../../util/log"

const log = Log.create({ service: "prompting-hooks" })

export class PromptingSessionHooks {
  private static initialized = false

  static async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Initialize the prompting integration
      await promptingIntegration.initialize()
      await SessionPromptEnhancer.initialize()

      // Subscribe to session events
      this.subscribeToSessionEvents()

      this.initialized = true
      log.info("Prompting session hooks initialized")
    } catch (error) {
      log.error("Failed to initialize prompting hooks", error)
    }
  }

  private static subscribeToSessionEvents(): void {
    // Clean up techniques when session is deleted
    Bus.subscribe(Session.Event.Deleted, async (event) => {
      const sessionId = event.properties.info.id

      try {
        await promptingIntegration.cleanupSession(sessionId)
        SessionPromptEnhancer.clearSessionTechniques(sessionId)

        log.info("Cleaned up prompting data for session", { sessionId })
      } catch (error) {
        log.error("Failed to cleanup prompting data", { sessionId, error })
      }
    })

    // Initialize techniques for new sessions
    Bus.subscribe(Session.Event.Updated, async (event) => {
      const info = event.properties.info

      // Only initialize for newly created sessions
      if (info.time.created === info.time.updated) {
        try {
          // Configure default techniques based on session type
          const isSubSession = !!info.parentID

          if (!isSubSession) {
            // Main sessions get balanced technique selection
            await promptingIntegration.configureSession({
              sessionId: info.id,
              techniques: [],
              autoSelect: true,
              strategy: "balanced",
            })
          }

          log.info("Initialized prompting for new session", {
            sessionId: info.id,
            isSubSession,
          })
        } catch (error) {
          log.error("Failed to initialize prompting for session", {
            sessionId: info.id,
            error,
          })
        }
      }
    })
  }

  static async enhanceSystemPrompt(
    sessionId: string,
    systemPrompts: string[],
  ): Promise<string[]> {
    try {
      // Get session configuration
      const config = await promptingIntegration.getSessionConfig(sessionId)

      if (!config || config.techniques.length === 0) {
        return systemPrompts
      }

      // Add technique-specific system prompts
      const techniquePrompts: string[] = []

      for (const techniqueId of config.techniques) {
        const technique = await promptingIntegration.getTechnique(techniqueId)
        if (technique) {
          // Add technique-specific instructions if available
          const instruction = `You are using the ${technique.name} prompting technique. ${technique.description}`
          techniquePrompts.push(instruction)
        }
      }

      // Combine original system prompts with technique prompts
      return [...systemPrompts, ...techniquePrompts]
    } catch (error) {
      log.error("Failed to enhance system prompt", { sessionId, error })
      return systemPrompts
    }
  }
}
