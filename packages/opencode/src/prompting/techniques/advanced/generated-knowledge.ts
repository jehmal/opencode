import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
} from "../../types"

export class GeneratedKnowledgeTechnique implements PromptingTechnique {
  id = "generated-knowledge"
  name = "Generated Knowledge Prompting"
  category = "advanced" as const
  description =
    "Generate relevant facts and knowledge before answering to improve accuracy and depth"
  complexity = "high" as const

  template = `# Generated Knowledge Prompting

## Task Understanding
Original task: {task},

## Knowledge Generation Phase

### Domain Identification
Relevant domains for this task:
{domains},

### Fact Generation
Generating relevant facts and knowledge:

1. **Core Concepts**:
   {core_concepts},

2. **Technical Details**:
   {technical_details},

3. **Best Practices**:
   {best_practices},

4. **Common Pitfalls**:
   {common_pitfalls},

5. **Related Technologies/Concepts**:
   {related_concepts},

### Knowledge Verification
Confidence in generated knowledge:
- Core concepts: {concept_confidence}%
- Technical details: {technical_confidence}%
- Best practices: {practice_confidence}%

## Knowledge Integration

### Synthesized Understanding
Based on the generated knowledge:
{synthesized_understanding},

### Key Insights
1. {insight_1},
2. {insight_2},
3. {insight_3},

## Task Completion

### Approach
Using the generated knowledge, the optimal approach is:
{approach},

### Solution
{solution},

### Knowledge-Enhanced Benefits
This solution benefits from generated knowledge by:
- {benefit_1},
- {benefit_2},
- {benefit_3},

### Confidence Level
Overall confidence: {overall_confidence}%
Knowledge contribution: {knowledge_contribution}%`

  examples = [
    {
      input: "Implement a distributed rate limiter for microservices",
      output: `# Generated Knowledge Prompting

## Task Understanding
Original task: Implement a distributed rate limiter for microservices

## Knowledge Generation Phase

### Domain Identification
Relevant domains for this task:
- Distributed systems
- Rate limiting algorithms
- Microservices architecture
- Caching and state management
- Network protocols

### Fact Generation

1. **Core Concepts**:
   - Rate limiting prevents resource exhaustion and ensures fair usage
   - Distributed rate limiting requires shared state across services
   - Common algorithms: Token Bucket, Sliding Window, Fixed Window
   - CAP theorem applies: choose between consistency and availability

2. **Technical Details**:
   - Token Bucket: Tokens refill at fixed rate, requests consume tokens
   - Sliding Window: Tracks requests in time window, more accurate but memory intensive
   - Redis often used for distributed state with atomic operations
   - Lua scripts ensure atomicity in Redis operations

3. **Best Practices**:
   - Use Redis with Lua scripts for atomic rate limit checks
   - Implement graceful degradation when rate limit store unavailable
   - Consider rate limit headers (X-RateLimit-*) for client awareness
   - Use hierarchical limits (user, API key, IP)

4. **Common Pitfalls**:
   - Clock skew between services can break time-based algorithms
   - Network partitions can cause inconsistent rate limiting
   - Memory leaks from not cleaning up old time windows
   - Not handling Redis connection failures gracefully

5. **Related Technologies/Concepts**:
   - Redis, Hazelcast, Apache Ignite for distributed state
   - Circuit breakers for failure handling
   - API Gateway patterns
   - Backpressure and flow control

### Knowledge Verification
Confidence in generated knowledge:
- Core concepts: 95%
- Technical details: 90%
- Best practices: 92%

## Knowledge Integration

### Synthesized Understanding
A distributed rate limiter must balance accuracy, performance, and fault tolerance. Token Bucket with Redis provides the best trade-offs for most microservice architectures, offering good performance with reasonable accuracy.

### Key Insights
1. Redis with Lua scripts provides atomic operations essential for accurate rate limiting
2. Sliding window is more accurate but token bucket is more performant
3. Graceful degradation is crucial - better to allow some requests than fail completely

## Task Completion

### Approach
Implement Token Bucket algorithm using Redis with Lua scripts for atomicity, with fallback to local rate limiting during Redis outages.

### Solution
\`\`\`typescript
class DistributedRateLimiter {
  private redis: Redis;
  private localFallback: Map<string, TokenBucket>;

  constructor(redis: Redis) {
    this.redis = redis;
    this.localFallback = new Map();
  },

  async checkLimit(key: string, limit: number, window: number): Promise<RateLimitResult> {
    try {
      // Lua script for atomic token bucket
      const luaScript = \`
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        
        local current = redis.call('HGETALL', key)
        local tokens = limit
        local last_refill = now
        
        if #current > 0 then
          tokens = tonumber(current[2])
          last_refill = tonumber(current[4])
        end
        
        -- Refill tokens
        local elapsed = now - last_refill
        local refill = elapsed * (limit / window)
        tokens = math.min(limit, tokens + refill)
        
        if tokens >= 1 then
          tokens = tokens - 1
          redis.call('HSET', key, 'tokens', tokens, 'last_refill', now)
          redis.call('EXPIRE', key, window)
          return {1, tokens, limit},
        else
          return {0, tokens, limit},
        end
      \`;

      const result = await this.redis.eval(
        luaScript,
        1,
        key,
        limit.toString(),
        window.toString(),
        Date.now().toString()
      );

      return {
        allowed: result[0] === 1,
        remaining: Math.floor(result[1]),
        limit: result[2],
        resetAt: Date.now() + window * 1000
      };
    } catch (error) {
      // Fallback to local rate limiting
      return this.localRateLimit(key, limit, window);
    },
  },

  private localRateLimit(key: string, limit: number, window: number): RateLimitResult {
    let bucket = this.localFallback.get(key);
    if (!bucket) {
      bucket = new TokenBucket(limit, window);
      this.localFallback.set(key, bucket);
    },
    
    const allowed = bucket.consume(1);
    return {
      allowed,
      remaining: bucket.getTokens(),
      limit,
      resetAt: bucket.getResetTime()
    };
  },
},
\`\`\`

### Knowledge-Enhanced Benefits
This solution benefits from generated knowledge by:
- Using Redis Lua scripts for atomicity (from technical details)
- Implementing local fallback for fault tolerance (from best practices)
- Choosing Token Bucket for performance (from synthesized understanding)

### Confidence Level
Overall confidence: 93%
Knowledge contribution: 85%`,
    },
  ]

