/**
 * Continuation Prompt Generator
 *
 * Generates optimized continuation prompts for seamless agent handoffs
 * using advanced prompting techniques and vector memory integration.
 */

import { z } from "zod"

// Schema for project state
const ProjectStateSchema = z.object({
  projectName: z.string(),
  projectGoal: z.string(),
  completionPercentage: z.number().min(0).max(100),
  workingDirectory: z.string(),
  completedComponents: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      filePath: z.string().optional(),
    }),
  ),
  remainingTasks: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      dependencies: z.array(z.string()).optional(),
    }),
  ),
  criticalFiles: z.array(
    z.object({
      path: z.string(),
      description: z.string(),
      lineNumbers: z.array(z.number()).optional(),
    }),
  ),
  knownIssues: z.array(
    z.object({
      issue: z.string(),
      solution: z.string(),
    }),
  ),
  architecturalConstraints: z.array(z.string()),
  successCriteria: z.array(z.string()),
  testingApproach: z.array(z.string()),
})

type ProjectState = z.infer<typeof ProjectStateSchema>

// Memory search queries for context recovery
interface MemorySearchQueries {
  recentSnapshot: string
  technicalImplementation: string
  successPatterns: string
  errorSolutions: string
  architecturalDecisions: string
}

export class ContinuationPromptGenerator {
  /**
   * Generates memory search queries for context recovery
   * Uses Chain of Thought reasoning to identify optimal search terms
   */
  private generateMemorySearchQueries(
    projectState: ProjectState,
  ): MemorySearchQueries {
    // Step-by-step reasoning for optimal search queries
    const projectDomain = this.extractProjectDomain(projectState.projectName)
    const recentTimeframe = this.getRecentTimeframe()

    return {
      recentSnapshot: `${projectState.projectName} project snapshot ${recentTimeframe}`,
      technicalImplementation: `${projectDomain} implementation patterns ${projectState.projectGoal}`,
      successPatterns: `${projectDomain} success patterns best practices`,
      errorSolutions: `${projectDomain} error solutions debugging`,
      architecturalDecisions: `${projectState.projectName} architecture decisions constraints`,
    }
  }

  /**
   * Applies Multi-Agent Coordination to break down remaining tasks
   * Creates specialized sub-agent assignments with clear handoff protocols
   */
  private generateSubAgentTasks(projectState: ProjectState): string {
    const tasks = projectState.remainingTasks
    const subAgentCount = Math.min(tasks.length, 4) // Optimal coordination limit

    let subAgentSection = `Required Tasks (USE ${subAgentCount} SUB-AGENTS IN PARALLEL)\n\n`

    tasks.slice(0, subAgentCount).forEach((task, index) => {
      const agentNumber = index + 1
      subAgentSection += `Sub-Agent ${agentNumber}: ${task.name}\n`
      subAgentSection += `${task.description}\n\n`
      subAgentSection += `Implementation Steps:\n`
      subAgentSection += `- Analyze current state and requirements\n`
      subAgentSection += `- Apply Chain of Thought reasoning to break down the task\n`
      subAgentSection += `- Implement solution with iterative refinement\n`
      subAgentSection += `- Use Reflexion to learn from any errors encountered\n`
      subAgentSection += `- Validate implementation meets success criteria\n\n`
      subAgentSection += `Priority: ${task.priority}\n`
      if (task.dependencies?.length) {
        subAgentSection += `Dependencies: ${task.dependencies.join(", ")}\n`
      }
      subAgentSection += `\n`
    })

    return subAgentSection
  }

  /**
   * Applies Reflexion framework to capture lessons learned
   * Converts project experience into actionable insights for next agent
   */
  private generateReflexionInsights(projectState: ProjectState): string {
    let reflexionSection = `Reflexion Insights & Learning\n\n`

    reflexionSection += `What We've Accomplished:\n`
    projectState.completedComponents.forEach((component) => {
      reflexionSection += `- ${component.name}: ${component.description}\n`
    })

    reflexionSection += `\nLessons Learned:\n`
    projectState.knownIssues.forEach((issue) => {
      reflexionSection += `- Challenge: ${issue.issue}\n`
      reflexionSection += `  Solution Applied: ${issue.solution}\n`
      reflexionSection += `  Future Prevention: Apply this pattern to similar issues\n\n`
    })

    reflexionSection += `Self-Reflection for Next Agent:\n`
    reflexionSection += `- Build upon the ${projectState.completionPercentage}% completion achieved\n`
    reflexionSection += `- Apply proven patterns from completed components\n`
    reflexionSection += `- Use iterative refinement for complex implementations\n`
    reflexionSection += `- Leverage vector memory for context preservation\n\n`

    return reflexionSection
  }

