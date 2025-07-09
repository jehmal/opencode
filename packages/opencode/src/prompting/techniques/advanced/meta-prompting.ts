import type {
  PromptingTechnique,
  TechniqueContext,
  EnhancedPrompt,
  TaskType,
  Capability,
} from "../../types"

export class MetaPromptingTechnique implements PromptingTechnique {
  id = "meta-prompting"
  name = "Meta-Prompting"
  category = "advanced" as const
  description =
    "Generate optimal prompts by analyzing task requirements and creating specialized prompt strategies"
  complexity = "very_high" as const
  requiredCapabilities: Capability[] = ["self_reflection"]

  template = `# Meta-Prompting Framework

## Task Analysis
Analyzing the request: {task}

### Task Decomposition
1. **Primary Objective**: {primary_objective}
2. **Key Requirements**: {requirements_list}
3. **Constraints**: {constraints}
4. **Success Criteria**: {success_criteria}

### Task Classification
- **Type**: {task_type}
- **Domain**: {domain}
- **Complexity**: {complexity_level}
- **Required Capabilities**: {capabilities_needed}

## Optimal Prompting Strategy Selection

### Strategy Analysis
Based on the task characteristics, evaluating prompting strategies:

1. **Chain-of-Thought**: 
   - Suitability: {cot_score}/10
   - Reason: {cot_reason}

2. **Few-Shot Learning**:
   - Suitability: {few_shot_score}/10
   - Reason: {few_shot_reason}

3. **Tree of Thoughts**:
   - Suitability: {tot_score}/10
   - Reason: {tot_reason}

4. **ReAct Framework**:
   - Suitability: {react_score}/10
   - Reason: {react_reason}

5. **Constitutional AI**:
   - Suitability: {constitutional_score}/10
   - Reason: {constitutional_reason}

### Selected Strategy: {selected_strategy}

## Generated Optimal Prompt

### Prompt Structure
\`\`\`
{generated_prompt_structure}
\`\`\`

### Complete Prompt
{generated_prompt}

## Meta-Optimization

### Prompt Refinements
1. **Clarity Enhancement**: {clarity_improvements}
2. **Specificity Additions**: {specificity_additions}
3. **Context Enrichment**: {context_additions}
4. **Output Format Specification**: {format_specs}

### Final Optimized Prompt
{final_optimized_prompt}

## Execution Guidelines
- **Pre-processing**: {preprocessing_steps}
- **Execution Notes**: {execution_notes}
- **Post-processing**: {postprocessing_steps}
- **Validation Method**: {validation_approach}`

