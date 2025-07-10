// Type definitions for server.ts

export interface ProjectContextError {
  type: string;
  message: string;
  file?: string;
  line?: number;
}

export interface ProjectContext {
  projectName: string;
  projectGoal: string;
  workingDirectory: string;
  completedComponents: string[];
  criticalFiles: string[];
  requiredTasks: string[];
  knownIssues: string[];
  architecturalConstraints: string[];
  successCriteria: string[];
  testingApproach: string[];
}

export interface TaskEventServer {
  clients?: Set<unknown>;
}

export interface TaskEventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  recentEvents: unknown[];
}