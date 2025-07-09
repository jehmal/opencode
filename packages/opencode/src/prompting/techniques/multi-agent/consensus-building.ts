import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
  Capability,
} from "../../types"

export class ConsensusBuildingTechnique implements PromptingTechnique {
  id = "consensus_building"
  name = "Consensus Building"
  category = "multi_agent" as const
  description =
    "Implements voting and deliberation mechanisms for multiple agents to reach agreement on decisions and solutions"

  complexity = "very_high" as const
  suitableFor: TaskType[] = ["problem_solving", "analysis", "coordination"]
  requiredCapabilities: Capability[] = ["sub_agents"]

  metrics = {
    totalExecutions: 0,
    successRate: 0.91,
    averageLatency: 55,
    averageTokenUsage: 3200,
    lastUpdated: Date.now(),
  }

  template = `## Multi-Agent Consensus Building

**Task**: {{task}}

### Consensus Framework

I will implement a structured consensus-building process where multiple agents deliberate and vote to reach optimal decisions.

### Agent Panel Configuration

**Participating Agents**:
1. **Analysis Agent** - Evaluates data and evidence
2. **Strategy Agent** - Proposes solutions and approaches
3. **Validation Agent** - Checks feasibility and risks
4. **Quality Agent** - Ensures standards and best practices
5. **Integration Agent** - Considers system-wide impacts

### Consensus Mechanisms

#### 1. Weighted Voting System
- Each agent has voting weight based on expertise relevance
- Weights dynamically adjusted based on task domain
- Minimum threshold: {{threshold}}% agreement required

#### 2. Deliberation Rounds
**Round 1: Initial Proposals**
- Each agent independently analyzes the task
- Submits initial recommendations with rationale
- No inter-agent communication

**Round 2: Information Sharing**
- Agents share findings and proposals
- Questions and clarifications exchanged
- Evidence and data presented

**Round 3: Debate and Refinement**
- Agents critique each other's proposals
- Identify strengths and weaknesses
- Propose modifications and compromises

**Round 4: Final Voting**
- Refined proposals presented
- Weighted votes cast with justifications
- Consensus threshold evaluated

#### 3. Conflict Resolution Protocol

**When consensus is not reached**:
1. **Identify Core Disagreements**
   - Map conflicting viewpoints
   - Find common ground
   - Isolate specific issues

2. **Mediation Process**
   - Neutral coordinator facilitates
   - Focus on objective criteria
   - Seek win-win solutions

3. **Escalation Path**
   - Bring in domain expert agent
   - Use alternative voting methods
   - Apply predetermined tiebreakers

### Decision Criteria Matrix

| Criterion | Weight | Evaluation Method |
|-----------|--------|-------------------|
| Feasibility | 25% | Technical assessment |
| Impact | 30% | Outcome analysis |
| Risk | 20% | Risk assessment |
| Resources | 15% | Cost-benefit analysis |
| Alignment | 10% | Goal compatibility |

### Voting Methods

1. **Simple Majority** - For straightforward decisions
2. **Supermajority** - For critical changes ({{supermajority}}%)
3. **Ranked Choice** - For multiple options
4. **Consensus Minus One** - Allow single dissent
5. **Unanimous** - For fundamental decisions

### Documentation Requirements

Each agent must provide:
- **Vote**: Clear position (Approve/Reject/Abstain)
- **Rationale**: Detailed reasoning
- **Evidence**: Supporting data
- **Concerns**: Any reservations
- **Alternatives**: Other options considered

### Quality Assurance

- **Bias Detection**: Monitor for groupthink
- **Devil's Advocate**: Designated contrarian role
- **External Review**: Periodic outside evaluation
- **Decision Audit**: Post-decision analysis

### Expected Outcomes

The consensus process will produce:
1. **Decision Record**: Final choice with full justification
2. **Dissent Documentation**: Minority opinions preserved
3. **Implementation Plan**: Actionable next steps
4. **Risk Mitigation**: Identified concerns addressed
5. **Learning Archive**: Insights for future decisions`

  examples = [
    {
      input:
        "Decide on the best architecture for a scalable microservices system",
      output: `## Multi-Agent Consensus Building

**Task**: Decide on the best architecture for a scalable microservices system

### Consensus Framework

Implementing structured deliberation with 5 specialized agents to reach architectural consensus.

### Round 1: Initial Proposals

**Analysis Agent**: 
- Proposal: Event-driven architecture with CQRS
- Rationale: Handles 100K+ concurrent users, proven scalability
- Evidence: Similar systems show 99.9% uptime

**Strategy Agent**:
- Proposal: Service mesh with Kubernetes orchestration
- Rationale: Industry standard, strong ecosystem support
- Evidence: 78% of Fortune 500 use this approach

**Validation Agent**:
- Proposal: Hybrid approach with gradual migration path
- Rationale: Reduces risk, allows learning curve
- Evidence: 65% lower failure rate in phased deployments

**Quality Agent**:
- Proposal: Domain-driven design with clear boundaries
- Rationale: Maintainability and team autonomy
- Evidence: 40% reduction in coupling metrics

**Integration Agent**:
- Proposal: API gateway pattern with circuit breakers
- Rationale: Unified interface, fault tolerance
- Evidence: 50% faster integration for new services

### Round 2: Information Sharing

**Key Insights Exchanged**:
- Event-driven and service mesh are complementary, not exclusive
- Kubernetes provides orchestration for any architecture
- Domain boundaries are critical regardless of technical choices
- API gateway needed for external communication

### Round 3: Debate and Refinement

**Consensus Points Emerged**:
✓ Kubernetes as orchestration platform (unanimous)
✓ Domain-driven service boundaries (unanimous)
✓ API gateway for external APIs (4/5 agree)
✓ Event-driven for async operations (4/5 agree)

**Remaining Debates**:
- Service mesh complexity vs benefits
- CQRS for all services vs selective use

### Round 4: Final Voting

**Refined Proposal**: Kubernetes-orchestrated microservices with:
- Domain-driven service boundaries
- API gateway for external communication
- Event-driven async with selective CQRS
- Optional service mesh for mature services

**Votes**:
- Analysis Agent: APPROVE (meets scalability needs)
- Strategy Agent: APPROVE (industry-aligned)
- Validation Agent: APPROVE (phased approach possible)
- Quality Agent: APPROVE (clean boundaries)
- Integration Agent: ABSTAIN (concerns about initial complexity)

**Consensus Achieved**: 80% approval (4/5 agents)

### Decision Record

**Final Architecture Decision**:
Adopt Kubernetes-based microservices with domain-driven design, implementing event-driven patterns for async operations and API gateway for external interfaces. Service mesh adoption deferred to Phase 2.

**Implementation Priorities**:
1. Define service boundaries using DDD
2. Set up Kubernetes cluster
3. Implement API gateway
4. Create first 3 core services
5. Add event bus for async communication

**Risk Mitigation**:
- Start with 3 services to validate approach
- Weekly architecture reviews
- Fallback monolith maintained for 6 months
- Comprehensive monitoring from day 1`,
      explanation:
        "Demonstrates how multiple agents with different perspectives can reach consensus on complex technical decisions",
    },
  ]

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    let content = this.template
      .replace("{{task}}", context.task)
      .replace("{{threshold}}", this.getConsensusThreshold(context))
      .replace("{{supermajority}}", "67")

