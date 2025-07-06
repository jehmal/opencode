export interface MCPRequest {
  jsonrpc: "2.0"
  id: string | number
  method: string
  params?: any
}

export interface MCPResponse {
  jsonrpc: "2.0"
  id: string | number
  result?: any
  error?: MCPError
}

export interface MCPError {
  code: number
  message: string
  data?: any
}

export interface MCPNotification {
  jsonrpc: "2.0"
  method: string
  params?: any
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: "object"
    properties: Record<string, any>
    required?: string[]
  }
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPPrompt {
  name: string
  description: string
  arguments?: Array<{
    name: string
    description: string
    required?: boolean
  }>
}

export interface MockServerConfig {
  name: string
  tools?: MCPTool[]
  resources?: MCPResource[]
  prompts?: MCPPrompt[]
  failureRate?: number
  responseDelay?: number
  maxConnections?: number
}

export interface MockServerBehavior {
  shouldFail?: boolean
  shouldTimeout?: boolean
  shouldCrash?: boolean
  shouldReturnInvalidResponse?: boolean
  customResponse?: any
  delay?: number
}

export const MCPErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32099,
  SERVER_ERROR_END: -32000,
} as const

export const MCPMethods = {
  INITIALIZE: "initialize",
  INITIALIZED: "initialized",
  PING: "ping",
  LIST_TOOLS: "tools/list",
  CALL_TOOL: "tools/call",
  LIST_RESOURCES: "resources/list",
  READ_RESOURCE: "resources/read",
  SUBSCRIBE_RESOURCE: "resources/subscribe",
  UNSUBSCRIBE_RESOURCE: "resources/unsubscribe",
  LIST_PROMPTS: "prompts/list",
  GET_PROMPT: "prompts/get",
  SET_LEVEL: "logging/setLevel",
  COMPLETE: "completion/complete",
} as const
