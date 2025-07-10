# DGMO Prompting Techniques Guide

This guide provides detailed information about each of the 18 prompting techniques available in the DGMO system, including when to use them, example scenarios, and performance characteristics.

## Table of Contents

1. [Reasoning Techniques](#reasoning-techniques)
   - [Chain of Thought (CoT)](#chain-of-thought-cot)
   - [Tree of Thoughts (ToT)](#tree-of-thoughts-tot)
   - [Program-Aided Language (PAL)](#program-aided-language-pal)
2. [Generation Techniques](#generation-techniques)
   - [Few-Shot Learning](#few-shot-learning)
   - [Persona-Based](#persona-based)
3. [Multi-Agent Techniques](#multi-agent-techniques)
   - [Multi-Agent Coordination](#multi-agent-coordination)
   - [Agent Communication Protocol](#agent-communication-protocol)
   - [Consensus Building](#consensus-building)
   - [Hierarchical Decomposition](#hierarchical-decomposition)
4. [Optimization Techniques](#optimization-techniques)
   - [Self-Consistency](#self-consistency)
   - [Iterative Refinement](#iterative-refinement)
   - [Active-Prompt](#active-prompt)
5. [Advanced Techniques](#advanced-techniques)
   - [Constitutional AI](#constitutional-ai)
   - [Meta-Prompting](#meta-prompting)
   - [Generated Knowledge](#generated-knowledge)
   - [Prompt Chaining](#prompt-chaining)
   - [ReAct](#react)
   - [Reflexion](#reflexion)

---

## Reasoning Techniques

### Chain of Thought (CoT)

**ID**: `chain_of_thought`  
**Category**: Reasoning  
**Complexity**: Medium

#### Description

Chain of Thought prompting encourages the model to break down complex problems into intermediate reasoning steps, making the problem-solving process more transparent and accurate.

#### When to Use

- Mathematical word problems
- Logical puzzles
- Multi-step analysis tasks
- Complex decision-making requiring justification
- Debugging code issues

#### Example Scenarios

**Scenario 1: Mathematical Problem**

```
Task: Calculate the total cost of items with tax and discount
CoT Approach:
1. First, let me calculate the subtotal: 3 items × $25 = $75
2. Apply the 20% discount: $75 × 0.20 = $15 discount
3. Subtotal after discount: $75 - $15 = $60
4. Calculate 8% tax: $60 × 0.08 = $4.80
5. Final total: $60 + $4.80 = $64.80
```

**Scenario 2: Code Debugging**

```
Task: Find why the function returns incorrect results
CoT Approach:
1. Let me trace through the function step by step
2. Input validation: Checking if array is empty... OK
3. Loop initialization: i starts at 0... OK
4. Loop condition: i < array.length... Wait, should be i <= array.length for inclusive
5. Found the issue: off-by-one error in loop condition
```

#### Performance Characteristics

- **Latency**: Low (adds ~10-20ms)
- **Token Usage**: Medium (2-3x base prompt)
- **Accuracy Improvement**: High (20-40% on reasoning tasks)
- **Best Model Size**: Works well with all sizes, especially beneficial for smaller models

---

### Tree of Thoughts (ToT)

**ID**: `tree_of_thoughts`  
**Category**: Reasoning  
**Complexity**: High

#### Description

Tree of Thoughts extends CoT by exploring multiple reasoning paths simultaneously, evaluating each branch, and selecting the most promising path forward.

#### When to Use

- Complex strategic planning
- Problems with multiple valid approaches
- Situations requiring exploration of alternatives
- Game theory problems
- Architecture design decisions

#### Example Scenarios

**Scenario 1: System Architecture Decision**

```
Task: Choose database for new microservice
ToT Branches:
├── SQL Database
│   ├── PostgreSQL (Score: 8/10)
│   │   ├── Pros: ACID, complex queries, mature
│   │   └── Cons: Scaling challenges
│   └── MySQL (Score: 6/10)
│       ├── Pros: Fast, simple
│       └── Cons: Limited features
└── NoSQL Database
    ├── MongoDB (Score: 7/10)
    │   ├── Pros: Flexible schema, horizontal scaling
    │   └── Cons: Eventual consistency
    └── DynamoDB (Score: 9/10)
        ├── Pros: Serverless, auto-scaling
        └── Cons: Vendor lock-in

Decision: DynamoDB based on scalability requirements
```

#### Performance Characteristics

- **Latency**: Medium (adds ~30-50ms)
- **Token Usage**: High (3-5x base prompt)
- **Accuracy Improvement**: Very High (30-50% on complex problems)
- **Best Model Size**: Most effective with larger models

---

### Program-Aided Language (PAL)

**ID**: `program_aided`  
**Category**: Reasoning  
**Complexity**: Medium

#### Description

PAL generates and executes actual code to solve problems, particularly useful for mathematical computations and data analysis tasks.

#### When to Use

- Mathematical calculations
- Data analysis and statistics
- Algorithm implementation
- Financial computations
- Scientific calculations

#### Example Scenarios

**Scenario 1: Statistical Analysis**

````python
Task: Calculate mean, median, and standard deviation
PAL Generated Code:
```python
import numpy as np

data = [23, 45, 67, 89, 12, 34, 56, 78, 90, 21]

mean = np.mean(data)
median = np.median(data)
std_dev = np.std(data)

print(f"Mean: {mean:.2f}")
print(f"Median: {median:.2f}")
print(f"Standard Deviation: {std_dev:.2f}")
````

#### Performance Characteristics

- **Latency**: Medium (adds ~20-40ms + execution time)
- **Token Usage**: Medium (2-3x base prompt)
- **Accuracy Improvement**: Very High for computational tasks (95%+)
- **Best Model Size**: Works with all sizes, but code quality improves with larger models

---

## Generation Techniques

### Few-Shot Learning

**ID**: `few_shot`  
**Category**: Generation  
**Complexity**: Low

#### Description

Few-Shot Learning provides examples of input-output pairs to establish a pattern that the model should follow for new inputs.

#### When to Use

- Format standardization
- Style matching
- Pattern replication
- Data transformation tasks
- Creating consistent outputs

#### Example Scenarios

**Scenario 1: JSON Formatting**

```
Examples:
Input: "John Doe, 30, Engineer"
Output: {"name": "John Doe", "age": 30, "profession": "Engineer"}

Input: "Jane Smith, 25, Designer"
Output: {"name": "Jane Smith", "age": 25, "profession": "Designer"}

Now: "Bob Johnson, 35, Manager"
Output: {"name": "Bob Johnson", "age": 35, "profession": "Manager"}
```

#### Performance Characteristics

- **Latency**: Very Low (adds ~5-10ms)
- **Token Usage**: Low to Medium (depends on example count)
- **Accuracy Improvement**: High for pattern matching (80%+)
- **Best Model Size**: Effective with all model sizes

---

### Persona-Based

**ID**: `persona_based`  
**Category**: Generation  
**Complexity**: Low

#### Description

Assigns specific roles, expertise, or perspectives to guide the model's responses in a domain-specific manner.

#### When to Use

- Domain-specific expertise needed
- Consistent tone/voice required
- Role-playing scenarios
- Specialized knowledge application
- Professional consultations

#### Example Scenarios

**Scenario 1: Security Analysis**

```
Persona: "You are a senior cybersecurity expert with 15 years of experience in penetration testing and secure code review."

Task: Review this authentication code
Response: "As a security expert, I immediately notice several vulnerabilities:
1. Passwords stored in plain text - critical issue
2. No rate limiting on login attempts - brute force risk
3. SQL injection vulnerability in username field
4. Missing CSRF token validation..."
```

#### Performance Characteristics

- **Latency**: Very Low (adds ~5ms)
- **Token Usage**: Low (1.2x base prompt)
- **Accuracy Improvement**: Medium (improves domain relevance)
- **Best Model Size**: More effective with larger models that have broader training

---

## Multi-Agent Techniques

### Multi-Agent Coordination

**ID**: `multi_agent_coordination`  
**Category**: Multi-Agent  
**Complexity**: Very High

#### Description

Orchestrates multiple specialized agents working together on different aspects of a complex task.

#### When to Use

- Large-scale projects
- Tasks requiring diverse expertise
- Parallel workstreams
- Complex system development
- Comprehensive analysis

#### Example Scenarios

**Scenario 1: Full-Stack Application Development**

```
Coordinator creates specialized agents:
- Frontend Agent: React UI implementation
- Backend Agent: API development
- Database Agent: Schema design
- DevOps Agent: Deployment configuration
- Testing Agent: Test suite creation

Each agent works on their domain while coordinator ensures integration.
```

#### Performance Characteristics

- **Latency**: High (adds ~100-200ms for coordination)
- **Token Usage**: Very High (5-10x base prompt across agents)
- **Accuracy Improvement**: Very High for complex tasks
- **Best Model Size**: Requires capable models for effective coordination

---

### Agent Communication Protocol

**ID**: `agent_communication`  
**Category**: Multi-Agent  
**Complexity**: High

#### Description

Establishes structured communication channels and protocols between multiple agents for information sharing.

#### When to Use

- Inter-agent data exchange
- Collaborative problem solving
- Distributed task execution
- Status synchronization
- Knowledge sharing between agents

#### Example Scenarios

**Scenario 1: Microservices Design**

```
Protocol Definition:
- Message Format: JSON with {from, to, type, payload, timestamp}
- Types: REQUEST, RESPONSE, BROADCAST, STATUS
- Channels: design-decisions, implementation-details, testing-results

Agent A → Agent B: {
  "type": "REQUEST",
  "payload": "Need API schema for user service"
}
Agent B → Agent A: {
  "type": "RESPONSE",
  "payload": {"endpoints": [...], "models": [...]}
}
```

#### Performance Characteristics

- **Latency**: Medium (adds ~50-100ms for protocol overhead)
- **Token Usage**: High (3-4x due to structured messages)
- **Accuracy Improvement**: High for coordination tasks
- **Best Model Size**: Medium to large models

---

### Consensus Building

**ID**: `consensus_building`  
**Category**: Multi-Agent  
**Complexity**: High

#### Description

Multiple agents independently analyze a problem, propose solutions, and reach consensus through structured debate.

#### When to Use

- Critical decision making
- Risk assessment
- Architecture decisions
- Code review processes
- Validation of approaches

#### Example Scenarios

**Scenario 1: API Design Decision**

```
Three agents debate REST vs GraphQL:

Agent 1 (Pro-REST): "REST provides simplicity, caching, standard HTTP"
Agent 2 (Pro-GraphQL): "GraphQL reduces over-fetching, type safety"
Agent 3 (Neutral): "Consider team expertise and client needs"

Consensus Process:
- Round 1: Each presents arguments
- Round 2: Address counterpoints
- Round 3: Vote with justification
Final: 2-1 for GraphQL with REST fallback for public API
```

#### Performance Characteristics

- **Latency**: High (adds ~150-300ms for full consensus)
- **Token Usage**: Very High (5-8x for multiple rounds)
- **Accuracy Improvement**: Very High (reduces bias, improves decisions)
- **Best Model Size**: Large models for nuanced debate

---

### Hierarchical Decomposition

**ID**: `hierarchical_decomposition`  
**Category**: Multi-Agent  
**Complexity**: Very High

#### Description

Parent agents decompose complex tasks and create specialized child agents for subtasks, forming a hierarchy.

#### When to Use

- Large project breakdown
- Recursive problem solving
- Complex system implementation
- Organizational task distribution
- Divide-and-conquer strategies

#### Example Scenarios

**Scenario 1: E-commerce Platform Development**

```
Root Agent: "Build e-commerce platform"
├── Frontend Lead Agent
│   ├── UI Component Agent
│   ├── State Management Agent
│   └── Testing Agent
├── Backend Lead Agent
│   ├── API Design Agent
│   ├── Business Logic Agent
│   └── Database Agent
└── Infrastructure Agent
    ├── Deployment Agent
    └── Monitoring Agent
```

#### Performance Characteristics

- **Latency**: Very High (adds ~200-500ms for hierarchy setup)
- **Token Usage**: Very High (10x+ across all agents)
- **Accuracy Improvement**: Excellent for large projects
- **Best Model Size**: Large models for effective delegation

---

## Optimization Techniques

### Self-Consistency

**ID**: `self_consistency`  
**Category**: Optimization  
**Complexity**: Medium

#### Description

Generates multiple independent solutions to the same problem and selects the most consistent or frequent answer.

#### When to Use

- Improving accuracy on critical tasks
- Reducing randomness in outputs
- Validation of solutions
- High-stakes decisions
- Mathematical problems

#### Example Scenarios

**Scenario 1: Code Review Decision**

```
Task: Should we refactor this function?

Sample 1: "Yes, it's too complex (cyclomatic complexity: 15)"
Sample 2: "Yes, violates single responsibility principle"
Sample 3: "Yes, difficult to test in current form"
Sample 4: "No, works fine as is"
Sample 5: "Yes, maintenance burden is high"

Result: 4/5 say Yes → Refactor recommended
```

#### Performance Characteristics

- **Latency**: Medium (adds ~50-100ms for multiple samples)
- **Token Usage**: High (3-5x for multiple generations)
- **Accuracy Improvement**: High (15-25% improvement)
- **Best Model Size**: Effective with all sizes

---

### Iterative Refinement

**ID**: `iterative_refinement`  
**Category**: Optimization  
**Complexity**: Medium

#### Description

Progressively improves outputs through multiple refinement cycles, with each iteration building on the previous.

#### When to Use

- Writing and documentation
- Code optimization
- Design refinement
- Quality improvement
- Complex problem solving

#### Example Scenarios

**Scenario 1: API Documentation**

```
Iteration 1: Basic endpoint description
Iteration 2: Add parameters and types
Iteration 3: Include examples and error codes
Iteration 4: Add authentication details
Iteration 5: Polish language and formatting
```

#### Performance Characteristics

- **Latency**: Medium to High (adds ~30-60ms per iteration)
- **Token Usage**: High (2-4x depending on iterations)
- **Accuracy Improvement**: High for quality tasks
- **Best Model Size**: Benefits from larger models

---

### Active-Prompt

**ID**: `active_prompt`  
**Category**: Optimization  
**Complexity**: Medium

#### Description

Dynamically selects the most relevant examples from a pool based on the current task context.

#### When to Use

- Large example databases
- Context-sensitive tasks
- Adaptive learning scenarios
- Efficient few-shot learning
- Domain-specific applications

#### Example Scenarios

**Scenario 1: Code Generation**

```
Task: Generate Python function for data validation

Active Selection from Pool:
- Selected: Email validation example (high relevance)
- Selected: Input sanitization example (high relevance)
- Skipped: Image processing example (low relevance)
- Skipped: Network request example (low relevance)
```

#### Performance Characteristics

- **Latency**: Low to Medium (adds ~20-40ms for selection)
- **Token Usage**: Medium (optimized examples)
- **Accuracy Improvement**: High (better than random examples)
- **Best Model Size**: Works with all sizes

---

## Advanced Techniques

### Constitutional AI

**ID**: `constitutional_ai`  
**Category**: Advanced  
**Complexity**: High

#### Description

Self-critiques and revises outputs based on a set of defined principles or constitution.

#### When to Use

- Ethical considerations
- Safety-critical applications
- Content moderation
- Alignment with values
- Policy compliance

#### Example Scenarios

**Scenario 1: Code Review with Security Principles**

```
Constitution:
1. Never store sensitive data in logs
2. Always validate user input
3. Use parameterized queries

Self-Critique Process:
Initial: "Log user data for debugging"
Critique: "Violates Principle 1 - contains passwords"
Revision: "Log user ID only, mask sensitive fields"
```

#### Performance Characteristics

- **Latency**: Medium (adds ~40-80ms for critique cycles)
- **Token Usage**: High (2-3x for critique and revision)
- **Accuracy Improvement**: Very High for alignment
- **Best Model Size**: Most effective with larger models

---

### Meta-Prompting

**ID**: `meta_prompting`  
**Category**: Advanced  
**Complexity**: Very High

#### Description

Generates optimal prompts for specific tasks before executing them, essentially "prompting about prompting."

#### When to Use

- Prompt optimization
- Novel task types
- Automated prompt engineering
- Task-specific enhancement
- Dynamic adaptation

#### Example Scenarios

**Scenario 1: Custom Task Optimization**

```
Task: "Analyze startup pitch deck"

Meta-Prompt Generation:
"I need to create a prompt for pitch deck analysis.
Key aspects: market size, problem/solution fit, team, financials
Best approach: Structured analysis with scoring rubric
Generated Prompt: 'As a venture capital analyst, evaluate this pitch deck using the following criteria...'"
```

#### Performance Characteristics

- **Latency**: High (adds ~60-120ms for prompt generation)
- **Token Usage**: High (2-4x for meta-generation)
- **Accuracy Improvement**: Very High for novel tasks
- **Best Model Size**: Requires large models

---

### Generated Knowledge

**ID**: `generated_knowledge`  
**Category**: Advanced  
**Complexity**: Medium

#### Description

First generates relevant background knowledge about the topic, then uses that knowledge to solve the task.

#### When to Use

- Knowledge-intensive tasks
- Fact-based reasoning
- Domain expertise needed
- Research tasks
- Informed decision making

#### Example Scenarios

**Scenario 1: Technology Selection**

```
Task: Choose message queue for microservices

Generated Knowledge:
"Message queues comparison:
- RabbitMQ: AMQP protocol, reliable, complex setup
- Kafka: High throughput, distributed, event streaming
- Redis Pub/Sub: Simple, in-memory, limited persistence
- AWS SQS: Managed, scalable, AWS integration"

Decision: Based on high throughput needs → Kafka
```

#### Performance Characteristics

- **Latency**: Medium (adds ~30-60ms)
- **Token Usage**: Medium to High (2-3x)
- **Accuracy Improvement**: High for knowledge tasks
- **Best Model Size**: Benefits from larger models with more training data

---

### Prompt Chaining

**ID**: `prompt_chaining`  
**Category**: Advanced  
**Complexity**: High

#### Description

Links multiple prompts in sequence where the output of one becomes the input for the next.

#### When to Use

- Multi-stage processes
- Complex workflows
- Data transformation pipelines
- Report generation
- Sequential analysis

#### Example Scenarios

**Scenario 1: Code Migration Pipeline**

```
Chain Design:
1. Analyze Legacy Code → Identify patterns and dependencies
2. Design New Architecture → Based on analysis results
3. Generate Migration Plan → Using architecture design
4. Create Implementation → Following migration plan
5. Generate Tests → Based on implementation

Each stage feeds into the next automatically.
```

#### Performance Characteristics

- **Latency**: High (cumulative across chain)
- **Token Usage**: Very High (multiplied by chain length)
- **Accuracy Improvement**: High for complex workflows
- **Best Model Size**: Consistent model size recommended across chain

---

### ReAct

**ID**: `react`  
**Category**: Advanced  
**Complexity**: High

#### Description

Interleaves reasoning (Thought) with actions (Act) and observations, creating a dynamic problem-solving loop.

#### When to Use

- Interactive problem solving
- Tool usage scenarios
- Real-world tasks
- Debugging processes
- Exploratory analysis

#### Example Scenarios

**Scenario 1: Debugging Production Issue**

```
Thought: Server returns 500 errors, need to check logs
Action: grep "ERROR" /var/log/app.log
Observation: "ERROR: Database connection timeout"

Thought: Database connection issue, check DB status
Action: psql -c "SELECT 1"
Observation: "Connection refused"

Thought: Database is down, need to restart
Action: systemctl restart postgresql
Observation: "Service started successfuly"
```

#### Performance Characteristics

- **Latency**: Variable (depends on actions)
- **Token Usage**: High (multiple thought-action cycles)
- **Accuracy Improvement**: Very High for interactive tasks
- **Best Model Size**: Large models for complex reasoning

---

### Reflexion

**ID**: `reflexion`  
**Category**: Advanced  
**Complexity**: Very High

#### Description

Learns from previous attempts by reflecting on failures and successes to improve future performance.

#### When to Use

- Iterative improvement tasks
- Learning from mistakes
- Complex problem solving
- Adaptive strategies
- Performance optimization

#### Example Scenarios

**Scenario 1: Algorithm Optimization**

```
Attempt 1: Bubble sort implementation
Reflection: "Too slow for large datasets (O(n²))"

Attempt 2: Quick sort implementation
Reflection: "Better average case, but worst case still O(n²)"

Attempt 3: Merge sort with optimization
Reflection: "Consistent O(n log n), memory usage acceptable"

Learning: "For this use case, stable O(n log n) is priority"
```

#### Performance Characteristics

- **Latency**: Very High (multiple attempts + reflection)
- **Token Usage**: Very High (stores history)
- **Accuracy Improvement**: Excellent over iterations
- **Best Model Size**: Most effective with large models

---

## Technique Selection Matrix

| Task Type                | Primary Techniques       | Secondary Techniques       |
| ------------------------ | ------------------------ | -------------------------- |
| Mathematical Problems    | PAL, CoT                 | Self-Consistency           |
| Code Generation          | Few-Shot, PAL            | Iterative Refinement       |
| System Design            | ToT, Hierarchical        | Consensus Building         |
| Debugging                | ReAct, CoT               | Reflexion                  |
| Documentation            | Iterative Refinement     | Few-Shot                   |
| Analysis                 | CoT, Generated Knowledge | Meta-Prompting             |
| Multi-Component Projects | Multi-Agent Coordination | Hierarchical Decomposition |
| Decision Making          | ToT, Consensus Building  | Self-Consistency           |
| Learning Tasks           | Reflexion, Active-Prompt | Generated Knowledge        |
| Ethical/Safety           | Constitutional AI        | Consensus Building         |

## Performance Optimization Tips

1. **Combine Complementary Techniques**: CoT + Self-Consistency for critical reasoning
2. **Use Caching**: Cache Generated Knowledge for similar tasks
3. **Batch Operations**: Group similar tasks for Active-Prompt efficiency
4. **Limit Iterations**: Set maximum rounds for Iterative Refinement
5. **Parallel Execution**: Run independent agents concurrently
6. **Early Termination**: Stop Self-Consistency when consensus is clear
7. **Selective Application**: Use complex techniques only when needed

## Common Pitfalls and Solutions

### Pitfall 1: Over-Engineering Simple Tasks

**Solution**: Start with simple techniques, escalate only if needed

### Pitfall 2: Token Explosion with Multi-Agent

**Solution**: Set token budgets per agent, use summaries for communication

### Pitfall 3: Slow Consensus Building

**Solution**: Limit debate rounds, use weighted voting

### Pitfall 4: Reflexion Memory Overflow

**Solution**: Maintain sliding window of recent attempts

### Pitfall 5: Prompt Chaining Error Propagation

**Solution**: Add validation between chain steps

## Conclusion

The DGMO prompting techniques provide a comprehensive toolkit for enhancing AI agent capabilities. Success comes from:

- Understanding each technique's strengths
- Matching techniques to task requirements
- Combining techniques effectively
- Monitoring performance metrics
- Iterating based on results

Remember: Not every task needs every technique. Start simple, measure results, and scale complexity as needed.
