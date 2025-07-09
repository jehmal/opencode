# DGMO Prompting Techniques Integration

## Overview

The prompting techniques system has been seamlessly integrated with DGMO's session management, providing automatic prompt enhancement, technique selection, and performance tracking without breaking existing functionality.

## Key Integration Points

### 1. Session Management Integration

- **Automatic Initialization**: Techniques are automatically initialized for new sessions
- **Session Configuration**: Each session can have its own technique configuration
- **Cleanup**: Technique data is cleaned up when sessions are deleted

### 2. Task Tool Enhancement

The task tool now supports prompting techniques through new parameters:

```typescript
{
  techniques: string[]              // Specific techniques to use
  autoSelectTechniques: boolean     // Auto-select best techniques
  techniqueStrategy: "performance" | "balanced" | "exploration"
}
```

### 3. Prompt Enhancement

Prompts are enhanced before being sent to the LLM:

```typescript
// In task execution
let enhancedPrompt = params.prompt

if (params.techniques || params.autoSelectTechniques) {
  enhancedPrompt = await promptingIntegration.enhancePrompt(
    subSession.id,
    params.prompt,
    {
      techniques: params.techniques,
      autoSelect: params.autoSelectTechniques,
      strategy: params.techniqueStrategy,
    },
  )
}
```

### 4. Performance Tracking

Technique performance is tracked after task completion:

```typescript
await promptingIntegration.trackSessionPerformance(subSession.id, success, {
  duration,
  tokensUsed,
})
```

## Usage Examples

### Manual Technique Selection

```typescript
// Create a task with specific techniques
await task({
  description: "Analyze code",
  prompt: "Review this codebase for security vulnerabilities",
  techniques: ["chain-of-thought", "step-by-step"],
  autoSelectTechniques: false,
})
```

### Automatic Technique Selection

```typescript
// Let the system choose the best techniques
await task({
  description: "Debug issue",
  prompt: "Find why the authentication is failing",
  autoSelectTechniques: true,
  techniqueStrategy: "performance",
})
```

### Session-Level Configuration

```typescript
// Configure techniques for an entire session
await promptingIntegration.configureSession({
  sessionId: "session-123",
  techniques: ["few-shot", "chain-of-thought"],
  autoSelect: false,
  strategy: "balanced",
})
```

## Architecture

### Components

1. **DGMOPromptingIntegration**: Main integration class

   - Manages technique selection and application
   - Tracks performance metrics
   - Handles session configurations

2. **SessionPromptEnhancer**: Prompt enhancement utility

   - Intercepts and enhances prompts
   - Manages session-specific techniques
   - Emits enhancement events

3. **PromptingSessionHooks**: Session lifecycle integration
   - Initializes techniques for new sessions
   - Cleans up on session deletion
   - Enhances system prompts

### Data Flow

1. User creates task with technique parameters
2. Task tool applies prompt enhancement
3. Enhanced prompt sent to LLM
4. Performance tracked after completion
5. Metrics used for future technique selection

## Backward Compatibility

The integration maintains full backward compatibility:

- Existing code continues to work without modification
- Techniques are opt-in through parameters
- No breaking changes to existing APIs
- Graceful fallback on errors

## Events

New events for monitoring technique usage:

```typescript
// Technique applied to a session
"prompting.technique.applied": {
  sessionId: string
  techniqueId: string
  techniqueName: string
  timestamp: number
}

// Technique performance tracked
"prompting.technique.performance": {
  sessionId: string
  techniqueId: string
  success: boolean
  duration: number
  tokensUsed: number
}

// Prompt enhanced
"prompting.prompt.enhanced": {
  sessionId: string
  originalLength: number
  enhancedLength: number
  techniques: string[]
  timestamp: number
}
```

## Configuration

### Enable/Disable Enhancement

```typescript
// Disable prompt enhancement globally
SessionPromptEnhancer.disable()

// Enable prompt enhancement
SessionPromptEnhancer.enable()

// Check if enabled
const isEnabled = SessionPromptEnhancer.isEnabled()
```

### Performance Strategies

- **"performance"**: Select techniques with best success rates
- **"balanced"**: Balance between performance and exploration
- **"exploration"**: Try new techniques to gather data

## Future Enhancements

1. **Adaptive Learning**: Techniques improve based on task outcomes
2. **Context-Aware Selection**: Better technique matching based on task context
3. **Technique Composition**: Combine multiple techniques intelligently
4. **Custom Techniques**: Allow users to define their own techniques
5. **Visualization**: Dashboard for technique performance metrics

## Troubleshooting

### Techniques Not Applied

1. Check if techniques are enabled: `SessionPromptEnhancer.isEnabled()`
2. Verify technique names are valid
3. Check logs for enhancement errors

### Performance Issues

1. Reduce number of techniques per task
2. Use "performance" strategy for faster selection
3. Disable auto-selection for simple tasks

### Integration Errors

1. Ensure prompting system is initialized
2. Check for missing dependencies
3. Review error logs for specific issues
