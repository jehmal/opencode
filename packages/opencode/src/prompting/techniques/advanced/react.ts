import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
  Capability,
} from "../../types"

export class ReactTechnique implements PromptingTechnique {
  id = "react"
  name = "ReAct (Reasoning and Acting)"
  category = "advanced" as const
  description =
    "Interleave reasoning and action steps to solve complex tasks through iterative thinking and tool use"
  complexity = "very_high" as const
  requiredCapabilities: Capability[] = ["tools", "iteration"]

  template = `# ReAct Framework

## Task: {task},

### Iteration 1

**Thought 1**: {thought_1},
I need to understand the problem and identify what information or actions are required.

**Action 1**: {action_1},
{action_1_description},

**Observation 1**: {observation_1},
{observation_1_result},

### Iteration 2

**Thought 2**: {thought_2},
Based on the observation, I now understand {understanding_2}. Next, I should {next_step_2}.

**Action 2**: {action_2},
{action_2_description},

**Observation 2**: {observation_2},
{observation_2_result},

### Iteration 3

**Thought 3**: {thought_3},
{thought_3_reasoning},

**Action 3**: {action_3},
{action_3_description},

**Observation 3**: {observation_3},
{observation_3_result},

{additional_iterations},

### Final Iteration

**Thought N**: {final_thought},
I now have all the information needed. Let me synthesize the solution.

**Action N**: {final_action},
{final_action_description},

**Observation N**: {final_observation},
{final_observation_result},

## Solution Synthesis

### Key Findings
1. {finding_1},
2. {finding_2},
3. {finding_3},

### Final Answer
{final_answer},

### Reasoning Trace
- Total iterations: {total_iterations},
- Tools used: {tools_used},
- Key insights: {key_insights}`

  examples = [
    {
      input:
        "Debug why the authentication service is failing intermittently in production",
      output: `# ReAct Framework

## Task: Debug why the authentication service is failing intermittently in production

### Iteration 1

**Thought 1**: I need to understand the symptoms of the authentication failures. Let me check the error logs first.

**Action 1**: Search logs
Query production logs for authentication errors in the last 24 hours.

**Observation 1**: 
Found 847 authentication failures with pattern:
- 78% show "Connection timeout to Redis"
- 15% show "JWT validation failed"
- 7% show "Database connection pool exhausted"

### Iteration 2

**Thought 2**: The majority of failures are Redis timeouts. This suggests a performance or connectivity issue. Let me check Redis metrics.

**Action 2**: Check Redis metrics
Examine Redis performance metrics and connection stats.

**Observation 2**:
- Redis CPU: Spikes to 95% every 15 minutes
- Connection count: Peaks at 9,800 (limit is 10,000)
- Slow queries: 234 KEYS commands taking >1s each

### Iteration 3

**Thought 3**: The KEYS commands are problematic - they're O(N) operations that scan the entire keyspace. Let me find what's calling them.

**Action 3**: Search codebase
Search for KEYS command usage in authentication service code.

**Observation 3**:
Found in SessionCleanup.js:
\`\`\`javascript
// Clean expired sessions every 15 minutes
const expiredKeys = await redis.keys('session:*');
expiredKeys.forEach(key => {
  // Check expiration...
});
\`\`\`

### Iteration 4

**Thought 4**: Found the culprit! The session cleanup job uses KEYS command which blocks Redis. Let me check how many session keys exist.

**Action 4**: Count session keys
Check total number of session keys in Redis.

**Observation 4**:
Total session keys: 2.4 million
Growing at ~10,000/hour
No TTL set on 89% of keys

### Iteration 5

**Thought 5**: The sessions aren't expiring properly, causing accumulation. Combined with the KEYS scan, this explains the 15-minute failure pattern. Let me design a fix.

**Action 5**: Design solution
Create a fix that addresses both the KEYS usage and session expiration.

**Observation 5**:
Solution designed:
1. Replace KEYS with SCAN (non-blocking)
2. Set TTL on session creation
3. Use Redis streams for session tracking
4. Implement gradual cleanup for existing sessions

## Solution Synthesis

### Key Findings
1. Session cleanup job runs every 15 minutes using blocking KEYS command
2. 2.4M sessions accumulated due to missing TTL settings
3. Redis CPU spikes cause authentication timeouts

### Final Answer
The authentication failures are caused by a session cleanup job that:
1. Runs every 15 minutes using Redis KEYS command (O(N) blocking operation)
2. Scans 2.4 million session keys, causing Redis to become unresponsive
3. Creates cascading failures as new auth requests timeout

**Immediate fix**: Disable the cleanup job
**Long-term fix**: 
- Replace KEYS with SCAN
- Add TTL to all sessions (24 hours)
- Implement background migration for existing sessions
- Monitor Redis performance metrics

### Reasoning Trace
- Total iterations: 5
- Tools used: Log search, Metrics analysis, Code search, Redis inspection
- Key insights: Blocking operations + data accumulation = periodic failures`,
    },
  ]

  suitableFor: TaskType[] = ["problem_solving", "analysis", "exploration"]

  metrics = {
    totalExecutions: 0,
    successRate: 0,
    averageLatency: 0,
    averageTokenUsage: 0,
    lastUpdated: Date.now(),
  }

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    const { task } = context

    const prompt = this.template!.replace("{task}", task)
      .replace("{thought_1}", "Initial analysis of the problem")
      .replace("{action_1}", "Gather information")
      .replace("{action_1_description}", "Collecting relevant data")
      .replace("{observation_1}", "Initial findings")
      .replace("{observation_1_result}", "[Results from action 1]")
      .replace("{thought_2}", "Analyzing initial findings")
      .replace("{understanding_2}", "[Key understanding]")
      .replace("{next_step_2}", "[Next action]")
      .replace("{action_2}", "Investigate further")
      .replace("{action_2_description}", "Deeper investigation")
      .replace("{observation_2}", "Additional findings")
      .replace("{observation_2_result}", "[Results from action 2]")
      .replace("{thought_3}", "Synthesizing information")
      .replace(
        "{thought_3_reasoning}",
        "Based on observations, the pattern suggests...",
      )
      .replace("{action_3}", "Verify hypothesis")
      .replace("{action_3_description}", "Testing the theory")
      .replace("{observation_3}", "Verification results")
      .replace("{observation_3_result}", "[Results from action 3]")
      .replace("{additional_iterations}", "")
      .replace("{final_thought}", "Concluding analysis")
      .replace("{final_action}", "Synthesize solution")
      .replace("{final_action_description}", "Combining all findings")
      .replace("{final_observation}", "Complete understanding")
      .replace("{final_observation_result}", "[Final synthesis]")
      .replace("{finding_1}", "Primary discovery")
      .replace("{finding_2}", "Secondary insight")
      .replace("{finding_3}", "Additional finding")
      .replace(
        "{final_answer}",
        "[Complete solution based on reasoning and actions]",
      )
      .replace("{total_iterations}", "4")
      .replace("{tools_used}", "[List of tools/actions]")
      .replace("{key_insights}", "[Critical discoveries]")

    return {
      content: prompt,
      metadata: {
        techniques: ["react"],
        confidence: 0.9,
        estimatedTokens: 2000,
        compositionStrategy: "iterative-reasoning",
      },
      variables: {},
    }
  }

  validate(input: unknown): boolean {
    return typeof input === "string" && input.length > 10
  }
}

// Keep the const export for backward compatibility
export const react = new ReactTechnique()
