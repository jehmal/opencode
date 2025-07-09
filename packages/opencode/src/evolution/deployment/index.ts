/**
 * Evolution Deployment System
 * Exports all deployment-related components
 */

export { EvolutionDeploymentManager } from "./evolution-deployment-manager"
export type {
  DeploymentConfig,
  Deployment,
  DeploymentStatus,
  DeploymentStage,
  DeploymentMetrics,
  DeploymentResult,
  DeploymentPlan,
  DeploymentStrategy,
} from "./evolution-deployment-manager"

export {
  DirectDeploymentStrategy,
  CanaryDeploymentStrategy,
  BlueGreenDeploymentStrategy,
  createStrategy,
} from "./deployment-strategies"
export type { IDeploymentStrategy, HealthStatus } from "./deployment-strategies"

export { RolloutController } from "./rollout-controller"
export type {
  RolloutConfig,
  Rollout,
  RolloutStatus,
  RolloutStage,
  RolloutMetrics,
  RolloutAnalytics,
} from "./rollout-controller"

export { DeploymentMonitor } from "./deployment-monitor"
export type {
  MonitoringConfig,
  MonitoringSession,
  DeploymentMetrics as MonitoringMetrics,
  Alert,
  HealthCheck,
  HealthReport,
} from "./deployment-monitor"

export { RollbackManager } from "./rollback-manager"
export type {
  RollbackPlan,
  RollbackCheckpoint,
  RollbackAction,
  RollbackResult,
} from "./rollback-manager"

export { FeatureFlagManager } from "./feature-flags"
export type {
  FeatureFlag,
  FeatureFlagConfig,
  FeatureFlagRule,
  EvaluationContext,
} from "./feature-flags"

export { DeploymentHistoryTracker } from "./deployment-history"
export type {
  DeploymentRecord,
  DeploymentAnalytics,
} from "./deployment-history"

export { PostDeploymentValidator } from "./post-deployment-validator"
export type {
  PostDeploymentMetrics,
  ValidationReport as PostDeploymentReport,
  ValidationFinding,
  ValidationAnalysis,
} from "./post-deployment-validator"

export { DeploymentDashboard } from "./deployment-dashboard"
