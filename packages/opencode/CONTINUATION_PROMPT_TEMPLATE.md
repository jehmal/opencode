# Continuation Prompt Template

## Auto-Continuation Instructions

### Task Continuation Protocol

When you complete a major task or reach context limits, ALWAYS generate a continuation prompt for the next agent using this template:

### CONTINUATION PROMPT TEMPLATE

```
Instructions for Next [PROJECT_NAME] Agent
You are continuing the implementation of [PROJECT_GOAL]. The project is [PERCENTAGE]% complete with [WHAT_IS_DONE]. Your task is to [WHAT_REMAINS].

## Project Context

Working Directory: [ABSOLUTE_PATH]
Key Repositories: [LIST_WITH_PATHS]
Architecture Doc: [PATH_TO_ARCHITECTURE]
Related Systems: [DEPENDENCIES_WITH_PATHS]

## Memory Search Commands
First, retrieve the current project state and patterns:

Search: "[MOST_RECENT_SNAPSHOT_QUERY]"
Search: "[TECHNICAL_IMPLEMENTATION_QUERY]"
Search: "[SUCCESS_PATTERN_QUERY]"
Search: "[ERROR_SOLUTIONS_QUERY]"
Search: "[ARCHITECTURE_DECISIONS_QUERY]"

## Completed Components (DO NOT RECREATE)
✅ [COMPLETED_ITEM_1] - [BRIEF_DESCRIPTION]
✅ [COMPLETED_ITEM_2] - [BRIEF_DESCRIPTION]
✅ [COMPLETED_ITEM_3] - [BRIEF_DESCRIPTION]
[... all completed items with checkmarks]

## Critical Files to Reference

### [COMPONENT_NAME]:
- [FILE_PATH] - [WHAT_IT_DOES]
- [FILE_PATH] - [WHAT_IT_DOES]

### [COMPONENT_NAME]:
- [FILE_PATH] - [WHAT_IT_DOES]
- [FILE_PATH] - [WHAT_IT_DOES]

## Required Tasks (USE [N] SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: [TASK_NAME]
[SPECIFIC_IMPLEMENTATION_DETAILS]

1. [STEP_1_WITH_SPECIFICS]
2. [STEP_2_WITH_SPECIFICS]
3. [EXPECTED_OUTPUT]

Location: [WHERE_TO_IMPLEMENT]
Dependencies: [WHAT_IT_NEEDS]

### Sub-Agent 2: [TASK_NAME]
[SPECIFIC_IMPLEMENTATION_DETAILS]

1. [STEP_1_WITH_SPECIFICS]
2. [STEP_2_WITH_SPECIFICS]
3. [EXPECTED_OUTPUT]

Location: [WHERE_TO_IMPLEMENT]
Dependencies: [WHAT_IT_NEEDS]

[... continue for all parallel tasks]

## Integration Requirements
- [REQUIREMENT_1]
- [REQUIREMENT_2]
- [REQUIREMENT_3]

## Technical Constraints
- [CONSTRAINT_1]
- [CONSTRAINT_2]
- [CONSTRAINT_3]

## Success Criteria
- [MEASURABLE_OUTCOME_1]
- [MEASURABLE_OUTCOME_2]
- [MEASURABLE_OUTCOME_3]
[... specific, testable criteria]

## Testing Approach
After implementation:
1. [SPECIFIC_TEST_STEP]
2. [SPECIFIC_TEST_STEP]
3. [VALIDATION_STEP]
4. [PERFORMANCE_CHECK]

## Known Issues & Solutions

**Issue**: [PROBLEM_YOU_ENCOUNTERED]
**Solution**: [HOW_TO_HANDLE_IT]

**Issue**: [COMMON_PITFALL]
**Solution**: [PROVEN_APPROACH]

## Important Notes
- [KEY_INSIGHT_ABOUT_ARCHITECTURE]
- [CRITICAL_CONSTRAINT_TO_MAINTAIN]
- [PERFORMANCE_CONSIDERATION]
- Remember: [PROJECT_CORE_PHILOSOPHY]

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to complete the implementation. [FINAL_GUIDANCE_SPECIFIC_TO_PROJECT].
```

### When to Generate This Prompt

Create a continuation prompt when:

1. You've completed a major milestone
2. You're approaching context limits
3. You've made significant architectural decisions
4. You've discovered important patterns or solutions
5. The task requires a fresh context to continue

### Required Elements Checklist

Before finalizing your continuation prompt, ensure it includes:

- [ ] Specific memory search queries to restore context
- [ ] Clear completion boundaries with ✅ checkmarks
- [ ] Absolute file paths with descriptions
- [ ] Parallel sub-agent task breakdown
- [ ] Implementation-level details (not just goals)
- [ ] Measurable success criteria
- [ ] Concrete testing steps
- [ ] Architectural constraints and principles
- [ ] Known issues with proven solutions

## Why This Template Works

### 1. Memory-First Architecture

The template starts with memory searches because:

- **Context Recovery**: Pulls comprehensive project state from persistent memory
- **Avoids Repetition**: Leverages existing knowledge instead of re-explaining
- **Consistency**: Ensures all agents work from the same understanding

### 2. Explicit State Management

Completed components with checkmarks because:

- **Prevents Duplication**: Clear visual markers of what's done
- **Saves Time**: Agent immediately knows what to skip
- **Progress Tracking**: Easy to see project advancement

### 3. Parallel Execution Design

Sub-agent task structure because:

- **Efficiency**: Multiple focused agents work simultaneously
- **Clarity**: Each agent has a specific, bounded responsibility
- **Error Isolation**: Problems in one area don't block others

### 4. Implementation Specificity

Detailed steps and file paths because:

- **Reduces Ambiguity**: Agent knows exactly what to do
- **Maintains Architecture**: Decisions are already made
- **Accelerates Development**: No time wasted on exploration

### 5. Validation-Driven

Success criteria and testing because:

- **Measurable Progress**: Clear definition of "done"
- **Quality Assurance**: Built-in verification steps
- **Prevents Drift**: Keeps implementation aligned with goals

### 6. Knowledge Transfer

Known issues section because:

- **Learns from Experience**: Passes on discovered solutions
- **Prevents Repeated Mistakes**: Warns about common pitfalls
- **Accelerates Problem-Solving**: Solutions are pre-identified

## Example Usage in Practice

When you complete a task, add this to your final message:

```markdown
## Continuation Prompt for Next Agent

[Insert filled template here]

This prompt has been structured to enable immediate context recovery and parallel execution. The next agent should begin with the memory searches to restore full project context.
```

## Key Principles

- **Be Specific**: Vague instructions waste time
- **Include Paths**: Absolute paths prevent searching
- **State Constraints**: Prevent architectural drift
- **Provide Solutions**: Don't just list problems
- **Enable Parallelism**: Break down independent tasks
- **Test Everything**: Include verification steps

This template ensures seamless handoffs between context windows, maintaining momentum and preventing knowledge loss across agent transitions.

## The Branch Metaphor in Action

### 1. Identifying the Root of the Branch

Instead of just fixing the immediate error (this.session.fs.watch is not a function), I traced back to find the "trunk" where this branch originated:

```
Root: FileWatcher assumes all sessions have a watch() method
  ├── Branch: FileWatcher.start() calls watch()
  ├── Branch: SandboxManager.watchFiles() creates FileWatcher
  └── Branch: SandboxManager.index() calls watchFiles()
```

### 2. Mapping the Entire Branch

By thinking of it as a tree branch, I could see ALL the places that would break:

```
Error Branch:
watch() missing
  → FileWatcher.start() throws
    → SandboxManager.watchFiles() fails
      → SandboxManager.index() fails
        → Project initialization fails
          → User can't use the app
```

### 3. Cutting Off the Branch at the Right Point

Instead of patching each leaf (individual error), I identified where to "prune" the branch most effectively:

**Option 1 (Bad)**: Fix only FileWatcher.start()

- ❌ SandboxManager still tries to watch
- ❌ Unnecessary FileWatcher objects created
- ❌ Confusing logs about "failed watching"

**Option 2 (Good)**: Cut at multiple strategic points

- ✅ Check sandbox type BEFORE creating watcher
- ✅ Make FileWatcher defensive (check for watch existence)
- ✅ Skip the entire watching flow for local sandboxes

### 4. Why This Worked So Well

The branch metaphor helped because:

1. **Holistic View**: Instead of tunnel vision on one error, I saw the entire system
2. **Preventive Fixes**: I fixed not just the current error but prevented future related errors
3. **Clean Separation**: Local sandboxes now have a completely different flow - no watching at all
4. **Graceful Degradation**: Even if something unexpected happens, the app continues working

### 5. The Key Insight

The breakthrough was realizing that local sandboxes don't need file watching at all! They're already local files. So instead of trying to make watching work, I cut off that entire branch of functionality for local sandboxes.

