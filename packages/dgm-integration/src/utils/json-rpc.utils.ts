import type { JsonRpcRequest, JsonRpcResponse } from "../schemas"
import { JsonRpcErrorCode } from "../schemas"

/**
 * Create a JSON-RPC request
 */
export function createJsonRpcRequest(
  method: string,
  params?: unknown,
  id?: string | number | null,
): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    method,
    ...(params !== undefined && { params }),
    ...(id !== undefined && { id }),
  }
}

/**
 * Create a JSON-RPC success response
 */
export function createJsonRpcSuccessResponse(
  result: unknown,
  id: string | number | null,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    result,
    id,
  }
}

/**
 * Create a JSON-RPC error response
 */
export function createJsonRpcErrorResponse(
  code: number,
  message: string,
  id: string | number | null,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    error: {
      code,
      message,
      ...(data !== undefined && { data }),
    },
    id,
  }
}

/**
 * Check if a response is an error
 */
export function isJsonRpcError(response: JsonRpcResponse): boolean {
  return response.error !== undefined
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Parse a JSON-RPC message from a string
 */
export function parseJsonRpcMessage(
  message: string,
): JsonRpcRequest | JsonRpcResponse | null {
  try {
    return JSON.parse(message)
  } catch {
    return null
  }
}

/**
 * Stringify a JSON-RPC message
 */
export function stringifyJsonRpcMessage(
  message: JsonRpcRequest | JsonRpcResponse,
): string {
  return JSON.stringify(message)
}

/**
 * Create standard JSON-RPC errors
 */
export const JsonRpcErrors = {
  parseError: (id: string | number | null, data?: unknown) =>
    createJsonRpcErrorResponse(
      JsonRpcErrorCode.ParseError,
      "Parse error",
      id,
      data,
    ),

  invalidRequest: (id: string | number | null, data?: unknown) =>
    createJsonRpcErrorResponse(
      JsonRpcErrorCode.InvalidRequest,
      "Invalid Request",
      id,
      data,
    ),

  methodNotFound: (id: string | number | null, method?: string) =>
    createJsonRpcErrorResponse(
      JsonRpcErrorCode.MethodNotFound,
      `Method not found${method ? `: ${method}` : ""}`,
      id,
    ),

  invalidParams: (id: string | number | null, data?: unknown) =>
    createJsonRpcErrorResponse(
      JsonRpcErrorCode.InvalidParams,
      "Invalid params",
      id,
      data,
    ),

  internalError: (id: string | number | null, data?: unknown) =>
    createJsonRpcErrorResponse(
      JsonRpcErrorCode.InternalError,
      "Internal error",
      id,
      data,
    ),

  serverError: (id: string | number | null, message: string, data?: unknown) =>
    createJsonRpcErrorResponse(JsonRpcErrorCode.ServerError, message, id, data),
}
