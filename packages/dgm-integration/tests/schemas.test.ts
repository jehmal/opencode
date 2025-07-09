import { describe, it, expect } from "bun:test"
import {
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  DgmToolSchema,
  DgmToolCallSchema,
  DgmConfigSchema,
} from "../src/schemas"

describe("JSON-RPC Schemas", () => {
  it("should validate a valid JSON-RPC request", () => {
    const validRequest = {
      jsonrpc: "2.0",
      method: "test.method",
      params: { foo: "bar" },
      id: 1,
    }

    const result = JsonRpcRequestSchema.safeParse(validRequest)
    expect(result.success).toBe(true)
  })

  it("should reject invalid JSON-RPC request", () => {
    const invalidRequest = {
      jsonrpc: "1.0", // Wrong version
      method: "test.method",
      id: 1,
    }

    const result = JsonRpcRequestSchema.safeParse(invalidRequest)
    expect(result.success).toBe(false)
  })

  it("should validate a valid JSON-RPC response", () => {
    const validResponse = {
      jsonrpc: "2.0",
      result: { data: "test" },
      id: 1,
    }

    const result = JsonRpcResponseSchema.safeParse(validResponse)
    expect(result.success).toBe(true)
  })

  it("should validate a JSON-RPC error response", () => {
    const errorResponse = {
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Invalid Request",
      },
      id: null,
    }

    const result = JsonRpcResponseSchema.safeParse(errorResponse)
    expect(result.success).toBe(true)
  })
})

describe("DGM Schemas", () => {
  it("should validate a valid DGM tool", () => {
    const validTool = {
      name: "test_tool",
      description: "A test tool",
      inputSchema: {
        type: "object",
        properties: {
          input: { type: "string" },
        },
      },
    }

    const result = DgmToolSchema.safeParse(validTool)
    expect(result.success).toBe(true)
  })

  it("should validate a valid DGM tool call", () => {
    const validCall = {
      tool: "test_tool",
      arguments: { input: "test" },
      timeout: 5000,
    }

    const result = DgmToolCallSchema.safeParse(validCall)
    expect(result.success).toBe(true)
  })

  it("should validate DGM config with defaults", () => {
    const minimalConfig = {
      dgmPath: "/path/to/dgm",
    }

    const result = DgmConfigSchema.parse(minimalConfig)
    expect(result.pythonPath).toBe("python3")
    expect(result.timeout).toBe(30000)
    expect(result.maxRetries).toBe(3)
    expect(result.logLevel).toBe("info")
    expect(result.enableMetrics).toBe(true)
  })
})
