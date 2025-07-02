/**
 * Performance Tracker
 * 
 * Tracks tool execution metrics and generates usage patterns for evolution.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolMetrics, UsagePattern } from './types';

export class PerformanceTracker {
  private metricsDir: string;
  private metricsBuffer: ToolMetrics[] = [];
  private flushInterval: NodeJS.Timer | null = null;

  constructor(private dataDir: string = './dgm-data') {
    this.metricsDir = path.join(dataDir, 'metrics');
    this.initialize();
  }

  /**
   * Initialize the tracker
   */
  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.metricsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create metrics directory:', error);
    }

    // Flush metrics every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error);
    }, 30000);
  }

  /**
   * Track a tool execution
   */
  async track(metrics: ToolMetrics): Promise<void> {
    this.metricsBuffer.push({
      ...metrics,
      timestamp: metrics.timestamp || new Date()
    });

    // Flush if buffer is getting large
    if (this.metricsBuffer.length >= 100) {
      await this.flush();
    }
  }

  /**
   * Flush metrics to disk
   */
  async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    const filename = `metrics-${Date.now()}.json`;
    const filepath = path.join(this.metricsDir, filename);

    try {
      await fs.writeFile(filepath, JSON.stringify(metrics, null, 2));
    } catch (error) {
      console.error('Failed to write metrics:', error);
      // Put metrics back in buffer
      this.metricsBuffer.unshift(...metrics);
    }
  }

  /**
   * Get usage patterns for a time range
   */
  async getUsagePatterns(
    startDate: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    endDate: Date = new Date()
  ): Promise<UsagePattern[]> {
    const patterns = new Map<string, {
      executions: number;
      successes: number;
      totalTime: number;
      errors: Map<string, { count: number; message: string }>;
    }>();

    // Read all metrics files in the time range
    const files = await fs.readdir(this.metricsDir);
    
    for (const file of files) {
      if (!file.startsWith('metrics-') || !file.endsWith('.json')) {
        continue;
      }

      const timestamp = parseInt(file.slice(8, -5));
      if (timestamp < startDate.getTime() || timestamp > endDate.getTime()) {
        continue;
      }

      try {
        const content = await fs.readFile(path.join(this.metricsDir, file), 'utf-8');
        const metrics: ToolMetrics[] = JSON.parse(content);

        for (const metric of metrics) {
          const metricDate = new Date(metric.timestamp);
          if (metricDate < startDate || metricDate > endDate) {
            continue;
          }

          if (!patterns.has(metric.toolName)) {
            patterns.set(metric.toolName, {
              executions: 0,
              successes: 0,
              totalTime: 0,
              errors: new Map()
            });
          }

          const pattern = patterns.get(metric.toolName)!;
          pattern.executions++;
          pattern.totalTime += metric.executionTime;
          
          if (metric.success) {
            pattern.successes++;
          } else if (metric.errorType) {
            const errorKey = metric.errorType;
            if (!pattern.errors.has(errorKey)) {
              pattern.errors.set(errorKey, { 
                count: 0, 
                message: metric.errorMessage || 'Unknown error' 
              });
            }
            pattern.errors.get(errorKey)!.count++;
          }
        }
      } catch (error) {
        console.error(`Failed to read metrics file ${file}:`, error);
      }
    }

    // Convert to UsagePattern array
    const usagePatterns: UsagePattern[] = [];
    
    for (const [toolName, data] of patterns) {
      const commonErrors = Array.from(data.errors.entries())
        .map(([type, info]) => ({
          type,
          count: info.count,
          message: info.message
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 errors

      usagePatterns.push({
        toolName,
        totalExecutions: data.executions,
        successRate: data.executions > 0 ? data.successes / data.executions : 0,
        averageExecutionTime: data.executions > 0 ? data.totalTime / data.executions : 0,
        commonErrors,
        timeRange: { start: startDate, end: endDate }
      });
    }

    return usagePatterns;
  }

  /**
   * Get summary statistics
   */
  async getSummary(): Promise<{
    totalExecutions: number;
    overallSuccessRate: number;
    toolStats: Record<string, {
      executions: number;
      successRate: number;
      avgTime: number;
    }>;
  }> {
    const patterns = await this.getUsagePatterns();
    
    let totalExecutions = 0;
    let totalSuccesses = 0;
    const toolStats: Record<string, any> = {};

    for (const pattern of patterns) {
      totalExecutions += pattern.totalExecutions;
      totalSuccesses += Math.round(pattern.totalExecutions * pattern.successRate);
      
      toolStats[pattern.toolName] = {
        executions: pattern.totalExecutions,
        successRate: pattern.successRate,
        avgTime: pattern.averageExecutionTime
      };
    }

    return {
      totalExecutions,
      overallSuccessRate: totalExecutions > 0 ? totalSuccesses / totalExecutions : 0,
      toolStats
    };
  }

  /**
   * Clean up old metrics files
   */
  async cleanup(daysToKeep: number = 30): Promise<void> {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const files = await fs.readdir(this.metricsDir);

    for (const file of files) {
      if (!file.startsWith('metrics-') || !file.endsWith('.json')) {
        continue;
      }

      const timestamp = parseInt(file.slice(8, -5));
      if (timestamp < cutoffTime) {
        try {
          await fs.unlink(path.join(this.metricsDir, file));
        } catch (error) {
          console.error(`Failed to delete old metrics file ${file}:`, error);
        }
      }
    }
  }

  /**
   * Stop the tracker
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    await this.flush();
  }
}