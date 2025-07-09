# Vector Memory Implementation Guide

## Quick Start

### 1. Setting Up Qdrant Collection

```bash
# Create collection with correct vector configuration
curl -X PUT http://localhost:6333/collections/AgentMemories \
  -H 'Content-Type: application/json' \
  -d '{
    "vectors": {
      "fast-all-minilm-l6-v2": {
        "size": 384,
        "distance": "Cosine"
      }
    }
  }'
```

### 2. Storing Memories

#### Basic Memory Storage

```typescript
// Store a simple memory
const memory = {
  tool: "QdrantXXX_qdrant-store",
  args: {
    collection_name: "AgentMemories",
    information: `
TECHNICAL SOLUTION: React Performance Optimization
Date: 2025-01-30T14:00:00Z
Domain: frontend_optimization

PROBLEM: React app rendering slowly with large lists

SOLUTION:
1. Implemented React.memo for expensive components
2. Added virtualization with react-window
3. Optimized state updates to prevent unnecessary renders

CODE:
const MemoizedComponent = React.memo(ExpensiveComponent, (prev, next) => {
  return prev.id === next.id && prev.data === next.data;
});

METRICS:
- Render time: 2000ms → 150ms
- FPS: 15 → 60
- Memory usage: Reduced by 40%

TAGS: #react #performance #virtualization #memoization
CONFIDENCE: 0.98
`,
  },
}
```

#### Memory with Metadata

```typescript
const memoryWithMetadata = {
  tool: "QdrantXXX_qdrant-store",
  args: {
    collection_name: "AgentMemories",
    information: "Your structured memory text here",
    metadata: {
      // ONLY flat key-value pairs!
      type: "technical_solution",
      domain: "frontend",
      confidence: 0.98,
      date: "2025-01-30",
      // NO arrays: tags: ["react", "performance"] ❌
      // NO nested: metrics: { fps: 60 } ❌
    },
  },
}
```

### 3. Memory Templates

#### Error Solution Memory

```typescript
const errorMemory = `
ERROR PATTERN DETECTED AND RESOLVED:
Type: typescript_compilation_error
Error: Property 'fs' does not exist on type 'Session'

CONTEXT:
- Task: File watching in sandbox environment
- Location: src/evolution/sandbox/file-watcher.ts:45
- Timestamp: ${new Date().toISOString()}

ROOT CAUSE:
Local sandbox sessions don't have fs.watch() method available

SOLUTION:
1. Check sandbox type before accessing fs methods
2. Skip file watching for local sandboxes
3. Add defensive checks in FileWatcher class

CODE FIX:
if (this.sandbox.type === 'local') {
  log.info('Skipping file watch for local sandbox');
  return;
}

PREVENTION: Always check sandbox capabilities before using methods
RELATED ERRORS: method_not_found, undefined_property
SUCCESS METRIC: No more fs.watch errors in local sandboxes
CONFIDENCE: 0.95
`
```

#### Knowledge Memory

```typescript
const knowledgeMemory = `
TECHNICAL KNOWLEDGE - ai_agents/memory_systems:
Key Insights: Vector databases enable semantic search | Structured text preserves context | Flat metadata prevents validation errors

CONCEPTS:
- Vector Embeddings: 384-dimensional representations of text
- Cosine Similarity: Measures semantic closeness (0-1)
- Named Vectors: MCP servers require specific vector field names

BEST PRACTICES:
1. Store everything as structured text
2. Use consistent formatting with headers
3. Include timestamps and confidence scores
4. Tag content for easier retrieval

TOOLS & TECHNOLOGIES:
- Qdrant: Vector database (localhost:6333)
- FastEmbed: Embedding model (all-minilm-l6-v2)
- MCP: Model Context Protocol for tool integration

APPLICATIONS:
- Agent memory persistence
- Semantic code search
- Error pattern recognition
- Knowledge graph building

Confidence: 0.95
Last Updated: ${new Date().toISOString()}
Status: production_ready
`
```

#### Task Performance Memory

