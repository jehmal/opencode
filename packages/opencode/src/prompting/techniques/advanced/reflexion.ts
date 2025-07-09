import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
  Capability,
} from "../../types"

export class ReflexionTechnique implements PromptingTechnique {
  id = "reflexion"
  name = "Reflexion"
  category = "advanced" as const
  description =
    "Self-reflection and iterative improvement through analyzing past attempts and learning from mistakes"
  complexity = "very_high" as const
  requiredCapabilities: Capability[] = ["self_reflection", "iteration"]

  template = `# Reflexion Framework

## Task: {task},

## Attempt 1

### Initial Approach
{initial_approach},

### Execution
{initial_execution},

### Result
{initial_result},

### Self-Reflection
**What went well:**
{attempt1_successes},

**What could be improved:**
{attempt1_improvements},

**Key lessons:**
{attempt1_lessons},

**Confidence:** {attempt1_confidence}%

## Attempt 2

### Refined Approach
Based on reflection, adjusting strategy:
{refined_approach},

### Execution with Improvements
{refined_execution},

### Result
{refined_result},

### Self-Reflection
**Improvements from Attempt 1:**
{improvements_made},

**Remaining issues:**
{remaining_issues},

**New insights:**
{new_insights},

**Confidence:** {attempt2_confidence}%

## Attempt 3

### Optimized Approach
Incorporating all learnings:
{optimized_approach},

### Final Execution
{final_execution},

### Result
{final_result},

### Final Reflection
**Evolution of understanding:**
1. Started with: {initial_understanding},
2. Learned: {key_learnings},
3. Achieved: {final_achievement},

**Success factors:**
{success_factors},

**Confidence:** {final_confidence}%

## Reflexion Summary

### Learning Trajectory
- Attempt 1: {attempt1_summary},
- Attempt 2: {attempt2_summary},
- Attempt 3: {attempt3_summary},

### Key Improvements
1. {improvement_1},
2. {improvement_2},
3. {improvement_3},

### Final Solution
{final_solution},

### Meta-Learning
**Patterns identified:** {patterns},
**Reusable insights:** {reusable_insights},
**Future approach:** {future_approach}`

  examples = [
    {
      input: "Optimize a slow database query that's timing out",
      output: `# Reflexion Framework

## Task: Optimize a slow database query that's timing out

## Attempt 1

### Initial Approach
Add indexes to the columns used in WHERE clause to speed up the query.

### Execution
\`\`\`sql
-- Original query
SELECT u.*, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2023-01-01'
  AND u.status = 'active'
GROUP BY u.id;

-- Added indexes
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_status ON users(status);
\`\`\`

### Result
Query time reduced from 45s to 28s. Still timing out (30s limit).

### Self-Reflection
**What went well:**
- Indexes did improve performance by ~38%
- Correctly identified filtering columns

**What could be improved:**
- Didn't analyze the JOIN operation impact
- Ignored the GROUP BY aggregation cost
- Missing composite index opportunity

**Key lessons:**
- Single column indexes aren't always sufficient
- Need to consider the full query execution plan

**Confidence:** 40%

## Attempt 2

### Refined Approach
Based on reflection, focusing on:
1. Composite index for WHERE conditions
2. Covering index to avoid table lookups
3. Analyze JOIN performance

### Execution with Improvements
\`\`\`sql
-- Drop single indexes
DROP INDEX idx_users_created_at;
DROP INDEX idx_users_status;

-- Create composite index
CREATE INDEX idx_users_status_created ON users(status, created_at);

-- Add index for JOIN
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Analyze execution plan
EXPLAIN ANALYZE SELECT ...
\`\`\`

### Result
Query time: 12s. Significant improvement but still not meeting requirements.

Execution plan shows:
- Index scan on users: 0.8s
- Nested loop join: 8s
- Aggregation: 3.2s

### Self-Reflection
**Improvements from Attempt 1:**
- Composite index eliminated filesort
- JOIN index reduced nested loop cost

**Remaining issues:**
- Still doing full aggregation in memory
- JOIN produces too many intermediate rows
- COUNT operation is expensive

**New insights:**
- The aggregation is the bottleneck
- Need to rethink the query structure

**Confidence:** 70%

## Attempt 3

### Optimized Approach
Complete query restructure using subquery for pre-aggregation:

### Final Execution
\`\`\`sql
-- Restructured query with pre-aggregation
WITH user_orders AS (
  SELECT user_id, COUNT(*) as order_count
  FROM orders
  GROUP BY user_id
)
SELECT u.*, COALESCE(uo.order_count, 0) as order_count
FROM users u
LEFT JOIN user_orders uo ON u.id = uo.user_id
WHERE u.created_at > '2023-01-01'
  AND u.status = 'active';

-- Also create covering index
CREATE INDEX idx_users_covering 
ON users(status, created_at, id) 
INCLUDE (name, email, phone);
\`\`\`

### Result
Query time: 1.2s! Well under the 30s timeout.

### Final Reflection
**Evolution of understanding:**
1. Started with: Simple indexing solution
2. Learned: Query structure matters more than indexes
3. Achieved: 97% performance improvement

**Success factors:**
- Pre-aggregating before JOIN
- Covering index eliminates table lookups
- Proper query structure matches data access patterns

**Confidence:** 95%

## Reflexion Summary

### Learning Trajectory
- Attempt 1: Basic indexing (45s → 28s)
- Attempt 2: Composite indexes + JOIN optimization (28s → 12s)
- Attempt 3: Query restructure + covering index (12s → 1.2s)

### Key Improvements
1. Moved from index-focused to query-structure-focused
2. Identified aggregation as main bottleneck
3. Applied pre-aggregation pattern

### Final Solution
Restructure query to pre-aggregate orders, use covering index for users table, resulting in 97% performance improvement.

### Meta-Learning
**Patterns identified:** Aggregation before JOIN is often faster
**Reusable insights:** Always check execution plan, not just add indexes
**Future approach:** Consider query structure before optimization tactics`,
    },
  ]

