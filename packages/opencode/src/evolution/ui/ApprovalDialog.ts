/**
 * Evolution Approval Dialog Component
 * Agent ID: user-approval-workflow-004
 *
 * Interactive approval interface for evolution changes
 */

import type { EvolutionItem, CodeChange } from "./types"
import { style, boxChars, icons, progressChars } from "./theme"
import { formatDiff } from "./utils"

export interface ApprovalDialogOptions {
  evolution: EvolutionItem
  onApprove: () => void
  onReject: () => void
  onCancel: () => void
}

export class ApprovalDialog {
  private evolution: EvolutionItem
  private selectedChangeIndex = 0
  private showDiff = true
  private scrollOffset = 0

  constructor(private options: ApprovalDialogOptions) {
    this.evolution = options.evolution
  }

  render(width: number, height: number): string[] {
    const lines: string[] = []

    // Header
    lines.push(this.renderHeader(width))
    lines.push("")

    // Safety Score
    lines.push(this.renderSafetyScore(width))
    lines.push("")

    // Impact Assessment
    lines.push(this.renderImpactAssessment(width))
    lines.push("")

    // Performance Metrics
    lines.push(this.renderPerformanceMetrics(width))
    lines.push("")

    // Changes List
    const changesHeight = Math.max(10, height - lines.length - 5)
    lines.push(...this.renderChangesList(width, changesHeight))
    lines.push("")

    // Footer with actions
    lines.push(this.renderFooter(width))

    return lines
  }

  private renderHeader(width: number): string {
    const title = `Evolution Approval - ${this.evolution.id}`
    const status =
      this.getStatusIcon() + " " + this.evolution.status.toUpperCase()
    const padding = width - title.length - status.length - 4

    return (
      boxChars.topLeft +
      boxChars.horizontal +
      style.bold(title) +
      " ".repeat(Math.max(0, padding)) +
      this.getStatusColor(status) +
      boxChars.horizontal +
      boxChars.topRight
    )
  }

  private renderSafetyScore(width: number): string {
    const score = this.evolution.safetyScore
    const scoreBar = this.renderProgressBar(score.overall, 20)
    const recommendation =
      this.getRecommendationIcon(score.recommendation) +
      " " +
      score.recommendation.toUpperCase()

    return (
      style.bold("Safety Score: ") +
      scoreBar +
      " " +
      style.dim(`${score.overall}%`) +
      " " +
      this.getRecommendationColor(recommendation)
    )
  }

  private renderImpactAssessment(width: number): string {
    const impact = this.evolution.impact
    const icon = this.getImpactIcon(impact.level)
    const details = `${impact.affectedFiles} files, ${impact.testsCoverage}% test coverage`

    return (
      style.bold("Impact: ") +
      icon +
      " " +
      this.getImpactColor(impact.level.toUpperCase()) +
      " - " +
      style.dim(details) +
      (impact.breakingChanges ? style.danger(" ⚠ BREAKING CHANGES") : "")
    )
  }

  private renderPerformanceMetrics(width: number): string {
    const perf = this.evolution.performance
    const metrics = []

    if (perf.executionTime.improvement !== 0) {
      const icon = perf.executionTime.improvement > 0 ? "↑" : "↓"
      const color =
        perf.executionTime.improvement > 0 ? style.success : style.danger
      metrics.push(
        color(`${icon} ${Math.abs(perf.executionTime.improvement)}% execution`),
      )
    }

    if (perf.memoryUsage.improvement !== 0) {
      const icon = perf.memoryUsage.improvement > 0 ? "↓" : "↑"
      const color =
        perf.memoryUsage.improvement > 0 ? style.success : style.danger
      metrics.push(
        color(`${icon} ${Math.abs(perf.memoryUsage.improvement)}% memory`),
      )
    }

    return (
      style.bold("Performance: ") +
      (metrics.length > 0 ? metrics.join(", ") : style.dim("No changes"))
    )
  }