```typescript
const performanceMemory = `
TASK PERFORMANCE LOG - implement_websocket_${Date.now()}:
Task: Add WebSocket support for real-time updates
Duration: 45 minutes
Success: true

IMPLEMENTATION STEPS:
1. ✅ Created WebSocket server in server.ts
2. ✅ Added client connection handling
3. ✅ Implemented message broadcasting
4. ✅ Added reconnection logic
5. ✅ Created event type definitions

CHALLENGES FACED:
- Initial: CORS issues with WebSocket upgrade
- Solution: Added proper origin handling
- Result: Seamless connection from web clients

PERFORMANCE METRICS:
- Connection time: <100ms
- Message latency: <10ms
- Concurrent connections: Tested up to 1000
- Memory per connection: ~2KB

KEY DECISIONS:
- Used native WebSocket instead of Socket.io (smaller bundle)
- Implemented heartbeat for connection monitoring
- Added message queuing for offline clients

REUSABLE PATTERNS:
1. WebSocket server setup with TypeScript
2. Client reconnection with exponential backoff
3. Message type validation with Zod

TAGS: #websocket #realtime #networking #typescript
CONFIDENCE: 0.92
`
```

### 4. Searching Memories

#### Basic Search

```typescript
const searchArgs = {
  tool: "QdrantXXX_qdrant-find",
  args: {
    collection_name: "AgentMemories",
    query: "WebSocket implementation typescript",
    limit: 5,
  },
}
```

#### Advanced Search Patterns

```typescript
// Search for error solutions
const errorSearch = {
  query: "ERROR RESOLVED typescript fs.watch sandbox",
  limit: 10,
}

// Search for specific knowledge
const knowledgeSearch = {
  query: "TECHNICAL KNOWLEDGE vector embeddings Qdrant",
  limit: 5,
}

// Search for successful patterns
const patternSearch = {
  query: "SUCCESS PATTERN WebSocket real-time",
  limit: 3,
}
```

### 5. Integration with Continuation Prompts

```typescript
// In continuation prompt generator
const memoryQueries = [
  `PROJECT SNAPSHOT ${projectName} latest`,
  `TECHNICAL SOLUTION ${mainTechnology}`,
  `ERROR RESOLVED ${knownIssueType}`,
  `TASK PERFORMANCE LOG ${similarTask}`,
  `SUCCESS PATTERN ${implementationPattern}`,
]

// Generate the prompt section
const memorySection = `
## Memory Search Commands
First, retrieve the current project state and patterns:

${memoryQueries.map((q) => `Search: "${q}"`).join("\n")}
`
```

### 6. Best Practices

#### DO ✅

```typescript
// 1. Use structured text with clear sections
const goodMemory = `
CATEGORY: Description
Section1: Content
Section2: More content
TAGS: #tag1 #tag2
`

// 2. Include all context in the text
const contextualMemory = `
ERROR RESOLVED: ${errorType}
When: ${timestamp}
Where: ${filePath}:${lineNumber}
What: ${errorMessage}
Why: ${rootCause}
How: ${solution}
`

// 3. Use consistent date formats
const timestamp = new Date().toISOString()

// 4. Add confidence scores
const confidence = 0.95 // 0-1 scale
```

#### DON'T ❌

```typescript
// 1. Don't use complex metadata
const badMetadata = {
  tags: ["tag1", "tag2"], // Arrays fail!
  metrics: { fps: 60 }, // Nested objects fail!
}

// 2. Don't store unstructured text
const badMemory = "Fixed the bug by adding a check" // Too vague!

// 3. Don't forget timestamps
const undatedMemory = "Solution: Use React.memo" // When was this?

// 4. Don't mix memory types in one entry
const mixedMemory = `
ERROR: Something broke
ALSO HERE'S SOME KNOWLEDGE: React is good
` // Separate these!
```

### 7. Memory Lifecycle

#### Creation

```mermaid
graph LR
    A[Agent Action] --> B[Generate Memory Text]
    B --> C[Add Metadata]
    C --> D[Store in Qdrant]
    D --> E[Auto-generate Embeddings]
```

