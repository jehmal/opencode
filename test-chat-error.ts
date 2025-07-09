// Test the chat function error
import { Session } from "./packages/opencode/src/session/index"

async function testChat() {
  try {
    console.log("Testing Session.chat...")

    // Create a session first
    const session = await Session.create({
      providerID: "anthropic",
      modelID: "claude-3-5-sonnet-latest",
    })

    console.log("Session created:", session.id)

    // Try to chat
    await Session.chat({
      sessionID: session.id,
      providerID: "anthropic",
      modelID: "claude-3-5-sonnet-latest",
      parts: [
        {
          type: "text",
          text: "Hello, this is a test",
        },
      ],
    })

    console.log("Chat completed successfully")
  } catch (error: any) {
    console.error("Error:", error.message)
    console.error("Stack:", error.stack)
  }
}

testChat()
