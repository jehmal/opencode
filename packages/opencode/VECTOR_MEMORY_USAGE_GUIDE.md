# Vector Memory Usage Guide

## Practical Patterns for Storing and Retrieving Information in DGMO

### 🎯 QUICK START

```bash
# Store a memory
qdrant:store "Your memory content here" --type "error_solution" --project "my_project"

# Retrieve memories
qdrant:find "search query" --limit 10

# Vector search with context
qdrant:vector-search "complex query" --with-context --expand-relationships
```

### 📝 STORAGE PATTERNS

## 1. Structured Memory Storage

### 1.1 Error Resolution Pattern

````python
# When you solve an error, store it like this:
error_memory = """
ERROR PATTERN: [Specific Error Type]
Type: [compilation_error|runtime_error|logic_error]
Error: [Exact error message]
Root Cause: [Why it happened]

CONTEXT:
- Task: [What you were trying to do]
- Environment: [System details]
- Dependencies: [Relevant versions]

SOLUTION:
1. [Step 1]
2. [Step 2]
3. [Step 3]

CODE FIX:
```language
[Before code]
````

```language
[After code]
```

PREVENTION: [How to avoid this in future]
RELATED PATTERNS: [Similar errors]
SUCCESS METRIC: [How to verify it's fixed]
CONFIDENCE: [0.0-1.0]
"""

# Store with metadata

metadata = {
"type": "error_solution",
"domain": "go_compilation",
"error_type": "nil_comparison",
"project": "dgmo_tui",
"confidence": 0.95
}

````

### 1.2 Success Pattern Storage

```python
success_memory = """
SUCCESS PATTERN: [Achievement Name]
Type: [implementation|optimization|architecture]
Task: [What was accomplished]

APPROACH:
1. [Strategy step 1]
2. [Strategy step 2]
3. [Strategy step 3]

KEY INSIGHTS:
- [Insight 1]
- [Insight 2]
- [Insight 3]

METRICS:
- Performance: [Before] → [After]
- Complexity: [Measurement]
- Reusability: [Score]

REUSABLE COMPONENTS:
```language
[Code snippet or pattern]
````

FUTURE APPLICATIONS: [Where else this could work]
CONFIDENCE: [0.0-1.0]
"""

````

### 1.3 Knowledge Synthesis Pattern

```python
knowledge_memory = """
UNIVERSAL KNOWLEDGE: [Concept Name]
Abstraction Level: [1-5] (1=concrete, 5=abstract)
Domain: [Primary domain]
Cross-Domain Applications: [Other domains]

PRINCIPLE:
[Core principle statement]

MANIFESTATIONS:
- In [Language/Tool 1]: [How it appears]
- In [Language/Tool 2]: [How it appears]
- In [Language/Tool 3]: [How it appears]

PRACTICAL APPLICATIONS:
1. [Use case 1]
2. [Use case 2]
3. [Use case 3]

RELATIONSHIPS:
- Parent Concepts: [Higher level concepts]
- Sibling Concepts: [Related at same level]
- Child Concepts: [More specific versions]

EVOLUTION PATH:
[How this knowledge typically evolves with experience]

WISDOM SCORE: [0.0-1.0]
"""
````

### 1.4 Project Snapshot Pattern

```python
project_snapshot = """
PROJECT SNAPSHOT: [Project Name] - [Milestone]
Date: [ISO timestamp]
Phase: [Planning|Development|Testing|Deployment]
Completion: [Percentage]%

EXECUTIVE SUMMARY:
[2-3 sentences of current state]

COMPLETED COMPONENTS:
✅ [Component 1] - [Brief description]
✅ [Component 2] - [Brief description]
✅ [Component 3] - [Brief description]

IN PROGRESS:
🔄 [Task 1] - [Status and blockers]
🔄 [Task 2] - [Status and blockers]

TECHNICAL DECISIONS:
- [Decision 1]: [Rationale]
- [Decision 2]: [Rationale]

LESSONS LEARNED:
1. [Lesson 1]
2. [Lesson 2]

NEXT STEPS:
1. [Priority 1]
2. [Priority 2]

METRICS:
- Code Coverage: [X]%
- Performance: [Measurement]
- Technical Debt: [Assessment]

