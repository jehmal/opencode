import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import { UI } from "../ui"

interface MessagePattern {
  type: string
  description: string
  frequency: number
  examples: string[]
  suggestedAutomation?: string
  confidence: number
}

interface LLMAnalysisResult {
  patterns: MessagePattern[]
  workflows: {
    name: string
    steps: string[]
    frequency: number
    automation: string
  }[]
  toolUsagePatterns: {
    tool: string
    commonUseCases: string[]
    frequency: number
  }[]
  userPreferences: {
    preference: string
    evidence: string[]
  }[]
}

const ANALYSIS_PROMPT = `Analyze this conversation between a user and an AI assistant to find patterns.

The conversation includes:
- USER: <user message>
- ASSISTANT: <assistant response start>...[truncated]...<assistant response end>
- TOOLS_USED: <list of tools> (format: "MCP:server:tool (params)" for MCP tools, "ERROR:tool:message" for failures)

Look for:
1. Repeated user requests or commands (even if worded differently)
2. Common workflows (what user asks → what assistant does → outcome)
3. Tools frequently used for specific tasks (especially MCP tools)
4. Patterns in errors or incomplete tasks
5. Sequential steps users follow
6. MCP server usage patterns (e.g., "MCP:qdrant:qdrant-find" used frequently)

Pay special attention to:
- The beginning of conversations (user's initial request)
- The end of conversations (success/failure/incomplete)
- Which MCP servers and tools are used for which requests
- Repeated phrases like "use your X to do Y"
- Tool errors and what causes them

Messages to analyze:
{messages}

Return a JSON object with patterns found. Count similar requests as the same pattern.

Example response:
{
  "patterns": [
    {
      "type": "workflow",
      "description": "User asks to check Qdrant for context before tasks",
      "frequency": 3,
      "examples": ["use your qdrant to get context", "check qdrant first"],
      "suggestedAutomation": "Auto-check Qdrant when starting new tasks",
      "confidence": 0.9
    }
  ],
  "workflows": [
    {
      "name": "Context-then-implement",
      "steps": ["Get context from Qdrant", "Analyze requirements", "Implement solution"],
      "frequency": 2,
      "automation": "Create macro for context-aware implementation"
    }
  ],
  "toolUsagePatterns": [
    {
      "tool": "qdrant",
      "commonUseCases": ["Getting project context", "Finding previous solutions"],
      "frequency": 5
    }
  ],
  "userPreferences": []
}

IMPORTANT: Return ONLY valid JSON, no other text.`

export class LLMPatternAnalyzer {
  private anthropic: ReturnType<typeof createAnthropic>
  private model = "claude-3-5-sonnet-20241022" // Cheaper, faster model

  constructor(apiKey: string) {
    this.anthropic = createAnthropic({ apiKey })
  }

