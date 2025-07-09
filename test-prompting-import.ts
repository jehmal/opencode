// Test prompting integration import
async function testImport() {
  try {
    console.log("Testing import...")
    const module = await import(
      "./packages/opencode/src/prompting/integration/dgmo-integration"
    )
    console.log("Module keys:", Object.keys(module))
    console.log(
      "promptingIntegration type:",
      typeof module.promptingIntegration,
    )

    if (module.promptingIntegration) {
      console.log("promptingIntegration exists")
      console.log(
        "Constructor name:",
        module.promptingIntegration.constructor.name,
      )
      console.log(
        "Has enhancePrompt:",
        typeof module.promptingIntegration.enhancePrompt === "function",
      )

      // List all methods
      const proto = Object.getPrototypeOf(module.promptingIntegration)
      const methods = Object.getOwnPropertyNames(proto)
      console.log("Methods:", methods)
    }
  } catch (error) {
    console.error("Import error:", error)
  }
}

testImport()