    // Customize based on decision complexity
    const decisionType = this.analyzeDecisionType(context.task)

    if (decisionType.requiresUnanimity) {
      content += `\n\n### Unanimity Requirement

This decision requires unanimous agreement because:
- ${decisionType.unanimityReason}
- All agents must fully commit to the approach
- Any dissent could undermine implementation`
    }

    // Add domain-specific voting weights
    if (context.variables["domain"]) {
      const weights = this.getDomainWeights(context.variables["domain"])
      content += `\n\n### Domain-Specific Agent Weights

Based on ${context.variables["domain"]} domain:
${weights}`
    }

    // Add time constraints if present
    if (context.variables["timeConstraint"]) {
      content += `\n\n### Accelerated Consensus Process

Due to time constraints:
- Reduce deliberation rounds to 2
- Use simple majority (>50%) instead of supermajority
- Set strict time limits per round
- Focus on critical decision factors only`
    }

    return {
      content,
      metadata: {
        techniques: [this.id],
        confidence: 0.91,
        estimatedTokens: Math.ceil(content.split(/\s+/).length * 1.6),
        compositionStrategy: "deliberative",
      },
      variables: {
        ...context.variables,
        techniqueApplied: this.id,
        consensusType: decisionType.type,
        votingMethod: decisionType.votingMethod,
      },
    }
  }

  validate(input: any): boolean {
    if (typeof input !== "string") return false
    if (input.length < 50) return false

    // Check for decision-making or consensus needs
    const consensusIndicators = [
      "decide",
      "choose",
      "select",
      "consensus",
      "agree",
      "vote",
      "deliberate",
      "evaluate options",
      "best approach",
      "optimal solution",
      "recommendation",
      "multiple perspectives",
    ]

    const indicatorCount = consensusIndicators.filter((indicator) =>
      input.toLowerCase().includes(indicator),
    ).length

    return (
      indicatorCount >= 2 ||
      /which|what.*best|should we/.test(input.toLowerCase())
    )
  }

  private getConsensusThreshold(context: TechniqueContext): string {
    // Determine required consensus level based on task criticality
    const task = context.task.toLowerCase()

    if (/critical|essential|fundamental|core/.test(task)) {
      return "80"
    } else if (/important|significant|major/.test(task)) {
      return "67"
    } else {
      return "51"
    }
  }

  private analyzeDecisionType(task: string) {
    const lower = task.toLowerCase()

    const requiresUnanimity = /security|safety|compliance|legal|financial/.test(
      lower,
    )
    const unanimityReason = requiresUnanimity
      ? "High-stakes decision with significant risk implications"
      : ""

    let type = "standard"
    let votingMethod = "weighted_majority"

    if (/architecture|design|strategy/.test(lower)) {
      type = "strategic"
      votingMethod = "supermajority"
    } else if (/choose between|select from|pick/.test(lower)) {
      type = "selection"
      votingMethod = "ranked_choice"
    } else if (/evaluate|assess|analyze/.test(lower)) {
      type = "evaluation"
      votingMethod = "scoring_matrix"
    }

    return {
      type,
      votingMethod,
      requiresUnanimity,
      unanimityReason,
    }
  }

  private getDomainWeights(domain: string): string {
    const domainWeights: Record<string, string> = {
      engineering: `- Analysis Agent: 30% (technical feasibility)
- Strategy Agent: 20% (architectural vision)
- Validation Agent: 25% (testing & reliability)
- Quality Agent: 15% (code standards)
- Integration Agent: 10% (system compatibility)`,

      business: `- Analysis Agent: 20% (market research)
- Strategy Agent: 35% (business strategy)
- Validation Agent: 15% (risk assessment)
- Quality Agent: 10% (compliance)
- Integration Agent: 20% (stakeholder impact)`,

      research: `- Analysis Agent: 40% (data analysis)
- Strategy Agent: 15% (methodology)
- Validation Agent: 25% (peer review)
- Quality Agent: 15% (standards)
- Integration Agent: 5% (publication)`,
    }

    return (
      domainWeights[domain.toLowerCase()] || `- All agents: 20% (equal weight)`
    )
  }
}