#### Retrieval

```mermaid
graph LR
    A[Search Query] --> B[Generate Query Embedding]
    B --> C[Vector Similarity Search]
    C --> D[Return Top K Results]
    D --> E[Agent Uses Memory]
```

#### Evolution

```mermaid
graph LR
    A[Initial Memory] --> B[Agent Uses Memory]
    B --> C[Outcome Observed]
    C --> D[Update Confidence]
    D --> E[Store Updated Memory]
    E --> F[Link Related Memories]
```

### 8. Debugging Common Issues

#### Issue: "Wrong input: Not existing vector name"

```typescript
// Problem: Collection has default vector, not named vector
// Solution: Recreate collection with named vector
const fixCollection = {
  vectors: {
    "fast-all-minilm-l6-v2": {
      // Must match MCP expectation
      size: 384,
      distance: "Cosine",
    },
  },
}
```

#### Issue: "Metadata validation failed"

```typescript
// Problem: Complex metadata structure
const badMeta = { tags: ["a", "b"] } // ❌

// Solution: Flatten to simple key-value
const goodMeta = {
  tag1: "a",
  tag2: "b",
  tagCount: 2,
} // ✅
```

#### Issue: "No results found"

```typescript
// Problem: Query doesn't match memory format
const badQuery = "websocket" // Too generic

// Solution: Use memory format keywords
const goodQuery = "TECHNICAL SOLUTION WebSocket implementation" // ✅
```

### 9. Performance Optimization

#### Batch Operations

```typescript
// Store multiple memories at once
const batchStore = {
  tool: "QdrantXXX_qdrant-upsert-points",
  args: {
    collection_name: "AgentMemories",
    points: [
      { id: uuid1, content: memory1 },
      { id: uuid2, content: memory2 },
      { id: uuid3, content: memory3 },
    ],
  },
}
```

#### Efficient Queries

```typescript
// Use specific search terms
const efficientQuery = {
  query: "ERROR RESOLVED typescript fs.watch FileWatcher", // Specific
  limit: 5, // Don't over-fetch
  score_threshold: 0.7, // Filter low relevance
}
```

### 10. Advanced Patterns

#### Memory Linking

```typescript
const linkedMemory = `
TECHNICAL SOLUTION: Component Optimization
[... solution details ...]

RELATED MEMORIES:
- ERROR RESOLVED: React render loop (id: abc-123)
- KNOWLEDGE: React performance patterns (id: def-456)
- SUCCESS PATTERN: Memoization strategy (id: ghi-789)

BUILDS ON: Previous optimization work
ENABLES: Future performance improvements
`
```

#### Confidence Decay

```typescript
const ageAwareMemory = `
SOLUTION: ${solution}
Created: ${createdDate}
Last Verified: ${lastVerifiedDate}
Original Confidence: 0.95
Current Confidence: ${calculateDecay(createdDate, lastVerifiedDate)}
Status: ${getStatus(confidence)} // active|review_needed|deprecated
`
```

#### Cross-Domain Learning

```typescript
const crossDomainMemory = `
PATTERN RECOGNIZED: Caching Strategy
Domains: frontend, backend, database
Applications:
- Frontend: React.memo, useMemo
- Backend: Redis caching, memoization
- Database: Query result caching

ABSTRACT PATTERN:
1. Identify expensive operations
2. Check if inputs change frequently
3. Implement appropriate caching
4. Monitor cache hit rates
5. Adjust strategy based on metrics

TRANSFERABLE: true
CONFIDENCE: 0.88
`
```

## Conclusion

The vector memory system transforms agents from stateless tools into learning systems that improve with every interaction. By following these implementation patterns, you can build agents that:

- Never repeat the same mistakes
- Build on previous successes
- Share knowledge across instances
- Maintain context indefinitely
- Continuously improve performance

Remember: The key to success is consistent, structured memory formatting that enables both precise storage and effective retrieval.
