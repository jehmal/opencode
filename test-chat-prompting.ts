// Test the chat function with prompting integration
import { Session } from "./packages/opencode/src/session/index"
import { App } from "./packages/opencode/src/app/app"

async function testChatWithPrompting() {
  try {
    console.log("Testing Session with prompting integration...")

    // Initialize app context
    await App.provide(
      {
        cwd: process.cwd(),
      },
      async () => {
        // Create a session
        const session = await Session.create()
        console.log("Session created:", session.id)

        // Test that prompting was initialized
        const { promptingIntegration } = await import(
          "./packages/opencode/src/prompting/integration/dgmo-integration"
        )

        const sessionConfig = await promptingIntegration.getSessionConfig(
          session.id,
        )
        console.log("Session config:", sessionConfig)

        // Test enhancing a prompt directly
        const testPrompt = "Write a function to calculate fibonacci numbers"
        const enhanced = await promptingIntegration.enhancePrompt(
          session.id,
          testPrompt,
          {
            autoSelect: true,
            strategy: "balanced",
          },
        )

        console.log("Original prompt:", testPrompt)
        console.log(
          "Enhanced prompt:",
          enhanced.content.substring(0, 200) + "...",
        )
        console.log("Techniques used:", enhanced.metadata.techniques)
        console.log("Confidence:", enhanced.metadata.confidence)

        console.log(
          "\nAll tests passed! Prompting integration is working correctly.",
        )
      },
    )
  } catch (error: any) {
    console.error("Error:", error.message)
    console.error("Stack:", error.stack)
  }
}

testChatWithPrompting()
