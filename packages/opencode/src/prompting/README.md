# DGMO Native Prompting Techniques

A comprehensive system for integrating 18+ advanced prompting techniques directly into DGMO's agent workflow, enabling automatic technique selection, composition, and continuous learning.

## 🚀 Key Features

- **Zero-Latency Access**: All techniques available in-memory with <50ms total overhead
- **Automatic Selection**: AI-driven technique selection based on task analysis
- **Smart Composition**: Combine multiple techniques using sequential, parallel, or nested strategies
- **Inheritance System**: Sub-agents inherit and can modify parent techniques
- **Continuous Learning**: Performance tracking and adaptation for improved results over time

## 🎯 Quick Start Guide

### Installation

The prompting system is integrated into DGMO core. No additional installation required.

### Basic Usage

```typescript
import { promptingIntegration } from "./prompting/integration/dgmo-integration"

// Initialize the system (happens once at startup)
await promptingIntegration.initialize()

// Enhance any prompt with automatic technique selection
const enhancedPrompt = await promptingIntegration.enhanceSessionPrompt(
  sessionId,
  "Analyze this codebase and identify performance bottlenecks",
)
```

### Manual Technique Selection

```typescript
// Specify techniques manually if needed
const enhancedPrompt = await promptingIntegration.composePrompt(
  sessionId,
  "Debug this complex issue",
  ["chain_of_thought", "reflexion", "self_consistency"],
)
```

### Sub-Agent Inheritance

```typescript
// Sub-agents automatically inherit parent techniques
const subAgentTechniques = await promptingIntegration.prepareSubAgentTechniques(
  parentAgentId,
  "Focus on database optimization",
  [
    {
      techniqueId: "cot",
      type: "parameter",
      value: { focusArea: "sql_performance" },
    },
  ],
)
```

## 📁 Architecture Overview

```
src/prompting/
├── types.ts                    # Core TypeScript interfaces and types
├── registry/                   # Technique storage and retrieval
│   ├── technique-registry.ts   # Main registry implementation
│   ├── technique-loader.ts     # Dynamic technique loading
│   └── technique-cache.ts      # In-memory caching with LRU
├── techniques/                 # All 18+ technique implementations
│   ├── reasoning/             # CoT, ToT, PAL
│   ├── generation/            # Few-shot, Persona-based
│   ├── multi-agent/           # Coordination, Consensus, etc.
│   ├── optimization/          # Self-consistency, Refinement
│   └── advanced/              # ReAct, Reflexion, Meta-prompting
├── selector/                   # Intelligent technique selection
│   ├── technique-selector.ts   # Main selection engine
│   ├── task-analyzer.ts       # NLP-based task analysis
│   └── selection-strategies.ts # Different selection algorithms
├── composer/                   # Prompt composition engine
│   ├── prompt-composer.ts     # Combines techniques into prompts
│   ├── composition-rules.ts   # Rules for valid combinations
│   └── template-engine.ts     # Template processing
├── inheritance/               # Sub-agent technique inheritance
│   ├── technique-inheritance.ts
│   └── inheritance-policies.ts
├── learning/                  # Performance tracking and adaptation
│   ├── performance-tracker.ts
│   ├── effectiveness-analyzer.ts
│   └── adaptation-engine.ts
└── integration/              # DGMO system integration
    └── dgmo-integration.ts
```

## 🎯 Usage Examples

### Basic Usage

```typescript
import { promptingIntegration } from "./prompting/integration/dgmo-integration"

// Initialize the system (happens once)
await promptingIntegration.initialize()

// Enhance a session prompt with automatic technique selection
const enhancedPrompt = await promptingIntegration.enhanceSessionPrompt(
  sessionId,
  "Analyze this codebase and identify performance bottlenecks",
)

// The system automatically:
// 1. Analyzes the task (identifies: analysis, problem_solving)
// 2. Selects best techniques (e.g., CoT + Generated Knowledge)
// 3. Composes them into an optimized prompt
// 4. Returns ready-to-use enhanced prompt
```

