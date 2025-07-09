/**
 * Enhanced memory templates for vector storage
 * Incorporates diagnostic journeys and environment context
 */

export namespace MemoryTemplates {
  /**
   * Template for diagnostic journey memories
   */
  export const diagnosticJourney = (params: {
    title: string
    environment: "local" | "staging" | "production" | "all"
    symptoms: string
    diagnosticSteps: Array<{ action: string; result: string }>
    rootCause: string
    solution: string
    falseLeads?: string[]
    relatedIssues?: string[]
    preventionTips?: string[]
  }) => {
    const timestamp = new Date().toISOString()
    const steps = params.diagnosticSteps
      .map((s, i) => `${i + 1}. ${s.action} → Result: ${s.result}`)
      .join("\n")

    const falseLeadsSection = params.falseLeads?.length
      ? `\nFALSE LEADS (What didn't work):\n${params.falseLeads.map((l) => `- ${l}`).join("\n")}`
      : ""

    const preventionSection = params.preventionTips?.length
      ? `\nPREVENTION:\n${params.preventionTips.map((t) => `- ${t}`).join("\n")}`
      : ""

    return `DIAGNOSTIC JOURNEY: ${params.title}
Date: ${timestamp}
Environment: ${params.environment}
Domain: debugging

SYMPTOMS REPORTED:
${params.symptoms}

DIAGNOSTIC PROCESS:
${steps}

ROOT CAUSE DISCOVERED:
${params.rootCause}

SOLUTION APPLIED:
${params.solution}
${falseLeadsSection}
${preventionSection}

SEARCH HELPERS:
- Error signature: ${extractErrorSignature(params.symptoms)}
- Environment: ${params.environment}
- Category: diagnostic_journey

CONFIDENCE: 0.95
VERIFIED: true`
  }

  /**
   * Template for environment-specific errors
   */
  export const environmentError = (params: {
    error: string
    localBehavior: string
    productionBehavior: string
    cause: string
    solution: string
    debuggingTime: number // in minutes
  }) => {
    const timestamp = new Date().toISOString()

    return `ENVIRONMENT-SPECIFIC ERROR:
Date: ${timestamp}
Error: ${params.error}
Debugging Time: ${params.debuggingTime} minutes

BEHAVIOR DIFFERENCES:
Local: ${params.localBehavior}
Production: ${params.productionBehavior}

ROOT CAUSE:
${params.cause}

SOLUTION:
${params.solution}

DIAGNOSTIC CLUES:
- Works locally but fails in production
- Intermittent failures
- User-specific issues
- Timing-dependent behavior

COMMON CAUSES FOR THIS PATTERN:
1. Race conditions (different timing)
2. Data inconsistencies (missing migrations)
3. Environment variables missing
4. API endpoint differences
5. Caching behavior variations

TAGS: #production-only #environment-specific #debugging
CONFIDENCE: 0.92`
  }

  /**
   * Template for migration issues
   */
  export const migrationIssue = (params: {
    fromVersion: string
    toVersion: string
    library: string
    issue: string
    symptoms: string[]
    solution: string
    breakingChanges: string[]
  }) => {
    const timestamp = new Date().toISOString()

    return `MIGRATION ISSUE RESOLVED:
Date: ${timestamp}
Migration: ${params.library} ${params.fromVersion} → ${params.toVersion}

SYMPTOMS OBSERVED:
${params.symptoms.map((s) => `- ${s}`).join("\n")}

ISSUE:
${params.issue}

BREAKING CHANGES:
${params.breakingChanges.map((c) => `- ${c}`).join("\n")}

SOLUTION:
${params.solution}

MIGRATION CHECKLIST:
- [ ] Update package.json
- [ ] Run npm dedupe
- [ ] Check peer dependencies
- [ ] Update import statements
- [ ] Test in all environments
- [ ] Update TypeScript types

RELATED MIGRATIONS:
- Search: "MIGRATION ${params.library}"
- Search: "breaking changes ${params.fromVersion} ${params.toVersion}"

TAGS: #migration #${params.library} #breaking-change
CONFIDENCE: 0.94`
  }

