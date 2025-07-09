# Vector Memory Quick Reference Card

## 🚀 INSTANT COMMANDS

### Store Memories

```bash
# Quick store
qdrant:store "Memory content here"

# With metadata
qdrant:store "Memory content" --type "error_solution" --confidence 0.95

# From file
qdrant:store "$(cat solution.md)" --type "success_pattern"
```

### Find Memories

```bash
# Simple search
qdrant:find "search terms"

# Vector search
qdrant:vector-search "semantic query" --limit 10

# Filtered search
qdrant:vector-search "query" --type "error_solution" --project "current"
```

## 📝 MEMORY FORMATS

### Error Solution

```
ERROR: [exact error]
CAUSE: [why it happened]
FIX: [solution steps]
PREVENT: [avoidance tips]
```

### Success Pattern

```
SUCCESS: [what worked]
STEPS: [how you did it]
REUSE: [where else to apply]
METRICS: [improvements]
```

### Learning Note

```
LEARNED: [concept]
CONTEXT: [where/how]
APPLIES: [use cases]
RELATED: [connections]
```

### Project Snapshot

```
PROJECT: [name] - [date]
DONE: [completed items]
DOING: [in progress]
NEXT: [upcoming]
BLOCKERS: [issues]
```

## 🔍 SEARCH PATTERNS

### By Type

```bash
# Errors
--type "error_solution"

# Successes
--type "success_pattern"

# Knowledge
--type "universal_knowledge"

# Snapshots
--type "project_snapshot"
```

### By Time

```bash
# Today
--date "today"

# This week
--date ">=2025-01-24"

# Last month
--date ">=2025-01-01"
```

### By Project

```bash
# Current project
--project "dgmo"

# Specific project
--project "my_project"

# Cross-project
--cross-project true
```

### By Quality

```bash
# High confidence
--confidence ">=0.8"

# Evolved memories
--evolution ">=3"

# Frequently used
--usage ">=10"
```

## 🎯 COMMON QUERIES

```bash
# "What was that error fix?"
qdrant:find "error message keywords" --type "error_solution"

# "How did I do X before?"
qdrant:find "X implementation" --type "success_pattern"

# "What did I learn about Y?"
qdrant:find "Y concept" --type "learning"

# "Project status?"
qdrant:find "snapshot" --project "current" --latest

# "Similar problems?"
qdrant:vector-search "current error description" --expand

# "What's related?"
qdrant:get-entangled "memory topic" --min-strength 0.7

# "Predict what I need"
qdrant:predict-needs --context "current task"
```

## 💡 POWER TIPS

### 1. Immediate Documentation

```bash
# Right after fixing error
echo "ERROR: $error_msg
CAUSE: $cause
FIX: $solution" | qdrant:store --type "error_solution"
```

### 2. Batch Retrieval

```bash
# Get multiple related memories
qdrant:constellation "topic" --max-stars 10
```

### 3. Evolution Tracking

```bash
# See how memory evolved
qdrant:evolution "memory_id" --show-history
```

### 4. Predictive Loading

```bash
# Pre-load likely needs
qdrant:predict --horizon "1h" --prefetch
```

## 🔧 WORKFLOWS

### Debug Workflow

```bash
1. qdrant:find "error message"
2. qdrant:vector-search "error context" --expand
3. # Fix the issue
4. qdrant:store "solution" --type "error_solution"
5. qdrant:entangle "new_solution" "similar_errors"
```

### Learning Workflow

```bash
1. qdrant:store "new learning" --type "knowledge"
2. qdrant:find-related "concept"
3. qdrant:build-graph "concept" --depth 2
4. qdrant:schedule-review "memory_id"
```

### Project Workflow

```bash
1. qdrant:snapshot --project "current"
2. qdrant:predictions --today
3. # Work on project
4. qdrant:store "progress" --type "update"
5. qdrant:snapshot --end-of-day
```

## 🎨 TEMPLATES

### Quick Templates

```bash
# List templates
qdrant:templates

# Use template
qdrant:template "error" --fill

# Custom template
qdrant:template "custom" --create
```

## 📊 ANALYSIS

### Memory Stats

```bash
# Overall stats
qdrant:stats

# Project stats
qdrant:stats --project "current"

# Evolution metrics
qdrant:evolution-stats
```

### Pattern Analysis

```bash
# Find patterns
qdrant:patterns --type "error"

# Success patterns
qdrant:patterns --type "success" --min-occurrences 3
```

## ⚡ SHORTCUTS

```bash
# Aliases for common operations
alias qstore='qdrant:store'
alias qfind='qdrant:find'
alias qvec='qdrant:vector-search'
alias qsnap='qdrant:snapshot'
alias qpred='qdrant:predict'

# Functions for workflows
debug() {
  qfind "$1" --type "error_solution"
}

learn() {
  qstore "$1" --type "learning" && qfind-related "$1"
}

snapshot() {
  qsnap --project "${1:-current}" --auto-summarize
}
```

## 🚨 TROUBLESHOOTING

```bash
# Can't find memory?
qvec "broader search terms" --no-filters

# Too many results?
qfind "specific terms" --confidence ">=0.8" --limit 5

# Check memory health
qdrant:health-check

# Rebuild indices
qdrant:optimize --rebuild-indices

# Clear cache
qdrant:cache --clear
```

---

_Keep this card handy for quick memory operations!_