### Sub-Agent Inheritance

```typescript
// When creating sub-agents, they inherit parent techniques
const subAgentTechniques = await promptingIntegration.prepareSubAgentTechniques(
  parentAgentId,
  "Focus on database query optimization",
  [
    {
      techniqueId: "cot",
      type: "parameter",
      value: { focusArea: "sql" },
    },
  ],
)

// Sub-agent gets parent's techniques plus task-specific adaptations
```

### Performance Learning

```typescript
// After task completion, record performance
await promptingIntegration.onTaskComplete({
  taskId: "task-123",
  duration: 5000,
  success: true,
  metadata: { techniques: ["cot", "few_shot"] },
  metrics: { tokensUsed: 1500, latency: 45 },
})

// System learns and improves future selections
```

## 🧠 All 18 Available Techniques

### Reasoning Techniques (3)

1. **Chain of Thought (CoT)** - `chain_of_thought`

   - **Description**: Breaks down complex problems into step-by-step reasoning
   - **Best for**: Mathematical problems, logical puzzles, multi-step analysis
   - **Example**: "Let's think step by step: First... Then... Therefore..."

2. **Tree of Thoughts (ToT)** - `tree_of_thoughts`

   - **Description**: Explores multiple reasoning paths in parallel, evaluating each branch
   - **Best for**: Complex decision-making, strategic planning, exploring alternatives
   - **Example**: Creates a tree of possibilities and systematically evaluates each path

3. **Program-Aided Language (PAL)** - `program_aided`
   - **Description**: Generates and executes code to solve problems programmatically
   - **Best for**: Mathematical computations, data analysis, algorithmic solutions
   - **Example**: Writes Python code to calculate results instead of mental math

### Generation Techniques (2)

4. **Few-Shot Learning** - `few_shot`

   - **Description**: Provides examples to establish patterns for the model to follow
   - **Best for**: Format consistency, style matching, pattern replication
   - **Example**: "Example 1: Input → Output, Example 2: Input → Output, Now: Input → ?"

5. **Persona-Based** - `persona_based`
   - **Description**: Assigns specific roles or expertise to guide responses
   - **Best for**: Domain-specific tasks, expert knowledge, specialized perspectives
   - **Example**: "As a senior security engineer, analyze this code for vulnerabilities"

### Multi-Agent Techniques (4)

6. **Multi-Agent Coordination** - `multi_agent_coordination`

   - **Description**: Orchestrates multiple specialized agents working together
   - **Best for**: Complex projects, parallel workstreams, diverse expertise needed
   - **Example**: Creates agents for frontend, backend, and database tasks simultaneously

7. **Agent Communication Protocol** - `agent_communication`

   - **Description**: Establishes structured messaging between agents
   - **Best for**: Inter-agent coordination, information sharing, collaborative tasks
   - **Example**: Agents exchange findings using defined message formats

8. **Consensus Building** - `consensus_building`

   - **Description**: Multiple agents debate and reach agreement on solutions
   - **Best for**: Critical decisions, validation of approaches, reducing bias
   - **Example**: Three agents propose solutions, discuss pros/cons, vote on best approach

9. **Hierarchical Decomposition** - `hierarchical_decomposition`
   - **Description**: Parent agents create child agents for subtasks
   - **Best for**: Large projects, recursive problems, divide-and-conquer strategies
   - **Example**: Main agent creates specialized sub-agents for each component

### Optimization Techniques (3)

10. **Self-Consistency** - `self_consistency`

    - **Description**: Generates multiple solutions and selects the most consistent
    - **Best for**: Improving accuracy, reducing randomness, validation
    - **Example**: Solves problem 5 times, picks the most common answer

11. **Iterative Refinement** - `iterative_refinement`

    - **Description**: Progressively improves solutions through multiple passes
    - **Best for**: Writing tasks, code optimization, quality improvement
    - **Example**: Draft → Review → Revise → Polish cycle

