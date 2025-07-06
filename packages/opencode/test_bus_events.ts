#!/usr/bin/env bun

import {
  emitTaskStarted,
  emitTaskProgress,
  emitTaskCompleted,
  emitTaskFailed,
} from "./src/events/task-events"

console.log("Testing Bus event publishing...")

// Test task started event
console.log("Publishing TaskStarted event...")
emitTaskStarted({
  sessionID: "test-session-123",
  taskID: "test-task-456",
  agentName: "TestAgent",
  taskDescription: "Testing WebSocket broadcasting",
  timestamp: Date.now(),
})

// Test task progress event
console.log("Publishing TaskProgress event...")
emitTaskProgress({
  sessionID: "test-session-123",
  taskID: "test-task-456",
  progress: 50,
  message: "Testing progress broadcast",
  timestamp: Date.now(),
})

// Test task completed event
console.log("Publishing TaskCompleted event...")
emitTaskCompleted({
  sessionID: "test-session-123",
  taskID: "test-task-456",
  duration: 5000,
  success: true,
  summary: "Test completed successfully",
  timestamp: Date.now(),
})

// Test task failed event
console.log("Publishing TaskFailed event...")
emitTaskFailed({
  sessionID: "test-session-123",
  taskID: "test-task-789",
  error: "Test error for broadcasting",
  recoverable: true,
  timestamp: Date.now(),
})

console.log(
  "All test events published. Check WebSocket client for received messages.",
)
