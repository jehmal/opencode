import { z } from "zod"
import { Bus } from "../bus"

// MCP Call Started Event
export const MCPCallStartedEvent = Bus.event(
  "mcp.call.started",
  z.object({
    id: z.string(),
    server: z.string(),
    method: z.string(),
    sessionID: z.string(),
    parameters: z.record(z.any()).optional(),
    timestamp: z.number(),
  }),
)

// MCP Call Progress Event
export const MCPCallProgressEvent = Bus.event(
  "mcp.call.progress",
  z.object({
    id: z.string(),
    message: z.string(),
    timestamp: z.number(),
  }),
)

// MCP Call Completed Event
export const MCPCallCompletedEvent = Bus.event(
  "mcp.call.completed",
  z.object({
    id: z.string(),
    duration: z.number(),
    response: z.any().optional(),
    timestamp: z.number(),
  }),
)

// MCP Call Failed Event
export const MCPCallFailedEvent = Bus.event(
  "mcp.call.failed",
  z.object({
    id: z.string(),
    error: z.string(),
    duration: z.number(),
    timestamp: z.number(),
  }),
)

// Helper functions to publish MCP events
export function emitMCPCallStarted(
  data: z.infer<typeof MCPCallStartedEvent.properties>,
) {
  Bus.publish(MCPCallStartedEvent, data)
}

export function emitMCPCallProgress(
  data: z.infer<typeof MCPCallProgressEvent.properties>,
) {
  Bus.publish(MCPCallProgressEvent, data)
}

export function emitMCPCallCompleted(
  data: z.infer<typeof MCPCallCompletedEvent.properties>,
) {
  Bus.publish(MCPCallCompletedEvent, data)
}

export function emitMCPCallFailed(
  data: z.infer<typeof MCPCallFailedEvent.properties>,
) {
  Bus.publish(MCPCallFailedEvent, data)
}
