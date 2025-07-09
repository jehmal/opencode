import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
  Capability,
} from "../../types"

export class HierarchicalDecompositionTechnique implements PromptingTechnique {
  id = "hierarchical_decomposition"
  name = "Hierarchical Decomposition"
  category = "multi_agent" as const
  description =
    "Breaks down complex tasks into hierarchical parent-child relationships with specialized agents at each level"

  complexity = "very_high" as const
  suitableFor: TaskType[] = [
    "problem_solving",
    "generation",
    "analysis",
    "coordination",
  ]
  requiredCapabilities: Capability[] = ["sub_agents"]

  metrics = {
    totalExecutions: 0,
    successRate: 0.93,
    averageLatency: 60,
    averageTokenUsage: 3500,
    lastUpdated: Date.now(),
  }

  template = `## Hierarchical Task Decomposition

**Task**: {{task}}

### Hierarchical Structure

I will decompose this complex task into a hierarchical structure with parent and child agents, each responsible for specific subtasks.

### Task Hierarchy

\`\`\`
Root Coordinator (Level 0)
├── Parent Agent A (Level 1)
│   ├── Child Agent A.1 (Level 2)
│   ├── Child Agent A.2 (Level 2)
│   └── Child Agent A.3 (Level 2)
├── Parent Agent B (Level 1)
│   ├── Child Agent B.1 (Level 2)
│   └── Child Agent B.2 (Level 2)
└── Parent Agent C (Level 1)
    ├── Child Agent C.1 (Level 2)
    ├── Child Agent C.2 (Level 2)
    └── Child Agent C.3 (Level 2)
\`\`\`

### Decomposition Strategy

#### Level 0: Root Coordinator
- **Role**: Overall orchestration and final integration
- **Responsibilities**:
  - Task analysis and decomposition
  - Resource allocation
  - Progress monitoring
  - Result synthesis
  - Quality assurance

#### Level 1: Parent Agents
{{#each parentAgents}}
**{{name}}**
- **Domain**: {{domain}}
- **Subtasks**: {{subtasks}}
- **Child Agents**: {{childCount}}
- **Dependencies**: {{dependencies}}
{{/each}}

#### Level 2: Child Agents
Specialized agents handling atomic tasks:
- Focused on single responsibility
- Report to parent agent
- Can work in parallel within constraints
- Produce specific deliverables

### Communication Flow

1. **Top-Down Instructions**
   - Root → Parents: High-level objectives
   - Parents → Children: Specific tasks
   - Include context and constraints

2. **Bottom-Up Reporting**
   - Children → Parents: Task results
   - Parents → Root: Aggregated outcomes
   - Include status and issues

3. **Lateral Coordination**
   - Between parents: Dependency management
   - Between children: Resource sharing
   - Conflict resolution protocols

### Task Assignment Protocol

1. **Analysis Phase**
   - Root analyzes overall task
   - Identifies major components
   - Determines dependencies

2. **Decomposition Phase**
   - Break into logical subtasks
   - Assign to parent agents
   - Define success criteria

3. **Distribution Phase**
   - Parents further decompose
   - Assign to child agents
   - Set priorities and deadlines

4. **Execution Phase**
   - Parallel execution where possible
   - Sequential for dependencies
   - Real-time progress tracking

### Dependency Management

**Dependency Types**:
- **Sequential**: Task B requires Task A output
- **Resource**: Shared resource constraints
- **Knowledge**: Information dependencies
- **Approval**: Requires validation before proceeding

**Resolution Strategy**:
- Map all dependencies upfront
- Create execution schedule
- Buffer time for critical paths
- Fallback plans for blockers

### Progress Aggregation

Each level aggregates progress from below:
- Child progress → Parent summary
- Parent summaries → Root dashboard
- Real-time status visualization
- Automatic escalation of issues

### Quality Control

**Multi-Level Validation**:
1. Child self-validation
2. Parent review of child outputs
3. Root verification of integration
4. Cross-functional checks

### Expected Deliverables

**From Each Level**:
- Level 2: Atomic task outputs
- Level 1: Integrated component results
- Level 0: Complete solution

**Documentation**:
- Task breakdown structure
- Execution timeline
- Decision log
- Lessons learned`

