import { AgentConfig } from "../config/agent-config"

export namespace ParallelAgents {
  // Patterns to detect parallel agent requests
  const PARALLEL_PATTERNS = [
    /use (?:your )?(?:sub[ -]?)?agents? (?:in parallel )?to/i,
    /create (\d+) (?:different )?(?:sub[ -]?)?agents?/i,
    /(?:in parallel|simultaneously|concurrently),? (?:create|make|write)/i,
    /launch (?:multiple|several|\d+) agents?/i,
    /parallel agents? (?:to|for)/i,
  ]

  export interface AgentTask {
    id: string
    description: string
    agentMode?: "read-only" | "all-tools"
    model?: string
  }

  export interface ParallelRequest {
    tasks: AgentTask[]
    detected: boolean
    originalPrompt: string
  }

  /**
   * Detects if a user prompt is requesting parallel agent execution
   */
  export function detectParallelRequest(prompt: string): ParallelRequest {
    for (const pattern of PARALLEL_PATTERNS) {
      if (pattern.test(prompt)) {
        return {
          detected: true,
          originalPrompt: prompt,
          tasks: parseTasksFromPrompt(prompt),
        }
      }
    }

    return {
      detected: false,
      originalPrompt: prompt,
      tasks: [],
    }
  }

  /**
   * Parses individual tasks from a parallel agent request
   */
  function parseTasksFromPrompt(prompt: string): AgentTask[] {
    const tasks: AgentTask[] = []

    // Try to extract number of agents
    const numberMatch = prompt.match(
      /(\d+) (?:different )?(?:sub[ -]?)?agents?/i,
    )
    const count = numberMatch ? parseInt(numberMatch[1]) : 3 // Default to 3

    // Try to extract the main task
    const taskMatch = prompt.match(/(?:to|for) (.+?)(?:\.|$)/i)
    const mainTask = taskMatch ? taskMatch[1].trim() : prompt

    // Check if tasks are enumerated
    const enumeratedTasks = prompt.match(
      /(?:\d+\.|[-•*])\s*(.+?)(?=(?:\d+\.|[-•*])|$)/g,
    )

    if (enumeratedTasks && enumeratedTasks.length > 0) {
      // Use enumerated tasks
      enumeratedTasks.forEach((task, index) => {
        const cleanTask = task.replace(/^(?:\d+\.|[-•*])\s*/, "").trim()
        tasks.push({
          id: `agent-${index + 1}`,
          description: cleanTask,
        })
      })
    } else {
      // Generate tasks based on count and main task
      for (let i = 0; i < count; i++) {
        tasks.push({
          id: `agent-${i + 1}`,
          description: `${mainTask} (Agent ${i + 1} perspective)`,
        })
      }
    }

    return tasks
  }

  /**
   * Generates a prompt for DGMO to create parallel task tools
   */
  export function generateParallelAgentPrompt(
    request: ParallelRequest,
    agentMode: "read-only" | "all-tools" = "read-only",
  ): string {
    const taskDescriptions = request.tasks
      .map((task, index) => `${index + 1}. ${task.description}`)
      .join("\n")

    return `I'll help you by creating ${request.tasks.length} parallel sub-agents to work on this task. Each agent will work independently and simultaneously.

## Parallel Agent Execution Plan

${taskDescriptions}

I'll now launch these agents with ${agentMode} mode:

\`\`\`typescript
// Launching ${request.tasks.length} parallel agents
${request.tasks
  .map(
    (task) => `await Tool.task({
  prompt: "${task.description}",
  agentMode: "${agentMode}",
  parallel: true,
  agentId: "${task.id}"
})`,
  )
  .join("\n")}
\`\`\`

The agents are now working in parallel. Their results will appear inline below as they complete their tasks.`
  }

  /**
   * Generates tool calls for parallel agent execution
   * This returns the tool call format that DGMO should use
   */
  export async function generateToolCalls(
    request: ParallelRequest,
    agentMode?: "read-only" | "all-tools",
  ): Promise<any[]> {
    const mode = agentMode || (await AgentConfig.getAgentMode())

    // Generate tool call objects for each agent
    return request.tasks.map((task) => ({
      tool: "task",
      parameters: {
        prompt: task.description,
        agentMode: mode,
        parallel: true,
        agentId: task.id,
      },
    }))
  }

  /**
   * Aggregates results from multiple parallel agents
   */
  export function aggregateResults(results: any[]): string {
    return `## Parallel Agent Results

${results
  .map(
    (result, index) => `### Agent ${index + 1} Result

${result.content || result}

---`,
  )
  .join("\n\n")}

All ${results.length} agents have completed their tasks successfully.`
  }
}
