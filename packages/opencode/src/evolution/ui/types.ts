/**
 * Evolution UI Types
 * Agent ID: user-approval-workflow-004
 *
 * Type definitions for the Evolution TUI components
 */

import type {
  EvolutionResult,
  EvolutionStatus as BaseEvolutionStatus,
  PerformanceMetrics as BasePerformanceMetrics,
} from "../types"

// Define missing types
export type EvolutionPhase =
  | "analyzing"
  | "generating"
  | "testing"
  | "validating"
  | "applying"

export interface SafetyScore {
  overall: number // 0-100
  categories: {
    apiCompatibility: number
    testCoverage: number
    performanceImpact: number
    securityRisk: number
    codeQuality: number
  }
  recommendation: "safe" | "caution" | "risky"
}

export interface EvolutionUIState {
  evolutions: EvolutionItem[]
  selectedEvolution: string | null
  filter: EvolutionFilter
  view: EvolutionView
  autoApprovalSettings: AutoApprovalSettings
}

export interface EvolutionItem {
  id: string
  timestamp: Date
  status: EvolutionStatus
  phase: EvolutionPhase
  progress: number
  safetyScore: SafetyScore
  impact: ImpactAssessment
  changes: CodeChange[]
  performance: PerformanceMetrics
  error?: string
}

export type EvolutionStatus =
  | "pending"
  | "in-progress"
  | "awaiting-approval"
  | "approved"
  | "rejected"
  | "applied"
  | "rolled-back"
  | "failed"

export interface EvolutionFilter {
  status?: EvolutionStatus[]
  minSafetyScore?: number
  dateRange?: {
    start: Date
    end: Date
  }
  pattern?: string
}

export type EvolutionView =
  | "dashboard"
  | "detail"
  | "history"
  | "settings"
  | "approval"

export interface CodeChange {
  file: string
  type: "add" | "modify" | "delete"
  before?: string
  after?: string
  diff: string
  lineChanges: {
    added: number
    removed: number
  }
}

export interface ImpactAssessment {
  level: "low" | "medium" | "high" | "critical"
  affectedFiles: number
  affectedFunctions: string[]
  testsCoverage: number
  breakingChanges: boolean
  description: string
}

export interface PerformanceMetrics {
  executionTime: {
    before: number
    after: number
    improvement: number
  }
  memoryUsage: {
    before: number
    after: number
    improvement: number
  }
  cpuUsage: {
    before: number
    after: number
    improvement: number
  }
}

export interface AutoApprovalSettings {
  enabled: boolean
  minSafetyScore: number
  maxImpactLevel: "low" | "medium" | "high"
  requireTests: boolean
  excludePatterns: string[]
  notificationPreferences: NotificationPreferences
}

export interface NotificationPreferences {
  onEvolutionStart: boolean
  onAwaitingApproval: boolean
  onAutoApproval: boolean
  onFailure: boolean
  onCompletion: boolean
}

export interface UITheme {
  colors: {
    primary: string
    secondary: string
    success: string
    warning: string
    danger: string
    info: string
    background: string
    foreground: string
    border: string
  }
  spacing: {
    xs: number
    sm: number
    md: number
    lg: number
    xl: number
  }
}

export interface KeyboardShortcuts {
  approve: string[]
  reject: string[]
  viewDetails: string[]
  toggleDiff: string[]
  nextEvolution: string[]
  previousEvolution: string[]
  refresh: string[]
  settings: string[]
  help: string[]
}

export interface EvolutionEvent {
  type: EvolutionEventType
  evolutionId: string
  timestamp: Date
  data: any
}

export type EvolutionEventType =
  | "evolution.started"
  | "evolution.progress"
  | "evolution.completed"
  | "evolution.failed"
  | "evolution.approved"
  | "evolution.rejected"
  | "evolution.applied"
  | "evolution.rolled-back"