```
Before: All sandboxes → Try to watch → Error for local
After:  Local sandboxes → Skip watching entirely
        Remote sandboxes → Watch normally
```

### 6. Pattern for Future Issues

This approach can be applied to any error:

1. Don't just fix the error message
2. Trace back to find the root assumption
3. Map out everything that depends on that assumption
4. Cut the branch at the most logical point
5. Ensure graceful handling at multiple levels

The success here shows the power of thinking systematically about errors as interconnected branches rather than isolated issues. By addressing the root cause and its entire "branch" of dependencies, we created a robust solution that just works!

## Agent Memory Storage Guide: Building Self-Improving AI Systems

### Core Philosophy: Reflexive Learning Through Structured Memory

The goal is to create an AI agent that continuously improves through every interaction by storing memories in a way that enables pattern recognition, error correction, and knowledge accumulation. This guide implements a reflexive learning system where the agent learns from its mistakes and successes.

### Critical Storage Rule for First-Time Success

**THE GOLDEN RULE**: Store everything in the information parameter as structured text. Never use complex metadata with arrays or nested objects - it will fail validation.

#### ✅ What Works (Every Time)

```python
# Option 1: Information only (RECOMMENDED)
qdrant:qdrant-store
- information: "Your complete structured memory text here"

# Option 2: Information with SIMPLE flat metadata
qdrant:qdrant-store
- information: "Your memory text"
- metadata: {
    "type": "error_solution",
    "date": "2025-01-30",
    "confidence": 0.95
  }
```

#### ❌ What Fails (Don't Do This)

```python
# Complex metadata WILL FAIL
- metadata: {
    "tags": ["tag1", "tag2"],  # Arrays break it
    "metrics": {                # Nested objects break it
      "score": 100
    }
  }
```

### Memory Categories and Structures

#### 1. Error Tracking and Solutions

Store errors with their complete context and solutions IN THE INFORMATION FIELD:

```python
# Format everything as structured text
error_memory_text = """
ERROR PATTERN DETECTED AND RESOLVED:
Type: configuration_error
Error: Wrong input: Not existing vector name error: fast-all-minilm-l6-v2
Root Cause: MCP server expects named vector 'fast-all-minilm-l6-v2' but collection had unnamed default vector

CONTEXT:
- Task: Setting up Qdrant collection
- Attempted: Creating collection with default vector
- Timestamp: 2025-01-30T10:45:00Z
- Environment: Qdrant MCP server with AgentMemories collection

SOLUTION:
1. Delete existing collection
2. Create collection with named vector matching MCP expectation
3. Verify configuration matches MCP server requirements

Code Fix:
curl -X PUT http://localhost:6333/collections/AgentMemories -d '{"vectors": {"fast-all-minilm-l6-v2": {"size": 384, "distance": "Cosine"}}}'

PREVENTION: Always check MCP server vector naming requirements before creating collections
RELATED ERRORS: vector_size_mismatch, embedding_model_not_found
SUCCESS METRIC: Successfully stored memory without errors
CONFIDENCE: 0.95
"""

# Store with simple metadata only
simple_metadata = {
    "type": "error_solution",
    "domain": "vector_databases",
    "confidence": 0.95
}
```

#### 2. Knowledge Accumulation Structure

Organize knowledge hierarchically with relationships AS TEXT:

```python
knowledge_memory_text = """
TECHNICAL KNOWLEDGE - vector_databases/qdrant_configuration:
Key Insights: Embedding model names in MCP differ from vector field names | Collections require named vectors for MCP compatibility | Vector dimensions must match embedding model output

RELATIONSHIPS:
- Parent Concepts: database_configuration, embedding_systems
- Child Concepts: fastembed_models, vector_indexing
- Related Tools: qdrant_client, mcp_server, fastembed

PRACTICAL APPLICATIONS:
- Setting up memory storage for AI agents
- Creating searchable knowledge bases
- Building reflexive learning systems

Confidence: 0.95
Last Updated: 2025-01-30
Status: tested_and_confirmed
"""
```

#### 3. Task Performance Memories

Track what works and what doesn't:

