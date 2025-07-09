# Prompting Technique Display Workaround

## Problem

The SDK doesn't have proper type definitions for the `prompting` field in the assistant metadata, causing the UI to not display prompting technique indicators above assistant messages.

## Solution

We implemented a workaround that passes technique information through the existing `system` array field, which is already properly typed in the SDK.

## Implementation Details

### TypeScript Side (packages/opencode/src/session/index.ts)

1. When prompting techniques are used, we add a special system message with the format:

   ```
   __PROMPTING_TECHNIQUES__:technique1,technique2,technique3
   ```

2. This message is added to the system array that's already being sent with the assistant metadata:
   ```typescript
   if (
     promptingMetadata.techniques &&
     promptingMetadata.techniques.length > 0
   ) {
     const techniqueInfo = `__PROMPTING_TECHNIQUES__:${promptingMetadata.techniques.join(",")}`
     system.push(techniqueInfo)
   }
   ```

### Go Side (packages/tui/internal/components/chat/message.go)

1. The `renderTechniqueInfo` function now first checks the system array for our special message:

   ```go
   if metadata.Assistant != nil && metadata.Assistant.System != nil {
     for _, sysMsg := range metadata.Assistant.System {
       if strings.HasPrefix(sysMsg, "__PROMPTING_TECHNIQUES__:") {
         // Extract and format techniques
       }
     }
   }
   ```

2. As a fallback, it still tries to access the prompting field through ExtraFields in case the SDK is updated in the future.

## Benefits

- Uses existing SDK fields that are properly typed
- No SDK regeneration required
- Backward compatible - if SDK is updated, the direct prompting field access will work
- Minimal code changes
- Techniques are displayed as intended in the UI

## Testing

To test the workaround:

1. Enable prompting techniques in your session
2. Send a message that triggers technique selection
3. The technique abbreviations (e.g., "CoT", "FS") should appear above the assistant's response

## Future Considerations

When the SDK is properly updated to include the prompting field types, this workaround can be removed and the code can directly access `metadata.Assistant.Prompting.Techniques`.
