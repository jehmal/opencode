import { z } from "zod"

/**
 * JSON-RPC 2.0 Request Schema
 */
export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string().min(1),
  params: z.unknown().optional(),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
})

/**
 * JSON-RPC 2.0 Response Schema
 */
export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
  id: z.union([z.string(), z.number(), z.null()]),
})

/**
 * JSON-RPC 2.0 Notification Schema (no id field)
 */
export const JsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string().min(1),
  params: z.unknown().optional(),
})

/**
 * JSON-RPC 2.0 Batch Request Schema
 */
export const JsonRpcBatchRequestSchema = z.array(
  z.union([JsonRpcRequestSchema, JsonRpcNotificationSchema]),
)

/**
 * JSON-RPC 2.0 Batch Response Schema
 */
export const JsonRpcBatchResponseSchema = z.array(JsonRpcResponseSchema)

/**
 * Standard JSON-RPC Error Codes
 */
export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  ServerError: -32000, // -32000 to -32099 reserved for implementation-defined server-errors
} as const

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>
export type JsonRpcNotification = z.infer<typeof JsonRpcNotificationSchema>
export type JsonRpcBatchRequest = z.infer<typeof JsonRpcBatchRequestSchema>
export type JsonRpcBatchResponse = z.infer<typeof JsonRpcBatchResponseSchema>