  /**
   * Applies Iterative Refinement to success criteria
   * Creates measurable, testable validation steps
   */
  private generateRefinedSuccessCriteria(projectState: ProjectState): string {
    let criteriaSection = `Success Criteria (Iteratively Refined)\n\n`

    // First iteration: Basic criteria
    criteriaSection += `Core Success Metrics:\n`
    projectState.successCriteria.forEach((criteria, index) => {
      criteriaSection += `${index + 1}. ${criteria}\n`
    })

    // Second iteration: Add measurability
    criteriaSection += `\nMeasurable Validation:\n`
    criteriaSection += `- All tests pass without errors\n`
    criteriaSection += `- Performance benchmarks meet requirements\n`
    criteriaSection += `- Code quality standards maintained\n`
    criteriaSection += `- Documentation updated and accurate\n`

    // Third iteration: Add automation
    criteriaSection += `\nAutomated Verification:\n`
    criteriaSection += `- CI/CD pipeline validates changes\n`
    criteriaSection += `- Integration tests confirm compatibility\n`
    criteriaSection += `- Memory storage validates project state\n\n`

    return criteriaSection
  }

  /**
   * Main function to generate optimized continuation prompt
   * Integrates all prompting techniques for maximum effectiveness
   */
  public generateContinuationPrompt(projectState: ProjectState): string {
    // Validate input using Zod schema
    const validatedState = ProjectStateSchema.parse(projectState)

    // Generate memory search queries using Chain of Thought
    const memoryQueries = this.generateMemorySearchQueries(validatedState)

    // Apply Multi-Agent Coordination for task breakdown
    const subAgentTasks = this.generateSubAgentTasks(validatedState)

    // Apply Reflexion for learning insights
    const reflexionInsights = this.generateReflexionInsights(validatedState)

    // Apply Iterative Refinement for success criteria
    const refinedCriteria = this.generateRefinedSuccessCriteria(validatedState)

    // Compose the complete continuation prompt
    const prompt = `
# Instructions for Next ${validatedState.projectName} Agent

You are continuing the implementation of ${validatedState.projectGoal}. The project is ${validatedState.completionPercentage}% complete with significant progress made. Your task is to complete the remaining implementation using advanced prompting techniques and vector memory integration.

## Project Context
- **Working Directory**: ${validatedState.workingDirectory}
- **Current Phase**: Implementation and optimization
- **Architecture**: Vector memory + MCP servers + advanced prompting
- **Completion Status**: ${validatedState.completionPercentage}% complete

## Memory Search Commands (Chain of Thought Context Recovery)
First, retrieve the current project state and patterns using these optimized queries:

1. Search: "${memoryQueries.recentSnapshot}"
2. Search: "${memoryQueries.technicalImplementation}"
3. Search: "${memoryQueries.successPatterns}"
4. Search: "${memoryQueries.errorSolutions}"
5. Search: "${memoryQueries.architecturalDecisions}"

## Completed Components (DO NOT RECREATE)
${validatedState.completedComponents
  .map(
    (comp) =>
      `✅ ${comp.name} - ${comp.description}${comp.filePath ? ` (${comp.filePath})` : ""}`,
  )
  .join("\n")}

## Critical Files to Reference
${validatedState.criticalFiles
  .map(
    (file) =>
      `- ${file.path} - ${file.description}${file.lineNumbers?.length ? ` (lines: ${file.lineNumbers.join(", ")})` : ""}`,
  )
  .join("\n")}

## ${subAgentTasks}

## Integration Requirements
- Maintain backward compatibility with existing systems
- Follow established architectural patterns
- Integrate with vector memory storage system
- Use MCP servers for enhanced capabilities
- Apply prompting techniques for optimization

## Technical Constraints
${validatedState.architecturalConstraints.map((constraint) => `- ${constraint}`).join("\n")}

## ${refinedCriteria}

## Testing Approach (Iterative Validation)
${validatedState.testingApproach.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## ${reflexionInsights}

## Important Notes
- **Chain of Thought**: Use step-by-step reasoning for complex implementations
- **Multi-Agent Coordination**: Leverage parallel sub-agents for efficiency
- **Reflexion**: Learn from previous patterns and apply proven solutions
- **Iterative Refinement**: Progressively improve outputs through multiple passes
- **Vector Memory**: Store all insights and patterns for future reference

## Next Steps
1. Begin with memory searches to restore full context
2. Launch sub-agents in parallel for maximum efficiency
3. Apply prompting techniques throughout implementation
4. Store results in vector memory for future handoffs
5. Validate all success criteria before completion

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to complete the implementation using the advanced prompting techniques outlined above.
`

    return prompt.trim()
  }

  // Helper methods
  private extractProjectDomain(projectName: string): string {
    const domainMap: Record<string, string> = {
      opencode: "ai_coding_assistant",
      dgmo: "ai_agent_system",
      qdrant: "vector_database",
      mcp: "model_context_protocol",
    }

    const lowerName = projectName.toLowerCase()
    for (const [key, domain] of Object.entries(domainMap)) {
      if (lowerName.includes(key)) return domain
    }

    return "software_development"
  }

  private getRecentTimeframe(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
  }
}

// Export singleton instance
export const continuationPromptGenerator = new ContinuationPromptGenerator()

// Export types for external use
export type { ProjectState }
export { ProjectStateSchema }
