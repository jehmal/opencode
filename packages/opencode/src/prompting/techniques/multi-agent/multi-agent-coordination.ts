import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
  Capability,
} from "../../types"

export class MultiAgentCoordinationTechnique implements PromptingTechnique {
  id = "multi_agent_coordination"
  name = "Multi-Agent Coordination"
  category = "multi_agent" as const
  description =
    "Orchestrates multiple specialized agents to work together on complex tasks through role assignment and coordination"

  complexity = "high" as const
  suitableFor: TaskType[] = [
    "coordination",
    "problem_solving",
    "analysis",
    "generation",
  ]
  requiredCapabilities: Capability[] = ["sub_agents"]

  metrics = {
    totalExecutions: 0,
    successRate: 0.92,
    averageLatency: 45,
    averageTokenUsage: 2500,
    lastUpdated: Date.now(),
  }

  template = `## Multi-Agent Task Coordination

**Task**: {{task}}

### Agent Orchestration Plan

I will coordinate multiple specialized agents to complete this task efficiently. Each agent will have a specific role and responsibility.

### Agent Roles and Assignments

{{#if requiresResearch}}
**Agent 1: Research Specialist**
- Role: Gather and analyze relevant information
- Tasks:
  - Search for existing patterns and solutions
  - Analyze current implementation
  - Identify best practices
- Output: Comprehensive research report
{{/if}}

{{#if requiresDesign}}
**Agent 2: Architecture Designer**
- Role: Design the solution architecture
- Tasks:
  - Create system design
  - Define interfaces and contracts
  - Plan integration points
- Output: Technical design document
{{/if}}

{{#if requiresImplementation}}
**Agent 3: Implementation Specialist**
- Role: Build the solution
- Tasks:
  - Implement core functionality
  - Write tests
  - Ensure code quality
- Output: Working implementation
{{/if}}

{{#if requiresValidation}}
**Agent 4: Quality Assurance Agent**
- Role: Validate and test the solution
- Tasks:
  - Run comprehensive tests
  - Check edge cases
  - Verify requirements
- Output: Test report and validation results
{{/if}}

{{#if requiresIntegration}}
**Agent 5: Integration Specialist**
- Role: Integrate components and ensure compatibility
- Tasks:
  - Connect all components
  - Resolve conflicts
  - Ensure smooth operation
- Output: Integrated solution
{{/if}}

### Coordination Protocol

1. **Parallel Execution Phase**
   - Agents {{parallelAgents}} will work simultaneously
   - Each agent focuses on their specialized area
   - Results will be collected for synthesis

2. **Sequential Dependencies**
   {{sequentialSteps}}

3. **Communication Points**
   - Agents will share findings at key milestones
   - Critical information will be passed between agents
   - Conflicts will be resolved through consensus

4. **Final Integration**
   - All agent outputs will be combined
   - A final synthesis will ensure coherence
   - The complete solution will be validated

### Expected Outcomes

Each agent will produce:
- Detailed findings in their area
- Actionable recommendations
- Implementation artifacts
- Quality metrics

The coordinated effort will result in a comprehensive solution that addresses all aspects of the task.`

  examples = [
    {
      input: "Build a real-time chat application with user authentication",
      output: `## Multi-Agent Task Coordination

**Task**: Build a real-time chat application with user authentication

### Agent Orchestration Plan

I will coordinate 5 specialized agents to build this chat application efficiently.

### Agent Roles and Assignments

**Agent 1: Research Specialist**
- Role: Gather and analyze relevant information
- Tasks:
  - Research real-time communication protocols (WebSocket, Socket.io)
  - Analyze authentication best practices (JWT, OAuth)
  - Identify suitable tech stack and libraries
- Output: Technology recommendations and best practices guide

**Agent 2: Architecture Designer**
- Role: Design the solution architecture
- Tasks:
  - Design database schema for users and messages
  - Create API architecture (REST/GraphQL endpoints)
  - Plan WebSocket event structure
  - Design authentication flow
- Output: Complete system architecture with diagrams

**Agent 3: Backend Implementation Specialist**
- Role: Build the server-side solution
- Tasks:
  - Implement authentication system
  - Create WebSocket server for real-time messaging
  - Build message persistence layer
  - Implement user management
- Output: Working backend with all APIs

**Agent 4: Frontend Implementation Specialist**
- Role: Build the client-side application
- Tasks:
  - Create chat UI components
  - Implement WebSocket client
  - Build authentication forms
  - Add real-time message updates
- Output: Responsive chat interface

**Agent 5: Integration & Testing Specialist**
- Role: Integrate and test the complete system
- Tasks:
  - Connect frontend to backend
  - Test real-time functionality
  - Verify authentication flows
  - Ensure message delivery reliability
- Output: Fully integrated and tested application

### Coordination Protocol

1. **Parallel Execution Phase**
   - Agents 1 & 2 will work simultaneously (Research & Architecture)
   - Their outputs will inform Agents 3 & 4

2. **Sequential Dependencies**
   - Architecture must be complete before implementation begins
   - Backend APIs needed before frontend integration
   - All components ready before final testing

3. **Communication Points**
   - API contracts shared between backend and frontend agents
   - Authentication strategy coordinated across all agents
   - WebSocket events synchronized between client and server

4. **Final Integration**
   - All components merged into working application
   - End-to-end testing performed
   - Documentation compiled from all agents

### Expected Outcomes

The coordinated effort will produce:
- Scalable real-time chat architecture
- Secure authentication system
- Responsive user interface
- Comprehensive test coverage
- Deployment-ready application`,
      explanation:
        "This example shows how multiple agents with different specializations work together to build a complex application",
    },
  ]

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    const taskAnalysis = this.analyzeTask(context.task)