  examples = [
    {
      input:
        "Develop a complete e-commerce platform with payment processing, inventory management, and customer portal",
      output: `## Hierarchical Task Decomposition

**Task**: Develop a complete e-commerce platform with payment processing, inventory management, and customer portal

### Hierarchical Structure

\`\`\`
E-Commerce Platform Coordinator
├── Frontend Parent Agent
│   ├── UI/UX Designer Agent
│   ├── Customer Portal Developer Agent
│   └── Mobile App Developer Agent
├── Backend Parent Agent
│   ├── API Developer Agent
│   ├── Database Architect Agent
│   └── Integration Specialist Agent
├── Payment Parent Agent
│   ├── Payment Gateway Agent
│   ├── Security Compliance Agent
│   └── Transaction Monitor Agent
└── Inventory Parent Agent
    ├── Stock Management Agent
    ├── Supplier Integration Agent
    └── Analytics Agent
\`\`\`

### Level 1: Parent Agent Assignments

**Frontend Parent Agent**
- Domain: User interfaces and experiences
- Subtasks: Design system, customer portal, mobile apps
- Child Agents: 3
- Dependencies: Backend APIs, brand guidelines

**Backend Parent Agent**
- Domain: Server-side logic and data management
- Subtasks: API development, database design, integrations
- Child Agents: 3
- Dependencies: Business requirements, security policies

**Payment Parent Agent**
- Domain: Financial transactions and compliance
- Subtasks: Gateway integration, PCI compliance, monitoring
- Child Agents: 3
- Dependencies: Legal requirements, backend APIs

**Inventory Parent Agent**
- Domain: Product and stock management
- Subtasks: Stock tracking, supplier APIs, reporting
- Child Agents: 3
- Dependencies: Database schema, business rules

### Execution Timeline

**Phase 1: Foundation (Weeks 1-2)**
- Database Architect: Design schema
- UI/UX Designer: Create design system
- Security Compliance: Define requirements

**Phase 2: Core Development (Weeks 3-6)**
- API Developer: Build core endpoints
- Customer Portal Developer: Implement frontend
- Payment Gateway Agent: Integrate processors
- Stock Management Agent: Build inventory system

**Phase 3: Integration (Weeks 7-8)**
- Integration Specialist: Connect all systems
- Mobile App Developer: Adapt for mobile
- Supplier Integration Agent: External connections

**Phase 4: Polish & Launch (Weeks 9-10)**
- Transaction Monitor: Set up monitoring
- Analytics Agent: Implement reporting
- All agents: Testing and refinement

### Dependency Resolution

**Critical Path**:
1. Database schema → API development → Frontend integration
2. Security requirements → Payment gateway → Transaction processing
3. Inventory design → Stock management → Supplier integration

**Parallel Tracks**:
- UI/UX design can proceed independently
- Mobile development after web portal stable
- Analytics after core features complete

### Progress Tracking

**Week 4 Status**:
- Frontend: 60% (Portal functional, mobile pending)
- Backend: 70% (APIs complete, optimization ongoing)
- Payment: 40% (Gateway integrated, compliance pending)
- Inventory: 50% (Core features done, suppliers next)

**Overall**: 55% complete, on track for 10-week delivery

### Risk Mitigation

- Payment compliance delayed → Temporary manual processing
- Mobile app complexity → Launch web-first, mobile in v1.1
- Supplier API issues → Manual upload fallback
- Performance concerns → Implement caching layer`,
      explanation:
        "Shows how a complex system is broken down into manageable hierarchical components with clear parent-child relationships",
    },
  ]

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    const decomposition = this.decomposeTask(context.task)

    let content = this.template.replace("{{task}}", context.task)

    // Build parent agents section
    const parentAgentsSection = decomposition.parentAgents
      .map(
        (agent) => `**${agent.name}**
- **Domain**: ${agent.domain}
- **Subtasks**: ${agent.subtasks}
- **Child Agents**: ${agent.childCount}
- **Dependencies**: ${agent.dependencies}`,
      )
      .join("\n\n")