CONFIDENCE: [0.0-1.0]
"""
```

## 2. RETRIEVAL STRATEGIES

### 2.1 Basic Retrieval Patterns

```python
# 1. Simple keyword search
results = qdrant.find("Go build error panic")

# 2. Semantic search (finds related concepts)
results = qdrant.vector_search("how to debug compilation failures")

# 3. Filtered search
results = qdrant.vector_search(
    query="error handling patterns",
    filter={
        "type": "error_solution",
        "confidence": {"$gte": 0.8},
        "domain": "go_development"
    }
)

# 4. Time-based retrieval
results = qdrant.vector_search(
    query="recent learnings",
    filter={
        "date": {"$gte": "2025-01-25"}
    }
)

# 5. Project-specific search
results = qdrant.vector_search(
    query="implementation details",
    filter={
        "project": "dgmo_tui"
    }
)
```

### 2.2 Advanced Retrieval Patterns

```python
# 1. Constellation retrieval (get related memory clusters)
constellation = qdrant.get_constellation(
    seed_query="Go build debugging journey",
    max_stars=10,
    min_brightness=0.7
)

# 2. Predictive retrieval (what you'll need next)
predictions = qdrant.predict_needs(
    current_context="implementing websocket server",
    time_horizon="next_hour"
)

# 3. Cross-project pattern search
patterns = qdrant.find_patterns(
    pattern_type="error_resolution",
    min_occurrences=3,
    across_projects=True
)

# 4. Evolution tracking
evolution = qdrant.track_evolution(
    memory_id="specific_memory_id",
    include_history=True
)

# 5. Entangled memory retrieval
entangled = qdrant.get_entangled(
    memory_query="vector database setup",
    entanglement_types=["causal", "correlational"],
    min_strength=0.7
)
```

### 2.3 Query Construction Best Practices

```python
# GOOD: Specific and contextual
query = "Go 1.24 toolchain panic loadPackageData empty path build error"

# BETTER: Include action and outcome
query = "fix Go build panic error using stable version downgrade"

# BEST: Include problem, solution, and context
query = "Go 1.24 build panic fixed by downgrading to 1.22 empty import error"

# For learning queries
learning_query = "systematic debugging methodology build errors incremental fixes"

# For pattern queries
pattern_query = "success pattern vector memory implementation Qdrant"

# For prediction queries
prediction_query = "future challenges Go 1.25 toolchain compatibility"
```

## 3. MEMORY LIFECYCLE MANAGEMENT

### 3.1 Memory Evolution Triggers

```yaml
Evolution_Triggers:
  high_usage:
    threshold: 10 accesses
    action: strengthen_embeddings
    confidence_boost: 1.1x

  cross_reference:
    threshold: 5 references
    action: promote_to_universal
    abstraction_increase: +1

  pattern_emergence:
    threshold: 3 similar_memories
    action: create_constellation
    pattern_strength: 0.8

  temporal_validation:
    threshold: prediction_accuracy > 0.75
    action: increase_prediction_weight
    temporal_boost: 1.2x

  error_correction:
    threshold: solution_verified
    action: update_confidence
    confidence_set: 0.95
```

### 3.2 Memory Consolidation Rules

```python
# Consolidation happens when:
consolidation_rules = {
    "similar_content": {
        "similarity_threshold": 0.85,
        "min_memories": 3,
        "action": "merge_into_pattern"
    },
    "temporal_sequence": {
        "time_window": "7_days",
        "min_events": 5,
        "action": "create_timeline"
    },
    "concept_hierarchy": {
        "abstraction_gap": 2,
        "min_instances": 4,
        "action": "build_hierarchy"
    }
}
```

## 4. PRACTICAL WORKFLOWS

### 4.1 Daily Development Workflow

```bash
# Morning: Check predictions and context
dgmo memory predictions --today
dgmo memory context --project current

# During coding: Store learnings immediately
dgmo memory store "Discovered that X leads to Y" --type learning

# After solving error: Document solution
dgmo memory store "$(cat error_solution.md)" --type error_solution

# End of day: Create snapshot
dgmo memory snapshot --project current --auto-summarize
```

### 4.2 Debugging Workflow

```python
# 1. When error occurs, search for similar
similar_errors = qdrant.vector_search(
    query=error_message,
    filter={"type": "error_solution"},
    limit=5
)

# 2. If no exact match, search for patterns
error_patterns = qdrant.find_patterns(
    pattern_type="error",
    domain=current_domain,
    similarity_threshold=0.7
)

# 3. After solving, store the solution
solution_memory = create_error_solution_memory(
    error=error_message,
    solution=solution_steps,
    context=current_context
)
qdrant.store(solution_memory)

# 4. Link to related memories
qdrant.create_entanglement(
    memory_a=solution_memory.id,
    memory_b=similar_error.id,
    type="evolutionary"
)
```

### 4.3 Learning Workflow

```python
# 1. After learning something new
learning = create_knowledge_memory(
    concept=new_concept,
    context=how_learned,
    applications=potential_uses
)

# 2. Check for related knowledge
related = qdrant.vector_search(
    query=new_concept,
    expand_relationships=True
)

# 3. Build knowledge graph
knowledge_graph = qdrant.build_graph(
    center=learning.id,
    depth=2,
    relationship_types=["parent", "sibling", "application"]
)

# 4. Schedule review
qdrant.schedule_review(
    memory_id=learning.id,
    intervals=[1, 7, 30]  # days
)
```

## 5. SEARCH OPTIMIZATION TECHNIQUES

### 5.1 Query Expansion

```python
# Original query
query = "websocket error"

# Expanded query with synonyms and related terms
expanded_query = """
websocket error OR
ws connection failed OR
real-time communication issue OR
socket.io problem OR
event streaming failure
"""

# Contextual expansion
contextual_query = f"""
{query} AND project:{current_project} AND date:[last_30_days]
"""
```

### 5.2 Faceted Search

```python
# Search with multiple facets
results = qdrant.faceted_search(
    query="performance optimization",
    facets={
        "domain": ["backend", "frontend", "database"],
        "type": ["success_pattern", "optimization"],
        "confidence": {"min": 0.8},
        "impact": ["high", "medium"]
    }
)
```

### 5.3 Relevance Tuning

```python
# Configure relevance weights
relevance_config = {
    "text_similarity": 0.4,
    "recency": 0.2,
    "usage_frequency": 0.2,
    "confidence_score": 0.1,
    "project_relevance": 0.1
}

results = qdrant.search_with_relevance(
    query=query,
    relevance_config=relevance_config
)
```

## 6. MEMORY TEMPLATES

### 6.1 Quick Templates

```bash
# Error template
dgmo memory template error --fill

# Success template
dgmo memory template success --fill

# Learning template
dgmo memory template learning --fill

# Snapshot template
dgmo memory template snapshot --fill
```

### 6.2 Custom Templates

```python
# Create custom template
custom_template = """
TEMPLATE: {template_name}
Type: {memory_type}
Required Fields:
- {field1}: {description}
- {field2}: {description}

