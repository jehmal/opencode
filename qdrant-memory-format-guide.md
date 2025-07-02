# Qdrant Memory Storage Format Guide

## Critical: Metadata Parameter Format

The Qdrant MCP server (`mcp__qdrant__qdrant-store`) has a specific requirement for the metadata parameter that differs from typical JSON handling.

### ❌ INCORRECT - These will fail:

```python
# 1. JSON string format (WRONG)
mcp__qdrant__qdrant-store(
    information="Your memory text",
    metadata='{"type": "error_solution", "category": "debugging"}'
)

# 2. Multi-line dictionary format (WRONG - gets converted to string)
mcp__qdrant__qdrant-store(
    information="Your memory text",
    metadata={
        "type": "error_solution",
        "category": "debugging",
        "severity": "high"
    }
)

# 3. Pretty-printed JSON (WRONG)
mcp__qdrant__qdrant-store(
    information="Your memory text",
    metadata="""{
    "type": "error_solution",
    "category": "debugging"
}"""
)
```

### ✅ CORRECT - Use this format:

```python
# Store memory WITHOUT metadata parameter
mcp__qdrant__qdrant-store(
    information="Your structured memory text here..."
)

# The metadata should be embedded in the information text itself
# using the structured format from agent-memory-guide.md
```

## Memory Storage Best Practices

### 1. Structure Your Information Text

Instead of relying on metadata parameter, embed all context in the information text using templates:

```python
memory_text = """
ERROR RESOLVED: Configuration Mismatch
Problem: Qdrant expects named vector 'fast-all-minilm-l6-v2'
Root Cause: Collection created with default vector instead of named vector
Solution: Delete collection -> Recreate with named vector -> Test storage
Prevention: Always check MCP server vector requirements first
Verification: Successfully stored test memory
Related Issues: vector_size_mismatch, embedding_model_errors
Timestamp: 2025-01-19T15:00:00Z
Confidence: 0.98
Category: error_solution
Tools: qdrant, mcp_server
"""

# Store it
mcp__qdrant__qdrant-store(information=memory_text)
```

### 2. Use Structured Templates

Follow these templates from agent-memory-guide.md:

#### Error Resolution Template
```
ERROR RESOLVED: {error_type}
Problem: {error_description}
Root Cause: {root_cause}
Solution: {solution_steps}
Prevention: {how_to_avoid}
Verification: {how_to_verify}
Related Issues: {related_problems}
Timestamp: {iso_timestamp}
Confidence: {0.0-1.0}
Category: error_solution
```

#### Task Performance Template
```
TASK PERFORMANCE LOG - {task_id}:
Task: {task_description}
Success after {attempts} attempts
Key Learning: {main_lesson}
Reusable Pattern: {pattern_name} - {steps}
Time to Solution: {duration}
Errors Encountered: {error_count}
Final Success: {true/false}
Timestamp: {iso_timestamp}
Confidence: {0.0-1.0}
Category: task_performance
```

#### Technical Knowledge Template
```
TECHNICAL KNOWLEDGE - {domain}/{topic}:
Key Insights: {insight1} | {insight2} | {insight3}
Related to: {parent_concepts}
Practical Use: {application}
Confidence: {0.0-1.0}
Status: {tested_and_confirmed/theoretical/experimental}
Source: {where_learned}
Timestamp: {iso_timestamp}
Category: technical_knowledge
```

#### Pattern Recognition Template
```
PATTERN: {pattern_name}
Observed in: {contexts}
Success Rate: {percentage}%
Steps: {step1} -> {step2} -> {step3}
Common Variations: {variations}
When to Apply: {conditions}
When to Avoid: {anti_patterns}
Timestamp: {iso_timestamp}
Category: pattern_recognition
```

### 3. Include All Context in Text

Since we cannot use the metadata parameter reliably, ensure your information text includes:

- **Category**: error_solution, task_performance, technical_knowledge, pattern_recognition, etc.
- **Timestamp**: ISO format (2025-01-19T15:00:00Z)
- **Confidence**: Decimal between 0.0 and 1.0
- **Tools/Technologies**: List relevant tools
- **Related Concepts**: For linking memories
- **Verification Status**: tested_and_confirmed, experimental, theoretical
- **Success Metrics**: For performance tracking

### 4. Search-Optimized Format

Structure memories for easy retrieval:

```python
# Good - Searchable keywords at start
memory = """
ERROR RESOLVED: Qdrant MCP Metadata Format
Problem: metadata parameter must be dictionary not string
Solution: Embed metadata in information text
Category: error_solution
Tools: qdrant, mcp_server
"""

# Bad - Key information buried
memory = """
After extensive debugging, we discovered that the issue
was related to how the metadata parameter was being passed...
"""
```

### 5. Example: Complete Memory Storage

Here's a full example following all best practices:

```python
# Prepare the memory
memory_content = """
PROJECT MILESTONE: OpenCode-DGM Integration Phase 1 Complete
Task: Implement foundation services for cross-language integration
Success after 1 attempt with 5 parallel sub-agents
Key Learning: Parallel agents with specialized prompts improve quality
Reusable Pattern: parallel_phase_implementation - Analyze -> Prompt -> Execute -> Integrate
Components: monorepo, protocol_layer, command_router, type_system, dev_environment
Technologies: TypeScript, Python, Docker, Turborepo, Poetry, RabbitMQ
Architecture: Hybrid microservices with event-driven communication
Success Rate: 100%
Time to Solution: 2 hours
Timestamp: 2025-01-19T14:45:00Z
Confidence: 0.98
Category: project_milestone
Status: tested_and_confirmed
Related: microservices, cross_language_integration, protocol_design
"""

# Store it (no metadata parameter!)
mcp__qdrant__qdrant-store(information=memory_content)
```

## Common Pitfalls to Avoid

1. **Don't use the metadata parameter** - It expects a specific format that's not well documented
2. **Don't use JSON strings** - Embed structure in the text itself
3. **Don't forget timestamps** - Always include for temporal tracking
4. **Don't omit categories** - Essential for retrieval
5. **Don't store unstructured text** - Always use templates

## Retrieval Tips

When searching for memories:

```python
# Search by category
mcp__qdrant__qdrant-find(query="Category: error_solution Qdrant")

# Search by pattern
mcp__qdrant__qdrant-find(query="PATTERN: parallel_phase_implementation")

# Search by technology
mcp__qdrant__qdrant-find(query="Tools: typescript python integration")

# Search by success metrics
mcp__qdrant__qdrant-find(query="Success Rate: 100%")
```

## Summary

The key to successful Qdrant memory storage is:
1. Use ONLY the information parameter
2. Embed all metadata within structured text
3. Follow consistent templates
4. Include searchable keywords
5. Add timestamps and categories

This approach ensures reliable storage and retrieval while working around the metadata parameter limitations.