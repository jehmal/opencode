/**
 * Sandbox Types and Interfaces
 * Agent: safe-evolution-sandbox-003
 */

export interface SandboxConfig {
  tempDir: string
  dockerImage?: string
  maxConcurrentSandboxes?: number
  defaultTimeout?: number
  securityPolicy?: SecurityPolicy
}

export interface ResourceLimits {
  cpuShares: number // Docker CPU shares (1024 = 1 CPU)
  memoryMB: number // Memory limit in MB
  diskMB: number // Disk space limit in MB
  maxProcesses: number // Maximum number of processes
  maxFileDescriptors: number // Maximum open files
  networkEnabled: boolean // Allow network access
  executionTimeoutMs: number // Execution timeout in milliseconds
}

export interface SecurityPolicy {
  allowedModules: string[] // Whitelisted npm modules
  blockedPatterns: RegExp[] // Code patterns to block
  maxCodeSize: number // Maximum code size in bytes
  allowFileSystem: boolean // Allow file system access
  allowChildProcess: boolean // Allow spawning processes
  allowNetwork: boolean // Allow network requests
  allowedAPIs: string[] // Whitelisted Node.js APIs
}

export enum SandboxStatus {
  CREATED = "created",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  TIMEOUT = "timeout",
  DESTROYED = "destroyed",
}

export interface SandboxInstance {
  id: string
  containerId: string
  status: SandboxStatus
  createdAt: number
  startedAt?: number
  completedAt?: number
  resourceLimits: ResourceLimits
  directory: string
  logs: string[]
  error?: string
  metrics: SandboxMetrics
}

export interface SandboxMetrics {
  cpuUsage: number // Percentage (0-100)
  memoryUsage: number // Bytes
  diskUsage: number // Bytes
  networkIO: {
    in: number // Bytes received
    out: number // Bytes sent
  }
}

export interface ExecutionResult {
  success: boolean
  output?: any
  error?: string
  logs: string[]
  testResults?: TestResults
  performanceMetrics?: PerformanceMetrics
  securityViolations?: SecurityViolation[]
  resourceUsage?: ResourceUsage
}

export interface TestResults {
  total: number
  passed: number
  failed: number
  skipped: number
  duration: number
  failures: TestFailure[]
  coverage?: CodeCoverage
}

export interface TestFailure {
  test: string
  error: string
  stack?: string
  expected?: any
  actual?: any
}

export interface CodeCoverage {
  lines: CoverageMetric
  functions: CoverageMetric
  branches: CoverageMetric
  statements: CoverageMetric
}

export interface CoverageMetric {
  total: number
  covered: number
  percentage: number
}

export interface PerformanceMetrics {
  executionTime: number // Total execution time in ms
  memoryPeak: number // Peak memory usage in bytes
  cpuTime: number // CPU time in ms
  gcTime: number // Garbage collection time in ms
  gcCount: number // Number of GC runs
}

export interface SecurityViolation {
  type: SecurityViolationType
  description: string
  location?: CodeLocation
  severity: "low" | "medium" | "high" | "critical"
  recommendation: string
}

export enum SecurityViolationType {
  DANGEROUS_FUNCTION = "dangerous_function",
  RESOURCE_LIMIT = "resource_limit",
  BLOCKED_PATTERN = "blocked_pattern",
  UNAUTHORIZED_ACCESS = "unauthorized_access",
  NETWORK_VIOLATION = "network_violation",
  PROCESS_SPAWN = "process_spawn",
}

export interface CodeLocation {
  file: string
  line: number
  column: number
  snippet?: string
}

export interface ResourceUsage {
  cpu: {
    user: number // User CPU time in ms
    system: number // System CPU time in ms
    percent: number // CPU usage percentage
  }
  memory: {
    rss: number // Resident set size
    heapTotal: number // Total heap size
    heapUsed: number // Used heap size
    external: number // External memory
  }
  disk: {
    read: number // Bytes read
    written: number // Bytes written
  }
}

export interface SnapshotData {
  id: string
  sandboxId: string
  timestamp: number
  code: string
  tests: string
  executionResult?: ExecutionResult
  metadata: {
    version: string
    description?: string
    tags?: string[]
  }
}

export interface RollbackOptions {
  snapshotId: string
  validateBeforeRollback?: boolean
  preserveCurrentState?: boolean
  reason?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  score: number // 0-100 safety score
}

export interface ValidationError {
  code: string
  message: string
  severity: "error" | "critical"
  location?: CodeLocation
}

export interface ValidationWarning {
  code: string
  message: string
  suggestion?: string
}
