/**
 * Evolution CLI Commands
 * Provides command-line interface for controlling the evolution system
 */

import { Log } from "../../util/log"
import { EvolutionOrchestrator } from "./evolution-orchestrator"
import { EvolutionBridge } from "../bridge"
import { UsageAnalyzer } from "./usage-analyzer"
import { SandboxManager } from "../sandbox/sandbox-manager"
import { EvolutionUI } from "../ui"
import { EvolutionPrioritizer } from "./evolution-prioritizer"
import { EvolutionMetricsCollector } from "./evolution-metrics"
import { EvolutionRollbackManager } from "./evolution-rollback"
import { EvolutionConfigManager } from "./evolution-config"
import { DGMBridge } from "../../dgm/bridge"

const log = Log.create({ service: "evolution-commands" })

let orchestrator: EvolutionOrchestrator | null = null

/**
 * Get or create orchestrator instance
 */
async function getOrchestrator(): Promise<EvolutionOrchestrator> {
  if (!orchestrator) {
    // Initialize components
    const dgmBridge = new DGMBridge({
      pythonPath: "python3",
      bridgePath: "./dgm/bridge/server.py",
      timeout: 30000,
    })

    await dgmBridge.initialize()

    const evolutionBridge = new EvolutionBridge(
      {
        enabled: true,
        autoEvolve: false,
        evolutionThreshold: {
          performanceDegradation: 20,
          errorRateIncrease: 10,
          testFailureRate: 5,
        },
        maxConcurrentEvolutions: 3,
        evolutionTimeout: 600000,
        rollbackOnFailure: true,
        requireApproval: true,
        telemetry: { trackMetrics: true, reportingInterval: 60000 },
      },
      dgmBridge,
    )

    const analyzer = new UsageAnalyzer()
    const sandbox = new SandboxManager()
    const ui = new EvolutionUI()
    const prioritizer = new EvolutionPrioritizer()
    const metricsCollector = new EvolutionMetricsCollector()
    const rollbackManager = new EvolutionRollbackManager()
    const configManager = new EvolutionConfigManager()

    await configManager.initialize()

    orchestrator = new EvolutionOrchestrator(
      evolutionBridge,
      analyzer,
      sandbox,
      ui,
      prioritizer,
      metricsCollector,
      rollbackManager,
      configManager,
    )
  }

  return orchestrator
}

/**
 * Format evolution status for display
 */
function formatEvolutionStatus(status: any): string {
  const lines: string[] = [
    "Evolution Orchestrator Status:",
    `  Running: ${status.isRunning ? "Yes" : "No"}`,
    `  Paused: ${status.isPaused ? "Yes" : "No"}`,
    `  Cycles: ${status.cycleCount}`,
    `  Active Evolutions: ${status.activeEvolutions}`,
    `  Queued Evolutions: ${status.queuedEvolutions}`,
    `  Success Rate: ${(status.successRate * 100).toFixed(1)}%`,
    `  Total: ${status.successCount + status.failureCount} (${status.successCount} success, ${status.failureCount} failed)`,
  ]

  return lines.join("\n")
}

/**
 * Format metrics report for display
 */
function formatMetricsReport(report: any): string {
  const lines: string[] = [
    "Evolution Metrics Report:",
    `  Total Evolutions: ${report.totalEvolutions}`,
    `  Success Rate: ${(report.successRate * 100).toFixed(1)}%`,
    "",
    "Average Improvements:",
  ]

  for (const [metric, improvement] of Object.entries(
    report.averageImprovement,
  )) {
    lines.push(`  ${metric}: ${(improvement as number).toFixed(1)}%`)
  }

  if (report.topEvolutions.length > 0) {
    lines.push("", "Top Evolutions:")
    for (const evolution of report.topEvolutions) {
      lines.push(
        `  - ${evolution.type}: ${evolution.improvement.toFixed(1)}% improvement`,
      )
    }
  }

  if (report.recommendations.length > 0) {
    lines.push("", "Recommendations:")
    for (const rec of report.recommendations) {
      lines.push(`  - ${rec}`)
    }
  }

  return lines.join("\n")
}

/**
 * Evolution CLI commands
 */
