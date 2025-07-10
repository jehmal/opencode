// Type definitions for task.ts

export interface TaskPart {
  type: string;
  text?: string;
}

export interface TaskResult {
  parts: TaskPart[];
}