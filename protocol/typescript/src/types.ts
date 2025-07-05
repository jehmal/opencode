import { z } from 'zod'
import type { StandardSchemaV1 } from '@standard-schema/spec'

export const PROTOCOL_VERSION = '1.0.0'

export type Language = 'typescript' | 'python'

export interface JSONSchema {
  type?: string
  properties?: Record<string, JSONSchema>
  items?: JSONSchema
  required?: string[]
  enum?: any[]
  const?: any
  description?: string
  default?: any
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  additionalProperties?: boolean | JSONSchema
  oneOf?: JSONSchema[]
  anyOf?: JSONSchema[]
  allOf?: JSONSchema[]
  not?: JSONSchema
}

export interface ToolContext {
  sessionId: string
  messageId: string
  abort: AbortSignal
  timeout: number
  metadata: Map<string, any>
}

export interface ToolRegistration {
  id: string
  description: string
  language: Language
  schema: JSONSchema
  handler: ToolHandler
}

export type ToolHandler = (params: any, context: ToolContext) => Promise<ToolResult>

export interface ToolResult {
  output: string
  metadata: {
    title: string
    [key: string]: any
  }
  diagnostics?: any[]
}

// JSON-RPC 2.0 types
export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: any
  protocol?: string
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: any
  error?: JsonRpcError
  protocol?: string
}

export interface JsonRpcError {
  code: number
  message: string
  data?: any
}

// Protocol-specific request/response types
export interface ToolExecuteRequest extends JsonRpcRequest {
  method: 'tool.execute'
  params: {
    tool: string
    language: Language
    parameters: any
    context: {
      sessionId: string
      messageId: string
      timeout?: number
    }
  }
}

export interface ToolExecuteResponse extends JsonRpcResponse {
  result?: ToolResult
}

// Error codes
export enum ErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  ToolNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ExecutionError = -32000,
  TimeoutError = -32001,
  PermissionDenied = -32002,
}

// Tool info types for compatibility
export interface ToolInfo<P = any, M = any> {
  id: string
  description: string
  parameters: P
  execute(args: any, ctx: any): Promise<{
    metadata: M
    output: string
  }>
}