  examples = [
    {
      input: "Create a prompt for analyzing complex system architectures",
      output: `# Meta-Prompting Framework

## Task Analysis
Analyzing the request: Create a prompt for analyzing complex system architectures

### Task Decomposition
1. **Primary Objective**: Generate a comprehensive prompt for systematic architecture analysis
2. **Key Requirements**: 
   - Handle multiple system components
   - Identify relationships and dependencies
   - Evaluate design patterns
   - Assess scalability and performance
3. **Constraints**: Must work for various architecture types (microservices, monolithic, serverless)
4. **Success Criteria**: Produces thorough, actionable architecture insights

### Task Classification
- **Type**: Analysis and evaluation
- **Domain**: Software engineering / System design
- **Complexity**: High (multiple interconnected aspects)
- **Required Capabilities**: Technical analysis, pattern recognition, systematic thinking

## Optimal Prompting Strategy Selection

### Strategy Analysis

1. **Chain-of-Thought**: 
   - Suitability: 9/10
   - Reason: Excellent for breaking down complex systems into analyzable components

2. **Few-Shot Learning**:
   - Suitability: 6/10
   - Reason: Helpful for pattern examples but may limit creative analysis

3. **Tree of Thoughts**:
   - Suitability: 8/10
   - Reason: Good for exploring multiple architectural perspectives

4. **ReAct Framework**:
   - Suitability: 7/10
   - Reason: Useful if interactive exploration is needed

5. **Constitutional AI**:
   - Suitability: 5/10
   - Reason: Less relevant for technical analysis

### Selected Strategy: Chain-of-Thought with Tree-of-Thoughts elements

## Generated Optimal Prompt

### Prompt Structure
\`\`\`
1. System Overview
   - High-level description
   - Core components identification
   
2. Component Deep-Dive
   - For each component:
     * Purpose and responsibilities
     * Technologies used
     * Interfaces and APIs
     
3. Relationship Analysis
   - Component interactions
   - Data flow patterns
   - Dependency mapping
   
4. Quality Attributes
   - Performance characteristics
   - Scalability assessment
   - Security considerations
   - Maintainability factors
   
5. Design Patterns
   - Identified patterns
   - Pattern effectiveness
   - Anti-patterns present
   
6. Recommendations
   - Improvement opportunities
   - Risk mitigation
   - Evolution strategy
\`\`\`

### Complete Prompt
"Analyze the following system architecture step-by-step:

First, provide a comprehensive overview of the system, identifying all major components and their primary purposes.

Second, for each component, detail:
- Its core responsibilities and boundaries
- The technologies and frameworks it uses
- How it interfaces with other components
- Its data management approach

Third, map the relationships between components:
- Synchronous vs asynchronous communication
- Data flow directions and transformations
- Critical dependencies and potential bottlenecks

Fourth, evaluate the architecture's quality attributes:
- Performance: Current capabilities and limitations
- Scalability: Horizontal and vertical scaling potential
- Security: Authentication, authorization, and data protection
- Maintainability: Code organization, testing strategy, deployment complexity

Fifth, identify design patterns and practices:
- Architectural patterns (e.g., microservices, event-driven, layered)
- Design patterns within components
- Any anti-patterns that may cause issues

Finally, provide actionable recommendations:
- Top 3 improvements for immediate impact
- Long-term architectural evolution strategy
- Risk mitigation approaches for identified weaknesses

Format your analysis with clear sections and use diagrams where helpful."

## Meta-Optimization

### Prompt Refinements
1. **Clarity Enhancement**: Added specific sub-questions for each analysis area
2. **Specificity Additions**: Included concrete examples of what to look for
3. **Context Enrichment**: Covered both technical and business perspectives
4. **Output Format Specification**: Structured sections with clear deliverables

### Final Optimized Prompt
[Previous prompt with these additions:]
"Context: {system_type} architecture serving {user_scale} users
Constraints: {time_limit} for analysis, focus on {priority_areas}
Output: Provide executive summary first, then detailed analysis
Tools: You may use {available_tools} for visualization"

## Execution Guidelines
- **Pre-processing**: Gather system documentation, deployment configs, and metrics
- **Execution Notes**: Start with breadth-first analysis, then deep-dive into critical paths
- **Post-processing**: Create visual diagrams for complex relationships
- **Validation Method**: Cross-reference findings with system metrics and team feedback`,
    },
  ]

  suitableFor: TaskType[] = ["analysis", "generation", "problem_solving"]

  metrics = {
    totalExecutions: 0,
    successRate: 0,
    averageLatency: 0,
    averageTokenUsage: 0,
    lastUpdated: Date.now(),
  }

  async apply(context: TechniqueContext): Promise<EnhancedPrompt> {
    const { task, variables } = context

    const prompt = this.template!.replace("{task}", task)
      .replace("{primary_objective}", "Generate optimal prompt for: " + task)
      .replace(
        "{requirements_list}",
        "- Clear structure\n- Specific instructions\n- Measurable outcomes",
      )
      .replace("{constraints}", variables["constraints"] || "None specified")
      .replace(
        "{success_criteria}",
        "Produces high-quality, actionable results",
      )
      .replace(
        "{task_type}",
        task.includes("analyze") ? "Analysis" : "Generation",
      )
      .replace("{domain}", variables["domain"] || "General")
      .replace("{complexity_level}", "High")
      .replace("{capabilities_needed}", context.capabilities.join(", "))
      .replace(
        "{selected_strategy}",
        "Chain-of-Thought with structured analysis",
      )
      .replace(
        "{generated_prompt_structure}",
        "1. Context\n2. Step-by-step analysis\n3. Deliverables",
      )
      .replace("{generated_prompt}", `Analyze and complete: ${task}`)
      .replace("{final_optimized_prompt}", `Analyze and complete: ${task}`)

    return {
      content: prompt,
      metadata: {
        techniques: ["meta-prompting"],
        confidence: 0.9,
        estimatedTokens: 1500,
        compositionStrategy: "meta-optimization",
      },
      variables: {},
    }
  }

  validate(input: unknown): boolean {
    return typeof input === "string" && input.length > 10
  }
}

// Keep the const export for backward compatibility
export const metaPrompting = new MetaPromptingTechnique()