export const evolutionCommands = {
  /**
   * Start the evolution orchestrator
   */
  "evolution:start": async (args?: { interval?: number }) => {
    try {
      const orchestrator = await getOrchestrator()
      await orchestrator.start({
        cycleInterval: args?.interval ? args.interval * 1000 : undefined,
      })
      console.log("✅ Evolution orchestrator started")
    } catch (error) {
      console.error("❌ Failed to start evolution orchestrator:", error)
    }
  },

  /**
   * Stop the evolution orchestrator
   */
  "evolution:stop": async () => {
    try {
      const orchestrator = await getOrchestrator()
      await orchestrator.stop()
      console.log("✅ Evolution orchestrator stopped")
    } catch (error) {
      console.error("❌ Failed to stop evolution orchestrator:", error)
    }
  },

  /**
   * Pause the evolution orchestrator
   */
  "evolution:pause": async () => {
    try {
      const orchestrator = await getOrchestrator()
      orchestrator.pause()
      console.log("✅ Evolution orchestrator paused")
    } catch (error) {
      console.error("❌ Failed to pause evolution orchestrator:", error)
    }
  },

  /**
   * Resume the evolution orchestrator
   */
  "evolution:resume": async () => {
    try {
      const orchestrator = await getOrchestrator()
      orchestrator.resume()
      console.log("✅ Evolution orchestrator resumed")
    } catch (error) {
      console.error("❌ Failed to resume evolution orchestrator:", error)
    }
  },

  /**
   * Get evolution status
   */
  "evolution:status": async () => {
    try {
      const orchestrator = await getOrchestrator()
      const status = orchestrator.getStatus()
      console.log(formatEvolutionStatus(status))

      const activeEvolutions = orchestrator.getActiveEvolutions()
      if (activeEvolutions.length > 0) {
        console.log("\nActive Evolutions:")
        for (const evolution of activeEvolutions) {
          console.log(
            `  - ${evolution.id}: ${evolution.state} (${evolution.hypothesis.type})`,
          )
        }
      }
    } catch (error) {
      console.error("❌ Failed to get evolution status:", error)
    }
  },

  /**
   * Get evolution metrics report
   */
  "evolution:report": async () => {
    try {
      const orchestrator = await getOrchestrator()
      const report = await orchestrator.getMetricsReport()
      console.log(formatMetricsReport(report))
    } catch (error) {
      console.error("❌ Failed to get metrics report:", error)
    }
  },

  /**
   * Configure evolution settings
   */
  "evolution:config": async (args?: { key?: string; value?: any }) => {
    try {
      const orchestrator = await getOrchestrator()
      const configManager = (orchestrator as any)
        .configManager as EvolutionConfigManager

      if (!args?.key) {
        // Show current config
        const config = await configManager.getConfig()
        console.log("Current Evolution Configuration:")
        console.log(JSON.stringify(config, null, 2))
      } else if (args.value === undefined) {
        // Get specific value
        const value = configManager.get(args.key)
        console.log(`${args.key}: ${JSON.stringify(value, null, 2)}`)
      } else {
        // Set value
        await configManager.set(args.key, args.value)
        console.log(`✅ Set ${args.key} = ${JSON.stringify(args.value)}`)
      }
    } catch (error) {
      console.error("❌ Failed to configure evolution:", error)
    }
  },

  /**
   * Enable auto-approval for safe evolutions
   */
  "evolution:auto-approve": async (args?: { enable?: boolean }) => {
    try {
      const orchestrator = await getOrchestrator()
      const configManager = (orchestrator as any)
        .configManager as EvolutionConfigManager

      const enable = args?.enable ?? true
      await configManager.updateConfig({
        autoApprove: {
          enabled: enable,
          maxRiskLevel: 0.2,
          types: ["fix_bugs", "improve_performance"],
        },
      })

      console.log(
        `✅ Auto-approval ${enable ? "enabled" : "disabled"} for safe evolutions`,
      )
    } catch (error) {
      console.error("❌ Failed to configure auto-approval:", error)
    }
  },

  /**
   * List available evolution commands
   */
  "evolution:help": async () => {
    console.log(`
Evolution Commands:
  evolution:start [--interval <seconds>]  Start the evolution orchestrator
  evolution:stop                          Stop the evolution orchestrator
  evolution:pause                         Pause evolution processing
  evolution:resume                        Resume evolution processing
  evolution:status                        Show current status
  evolution:report                        Show metrics report
  evolution:config [key] [value]          Get/set configuration
  evolution:auto-approve [--enable]       Enable/disable auto-approval
  evolution:help                          Show this help message

Examples:
  evolution:start --interval 300          Start with 5-minute cycles
  evolution:config autoApprove.enabled true
  evolution:auto-approve --enable
`)
  },
}

/**
 * Register evolution commands with the CLI
 */
export function registerEvolutionCommands(cli: any): void {
  for (const [command, handler] of Object.entries(evolutionCommands)) {
    cli.register(command, handler)
  }

  log.info("Evolution commands registered")
}