```python
task_performance_text = """
TASK PERFORMANCE LOG - setup_qdrant_mcp_20250130:
Task: Configure Qdrant collection for MCP server memory storage
Success after 3 attempts using iterative debugging approach

APPROACH EVOLUTION:
- Initial: Create basic collection with default vector (FAILED - MCP server expects specific named vector)
- Successful: Create collection with named vector 'fast-all-minilm-l6-v2'

PERFORMANCE METRICS:
- Attempts: 3
- Time to Solution: 15 minutes
- Errors Encountered: 2
- Final Success: True

KEY LEARNING: Always verify MCP server expectations before creating resources

REUSABLE PATTERN: mcp_qdrant_setup
1. Check MCP server vector naming convention
2. Create collection with matching named vector
3. Test with actual storage operation

LESSONS LEARNED:
- Named vectors are different from default vectors in Qdrant
- Error messages provide clues about expected configurations
- MCP servers have specific naming expectations
"""
```

### Memory Storage Best Practices

#### 1. Structure Everything as Text

Since complex metadata fails, put ALL information in the information field with clear formatting:

```python
memory_template = """
MEMORY TYPE: {category}
Date: {timestamp}
Domain: {domain}
Confidence: {confidence}

CONTENT:
{main_content}

METADATA THAT WOULD HAVE FAILED AS JSON:
- Tags: {tag1}, {tag2}, {tag3}
- Related Concepts: {concept1}, {concept2}
- Tools Used: {tool1}, {tool2}
- Success Metrics: {metric_description}

RELATIONSHIPS:
{relationship_details}

VERIFICATION:
{how_to_verify}
"""
```

#### 2. Use Simple Metadata Sparingly

If you must use metadata, keep it extremely simple:

```python
# GOOD - Will work
metadata = {
    "type": "error_solution",
    "date": "2025-01-30",
    "confidence": 0.95
}

# BAD - Will fail
metadata = {
    "tags": ["debugging", "qdrant"],  # Arrays fail
    "metrics": {"success": True}      # Nested objects fail
}
```

#### 3. Memory Templates for Common Scenarios

**Error Resolution Template**

```
ERROR RESOLVED: {error_type}
Problem: {error_description}
Root Cause: {root_cause}
Solution Steps:
1. {step1}
2. {step2}
3. {step3}
Prevention: {how_to_avoid}
Verification: {how_to_verify}
Related Issues: {issue1}, {issue2}, {issue3}
Tags: #error #solution #{domain}
Confidence: {confidence_score}
```

**Learning Template**

```
LEARNED: {concept_name}
Domain: {domain}
Key Insight: {main_insight}
Practical Application: {use_case}
Related Concepts: {topic1}, {topic2}, {topic3}
Confidence Level: {confidence}
Source: {where_learned}
Date: {timestamp}
Status: {verification_status}
```

**Success Pattern Template**

```
SUCCESS PATTERN: {pattern_name}
Observed in: {context1}, {context2}
Success Rate: {percentage}%
Steps:
1. {step1}
2. {step2}
3. {step3}
Common Variations: {variation1} | {variation2}
When to Apply: {conditions}
When to Avoid: {anti_patterns}
Tools Required: {tool1}, {tool2}
```

#### 4. Reflexive Learning Implementation

Store self-reflection as structured text:

```python
reflexive_memory_text = f"""
SELF-REFLECTION on {task_name}:
What I tried: {agent_action}
What happened: {'Success' if success else 'Failed'} - {outcome_description}
Why it happened: {root_cause_analysis}
What I learned: {key_lessons}
How to improve: {improvement_suggestions}

METRICS:
- Attempts: {attempt_count}
- Time Taken: {duration}
- Errors: {error_list}
- Success: {success_boolean}

IMPROVEMENT PRIORITY: {priority_level}
CONFIDENCE IN LEARNING: {confidence_score}
"""
```

### Implementation Checklist

Before storing any memory:

- [ ] All information is in the information parameter as structured text
- [ ] Used clear headers and formatting (CAPS for sections)
- [ ] Included all context (what, when, where, why, how, result)
- [ ] Added confidence scores and timestamps in the text
- [ ] Listed related concepts as comma-separated text (not arrays)
- [ ] If using metadata, kept it simple (flat key-value only)
- [ ] Included verification methods and success metrics
- [ ] Added searchable keywords and tags as #hashtags in text

### Summary: The Key to First-Time Success

1. Put EVERYTHING in the information field as well-formatted text
2. Skip metadata entirely OR use only simple flat key-value pairs
3. Structure your text with clear headers and sections
4. Include all arrays and complex data as formatted text, not JSON
5. Make it searchable with good keywords and consistent formatting

This approach guarantees your memories store successfully on the first attempt while maintaining all the rich context and relationships needed for effective reflexive learning.
