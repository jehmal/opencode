// Command Router Type Definitions

export interface Command {
  id: string;
  raw: string;
  timestamp: number;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedCommand {
  id: string;
  intents: Intent[];
  entities: Entity[];
  context: CommandContext;
  originalCommand: Command;
}

export interface Intent {
  type: IntentType;
  confidence: number;
  action: string;
  parameters: Record<string, unknown>;
}

export enum IntentType {
  FILE_OPERATION = 'file_operation',
  CODE_GENERATION = 'code_generation',
  ANALYSIS = 'analysis',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  SEARCH = 'search',
  SYSTEM_COMMAND = 'system_command',
  AGENT_TASK = 'agent_task',
  UNKNOWN = 'unknown'
}

export interface Entity {
  type: EntityType;
  value: string;
  position: [number, number];
  metadata?: Record<string, unknown>;
}

export enum EntityType {
  FILE_PATH = 'file_path',
  CODE_SNIPPET = 'code_snippet',
  COMMAND_FLAG = 'command_flag',
  VARIABLE_NAME = 'variable_name',
  FUNCTION_NAME = 'function_name',
  CLASS_NAME = 'class_name',
  PACKAGE_NAME = 'package_name',
  URL = 'url',
  NUMBER = 'number',
  STRING = 'string'
}

export interface CommandContext {
  workingDirectory: string;
  previousCommands: string[];
  activeFiles: string[];
  environment: Record<string, string>;
}

// Agent Communication Protocol
export interface AgentMessage {
  id: string;
  type: MessageType;
  source: string;
  target: string;
  payload: unknown;
  metadata: MessageMetadata;
  timestamp: number;
}

export enum MessageType {
  COMMAND = 'command',
  RESPONSE = 'response',
  STATUS = 'status',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
  ACKNOWLEDGMENT = 'acknowledgment'
}

export interface MessageMetadata {
  correlationId?: string;
  priority: Priority;
  ttl?: number;
  retryCount?: number;
  maxRetries?: number;
}

export enum Priority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3
}

export enum StatusCode {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  PENDING = 'PENDING',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
  RETRY = 'RETRY'
}

// Handler Types
export interface Handler {
  id: string;
  type: HandlerType;
  name: string;
  capabilities: string[];
  execute: (command: ParsedCommand) => Promise<HandlerResponse>;
  canHandle: (intent: Intent) => boolean;
}

export enum HandlerType {
  TOOL = 'tool',
  AGENT = 'agent',
  SERVICE = 'service',
  PLUGIN = 'plugin'
}

export interface HandlerResponse {
  status: StatusCode;
  data?: unknown;
  error?: Error;
  metadata?: Record<string, unknown>;
}

// Route Types
export interface Route {
  pattern: string;
  handler: Handler;
  priority: number;
  middleware?: Middleware[];
}

export interface RouteMatch {
  route: Route;
  params: Record<string, unknown>;
  score: number;
}

export type Middleware = (
  command: ParsedCommand,
  next: () => Promise<HandlerResponse>
) => Promise<HandlerResponse>;

// Registry Types
export interface HandlerRegistry {
  register(handler: Handler): void;
  unregister(handlerId: string): void;
  getHandler(handlerId: string): Handler | undefined;
  findHandlers(intent: Intent): Handler[];
  getAllHandlers(): Handler[];
}

// Error Types
export class RouterError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'RouterError';
  }
}

export class TimeoutError extends RouterError {
  constructor(message: string, timeout: number) {
    super(message, 'TIMEOUT', { timeout });
  }
}

export class HandlerNotFoundError extends RouterError {
  constructor(intent: Intent) {
    super(`No handler found for intent: ${intent.type}`, 'HANDLER_NOT_FOUND', { intent });
  }
}