/**
 * DGM Integration Module
 * 
 * Provides a lightweight bridge between OpenCode and DGM for self-improving AI tools.
 * This module handles:
 * - Performance tracking of tool executions
 * - Communication with DGM Python agent
 * - Tool synchronization and evolution
 */

export { DGMBridge } from './dgm-bridge';
export { PerformanceTracker } from './performance';
export { ToolSync } from './tool-sync';
export * from './types';

// Re-export core types
export type {
  ToolMetrics,
  UsagePattern,
  Improvement,
  EvolutionResult,
  DGMConfig
} from './types';