    let content = this.template
      .replace("{{task}}", context.task)
      .replace(
        "{{#if requiresResearch}}",
        taskAnalysis.requiresResearch ? "" : "<!--",
      )
      .replace("{{/if}}", taskAnalysis.requiresResearch ? "" : "-->")
      .replace(
        "{{#if requiresDesign}}",
        taskAnalysis.requiresDesign ? "" : "<!--",
      )
      .replace("{{/if}}", taskAnalysis.requiresDesign ? "" : "-->")
      .replace(
        "{{#if requiresImplementation}}",
        taskAnalysis.requiresImplementation ? "" : "<!--",
      )
      .replace("{{/if}}", taskAnalysis.requiresImplementation ? "" : "-->")
      .replace(
        "{{#if requiresValidation}}",
        taskAnalysis.requiresValidation ? "" : "<!--",
      )
      .replace("{{/if}}", taskAnalysis.requiresValidation ? "" : "-->")
      .replace(
        "{{#if requiresIntegration}}",
        taskAnalysis.requiresIntegration ? "" : "<!--",
      )
      .replace("{{/if}}", taskAnalysis.requiresIntegration ? "" : "-->")

    // Determine parallel agents
    const parallelAgents: string[] = []
    if (taskAnalysis.requiresResearch) parallelAgents.push("1")
    if (taskAnalysis.requiresDesign) parallelAgents.push("2")
    content = content.replace("{{parallelAgents}}", parallelAgents.join(", "))

    // Add sequential steps
    const sequentialSteps = this.determineSequentialSteps(taskAnalysis)
    content = content.replace(
      "{{sequentialSteps}}",
      sequentialSteps.map((step) => `   - ${step}`).join("\n")
    )

    // Add domain-specific context
    if (context.variables["domain"]) {
      content = `Domain: ${context.variables["domain"]}\n\n${content}`
    }

    // Add complexity-based enhancements
    if (taskAnalysis.complexity === "very_high") {
      content += `\n\n### Additional Coordination Measures

- **Checkpoint Synchronization**: Agents will sync at 25%, 50%, and 75% completion
- **Conflict Resolution**: Designated lead agent will resolve conflicts
- **Resource Sharing**: Shared memory space for cross-agent data access
- **Rollback Protocol**: Ability to revert to previous stable state if needed`
    }

    return {
      content,
      metadata: {
        techniques: [this.id],
        confidence: 0.92,
        estimatedTokens: Math.ceil(content.split(/\s+/).length * 1.5),
        compositionStrategy: "parallel",
      },
      variables: {
        ...context.variables,
        techniqueApplied: this.id,
        agentCount: this.countRequiredAgents(taskAnalysis),
        coordinationType: "orchestrated",
      },
    }
  }

  validate(input: any): boolean {
    if (typeof input !== "string") return false
    if (input.length < 50) return false

    // Check for multi-faceted tasks that benefit from agent coordination
    const coordinationIndicators = [
      "build",
      "create",
      "implement",
      "design",
      "develop",
      "integrate",
      "system",
      "application",
      "multiple",
      "complex",
      "coordinate",
      "orchestrate",
    ]

    const indicatorCount = coordinationIndicators.filter((indicator) =>
      input.toLowerCase().includes(indicator),
    ).length

    return indicatorCount >= 2 || input.length > 200
  }

  private analyzeTask(task: string) {
    const lower = task.toLowerCase()

    return {
      requiresResearch: /research|analyze|investigate|explore|study/.test(
        lower,
      ),
      requiresDesign: /design|architect|plan|structure|model/.test(lower),
      requiresImplementation: /implement|build|create|develop|code/.test(lower),
      requiresValidation: /test|validate|verify|check|ensure/.test(lower),
      requiresIntegration: /integrate|connect|combine|merge|unify/.test(lower),
      complexity: this.assessComplexity(task),
    }
  }

  private assessComplexity(task: string): "high" | "very_high" {
    const complexityScore =
      (task.length > 200 ? 1 : 0) +
      (task.split(/[,;]/).length > 3 ? 1 : 0) +
      (/multiple|several|various/.test(task) ? 1 : 0) +
      (/system|application|platform/.test(task) ? 1 : 0)

    return complexityScore >= 3 ? "very_high" : "high"
  }

  private determineSequentialSteps(analysis: any): string[] {
    const steps: string[] = []

    if (analysis.requiresResearch && analysis.requiresDesign) {
      steps.push("Research findings inform design decisions")
    }
    if (analysis.requiresDesign && analysis.requiresImplementation) {
      steps.push("Design completion triggers implementation start")
    }
    if (analysis.requiresImplementation && analysis.requiresValidation) {
      steps.push("Implementation ready for validation testing")
    }
    if (analysis.requiresValidation && analysis.requiresIntegration) {
      steps.push("Validated components ready for integration")
    }

    return steps
  }

  private countRequiredAgents(analysis: any): number {
    return [
      analysis.requiresResearch,
      analysis.requiresDesign,
      analysis.requiresImplementation,
      analysis.requiresValidation,
      analysis.requiresIntegration,
    ].filter(Boolean).length
  }
}
