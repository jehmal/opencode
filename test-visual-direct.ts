#!/usr/bin/env bun
import { VisualModeServer } from "./opencode/packages/opencode/src/visual/server";

console.log("Starting Visual Mode Server...");
const server = new VisualModeServer({ sessionId: "test-123" });
const port = await server.start();
console.log("Server running on port", port);
console.log("Press Ctrl+C to stop");
await new Promise(() => {});
