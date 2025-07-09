#!/usr/bin/env bun

// Test script to verify prompting UI changes

import { Session } from "./packages/opencode/src/session"

async function testPromptingUI() {
  console.log("Testing prompting UI changes...")

  // Create a test session
  const sessionId = "test-prompting-ui-" + Date.now()
  await Session.create(sessionId)

  console.log("Session created:", sessionId)

  // Test a simple prompt
  const testPrompt = "Explain how to implement a binary search algorithm"

  console.log("\nOriginal prompt:", testPrompt)
  console.log("\nTo test the changes:")
  console.log("1. Start the UI: cd packages/tui && go run .")
  console.log("2. Send this prompt:", testPrompt)
  console.log("\nExpected behavior:")
  console.log("- User message shows original prompt (not enhanced)")
  console.log(
    "- Assistant message shows technique indicator (e.g., '◆ CoT') above the message",
  )
  console.log(
    "\nThe enhanced prompt should be sent to the model but not shown in the UI.",
  )
}

testPromptingUI().catch(console.error)