  /**
   * Template for race condition patterns
   */
  export const raceCondition = (params: {
    scenario: string
    symptoms: string
    badCode: string
    fixedCode: string
    explanation: string
    testingStrategy: string
  }) => {
    const timestamp = new Date().toISOString()

    return `RACE CONDITION PATTERN:
Date: ${timestamp}
Scenario: ${params.scenario}

SYMPTOMS:
${params.symptoms}

PROBLEMATIC CODE:
\`\`\`javascript
${params.badCode}
\`\`\`

FIXED CODE:
\`\`\`javascript
${params.fixedCode}
\`\`\`

EXPLANATION:
${params.explanation}

TESTING STRATEGY:
${params.testingStrategy}

DETECTION PATTERNS:
- Inconsistent behavior
- Works locally, fails in production
- Timing-dependent failures
- Out-of-order state updates
- Stale closure issues

PREVENTION:
- Always cleanup async operations
- Use AbortController for fetch
- Implement proper cancellation
- Consider state machines for complex flows

TAGS: #race-condition #async #concurrency #react
CONFIDENCE: 0.96`
  }

  /**
   * Helper to extract error signature for better search
   */
  function extractErrorSignature(symptoms: string): string {
    // Extract key error patterns
    const patterns = [
      /Cannot read property '(\w+)' of undefined/,
      /(\w+) is not a function/,
      /Cannot resolve '([^']+)'/,
      /Unexpected token (\w+)/,
    ]

    for (const pattern of patterns) {
      const match = symptoms.match(pattern)
      if (match) return match[0]
    }

    // Fallback to first line
    return symptoms.split("\n")[0].substring(0, 50)
  }
}

/**
 * Helper functions for memory workflow
 */
export namespace MemoryWorkflow {
  /**
   * Create and store a diagnostic journey memory
   */
  export async function storeDiagnosticJourney(
    params: Parameters<typeof MemoryTemplates.diagnosticJourney>[0],
  ) {
    const memory = MemoryTemplates.diagnosticJourney(params)

    return {
      tool: "QdrantXXX_qdrant-store",
      args: {
        collection_name: "AgentMemories",
        information: memory,
        metadata: {
          type: "diagnostic_journey",
          environment: params.environment,
          confidence: 0.95,
          date: new Date().toISOString().split("T")[0],
        },
      },
    }
  }

  /**
   * Search for similar diagnostic journeys
   */
  export function searchSimilarJourneys(
    symptoms: string,
    environment?: string,
  ) {
    const envQuery = environment ? ` Environment: ${environment}` : ""

    return {
      tool: "QdrantXXX_qdrant-find",
      args: {
        collection_name: "AgentMemories",
        query: `DIAGNOSTIC JOURNEY ${symptoms}${envQuery}`,
        limit: 5,
      },
    }
  }

  /**
   * Search for environment-specific issues
   */
  export function searchEnvironmentIssues(
    error: string,
    environment: "local" | "production",
  ) {
    return {
      tool: "QdrantXXX_qdrant-find",
      args: {
        collection_name: "AgentMemories",
        query: `ENVIRONMENT-SPECIFIC ERROR ${error} ${environment}`,
        limit: 5,
      },
    }
  }

  /**
   * Create a learning chain from related memories
   */
  export async function createLearningChain(
    currentIssue: string,
    relatedMemoryIds: string[],
    newInsights: string,
  ) {
    const timestamp = new Date().toISOString()

    const memory = `LEARNING CHAIN: ${currentIssue}
Date: ${timestamp}
Type: pattern_evolution

CURRENT ISSUE:
${currentIssue}

BUILT UPON MEMORIES:
${relatedMemoryIds.map((id) => `- Memory: ${id}`).join("\n")}

NEW INSIGHTS GAINED:
${newInsights}

PATTERN EVOLUTION:
This issue represents an evolution of previously seen patterns.
By connecting these memories, we can see how problems evolve
and develop more robust solutions.

SEARCH HELPERS:
- Pattern: "${currentIssue}"
- Type: learning_chain
- Related: ${relatedMemoryIds.join(", ")}

CONFIDENCE: 0.90`

    return {
      tool: "QdrantXXX_qdrant-store",
      args: {
        collection_name: "AgentMemories",
        information: memory,
        metadata: {
          type: "learning_chain",
          confidence: 0.9,
          date: timestamp.split("T")[0],
        },
      },
    }
  }
}
