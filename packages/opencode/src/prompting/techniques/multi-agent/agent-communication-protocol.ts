import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
  Capability,
} from "../../types"

export class AgentCommunicationProtocolTechnique implements PromptingTechnique {
  id = "agent_communication_protocol"
  name = "Agent Communication Protocol"
  category = "multi_agent" as const
  description =
    "Establishes structured communication formats and protocols for information passing between multiple agents"

  complexity = "high" as const
  suitableFor: TaskType[] = ["coordination", "analysis", "problem_solving"]
  requiredCapabilities: Capability[] = ["sub_agents"]

  metrics = {
    totalExecutions: 0,
    successRate: 0.89,
    averageLatency: 35,
    averageTokenUsage: 1800,
    lastUpdated: Date.now(),
  }

  template = `## Agent Communication Protocol

**Task**: {{task}}

### Communication Framework

I will establish a structured communication protocol to ensure efficient information exchange between agents.

### Message Format Specification

All inter-agent communications will follow this structured format:

\`\`\`
MESSAGE_TYPE: [REQUEST|RESPONSE|UPDATE|QUERY|BROADCAST]
FROM_AGENT: [Agent ID/Role]
TO_AGENT: [Agent ID/Role or ALL]
TIMESTAMP: [ISO 8601 timestamp]
PRIORITY: [HIGH|MEDIUM|LOW]
CONTENT: {
  subject: [Brief description]
  body: [Detailed information]
  data: [Structured data if applicable]
  action_required: [Yes/No]
  deadline: [If action required]
}
METADATA: {
  message_id: [Unique identifier]
  thread_id: [Conversation thread]
  version: [Protocol version]
  encryption: [If sensitive data]
}
\`\`\`

### Communication Channels

1. **Direct Channel** (Agent-to-Agent)
   - For specific queries and responses
   - Private information exchange
   - Task handoffs

2. **Broadcast Channel** (One-to-Many)
   - Status updates
   - Shared discoveries
   - Global alerts

3. **Query Channel** (Request-Response)
   - Information requests
   - Capability queries
   - Resource availability

4. **Update Channel** (Continuous Stream)
   - Progress reports
   - Real-time status
   - Metric updates

### Protocol Rules

1. **Message Acknowledgment**
   - All messages must be acknowledged within 2 seconds
   - Failed acknowledgments trigger retry mechanism
   - Maximum 3 retry attempts

2. **Information Integrity**
   - Messages include checksums for data validation
   - Version control for protocol compatibility
   - Rollback capability for failed communications

3. **Priority Handling**
   - HIGH priority messages processed immediately
   - MEDIUM priority within standard queue
   - LOW priority during idle periods

4. **Conflict Resolution**
   - Timestamp-based ordering for concurrent messages
   - Agent hierarchy for decision conflicts
   - Consensus mechanism for critical decisions

### Data Exchange Formats

**Structured Data Types**:
- JSON for complex objects
- CSV for tabular data
- Binary for large files
- Markdown for documentation

**Standard Fields**:
- \`status\`: Current agent state
- \`progress\`: Completion percentage
- \`results\`: Findings or outputs
- \`errors\`: Issues encountered
- \`dependencies\`: Required inputs

### Communication Patterns

1. **Request-Response Pattern**
   \`\`\`
   Agent A → Agent B: REQUEST {need: "data analysis"}
   Agent B → Agent A: RESPONSE {result: {analysis}}
   \`\`\`

2. **Publish-Subscribe Pattern**
   \`\`\`
   Agent A → ALL: BROADCAST {update: "milestone reached"}
   Agents B,C,D: [Receive and process update]
   \`\`\`

3. **Pipeline Pattern**
   \`\`\`
   Agent A → Agent B: UPDATE {output: "processed data"}
   Agent B → Agent C: UPDATE {output: "enhanced data"}
   Agent C → Coordinator: UPDATE {output: "final result"}
   \`\`\`

### Error Handling Protocol

- **Timeout**: 30-second default, configurable per message type
- **Retry Logic**: Exponential backoff (2s, 4s, 8s)
- **Fallback**: Alternative agent assignment on failure
- **Recovery**: State restoration from last checkpoint

This protocol ensures reliable, efficient, and structured communication between all agents working on the task.`

