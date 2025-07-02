import type { Argv } from "yargs"
import { Bus } from "../../bus"
import { Config } from "../../config/config"
import { Session } from "../../session"
import { SessionPerformance } from "../../session/performance"
import { UI } from "../ui"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { DGMBridge } from "@opencode/dgm-integration"
import { Message } from "../../session/message"

/**
 * Evolution command for DGMO
 * Analyzes performance patterns and triggers DGM self-improvement
 */
export const EvolveCommand = cmd({
  command: "evolve",
  describe: "analyze performance and evolve dgmo capabilities",
  builder: (yargs: Argv) => {
    return yargs
      .option("analyze", {
        alias: ["a"],
        describe: "analyze performance patterns without evolving",
        type: "boolean",
        default: false,
      })
      .option("session", {
        alias: ["s"],
        describe: "analyze specific session ID",
        type: "string",
      })
      .option("auto-apply", {
        describe: "automatically apply improvements without confirmation",
        type: "boolean",
        default: false,
      })
      .option("min-samples", {
        describe: "minimum number of samples before evolution",
        type: "number",
        default: 10,
      })
      .option("verbose", {
        describe: "show detailed evolution process",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args) => {
    await bootstrap({ cwd: process.cwd() }, async () => {
      UI.empty()
      UI.println(UI.logo())
      UI.empty()
      UI.println(
        UI.Style.TEXT_HIGHLIGHT_BOLD + "Evolution Engine",
        UI.Style.TEXT_NORMAL + " - Analyzing performance patterns..."
      )
      UI.empty()

      try {
        // Initialize DGM bridge
        const bridge = new DGMBridge()
        await bridge.initialize()

        // Collect performance data
        const performanceData = await collectPerformanceData(args.session)
        
        if (performanceData.totalSamples < args.minSamples) {
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "⚠ ",
            UI.Style.TEXT_NORMAL + `Insufficient data: ${performanceData.totalSamples}/${args.minSamples} samples`
          )
          UI.println(
            UI.Style.TEXT_DIM + "  Continue using DGMO to gather more performance data."
          )
          return
        }

        // Display performance summary
        displayPerformanceSummary(performanceData, args.verbose)

        if (args.analyze) {
          UI.empty()
          UI.println(UI.Style.TEXT_INFO_BOLD + "Analysis complete. Use --analyze=false to trigger evolution.")
          return
        }

        // Analyze patterns and get evolution suggestions
        UI.empty()
        UI.println(
          UI.Style.TEXT_INFO_BOLD + "→ ",
          UI.Style.TEXT_NORMAL + "Sending patterns to DGM for analysis..."
        )
        
        const evolutionResults = await analyzeAndEvolve(bridge, performanceData, args.verbose)
        
        // Display evolution suggestions
        displayEvolutionSuggestions(evolutionResults)

        // Apply improvements if requested
        if (args.autoApply || await confirmApplyImprovements()) {
          await applyImprovements(bridge, evolutionResults)
        }

        await bridge.close()
      } catch (error) {
        UI.error(`Evolution failed: ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
      }
    })
  },
})

// Performance data collection types
interface PerformanceData {
  totalSamples: number;
  toolStats: Record<string, {
    count: number;
    successRate: number;
    avgDuration: number;
    errors: string[];
  }>;
  errorPatterns: Array<{
    pattern: string;
    count: number;
    tools: string[];
    examples: string[];
  }>;
  successRate: number;
  sessionCount: number;
  timeRange: {
    start: Date;
    end: Date;
  };
}

// Helper functions
async function collectPerformanceData(sessionId?: string): Promise<PerformanceData> {
  const data: PerformanceData = {
    totalSamples: 0,
    toolStats: {},
    errorPatterns: [],
    successRate: 0,
    sessionCount: 0,
    timeRange: {
      start: new Date(),
      end: new Date(),
    },
  };

  // If specific session requested, analyze just that one
  if (sessionId) {
    const session = await Session.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const report = await SessionPerformance.loadReport(sessionId);
    if (report) {
      processSessionData(data, report);
      data.sessionCount = 1;
    }
    return data;
  }

  // Otherwise, analyze all recent sessions
  const sessions = [];
  for await (const session of Session.list()) {
    sessions.push(session);
    if (sessions.length >= 100) break; // Limit to last 100 sessions
  }

  // Process performance data from all sessions
  for (const session of sessions) {
    const report = await SessionPerformance.loadReport(session.id);
    if (report) {
      processSessionData(data, report);
      data.sessionCount++;
    }
  }

  // Calculate aggregate metrics
  if (data.totalSamples > 0) {
    let totalSuccess = 0;
    for (const tool in data.toolStats) {
      totalSuccess += data.toolStats[tool].count * data.toolStats[tool].successRate;
    }
    data.successRate = totalSuccess / data.totalSamples;
  }

  // Sort error patterns by frequency
  data.errorPatterns.sort((a, b) => b.count - a.count);

  return data;
}

function processSessionData(data: PerformanceData, report: any): void {
  // Update time range
  const reportTime = new Date(report.timestamp || Date.now());
  if (reportTime < data.timeRange.start) data.timeRange.start = reportTime;
  if (reportTime > data.timeRange.end) data.timeRange.end = reportTime;

  // Process operation breakdown
  if (report.operationBreakdown) {
    for (const [operation, stats] of Object.entries(report.operationBreakdown)) {
      if (!data.toolStats[operation]) {
        data.toolStats[operation] = {
          count: 0,
          successRate: 1.0,
          avgDuration: 0,
          errors: [],
        };
      }
      
      const toolStat = data.toolStats[operation];
      const opStats = stats as any;
      
      // Update counts and averages
      const prevTotal = toolStat.count * toolStat.avgDuration;
      toolStat.count += opStats.count;
      data.totalSamples += opStats.count;
      
      if (toolStat.count > 0) {
        toolStat.avgDuration = (prevTotal + opStats.totalTime) / toolStat.count;
      }
    }
  }

  // Extract error patterns from metadata if available
  if (report.errors) {
    for (const error of report.errors) {
      addErrorPattern(data, error);
    }
  }
}

function addErrorPattern(data: PerformanceData, error: any): void {
  const pattern = extractErrorPattern(error);
  
  // Find existing pattern or create new one
  let errorPattern = data.errorPatterns.find(ep => ep.pattern === pattern);
  if (!errorPattern) {
    errorPattern = {
      pattern,
      count: 0,
      tools: [],
      examples: [],
    };
    data.errorPatterns.push(errorPattern);
  }
  
  errorPattern.count++;
  
  // Add tool if not already tracked
  if (error.tool && !errorPattern.tools.includes(error.tool)) {
    errorPattern.tools.push(error.tool);
  }
  
  // Keep up to 3 examples
  if (errorPattern.examples.length < 3 && error.message) {
    errorPattern.examples.push(error.message);
  }
}

function extractErrorPattern(error: any): string {
  // Extract common error patterns
  const message = error.message || error.toString();
  
  // Common patterns to detect
  if (message.includes('permission denied')) return 'permission_denied';
  if (message.includes('file not found')) return 'file_not_found';
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('syntax error')) return 'syntax_error';
  if (message.includes('type error')) return 'type_error';
  if (message.includes('network')) return 'network_error';
  if (message.includes('memory')) return 'memory_error';
  
  // Generic pattern based on error type
  if (error.type) return error.type;
  
  // Fallback to first few words
  return message.split(/\s+/).slice(0, 3).join('_').toLowerCase();
}

function displayPerformanceSummary(data: PerformanceData, verbose: boolean) {
  UI.println(UI.Style.TEXT_HIGHLIGHT_BOLD + "Performance Summary");
  UI.println(UI.Style.TEXT_DIM + "─".repeat(50));
  UI.empty();
  
  // Time range
  const days = Math.ceil((data.timeRange.end.getTime() - data.timeRange.start.getTime()) / (1000 * 60 * 60 * 24));
  UI.println(
    UI.Style.TEXT_NORMAL_BOLD + "Analysis Period: ",
    UI.Style.TEXT_NORMAL + `${days} days (${data.sessionCount} sessions)`
  );
  
  // Overall metrics
  UI.println(
    UI.Style.TEXT_NORMAL_BOLD + "Total Operations: ",
    UI.Style.TEXT_NORMAL + data.totalSamples.toLocaleString()
  );
  UI.println(
    UI.Style.TEXT_NORMAL_BOLD + "Success Rate: ",
    UI.Style.TEXT_NORMAL + `${(data.successRate * 100).toFixed(1)}%`
  );
  UI.empty();
  
  // Tool usage breakdown
  if (Object.keys(data.toolStats).length > 0) {
    UI.println(UI.Style.TEXT_NORMAL_BOLD + "Tool Usage:");
    const sortedTools = Object.entries(data.toolStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, verbose ? undefined : 5);
    
    for (const [tool, stats] of sortedTools) {
      const successIcon = stats.successRate > 0.9 ? "✓" : 
                         stats.successRate > 0.7 ? "~" : "!";
      UI.println(
        UI.Style.TEXT_DIM + `  ${successIcon} `,
        UI.Style.TEXT_NORMAL + tool.padEnd(20),
        UI.Style.TEXT_DIM + `${stats.count} calls, `,
        UI.Style.TEXT_NORMAL + `${(stats.successRate * 100).toFixed(0)}% success, `,
        UI.Style.TEXT_DIM + `${stats.avgDuration.toFixed(0)}ms avg`
      );
    }
  }
  
  // Error patterns
  if (data.errorPatterns.length > 0) {
    UI.empty();
    UI.println(UI.Style.TEXT_NORMAL_BOLD + "Common Error Patterns:");
    const topErrors = data.errorPatterns.slice(0, verbose ? 10 : 3);
    
    for (const pattern of topErrors) {
      UI.println(
        UI.Style.TEXT_WARNING_BOLD + "  ! ",
        UI.Style.TEXT_NORMAL + pattern.pattern.replace(/_/g, ' '),
        UI.Style.TEXT_DIM + ` (${pattern.count} occurrences)`
      );
      if (verbose && pattern.tools.length > 0) {
        UI.println(
          UI.Style.TEXT_DIM + "    Tools: " + pattern.tools.join(', ')
        );
      }
    }
  }
}

interface EvolutionResults {
  suggestions: Array<{
    type: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    implementation: string;
  }>;
  improvements: Array<{
    toolName: string;
    changes: string[];
    testResults?: any;
  }>;
  patterns: {
    errorPatterns: any[];
    performancePatterns: any[];
    successPatterns: any[];
  };
}

async function analyzeAndEvolve(
  bridge: DGMBridge, 
  data: PerformanceData, 
  verbose: boolean
): Promise<EvolutionResults> {
  const results: EvolutionResults = {
    suggestions: [],
    improvements: [],
    patterns: {
      errorPatterns: [],
      performancePatterns: [],
      successPatterns: [],
    },
  };

  try {
    // Prepare patterns for DGM analysis
    const patterns = {
      error_patterns: data.errorPatterns.map(ep => ({
        pattern: ep.pattern,
        frequency: ep.count,
        affected_tools: ep.tools,
        examples: ep.examples,
      })),
      performance_patterns: Object.entries(data.toolStats).map(([tool, stats]) => ({
        tool,
        usage_count: stats.count,
        avg_duration_ms: stats.avgDuration,
        success_rate: stats.successRate,
        common_errors: stats.errors.slice(0, 5),
      })),
      success_patterns: Object.entries(data.toolStats)
        .filter(([_, stats]) => stats.successRate > 0.9)
        .map(([tool, stats]) => ({
          tool,
          success_rate: stats.successRate,
          usage_count: stats.count,
        })),
    };

    if (verbose) {
      UI.println(UI.Style.TEXT_DIM + "Patterns detected:");
      UI.println(UI.Style.TEXT_DIM + `  - Error patterns: ${patterns.error_patterns.length}`);
      UI.println(UI.Style.TEXT_DIM + `  - Performance patterns: ${patterns.performance_patterns.length}`);
      UI.println(UI.Style.TEXT_DIM + `  - Success patterns: ${patterns.success_patterns.length}`);
    }

    // Send patterns to DGM for evolution
    const evolutionResponse = await bridge.execute('evolve_based_on_patterns', patterns);
    
    if (evolutionResponse.adaptations) {
      // Process DGM's evolution suggestions
      for (const adaptation of evolutionResponse.adaptations) {
        results.suggestions.push({
          type: adaptation.type || 'general',
          description: adaptation.description,
          impact: determineImpact(adaptation),
          implementation: adaptation.implementation || '',
        });
      }
    }

    // Store patterns for reference
    results.patterns = patterns;

    if (verbose) {
      UI.println(UI.Style.TEXT_DIM + `\nEvolution analysis complete.`);
      UI.println(UI.Style.TEXT_DIM + `Found ${results.suggestions.length} improvement suggestions.`);
    }

  } catch (error) {
    UI.println(
      UI.Style.TEXT_WARNING_BOLD + "⚠ ",
      UI.Style.TEXT_NORMAL + `Evolution analysis failed: ${error}`
    );
  }

  return results;
}

function determineImpact(adaptation: any): 'high' | 'medium' | 'low' {
  // Determine impact based on adaptation characteristics
  if (adaptation.priority === 'critical' || adaptation.affects_core) return 'high';
  if (adaptation.priority === 'low' || adaptation.affects_edge_cases) return 'low';
  return 'medium';
}

function displayEvolutionSuggestions(results: EvolutionResults) {
  UI.empty();
  UI.println(UI.Style.TEXT_HIGHLIGHT_BOLD + "Evolution Suggestions");
  UI.println(UI.Style.TEXT_DIM + "─".repeat(50));
  UI.empty();
  
  if (results.suggestions.length === 0) {
    UI.println(
      UI.Style.TEXT_INFO_BOLD + "ℹ ",
      UI.Style.TEXT_NORMAL + "No improvements suggested at this time."
    );
    UI.println(
      UI.Style.TEXT_DIM + "  Continue using DGMO to gather more data."
    );
    return;
  }
  
  // Group by impact
  const highImpact = results.suggestions.filter(s => s.impact === 'high');
  const mediumImpact = results.suggestions.filter(s => s.impact === 'medium');
  const lowImpact = results.suggestions.filter(s => s.impact === 'low');
  
  // Display high impact suggestions
  if (highImpact.length > 0) {
    UI.println(UI.Style.TEXT_DANGER_BOLD + "High Impact Improvements:");
    for (const suggestion of highImpact) {
      UI.println(
        UI.Style.TEXT_DANGER_BOLD + "  ⚡ ",
        UI.Style.TEXT_NORMAL + suggestion.description
      );
      if (suggestion.type !== 'general') {
        UI.println(
          UI.Style.TEXT_DIM + "     Type: " + suggestion.type
        );
      }
    }
    UI.empty();
  }
  
  // Display medium impact suggestions
  if (mediumImpact.length > 0) {
    UI.println(UI.Style.TEXT_WARNING_BOLD + "Medium Impact Improvements:");
    for (const suggestion of mediumImpact) {
      UI.println(
        UI.Style.TEXT_WARNING_BOLD + "  → ",
        UI.Style.TEXT_NORMAL + suggestion.description
      );
    }
    UI.empty();
  }
  
  // Display low impact suggestions (only count)
  if (lowImpact.length > 0) {
    UI.println(
      UI.Style.TEXT_DIM + `Plus ${lowImpact.length} low-impact improvements available.`
    );
    UI.empty();
  }
  
  // Summary
  UI.println(
    UI.Style.TEXT_INFO_BOLD + "Summary: ",
    UI.Style.TEXT_NORMAL + `${results.suggestions.length} total improvements identified`
  );
}

async function confirmApplyImprovements(): Promise<boolean> {
  // For now, return false to require --auto-apply flag
  // In future, could implement interactive confirmation
  UI.empty();
  UI.println(
    UI.Style.TEXT_WARNING_BOLD + "⚠ ",
    UI.Style.TEXT_NORMAL + "Use --auto-apply to automatically apply high-impact improvements"
  );
  return false;
}

async function applyImprovements(bridge: DGMBridge, results: EvolutionResults) {
  UI.empty();
  UI.println(
    UI.Style.TEXT_INFO_BOLD + "→ ",
    UI.Style.TEXT_NORMAL + "Applying improvements..."
  );
  
  let appliedCount = 0;
  let failedCount = 0;
  
  for (const suggestion of results.suggestions) {
    if (suggestion.impact === 'high' && suggestion.implementation) {
      try {
        UI.println(
          UI.Style.TEXT_DIM + "  Applying: ",
          UI.Style.TEXT_NORMAL + suggestion.description
        );
        
        // Apply the improvement via DGM
        const applyResult = await bridge.execute('apply_improvement', {
          suggestion: suggestion.implementation,
          testFirst: true,
        });
        
        if (applyResult.success) {
          appliedCount++;
          UI.println(
            UI.Style.TEXT_SUCCESS_BOLD + "    ✓ ",
            UI.Style.TEXT_NORMAL + "Applied successfully"
          );
          
          // Record the improvement
          results.improvements.push({
            toolName: suggestion.type,
            changes: [suggestion.description],
            testResults: applyResult.testResults,
          });
        } else {
          failedCount++;
          UI.println(
            UI.Style.TEXT_DANGER_BOLD + "    ✗ ",
            UI.Style.TEXT_NORMAL + `Failed: ${applyResult.error || 'Unknown error'}`
          );
        }
      } catch (error) {
        failedCount++;
        UI.println(
          UI.Style.TEXT_DANGER_BOLD + "    ✗ ",
          UI.Style.TEXT_NORMAL + `Error: ${error}`
        );
      }
    }
  }
  
  UI.empty();
  UI.println(
    UI.Style.TEXT_HIGHLIGHT_BOLD + "Evolution Complete",
    UI.Style.TEXT_NORMAL + ` - Applied ${appliedCount} improvements`
  );
  
  if (failedCount > 0) {
    UI.println(
      UI.Style.TEXT_WARNING_BOLD + "⚠ ",
      UI.Style.TEXT_NORMAL + `${failedCount} improvements failed to apply`
    );
  }
  
  // Save evolution history
  await saveEvolutionHistory(results);
}

async function saveEvolutionHistory(results: EvolutionResults): Promise<void> {
  try {
    const history = {
      timestamp: new Date().toISOString(),
      patterns: results.patterns,
      suggestions: results.suggestions,
      improvements: results.improvements,
    };
    
    // Save to a history file for tracking evolution over time
    const { Storage } = await import('../../storage/storage');
    await Storage.writeJSON('evolution/history/' + Date.now(), history);
  } catch (error) {
    // Silently fail - history is not critical
  }
}