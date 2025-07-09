# Enhanced Vector Memory Workflow Guide

## Quick Integration Steps

### 1. Update Your Memory Creation Process

Instead of creating basic memories, use the diagnostic journey format:

```typescript
// OLD WAY
const memory = `Fixed React 18 error by updating dependencies`

// NEW WAY
const memory = MemoryTemplates.diagnosticJourney({
  title: "React 18 White Screen After Update",
  environment: "production",
  symptoms:
    "App shows white screen, console shows 'Cannot resolve react-dom/client'",
  diagnosticSteps: [
    { action: "Checked package.json", result: "Shows react-dom ^18.2.0" },
    { action: "Ran npm ls react", result: "Found 3 different React versions!" },
    {
      action: "Checked peer dependencies",
      result: "Some packages locked to React 17",
    },
  ],
  rootCause: "Multiple React versions due to dependency conflicts",
  solution: "Run npm dedupe and update packages with React 17 peer deps",
  falseLeads: ["Clearing cache", "Reinstalling node_modules"],
  preventionTips: [
    "Always check npm ls after major updates",
    "Review peer dependency warnings",
  ],
})
```

### 2. Enhanced Search Patterns

```typescript
// Search by symptoms (what users report)
const searchBySymptoms = {
  query: "SYMPTOMS white screen Cannot resolve react-dom",
  limit: 5,
}

// Search by environment
const searchByEnvironment = {
  query: "DIAGNOSTIC JOURNEY Environment: production",
  limit: 10,
}

// Search for false leads to avoid
const searchFalseLeads = {
  query: "FALSE LEADS clearing cache node_modules",
  limit: 5,
}
```

### 3. Practical Workflow Examples

#### When Debugging a Production Issue

```typescript
// Step 1: Search for similar symptoms
await search("SYMPTOMS " + userReportedError + " Environment: production")

// Step 2: If no exact match, search broader
await search("DIAGNOSTIC JOURNEY " + errorType)

// Step 3: After solving, store the journey
await storeDiagnosticJourney({
  title: problemTitle,
  environment: "production",
  symptoms: whatUserReported,
  diagnosticSteps: whatYouTried,
  rootCause: whatYouFound,
  solution: howYouFixed,
  falseLeads: whatDidntWork,
})
```

#### When Handling Migration Issues

```typescript
// Search for previous migration experiences
await search(`MIGRATION ${library} ${fromVersion} → ${toVersion}`)

// Store new migration knowledge
const migrationMemory = MemoryTemplates.migrationIssue({
  fromVersion: "17.0.2",
  toVersion: "18.2.0",
  library: "react",
  issue: "Multiple React versions causing conflicts",
  symptoms: ["White screen", "Module resolution errors"],
  solution: "npm dedupe + update peer deps",
  breakingChanges: ["New root API", "Stricter StrictMode"],
})
```

### 4. Building Learning Chains

Connect related issues to build deeper understanding:

```typescript
// After solving a complex issue that relates to previous ones
await MemoryWorkflow.createLearningChain(
  "React 18 hydration mismatch in SSR",
  ["memory-id-1", "memory-id-2"], // Previous related memories
  "Hydration issues often stem from the same root causes as render timing issues",
)
```

### 5. Integration with Existing Code

Add to your tool execution flow:

```typescript
// In your error handling
catch (error) {
  // Search for similar errors first
  const similar = await MemoryWorkflow.searchSimilarJourneys(
    error.message,
    process.env.NODE_ENV
  )

  if (similar.length > 0) {
    console.log("Found similar issues:", similar)
    // Apply known solutions
  } else {
    // New error - debug and store journey
    const diagnosticSteps = []
    // ... debugging process ...

    await MemoryWorkflow.storeDiagnosticJourney({
      title: `Error: ${error.message}`,
      environment: process.env.NODE_ENV,
      symptoms: error.stack,
      diagnosticSteps,
      rootCause: foundCause,
      solution: appliedFix
    })
  }
}
```

### 6. Memory Search Strategies

#### Symptom-First Search

```typescript
// User says: "My app is slow after updating"
search: "SYMPTOMS slow performance after update"
```

#### Environment-Specific Search

```typescript
// Production-only issues
search: "Environment: production works locally"
```

#### Pattern-Based Search

```typescript
// Race conditions
search: "RACE CONDITION async state update"
```

#### Learning Path Search

```typescript
// Find related learning
search: "LEARNING CHAIN react hooks"
```

### 7. Best Practices

1. **Always Include Environment Context**

   - Mark whether issue is local/staging/production/all
   - This dramatically improves search relevance

2. **Document False Leads**

   - Save time by recording what DOESN'T work
   - Prevents repeating failed approaches

3. **Create Learning Chains**

   - Connect related memories
   - Build comprehensive understanding over time

4. **Use Consistent Formatting**

   - Stick to templates for better search
   - Makes memories more discoverable

5. **Include Time Metrics**
   - Record debugging time
   - Helps prioritize which issues need better tooling

### 8. Migration Strategy

For existing memories, gradually enhance them:

```typescript
// When you encounter an old memory
const oldMemory = "Fixed React error with npm dedupe"

// Enhance it with context
const enhancedMemory = `${oldMemory}

ENHANCED CONTEXT (Added ${new Date().toISOString()}):
Environment: all
Category: dependency_conflict
Related Issues: React version conflicts, peer dependency issues
Search Terms: multiple react versions, npm dedupe, peer deps`
```

### 9. Monitoring Memory Effectiveness

Track which memories are most helpful:

```typescript
// After using a memory successfully
const feedbackMemory = `MEMORY FEEDBACK:
Used Memory: ${memoryId}
Situation: ${currentProblem}
Effectiveness: High - Solved issue in 5 minutes
Improvements: Could add more specific error messages

This creates a feedback loop for memory quality`
```

### 10. Quick Reference Card

```
MEMORY CREATION:
- Use templates for consistency
- Include environment ALWAYS
- Document the journey, not just solution
- Add false leads to save future time

MEMORY SEARCH:
- Start with symptoms
- Filter by environment
- Look for patterns
- Check learning chains

MEMORY EVOLUTION:
- Connect related memories
- Add feedback on usage
- Enhance old memories
- Build pattern libraries
```

## Conclusion

This enhanced workflow transforms your vector memory from a simple storage system into an intelligent debugging assistant that learns from every interaction. The key is consistency - use the templates, include context, and build connections between memories.