12. **Active-Prompt** - `active_prompt`
    - **Description**: Dynamically selects most relevant examples from a pool
    - **Best for**: Context-sensitive tasks, adaptive learning, efficiency
    - **Example**: Chooses examples most similar to current task from database

### Advanced Techniques (6)

13. **Constitutional AI** - `constitutional_ai`

    - **Description**: Self-critiques and revises based on defined principles
    - **Best for**: Ethical considerations, safety checks, alignment
    - **Example**: Reviews own output against principles, revises if violations found

14. **Meta-Prompting** - `meta_prompting`

    - **Description**: Generates optimal prompts for specific tasks
    - **Best for**: Prompt optimization, task-specific enhancement, automation
    - **Example**: Creates the best prompt for the given task before executing

15. **Generated Knowledge** - `generated_knowledge`

    - **Description**: First generates relevant background knowledge, then solves
    - **Best for**: Knowledge-intensive tasks, fact-checking, informed decisions
    - **Example**: "First, let me gather relevant information... Now, based on this..."

16. **Prompt Chaining** - `prompt_chaining`

    - **Description**: Links multiple prompts where outputs feed into next inputs
    - **Best for**: Multi-stage processes, complex workflows, data pipelines
    - **Example**: Research → Analyze → Synthesize → Present chain

17. **ReAct** - `react`

    - **Description**: Interleaves reasoning with actions (Reason + Act)
    - **Best for**: Interactive tasks, tool usage, real-world problem solving
    - **Example**: "Thought: I need X. Action: Use tool Y. Observation: Got Z..."

18. **Reflexion** - `reflexion`
    - **Description**: Learns from feedback by reflecting on past attempts
    - **Best for**: Iterative improvement, learning from mistakes, adaptation
    - **Example**: "Last attempt failed because... This time I'll try..."

## ⚡ Performance Specifications

- **Technique Loading**: <10ms (cached)
- **Task Analysis**: <20ms
- **Technique Selection**: <10ms
- **Prompt Composition**: <20ms
- **Total Overhead**: <50ms (95th percentile)

## 🔧 Integration Points

### Session Manager

```typescript
// In session creation
const prompt = await enhanceSessionPrompt(sessionId, userTask)
```

### Parallel Agents

```typescript
// In sub-agent creation
const techniques = await prepareSubAgentTechniques(parentId, task)
```

### Task Events

```typescript
// In task completion handler
await onTaskComplete(event)
```

## 📊 Monitoring

```typescript
// Get system metrics
const metrics = await promptingIntegration.getPerformanceMetrics()
console.log(metrics)
// {
//   registry: { totalTechniques: 18, cacheHitRate: 0.95 },
//   selector: { averageAnalysisTime: 18 },
//   composer: { cacheHitRate: 0.87 },
//   tracker: { totalExecutions: 10000, avgImprovement: 0.23 }
// }
```

## 🚦 Implementation Status

- [x] Architecture Design
- [x] TypeScript Interfaces
- [x] Core Components Structure
- [x] Technique Implementations (Phase 1) ✅
- [x] Selection Engine (Phase 2) ✅
- [x] Composition System (Phase 3) ✅
- [ ] Inheritance System (Phase 4) - In Progress
- [ ] Learning System (Phase 5) - In Progress
- [ ] Full Integration (Phase 6)

## 🔮 Future Enhancements

1. **Custom Techniques**: Allow users to define their own prompting patterns
2. **Technique Marketplace**: Share and discover community techniques
3. **Multi-Model Support**: Optimize techniques per LLM model
4. **Visual Composer**: GUI for technique selection and composition
5. **A/B Testing**: Built-in experimentation framework

## 📚 References

- [Architecture Document](./ARCHITECTURE.md)
- [Techniques Guide](./TECHNIQUES_GUIDE.md)
- [API Reference](./API_REFERENCE.md)
- [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md)
- [Type Definitions](./types.ts)
- [Integration Guide](./integration/dgmo-integration.ts)
