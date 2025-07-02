/**
 * DGM Integration Package
 * Main exports for OpenCode + DGM communication
 */

export { DGMBridge } from './dgm-bridge';
export type { DGMBridgeOptions, DGMResponse, DGMRequest } from './dgm-bridge';

export { PerformanceTracker, PerformanceMetric } from './performance';
export type { PerformanceReport, OperationType } from './performance';

export { ToolSynchronizer } from './tool-sync';
export type { ToolDefinition, ToolSyncOptions } from './tool-sync';

export { EvolutionManager, evolutionManager } from './evolution-manager';
export type { EvolutionConfig, EvolutionState, EvolutionEvent } from './evolution-manager';

// Version info
export const VERSION = '0.0.1';
export const PYTHON_BRIDGE_VERSION = '0.0.1';