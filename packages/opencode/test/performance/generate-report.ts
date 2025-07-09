/**
 * Performance Report Generator
 *
 * Generates detailed performance reports with graphs and analysis
 */

import * as fs from "fs/promises"
import * as path from "path"

interface BenchmarkResult {
  metric: string
  value: number
  unit: string
  target?: number
  passed?: boolean
  details?: any
}

interface BenchmarkSummary {
  timestamp: number
  results: BenchmarkResult[]
  overallPassed: boolean
  recommendations: string[]
}

class PerformanceReportGenerator {
  async generateReport(summaryPath: string): Promise<void> {
    try {
      // Load benchmark results
      const data = await fs.readFile(summaryPath, "utf-8")
      const summary: BenchmarkSummary = JSON.parse(data)

      // Generate HTML report
      const html = this.generateHTML(summary)

      // Save report
      const reportPath = summaryPath.replace(".json", ".html")
      await fs.writeFile(reportPath, html)

      console.log(`\n📊 Performance report generated: ${reportPath}`)

      // Also generate markdown summary
      const markdown = this.generateMarkdown(summary)
      const mdPath = summaryPath.replace(".json", ".md")
      await fs.writeFile(mdPath, markdown)

      console.log(`📄 Markdown summary generated: ${mdPath}`)
    } catch (error) {
      console.error("Failed to generate report:", error)
    }
  }

  private generateHTML(summary: BenchmarkSummary): string {
    const date = new Date(summary.timestamp).toLocaleString()
    const status = summary.overallPassed ? "✅ PASSED" : "❌ FAILED"

    return `<!DOCTYPE html>
<html>
<head>
  <title>DGM Bridge Performance Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .status-passed { color: #22c55e; }
    .status-failed { color: #ef4444; }
    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .metric-value {
      font-size: 24px;
      font-weight: bold;
    }
    .metric-target {
      color: #666;
      font-size: 14px;
    }
    .metric-details {
      margin-top: 10px;
      padding: 10px;
      background: #f9f9f9;
      border-radius: 4px;
      font-size: 14px;
    }
    .recommendations {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .chart {
      margin-top: 15px;
      height: 200px;
      background: #f9f9f9;
      border-radius: 4px;
      display: flex;
      align-items: flex-end;
      padding: 10px;
      gap: 5px;
    }
    .bar {
      flex: 1;
      background: #3b82f6;
      border-radius: 4px 4px 0 0;
      position: relative;
      min-height: 20px;
    }
    .bar-label {
      position: absolute;
      bottom: -20px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DGM Bridge Performance Report</h1>
    <p>Generated: ${date}</p>
    <p>Overall Status: <span class="${summary.overallPassed ? "status-passed" : "status-failed"}">${status}</span></p>
  </div>

  <h2>Performance Metrics</h2>
  ${summary.results.map((result) => this.generateMetricCard(result)).join("")}

  ${
    summary.recommendations.length > 0
      ? `
  <div class="recommendations">
    <h3>Recommendations</h3>
    <ul>
      ${summary.recommendations.map((rec) => `<li>${rec}</li>`).join("")}
    </ul>
  </div>
  `
      : ""
  }

  <h2>Performance Trends</h2>
  <div class="chart">
    ${this.generateChart(summary.results)}
  </div>
</body>
</html>`
  }

  private generateMetricCard(result: BenchmarkResult): string {
    const status = result.passed === false ? "❌" : "✅"
    const targetStr = result.target
      ? ` (target: ${result.target}${result.unit})`
      : ""

    return `
    <div class="metric-card">
      <div class="metric-header">
        <div>
          <h3>${status} ${result.metric}</h3>
          <div class="metric-value">${result.value.toFixed(2)}${result.unit}</div>
          <div class="metric-target">${targetStr}</div>
        </div>
      </div>
      ${
        result.details
          ? `
      <div class="metric-details">
        <pre>${JSON.stringify(result.details, null, 2)}</pre>
      </div>
      `
          : ""
      }
    </div>`
  }

  private generateChart(results: BenchmarkResult[]): string {
    const latencyResults = results.filter((r) => r.metric.includes("latency"))
    if (latencyResults.length === 0) return "<p>No latency data to display</p>"

    const maxValue = Math.max(...latencyResults.map((r) => r.value))

    return latencyResults
      .map((result) => {
        const height = (result.value / maxValue) * 100
        return `
        <div class="bar" style="height: ${height}%">
          <div class="bar-label">${result.metric.replace("latency_", "").replace("_avg", "")}</div>
        </div>
      `
      })
      .join("")
  }

  private generateMarkdown(summary: BenchmarkSummary): string {
    const date = new Date(summary.timestamp).toLocaleString()
    const status = summary.overallPassed ? "✅ PASSED" : "❌ FAILED"

    let md = `# DGM Bridge Performance Report

Generated: ${date}  
Overall Status: **${status}**

## Performance Metrics

| Metric | Value | Target | Status | Details |
|--------|-------|--------|--------|---------|
`

    for (const result of summary.results) {
      const status = result.passed === false ? "❌" : "✅"
      const target = result.target ? `${result.target}${result.unit}` : "N/A"
      const details = result.details
        ? Object.entries(result.details)
            .map(
              ([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(2) : v}`,
            )
            .join(", ")
        : ""

      md += `| ${result.metric} | ${result.value.toFixed(2)}${result.unit} | ${target} | ${status} | ${details} |\n`
    }

    if (summary.recommendations.length > 0) {
      md += `\n## Recommendations\n\n`
      for (const rec of summary.recommendations) {
        md += `- ${rec}\n`
      }
    }

    md += `\n## Summary\n\n`
    md += `Total metrics tested: ${summary.results.length}\n`
    md += `Passed: ${summary.results.filter((r) => r.passed !== false).length}\n`
    md += `Failed: ${summary.results.filter((r) => r.passed === false).length}\n`

    return md
  }
}

// Run if called directly
if (require.main === module) {
  const generator = new PerformanceReportGenerator()
  const summaryPath = process.argv[2]

  if (!summaryPath) {
    console.error("Usage: bun run generate-report.ts <path-to-summary.json>")
    process.exit(1)
  }

  generator.generateReport(summaryPath).catch(console.error)
}
