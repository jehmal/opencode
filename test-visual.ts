import { VisualModeServer } from "./opencode/packages/opencode/src/visual/server";

async function test() {
    console.log("Testing Visual Mode...");
    const server = new VisualModeServer({ sessionId: "test-123" });
    const port = await server.start();
    console.log("Server started on port", port);
    await server.stop();
    console.log("Test complete!");
}

test();
