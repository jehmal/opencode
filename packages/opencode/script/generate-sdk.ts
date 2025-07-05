#!/usr/bin/env bun

import { Server } from "../src/server/server"

async function generateSDK() {
  console.log("Generating OpenAPI spec...")

  // Generate OpenAPI spec
  const spec = await Server.openapi()

  // Write spec to file
  const specPath = "./openapi.json"
  await Bun.file(specPath).write(JSON.stringify(spec, null, 2))
  console.log(`OpenAPI spec written to ${specPath}`)

  console.log("\nTo regenerate the Go SDK:")
  console.log(
    "1. Install Stainless CLI: npm install -g @stainless-api/stainless-cli",
  )
  console.log("2. Configure Stainless with your API key")
  console.log(
    "3. Run: stainless generate --spec openapi.json --language go --output ../../../opencode-sdk-go",
  )
  console.log("\nNote: The SDK generation requires Stainless API access.")
  console.log(
    "For now, you can manually update the Go SDK by adding the sub-session methods.",
  )
}

generateSDK().catch(console.error)
