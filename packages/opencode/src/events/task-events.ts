import { z } from "zod"
import { Bus } from "../bus"

// Define task event types
export const TaskStartedEvent = Bus.event(
  "task.started",
  z.object({
    sessionID: z.string(),
    taskID: z.string(),
    agentName: z.string(),
    taskDescription: z.string(),
    timestamp: z.number(),
  }),
)

export const TaskProgressEvent = Bus.event(
  "task.progress",
  z.object({
    sessionID: z.string(),
    taskID: z.string(),
    progress: z.number().min(0).max(100),
    message: z.string().optional(),
    timestamp: z.number(),
    startTime: z.number().optional(),
  }),
)

export const TaskCompletedEvent = Bus.event(
  "task.completed",
  z.object({
    sessionID: z.string(),
    taskID: z.string(),
    duration: z.number(),
    success: z.boolean(),
    summary: z.string().optional(),
    timestamp: z.number(),
  }),
)

export const TaskFailedEvent = Bus.event(
  "task.failed",
  z.object({
    sessionID: z.string(),
    taskID: z.string(),
    error: z.string(),
    recoverable: z.boolean(),
    timestamp: z.number(),
  }),
)

// Helper to emit task events
export function emitTaskStarted(
  data: z.infer<typeof TaskStartedEvent.properties>,
) {
  Bus.publish(TaskStartedEvent, data)
}

export function emitTaskProgress(
  data: z.infer<typeof TaskProgressEvent.properties>,
) {
  Bus.publish(TaskProgressEvent, data)
}

export function emitTaskCompleted(
  data: z.infer<typeof TaskCompletedEvent.properties>,
) {
  Bus.publish(TaskCompletedEvent, data)
}

export function emitTaskFailed(
  data: z.infer<typeof TaskFailedEvent.properties>,
) {
  Bus.publish(TaskFailedEvent, data)
}