  examples = [
    {
      input:
        "Coordinate data analysis between research and visualization agents",
      output: `## Agent Communication Protocol

**Task**: Coordinate data analysis between research and visualization agents

### Communication Framework

I'll establish a protocol for the Research Agent and Visualization Agent to exchange data efficiently.

### Implemented Message Flow

1. **Initial Handshake**
   \`\`\`
   MESSAGE_TYPE: REQUEST
   FROM_AGENT: Coordinator
   TO_AGENT: Research_Agent
   TIMESTAMP: 2024-01-15T10:00:00Z
   PRIORITY: HIGH
   CONTENT: {
     subject: "Data Analysis Request",
     body: "Analyze dataset for key patterns and anomalies",
     data: {dataset_url: "s3://bucket/data.csv"},
     action_required: Yes,
     deadline: "2024-01-15T11:00:00Z"
   }
   \`\`\`

2. **Progress Updates**
   \`\`\`
   MESSAGE_TYPE: UPDATE
   FROM_AGENT: Research_Agent
   TO_AGENT: ALL
   TIMESTAMP: 2024-01-15T10:15:00Z
   PRIORITY: MEDIUM
   CONTENT: {
     subject: "Analysis Progress",
     body: "Completed 25% - found 3 significant patterns",
     data: {
       progress: 25,
       patterns_found: 3,
       estimated_completion: "2024-01-15T10:45:00Z"
     }
   }
   \`\`\`

3. **Data Handoff**
   \`\`\`
   MESSAGE_TYPE: RESPONSE
   FROM_AGENT: Research_Agent
   TO_AGENT: Visualization_Agent
   TIMESTAMP: 2024-01-15T10:45:00Z
   PRIORITY: HIGH
   CONTENT: {
     subject: "Analysis Complete - Data Ready",
     body: "Processed data with 5 key insights ready for visualization",
     data: {
       insights: [
         {type: "trend", description: "15% growth pattern"},
         {type: "anomaly", description: "Spike at Q3"},
         {type: "correlation", description: "Strong link X-Y"}
       ],
       processed_data_url: "s3://bucket/processed_data.json"
     },
     action_required: Yes
   }
   \`\`\`

4. **Visualization Confirmation**
   \`\`\`
   MESSAGE_TYPE: UPDATE
   FROM_AGENT: Visualization_Agent
   TO_AGENT: Coordinator
   TIMESTAMP: 2024-01-15T11:00:00Z
   PRIORITY: HIGH
   CONTENT: {
     subject: "Visualizations Complete",
     body: "Created 5 interactive charts based on insights",
     data: {
       charts: ["trend_line", "anomaly_heatmap", "correlation_matrix"],
       dashboard_url: "https://dashboard.example.com/analysis"
     }
   }
   \`\`\`

### Established Channels

- **Direct Channel**: Research ↔ Visualization for data exchange
- **Broadcast Channel**: Progress updates to all agents
- **Query Channel**: Coordinator queries for status
- **Update Channel**: Real-time progress streaming

This protocol enabled seamless coordination between agents, resulting in efficient data analysis and visualization.`,
      explanation:
        "Shows how structured communication enables smooth data flow between specialized agents",
    },
  ]

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    let content = this.template.replace("{{task}}", context.task)

    // Customize protocol based on task complexity
    const taskComplexity = this.assessTaskComplexity(context.task)

    if (taskComplexity.agentCount > 3) {
      content += `\n\n### Scalability Considerations

With ${taskComplexity.agentCount} agents expected:
- Implement message queuing to prevent overload
- Use topic-based routing for efficiency
- Enable message batching for bulk updates
- Add circuit breakers for fault tolerance`
    }

    // Add domain-specific protocols
    if (context.variables["domain"]) {
      const domainProtocols = this.getDomainProtocols(
        context.variables["domain"],
      )
      if (domainProtocols) {
        content += `\n\n### Domain-Specific Protocols\n\n${domainProtocols}`
      }
    }

    // Add security considerations if needed
    if (taskComplexity.requiresSecurity) {
      content += `\n\n### Security Protocols

- Message encryption for sensitive data
- Agent authentication via certificates
- Audit logging for all communications
- Access control based on agent roles`
    }

    return {
      content,
      metadata: {
        techniques: [this.id],
        confidence: 0.89,
        estimatedTokens: Math.ceil(content.split(/\s+/).length * 1.3),
        compositionStrategy: "structured",
      },
      variables: {
        ...context.variables,
        techniqueApplied: this.id,
        protocolVersion: "2.0",
        communicationType: "structured",
      },
    }
  }

  validate(input: any): boolean {
    if (typeof input !== "string") return false
    if (input.length < 40) return false

    // Check for communication/coordination needs
    const communicationIndicators = [
      "coordinate",
      "communicate",
      "exchange",
      "share",
      "pass",
      "transfer",
      "sync",
      "collaborate",
      "integrate",
      "connect",
      "agents",
      "multiple",
    ]

    const indicatorCount = communicationIndicators.filter((indicator) =>
      input.toLowerCase().includes(indicator),
    ).length

    return indicatorCount >= 2
  }

  private assessTaskComplexity(task: string) {
    const lower = task.toLowerCase()

    // Estimate number of agents based on task description
    const agentIndicators = [
      /\d+\s*agents?/,
      /multiple\s+agents?/,
      /several\s+agents?/,
      /team\s+of\s+agents?/,
    ]

    let agentCount = 2 // minimum
    for (const pattern of agentIndicators) {
      const match = lower.match(pattern)
      if (match) {
        const num = match[0].match(/\d+/)
        if (num) agentCount = parseInt(num[0])
        else if (match[0].includes("multiple")) agentCount = 3
        else if (match[0].includes("several")) agentCount = 4
        else if (match[0].includes("team")) agentCount = 5
        break
      }
    }

    return {
      agentCount,
      requiresSecurity: /secure|sensitive|private|confidential/.test(lower),
      requiresRealtime: /real-time|realtime|live|streaming/.test(lower),
    }
  }

  private getDomainProtocols(domain: string): string | null {
    const domainProtocols: Record<string, string> = {
      finance: `- Implement transaction logging
- Add financial data encryption
- Include audit trails
- Ensure ACID compliance`,
      healthcare: `- HIPAA-compliant messaging
- Patient data anonymization
- Consent verification
- Emergency priority override`,
      engineering: `- Technical specification format
- Version control integration
- Code review protocols
- Build status updates`,
    }

    return domainProtocols[domain.toLowerCase()] || null
  }
}
