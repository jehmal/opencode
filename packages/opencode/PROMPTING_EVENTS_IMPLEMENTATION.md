# Prompting Technique Events Implementation

## Overview

Added server-side support for sending prompting technique events to the TUI through the existing event system.

## Implementation Details

### 1. Event Types Created (`src/events/prompting-technique-events.ts`)

- **PromptingTechniqueSelectedEvent**: Emitted when techniques are selected for a task
- **PromptingTechniqueAppliedEvent**: Emitted when a technique is applied to enhance a prompt
- **PromptingTechniquePerformanceEvent**: Emitted with performance metrics for techniques
- **PromptingTechniqueEvaluationEvent**: Emitted when techniques are evaluated

### 2. Server Endpoints Added (`src/server/server.ts`)

- `POST /prompting/technique/selected` - Emit technique selection events
- `POST /prompting/technique/applied` - Emit technique application events
- `POST /prompting/technique/performance` - Emit performance metrics
- `POST /prompting/technique/evaluation` - Emit evaluation events

### 3. Session Integration (`src/session/index.ts`)

Added hooks in the `Session.chat` function to automatically emit events when:

- Prompting techniques are selected (before chat execution)
- Techniques are applied to enhance prompts
- Performance metrics are calculated (after chat completion)

### 4. Event Payload Structure

#### Selected Event

```typescript
{
  sessionID: string
  taskID?: string
  techniques: Array<{
    id: string
    name: string
    category?: string
    confidence: number
  }>
  selectionMode: "auto" | "manual"
  context?: string
  timestamp: number
}
```

#### Applied Event

```typescript
{
  sessionID: string
  taskID?: string
  techniqueID: string
  techniqueName: string
  originalPrompt: string
  enhancedPrompt: string
  enhancementDetails?: {
    addedElements?: string[]
    structureChanges?: string
    confidenceScore: number
  }
  timestamp: number
}
```

#### Performance Event

```typescript
{
  sessionID: string
  techniqueID: string
  techniqueName: string
  metrics: {
    successRate: number
    averageConfidence: number
    usageCount: number
    lastUsed: number
    taskTypes?: string[]
    averageResponseTime?: number
  }
  timestamp: number
}
```

#### Evaluation Event

```typescript
{
  sessionID: string
  taskID?: string
  techniqueID: string
  techniqueName: string
  evaluation: {
    effectiveness: number
    clarity: number
    completeness: number
    overallScore: number
    feedback?: string
  }
  timestamp: number
}
```

## Usage

### From Client Code

```typescript
// Emit technique selected event
await fetch("/prompting/technique/selected", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sessionID: "session-123",
    techniques: [
      {
        id: "cot",
        name: "Chain of Thought",
        confidence: 0.95,
      },
    ],
    selectionMode: "auto",
  }),
})
```

### Automatic Emission via Session

When sending a message with prompting metadata:

```typescript
await Session.chat({
  sessionID: "session-123",
  providerID: "anthropic",
  modelID: "claude-3",
  parts: [{ type: "text", text: "Solve this problem" }],
  // Include prompting metadata
  metadata: {
    prompting: {
      techniques: [
        {
          id: "cot",
          name: "Chain of Thought",
          confidence: 0.95,
          applied: true,
        },
      ],
      selectionMode: "auto",
      originalPrompt: "Solve this problem",
      enhancedPrompt: "Let's solve this step by step...",
    },
  },
})
```

### Listening to Events

Events are streamed through the SSE endpoint:

```typescript
const eventSource = new EventSource("/event")
eventSource.addEventListener("message", (event) => {
  const data = JSON.parse(event.data)
  if (data.type.startsWith("prompting.technique.")) {
    console.log("Prompting event:", data)
  }
})
```

## Integration Points

1. **TUI Integration**: The TUI can subscribe to these events via the `/event` SSE endpoint
2. **Session Hooks**: Automatic event emission when messages include prompting metadata
3. **Manual Emission**: Direct API calls for custom integrations

## Testing

Created test file `test/prompting-events.test.ts` to verify event emission functionality.

## Future Enhancements

1. Add middleware to automatically enhance prompts with techniques
2. Integrate with the prompting integration system for automatic technique selection
3. Add persistence for technique performance metrics
4. Create dashboard endpoints for technique analytics