    content = content.replace(
      /{{#each parentAgents}}[\s\S]*?{{\/each}}/,
      parentAgentsSection,
    )

    // Add complexity-specific enhancements
    if (decomposition.levels > 2) {
      content += `\n\n### Deep Hierarchy Considerations

With ${decomposition.levels} levels of hierarchy:
- Implement message routing through parent nodes
- Add intermediate coordination layers
- Use hierarchical namespacing for agents
- Enable partial result aggregation at each level`
    }

    // Add domain-specific patterns
    if (context.variables["domain"]) {
      const patterns = this.getDomainPatterns(context.variables["domain"])
      if (patterns) {
        content += `\n\n### Domain-Specific Patterns\n\n${patterns}`
      }
    }

    // Add scale considerations
    if (decomposition.totalAgents > 10) {
      content += `\n\n### Scale Management

With ${decomposition.totalAgents} total agents:
- Implement agent pooling for efficiency
- Use batch processing for similar tasks
- Add circuit breakers for fault isolation
- Monitor resource usage per branch`
    }

    return {
      content,
      metadata: {
        techniques: [this.id],
        confidence: 0.93,
        estimatedTokens: Math.ceil(content.split(/\s+/).length * 1.7),
        compositionStrategy: "hierarchical",
      },
      variables: {
        ...context.variables,
        techniqueApplied: this.id,
        hierarchyLevels: decomposition.levels,
        totalAgents: decomposition.totalAgents,
        decompositionType: "hierarchical",
      },
    }
  }

  validate(input: any): boolean {
    if (typeof input !== "string") return false
    if (input.length < 60) return false

    // Check for complex, multi-component tasks
    const hierarchicalIndicators = [
      "complete",
      "full",
      "entire",
      "comprehensive",
      "system",
      "platform",
      "application",
      "multiple components",
      "several parts",
      "various aspects",
      "break down",
      "decompose",
    ]

    const indicatorCount = hierarchicalIndicators.filter((indicator) =>
      input.toLowerCase().includes(indicator),
    ).length

    // Also check for lists or multiple requirements
    const hasMultipleRequirements =
      (input.match(/,/g) || []).length >= 2 ||
      (input.match(/and/gi) || []).length >= 2 ||
      /\d+\.|\d+\)/.test(input)

    return indicatorCount >= 2 || hasMultipleRequirements
  }

  private decomposeTask(task: string) {
    const components = this.identifyComponents(task)
    const parentAgents = components.map((comp) => ({
      name: `${comp.name} Parent Agent`,
      domain: comp.domain,
      subtasks: comp.subtasks.join(", "),
      childCount: comp.subtasks.length,
      dependencies: comp.dependencies || "None",
    }))

    const totalAgents =
      1 +
      parentAgents.length +
      parentAgents.reduce((sum, agent) => sum + agent.childCount, 0)

    return {
      parentAgents,
      levels: 3, // Typically 3 levels for most tasks
      totalAgents,
    }
  }

  private identifyComponents(task: string) {
    const lower = task.toLowerCase()
    const components = []

    // Common component patterns
    if (/frontend|ui|interface|portal/.test(lower)) {
      components.push({
        name: "Frontend",
        domain: "User interfaces",
        subtasks: ["Design", "Development", "Testing"],
        dependencies: "Backend APIs",
      })
    }

    if (/backend|server|api/.test(lower)) {
      components.push({
        name: "Backend",
        domain: "Server logic",
        subtasks: ["API Design", "Implementation", "Database"],
        dependencies: "Requirements",
      })
    }

    if (/payment|billing|transaction/.test(lower)) {
      components.push({
        name: "Payment",
        domain: "Financial processing",
        subtasks: ["Gateway Integration", "Security", "Compliance"],
        dependencies: "Legal requirements",
      })
    }

    if (/data|analytics|reporting/.test(lower)) {
      components.push({
        name: "Analytics",
        domain: "Data processing",
        subtasks: ["Collection", "Processing", "Visualization"],
        dependencies: "Data sources",
      })
    }

    // Default components if none identified
    if (components.length === 0) {
      components.push(
        {
          name: "Analysis",
          domain: "Requirements analysis",
          subtasks: ["Research", "Planning", "Design"],
          dependencies: "None",
        },
        {
          name: "Implementation",
          domain: "Development",
          subtasks: ["Core Features", "Integration", "Testing"],
          dependencies: "Design",
        },
        {
          name: "Deployment",
          domain: "Release management",
          subtasks: ["Preparation", "Deployment", "Monitoring"],
          dependencies: "Implementation",
        },
      )
    }

    return components
  }

  private getDomainPatterns(domain: string): string | null {
    const patterns: Record<string, string> = {
      software: `- Use feature-based decomposition
- Separate concerns by architectural layers
- Include testing agents at each level
- Add DevOps agents for deployment`,

      research: `- Hypothesis-driven decomposition
- Literature review as foundation layer
- Parallel experimentation branches
- Peer review at parent level`,

      business: `- Market analysis at top level
- Functional area decomposition
- ROI validation agents
- Stakeholder communication nodes`,
    }

    return patterns[domain.toLowerCase()] || null
  }
}