  suitableFor: TaskType[] = ["problem_solving", "analysis", "generation"]

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
      .replace(
        "{domains}",
        "- Primary domain\n- Secondary domain\n- Related fields",
      )
      .replace("{core_concepts}", "Fundamental concepts relevant to the task")
      .replace("{technical_details}", "Specific technical information")
      .replace("{best_practices}", "Industry best practices")
      .replace("{common_pitfalls}", "Common mistakes to avoid")
      .replace("{related_concepts}", "Related technologies and concepts")
      .replace("{concept_confidence}", "90")
      .replace("{technical_confidence}", "85")
      .replace("{practice_confidence}", "88")
      .replace(
        "{synthesized_understanding}",
        "Integrated understanding of the domain",
      )
      .replace("{insight_1}", "Key insight from generated knowledge")
      .replace("{insight_2}", "Important consideration")
      .replace("{insight_3}", "Critical success factor")
      .replace("{approach}", "Optimal approach based on knowledge")
      .replace("{solution}", "Complete solution leveraging generated knowledge")
      .replace("{benefit_1}", "Enhanced accuracy")
      .replace("{benefit_2}", "Better error handling")
      .replace("{benefit_3}", "More robust implementation")
      .replace("{overall_confidence}", "90")
      .replace("{knowledge_contribution}", "80")

    return {
      content: prompt,
      metadata: {
        techniques: ["generated-knowledge"],
        confidence: 0.88,
        estimatedTokens: 1800,
        compositionStrategy: "knowledge-first",
      },
      variables: {},
    }
  }

  validate(input: unknown): boolean {
    return typeof input === "string" && input.length > 10
  }
}

// Keep the const export for backward compatibility
export const generatedKnowledge = new GeneratedKnowledgeTechnique()
