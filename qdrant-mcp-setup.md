# Qdrant MCP Setup for Memory Storage System

## Overview
This document provides step-by-step instructions for setting up Qdrant MCP (Model Context Protocol) server to implement the structured memory storage system as outlined in the agent-memory-guide.md.

## Prerequisites

1. **Qdrant Server Running**
   ```bash
   # Using Docker
   docker run -p 6333:6333 qdrant/qdrant
   
   # Or install locally
   # See: https://qdrant.tech/documentation/quick-start/
   ```

2. **MCP Qdrant Server**
   ```bash
   # Install the MCP Qdrant server
   pip install mcp-server-qdrant
   ```

## Qdrant Collection Configuration

Based on the agent-memory-guide.md, create the collection with the correct named vector:

```bash
# Create AgentMemories collection with proper named vector
curl -X PUT http://localhost:6333/collections/AgentMemories \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "fast-all-minilm-l6-v2": {
        "size": 384,
        "distance": "Cosine"
      }
    }
  }'
```

## MCP Server Configuration

Add to your MCP configuration (typically in `.cursor/mcp_servers.json` or similar):

```json
{
  "mcpServers": {
    "qdrant": {
      "command": "python",
      "args": ["-m", "mcp_server_qdrant"],
      "env": {
        "QDRANT_URL": "http://localhost:6333",
        "QDRANT_COLLECTION": "AgentMemories",
        "QDRANT_VECTOR_NAME": "fast-all-minilm-l6-v2",
        "EMBEDDING_MODEL": "sentence-transformers/all-MiniLM-L6-v2"
      }
    }
  }
}
```

## Memory Storage Structure Implementation

Based on the agent-memory-guide.md, here are the proper storage patterns:

### 1. Technical Knowledge Storage
```python
# Example structure for technical knowledge
technical_memory = """
TECHNICAL KNOWLEDGE - {domain}/{topic}:
Key Insights: {insights}
Related to: {parent_concepts}
Practical Use: {applications}
Confidence: {confidence_level}
Status: {verification_status}
Tools: {related_tools}
"""

metadata = {
    "type": "technical_knowledge",
    "category": "domain_specific", 
    "domain": "vector_databases",
    "tools": ["qdrant", "mcp_server", "fastembed"],
    "confidence": 0.95,
    "timestamp": "2025-01-19T16:30:00Z",
    "tags": ["configuration", "setup", "integration"],
    "reusability": "high"
}
```

### 2. Error Resolution Storage
```python
# Example structure for error solutions
error_memory = """
ERROR RESOLVED: {error_type}
Problem: {error_description}
Root Cause: {root_cause}
Solution: {solution_steps}
Prevention: {how_to_avoid}
Verification: {how_to_verify}
Related Issues: {related_problems}
"""

metadata = {
    "type": "error_solution",
    "category": "troubleshooting",
    "error_type": "configuration_error",
    "severity": "medium",
    "tools": ["qdrant", "mcp_server"],
    "timestamp": "2025-01-19T16:30:00Z",
    "tags": ["debugging", "fix", "resolution"],
    "success_rate": 1.0
}
```

### 3. Task Performance Storage
```python
# Example structure for task performance
task_memory = """
TASK PERFORMANCE LOG - {task_id}:
Task: {task_description}
Success after {attempts} attempts
Key Learning: {primary_lesson}
Reusable Pattern: {pattern_name} - {pattern_steps}
Performance: {metrics}
"""

metadata = {
    "type": "task_performance",
    "category": "performance_tracking",
    "task_type": "integration_analysis",
    "success": True,
    "attempts": 1,
    "timestamp": "2025-01-19T16:30:00Z",
    "tags": ["performance", "success", "pattern"],
    "reusability": "high"
}
```

## Critical Implementation Rules

### ✅ CORRECT Metadata Format
```python
# Always use Python dictionary, NOT JSON string
metadata = {
    "type": "error_solution",
    "category": "type_mismatch", 
    "severity": "high",
    "timestamp": "2025-01-19T16:30:00Z"
}
```

### ❌ INCORRECT Metadata Format
```python
# Never use JSON string - this will fail!
metadata = '{"type": "error_solution", "category": "type_mismatch"}'
```

### Required Context (6 W's)
Every memory must include:
- **When**: Timestamp and date
- **Where**: System, environment, tool versions  
- **Why**: The goal or problem being solved
- **What**: The specific action or information
- **How**: The method or approach used
- **Result**: What happened (success/failure/partial)

## Verification and Testing

1. **Test Collection Creation**
   ```bash
   curl http://localhost:6333/collections/AgentMemories
   ```

2. **Test Vector Storage**
   ```bash
   # Store a test memory to verify configuration
   curl -X PUT http://localhost:6333/collections/AgentMemories/points \
     -H "Content-Type: application/json" \
     -d '{
       "points": [{
         "id": 1,
         "vector": {"fast-all-minilm-l6-v2": [0.1, 0.2, 0.3, ...]},
         "payload": {"text": "Test memory", "type": "test"}
       }]
     }'
   ```

3. **Test MCP Tools**
   ```python
   # Once configured, test with:
   # mcp__qdrant__qdrant-store(information="test", metadata={"type": "test"})
   # mcp__qdrant__qdrant-find(query="test")
   ```

## Troubleshooting Common Issues

### Vector Name Mismatch Error
```
Error: Wrong input: Not existing vector name error: fast-all-minilm-l6-v2
```
**Solution**: Ensure collection is created with named vector matching MCP expectation

### Metadata Format Error
```
Error: Expected dictionary but got string
```
**Solution**: Pass metadata as Python dict, not JSON string

### Connection Refused
```
Error: Connection refused to localhost:6333
```
**Solution**: Ensure Qdrant server is running and accessible

## Success Metrics

- ✅ Collection created without errors
- ✅ Named vector matches MCP expectations  
- ✅ Test storage operation succeeds
- ✅ Memory retrieval works correctly
- ✅ Structured memories follow agent-memory-guide.md format

## Next Steps

1. **Implement Reflexive Learning Cycle**
   - Add automatic reflection on task outcomes
   - Store lessons learned with proper structure
   - Create cross-references between related memories

2. **Set Up Memory Consolidation**
   - Regular cleanup of outdated memories
   - Consolidation of related knowledge
   - Confidence decay for unverified information

3. **Enable Advanced Patterns**
   - Error prediction based on stored patterns
   - Success pattern replication
   - Cross-domain insight linking

This setup will provide a robust, structured memory system that enables continuous learning and improvement according to the agent-memory-guide.md specifications. 