Optional Fields:
- {field3}: {description}

Format:
{format_example}
"""

# Register template
qdrant.register_template(
    name="my_template",
    template=custom_template,
    validation_schema=schema
)
```

## 7. BEST PRACTICES

### 7.1 Storage Best Practices

1. **Be Specific**: Include exact error messages, version numbers, file paths
2. **Add Context**: Always include what you were trying to do
3. **Include Solutions**: Don't just document problems, document fixes
4. **Set Confidence**: Be honest about how certain you are
5. **Link Related**: Create entanglements between related memories
6. **Use Templates**: Consistency helps retrieval

### 7.2 Retrieval Best Practices

1. **Start Broad**: Begin with semantic search, then filter
2. **Use Context**: Include current project/domain in queries
3. **Check Predictions**: See what the system thinks you need
4. **Follow Entanglements**: Explore related memories
5. **Verify Recency**: Check dates for time-sensitive info
6. **Trust Evolution**: Higher evolution scores = more reliable

### 7.3 Maintenance Best Practices

1. **Regular Snapshots**: Weekly project snapshots minimum
2. **Review Predictions**: Check prediction accuracy monthly
3. **Consolidate Patterns**: Let the system merge similar memories
4. **Update Confidence**: Adjust as you verify information
5. **Prune Outdated**: Archive memories with decay scores < 0.3

## 8. TROUBLESHOOTING

### 8.1 Common Issues

```yaml
Issue: "Can't find memory I know I stored"
Solutions:
  - Try semantic search instead of keyword
  - Check filters aren't too restrictive
  - Look for consolidated/evolved versions
  - Search by date range

Issue: "Too many irrelevant results"
Solutions:
  - Add more specific filters
  - Increase confidence threshold
  - Use project-specific search
  - Adjust relevance weights

Issue: "Memories not evolving"
Solutions:
  - Check evolution thresholds
  - Ensure memories are being accessed
  - Verify entanglements are created
  - Run manual evolution cycle
```

### 8.2 Performance Tips

```python
# 1. Batch operations
memories = [memory1, memory2, memory3]
qdrant.store_batch(memories)  # Faster than individual stores

# 2. Use caching
qdrant.enable_cache(
    ttl=300,  # 5 minutes
    size="1GB"
)

# 3. Optimize queries
# Instead of multiple queries
results1 = qdrant.find("error")
results2 = qdrant.find("solution")

# Use single complex query
results = qdrant.find("error AND solution")

# 4. Pre-warm predictions
qdrant.prewarm_predictions(
    context=current_context,
    time_horizon="next_hour"
)
```

## 9. ADVANCED USAGE

### 9.1 Memory Chains

```python
# Create a chain of related memories
chain = qdrant.create_chain(
    memories=[
        "problem_identification",
        "research_phase",
        "solution_attempt_1",
        "solution_attempt_2",
        "final_solution",
        "lessons_learned"
    ],
    chain_type="problem_solving_journey"
)
```

### 9.2 Memory Visualization

```python
# Generate memory map
memory_map = qdrant.visualize_memories(
    center_query="current project",
    depth=3,
    include_types=["all"],
    output_format="d3_json"
)

# Generate constellation view
constellation = qdrant.visualize_constellation(
    constellation_id="error_resolution_saga",
    show_brightness=True,
    show_connections=True
)
```

### 9.3 Bulk Analysis

```python
# Analyze memory patterns
analysis = qdrant.analyze_patterns(
    time_range="last_month",
    pattern_types=["error", "success", "learning"],
    min_confidence=0.7
)

# Generate insights
insights = qdrant.generate_insights(
    focus_area="debugging_efficiency",
    compare_periods=["this_week", "last_week"]
)
```

## CONCLUSION

Effective use of the vector memory system transforms DGMO from a tool into a learning partner. By following these patterns and practices, every interaction contributes to a growing intelligence that helps you code better, debug faster, and learn continuously.

Remember: The system is designed to evolve. The more you use it with intention and structure, the more valuable it becomes.

---

_"Your memories are not just stored; they live, grow, and illuminate the path forward."_