  async analyzeMessages(
    messages: string[],
    batchSize: number = 20, // Reduced to avoid token limits
    verbose: boolean = false,
  ): Promise<LLMAnalysisResult> {
    const results: LLMAnalysisResult = {
      patterns: [],
      workflows: [],
      toolUsagePatterns: [],
      userPreferences: [],
    }

    // Process messages in batches to avoid token limits
    const batches = this.createBatches(messages, batchSize)

    UI.println(
      UI.Style.TEXT_INFO_BOLD + "→ ",
      UI.Style.TEXT_NORMAL +
        `Analyzing ${messages.length} messages in ${batches.length} batches with Claude 3.5 Sonnet...`,
    )

    for (let i = 0; i < batches.length; i++) {
      if (verbose) {
        UI.println(
          UI.Style.TEXT_DIM +
            `  Processing batch ${i + 1}/${batches.length}...`,
        )
      }

      try {
        const batchResult = await this.analyzeBatch(batches[i])
        this.mergeResults(results, batchResult)
      } catch (error) {
        UI.println(
          UI.Style.TEXT_WARNING_BOLD + "⚠ ",
          UI.Style.TEXT_NORMAL + `Batch ${i + 1} analysis failed: ${error}`,
        )
      }

      // Small delay to avoid rate limits
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    // Consolidate and rank patterns
    this.consolidatePatterns(results)

    return results
  }

  private createBatches(messages: string[], batchSize: number): string[][] {
    const batches: string[][] = []
    for (let i = 0; i < messages.length; i += batchSize) {
      batches.push(messages.slice(i, i + batchSize))
    }
    return batches
  }

  private async analyzeBatch(
    messages: string[],
    verbose: boolean = false,
  ): Promise<LLMAnalysisResult> {
    const prompt = ANALYSIS_PROMPT.replace(
      "{messages}",
      messages.map((msg, i) => `${i + 1}. ${msg}`).join("\n"),
    )

    try {
      const { text } = await generateText({
        model: this.anthropic(this.model),
        prompt: prompt,
        temperature: 0.3, // Lower temperature for more consistent analysis
        maxTokens: 4000,
      })

      // Try to parse JSON from the response
      try {
        // First try direct parse
        return JSON.parse(text)
      } catch {
        // Try to extract JSON from text
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error("No JSON found in response")
        }
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      if (verbose) {
        UI.println(
          UI.Style.TEXT_WARNING_BOLD + "⚠ ",
          UI.Style.TEXT_NORMAL + `LLM error: ${error}`,
        )
      }

      // Fallback: return empty result
      return {
        patterns: [],
        workflows: [],
        toolUsagePatterns: [],
        userPreferences: [],
      }
    }
  }

  private extractPatternsFromText(text: string): LLMAnalysisResult {
    // Basic pattern extraction as fallback
    const result: LLMAnalysisResult = {
      patterns: [],
      workflows: [],
      toolUsagePatterns: [],
      userPreferences: [],
    }

    // Look for common patterns in the text response
    const lines = text.split("\n")
    for (const line of lines) {
      if (line.includes("pattern") || line.includes("workflow")) {
        result.patterns.push({
          type: "extracted",
          description: line.trim(),
          frequency: 1,
          examples: [],
          confidence: 0.5,
        })
      }
    }

    return result
  }

  private mergeResults(target: LLMAnalysisResult, source: LLMAnalysisResult) {
    // Merge patterns
    for (const pattern of source.patterns) {
      const existing = target.patterns.find(
        (p) => p.type === pattern.type && p.description === pattern.description,
      )

      if (existing) {
        existing.frequency += pattern.frequency
        existing.examples.push(
          ...pattern.examples.slice(0, 3 - existing.examples.length),
        )
        existing.confidence = Math.max(existing.confidence, pattern.confidence)
      } else {
        target.patterns.push(pattern)
      }
    }

    // Merge workflows
    for (const workflow of source.workflows) {
      const existing = target.workflows.find((w) => w.name === workflow.name)

      if (existing) {
        existing.frequency += workflow.frequency
      } else {
        target.workflows.push(workflow)
      }
    }

    // Merge tool usage patterns
    for (const toolPattern of source.toolUsagePatterns) {
      const existing = target.toolUsagePatterns.find(
        (t) => t.tool === toolPattern.tool,
      )

      if (existing) {
        existing.frequency += toolPattern.frequency
        // Merge unique use cases
        for (const useCase of toolPattern.commonUseCases) {
          if (!existing.commonUseCases.includes(useCase)) {
            existing.commonUseCases.push(useCase)
          }
        }
      } else {
        target.toolUsagePatterns.push(toolPattern)
      }
    }

    // Merge user preferences
    for (const pref of source.userPreferences) {
      const existing = target.userPreferences.find(
        (p) => p.preference === pref.preference,
      )

      if (existing) {
        existing.evidence.push(...pref.evidence)
      } else {
        target.userPreferences.push(pref)
      }
    }
  }

  private consolidatePatterns(results: LLMAnalysisResult) {
    // Sort patterns by frequency and confidence
    results.patterns.sort((a, b) => {
      const scoreA = a.frequency * a.confidence
      const scoreB = b.frequency * b.confidence
      return scoreB - scoreA
    })

    // Keep only patterns with frequency >= 2 or high confidence (lowered threshold)
    results.patterns = results.patterns.filter(
      (p) => p.frequency >= 2 || p.confidence >= 0.7,
    )

    // Sort workflows by frequency
    results.workflows.sort((a, b) => b.frequency - a.frequency)

    // Sort tool usage by frequency
    results.toolUsagePatterns.sort((a, b) => b.frequency - a.frequency)
  }

  // Convert LLM results to workflow patterns for the evolution system
  convertToWorkflowPatterns(results: LLMAnalysisResult): Array<{
    pattern: string
    formula: string
    count: number
    examples: string[]
    suggestedAutomation?: string
  }> {
    const workflowPatterns: Array<{
      pattern: string
      formula: string
      count: number
      examples: string[]
      suggestedAutomation?: string
    }> = []

    // Convert patterns
    for (const pattern of results.patterns) {
      if (pattern.type === "workflow" || pattern.type === "repeated_phrase") {
        workflowPatterns.push({
          pattern: pattern.description.toLowerCase().replace(/\s+/g, "_"),
          formula: pattern.description,
          count: pattern.frequency,
          examples: pattern.examples,
          suggestedAutomation: pattern.suggestedAutomation,
        })
      }
    }

    // Convert workflows
    for (const workflow of results.workflows) {
      workflowPatterns.push({
        pattern: workflow.name.toLowerCase().replace(/\s+/g, "_"),
        formula: workflow.steps.join(" → "),
        count: workflow.frequency,
        examples: workflow.steps,
        suggestedAutomation: workflow.automation,
      })
    }

    // Convert tool usage patterns
    for (const toolPattern of results.toolUsagePatterns) {
      if (toolPattern.frequency >= 3) {
        workflowPatterns.push({
          pattern: `${toolPattern.tool}_usage_pattern`,
          formula: `Use ${toolPattern.tool} for: ${toolPattern.commonUseCases.join(", ")}`,
          count: toolPattern.frequency,
          examples: toolPattern.commonUseCases,
          suggestedAutomation: `Auto-invoke ${toolPattern.tool} when detecting: ${toolPattern.commonUseCases[0]}`,
        })
      }
    }

    return workflowPatterns
  }
}

// Export function to integrate with existing evolve command
export async function analyzePatternsWithLLM(
  messages: string[],
  anthropicToken: string,
  verbose: boolean = false,
): Promise<
  Array<{
    pattern: string
    formula: string
    count: number
    examples: string[]
    suggestedAutomation?: string
  }>
> {
  try {
    const analyzer = new LLMPatternAnalyzer(anthropicToken)
    const results = await analyzer.analyzeMessages(messages, 20, verbose) // Use smaller batch size

    const totalPatterns =
      results.patterns.length +
      results.workflows.length +
      results.toolUsagePatterns.length

    UI.println(
      UI.Style.TEXT_SUCCESS_BOLD + "✓ ",
      UI.Style.TEXT_NORMAL +
        `LLM analysis complete. Found ${totalPatterns} patterns (${results.patterns.length} general, ${results.workflows.length} workflows, ${results.toolUsagePatterns.length} tool usage).`,
    )

    if (verbose && totalPatterns > 0) {
      UI.println(UI.Style.TEXT_DIM + "\nPatterns detected:")

      if (results.patterns.length > 0) {
        UI.println(UI.Style.TEXT_DIM + "  General patterns:")
        for (const pattern of results.patterns.slice(0, 3)) {
          UI.println(
            UI.Style.TEXT_DIM +
              `    - ${pattern.description} (${pattern.frequency} times, confidence: ${pattern.confidence})`,
          )
        }
      }

      if (results.workflows.length > 0) {
        UI.println(UI.Style.TEXT_DIM + "  Workflows:")
        for (const workflow of results.workflows.slice(0, 3)) {
          UI.println(
            UI.Style.TEXT_DIM +
              `    - ${workflow.name}: ${workflow.steps.join(" → ")} (${workflow.frequency} times)`,
          )
        }
      }
    }

    return analyzer.convertToWorkflowPatterns(results)
  } catch (error) {
    UI.println(
      UI.Style.TEXT_WARNING_BOLD + "⚠ ",
      UI.Style.TEXT_NORMAL + `LLM analysis failed: ${error}`,
    )
    return []
  }
}