  suitableFor: TaskType[] = ["problem_solving", "refinement", "analysis"]

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
      .replace("{initial_approach}", "First attempt at solving the problem")
      .replace("{initial_execution}", "Implementing initial solution")
      .replace("{initial_result}", "Partial success with issues")
      .replace(
        "{attempt1_successes}",
        "- Made progress\n- Identified key challenges",
      )
      .replace(
        "{attempt1_improvements}",
        "- Need better approach\n- Missing critical insight",
      )
      .replace("{attempt1_lessons}", "- Problem more complex than expected")
      .replace("{attempt1_confidence}", "60")
      .replace("{refined_approach}", "Improved strategy based on learnings")
      .replace("{refined_execution}", "Implementing refined solution")
      .replace("{refined_result}", "Better results, closer to goal")
      .replace(
        "{improvements_made}",
        "- Addressed main issues\n- Better understanding",
      )
      .replace("{remaining_issues}", "- Some edge cases remain")
      .replace("{new_insights}", "- Discovered optimal pattern")
      .replace("{attempt2_confidence}", "80")
      .replace("{optimized_approach}", "Final optimized approach")
      .replace("{final_execution}", "Implementing complete solution")
      .replace("{final_result}", "Successful solution achieved")
      .replace("{initial_understanding}", "Surface-level approach")
      .replace("{key_learnings}", "Deep insights and patterns")
      .replace("{final_achievement}", "Robust, optimized solution")
      .replace(
        "{success_factors}",
        "- Iterative refinement\n- Learning from failures",
      )
      .replace("{final_confidence}", "95")
      .replace("{attempt1_summary}", "Basic approach, partial success")
      .replace(
        "{attempt2_summary}",
        "Refined approach, significant improvement",
      )
      .replace("{attempt3_summary}", "Optimized solution, complete success")
      .replace("{improvement_1}", "Better problem understanding")
      .replace("{improvement_2}", "Optimized approach")
      .replace("{improvement_3}", "Robust error handling")
      .replace("{final_solution}", "Complete, optimized solution")
      .replace("{patterns}", "Iterative improvement yields best results")
      .replace("{reusable_insights}", "Reflection accelerates learning")
      .replace("{future_approach}", "Start with analysis, iterate quickly")

    return {
      content: prompt,
      metadata: {
        techniques: ["reflexion"],
        confidence: 0.92,
        estimatedTokens: 2200,
        compositionStrategy: "iterative-learning",
      },
      variables: {},
    }
  }

  validate(input: unknown): boolean {
    return typeof input === "string" && input.length > 10
  }
}

// Keep the const export for backward compatibility
export const reflexion = new ReflexionTechnique()