  private renderChangesList(width: number, height: number): string[] {
    const lines: string[] = []
    const changes = this.evolution.changes

    lines.push(style.bold(`Changes (${changes.length} files):`))
    lines.push(boxChars.horizontal.repeat(width))

    if (this.showDiff && changes[this.selectedChangeIndex]) {
      // Show diff for selected change
      const change = changes[this.selectedChangeIndex]
      lines.push(style.info(`${change.file}:`))
      lines.push(
        ...formatDiff(change.diff, width - 4).map((line) => "  " + line),
      )
    } else {
      // Show list of changes
      changes.forEach((change, index) => {
        const selected = index === this.selectedChangeIndex
        const prefix = selected ? style.inverse(" > ") : "   "
        const icon = this.getChangeIcon(change.type)
        const stats = `+${change.lineChanges.added} -${change.lineChanges.removed}`

        lines.push(prefix + icon + " " + change.file + " " + style.dim(stats))
      })
    }

    // Trim to fit height
    return lines.slice(0, height)
  }

  private renderFooter(width: number): string {
    const actions = [
      style.success("[A]pprove"),
      style.danger("[R]eject"),
      style.dim("[D]iff"),
      style.dim("[↑↓] Navigate"),
      style.dim("[ESC] Cancel"),
    ]

    return (
      boxChars.bottomLeft +
      boxChars.horizontal +
      actions.join(" " + boxChars.vertical + " ") +
      boxChars.horizontal.repeat(width - actions.join(" | ").length - 2) +
      boxChars.bottomRight
    )
  }

  private renderProgressBar(value: number, width: number): string {
    const filled = Math.floor((value / 100) * width)
    const empty = width - filled

    let bar = ""
    for (let i = 0; i < filled; i++) {
      bar += progressChars.full
    }
    for (let i = 0; i < empty; i++) {
      bar += progressChars.empty
    }

    return "[" + this.getScoreColor(bar, value) + "]"
  }

  private getStatusIcon(): string {
    switch (this.evolution.status) {
      case "awaiting-approval":
        return icons.warning
      case "approved":
        return icons.check
      case "rejected":
        return icons.cross
      case "failed":
        return icons.cross
      default:
        return icons.circle
    }
  }

  private getStatusColor(text: string): string {
    switch (this.evolution.status) {
      case "awaiting-approval":
        return style.warning(text)
      case "approved":
        return style.success(text)
      case "rejected":
        return style.danger(text)
      case "failed":
        return style.danger(text)
      default:
        return style.dim(text)
    }
  }

  private getRecommendationIcon(recommendation: string): string {
    switch (recommendation) {
      case "safe":
        return icons.check
      case "caution":
        return icons.warning
      case "risky":
        return icons.cross
      default:
        return icons.circle
    }
  }

  private getRecommendationColor(text: string): string {
    const rec = this.evolution.safetyScore.recommendation
    switch (rec) {
      case "safe":
        return style.success(text)
      case "caution":
        return style.warning(text)
      case "risky":
        return style.danger(text)
      default:
        return text
    }
  }

  private getImpactIcon(level: string): string {
    switch (level) {
      case "low":
        return "•"
      case "medium":
        return "••"
      case "high":
        return "•••"
      case "critical":
        return "⚠"
      default:
        return "•"
    }
  }

  private getImpactColor(text: string): string {
    switch (this.evolution.impact.level) {
      case "low":
        return style.success(text)
      case "medium":
        return style.warning(text)
      case "high":
        return style.danger(text)
      case "critical":
        return style.danger(style.bold(text))
      default:
        return text
    }
  }

  private getChangeIcon(type: string): string {
    switch (type) {
      case "add":
        return style.success("+")
      case "modify":
        return style.warning("~")
      case "delete":
        return style.danger("-")
      default:
        return " "
    }
  }

  private getScoreColor(bar: string, score: number): string {
    if (score >= 80) return style.success(bar)
    if (score >= 60) return style.warning(bar)
    return style.danger(bar)
  }

  handleInput(key: string): boolean {
    switch (key) {
      case "a":
      case "A":
        this.options.onApprove()
        return true
      case "r":
      case "R":
        this.options.onReject()
        return true
      case "d":
      case "D":
        this.showDiff = !this.showDiff
        return true
      case "ArrowUp":
      case "k":
        if (this.selectedChangeIndex > 0) {
          this.selectedChangeIndex--
          return true
        }
        break
      case "ArrowDown":
      case "j":
        if (this.selectedChangeIndex < this.evolution.changes.length - 1) {
          this.selectedChangeIndex++
          return true
        }
        break
      case "Escape":
        this.options.onCancel()
        return true
    }
    return false
  }
}
