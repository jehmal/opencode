import type { MCPRequest, MCPResponse, MockServerBehavior } from "./types"
import { MCPErrorCodes } from "./types"

export class MockMCPServer {
  private behavior: MockServerBehavior = {}

  constructor(private config: { name: string }) {}

  setBehavior(behavior: MockServerBehavior) {
    this.behavior = { ...this.behavior, ...behavior }
  }

  createResponse(request: MCPRequest, result?: any): MCPResponse {
    if (this.behavior.shouldReturnInvalidResponse) {
      return { invalid: "response" } as any
    }

    if (this.behavior.customResponse) {
      return this.behavior.customResponse
    }

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: result || { success: true },
    }
  }

  createError(
    request: MCPRequest,
    code: number,
    message: string,
    data?: any,
  ): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: {
        code,
        message,
        data,
      },
    }
  }

  async processRequest(request: MCPRequest): Promise<MCPResponse> {
    if (this.behavior.shouldFail) {
      return this.createError(
        request,
        MCPErrorCodes.INTERNAL_ERROR,
        "Mock server failure",
      )
    }

    if (this.behavior.shouldTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 30000))
    }

    if (this.behavior.shouldCrash) {
      process.exit(1)
    }

    if (this.behavior.delay) {
      await new Promise((resolve) => setTimeout(resolve, this.behavior.delay))
    }

    return this.handleMethod(request)
  }

  protected async handleMethod(request: MCPRequest): Promise<MCPResponse> {
    switch (request.method) {
      case "initialize":
        return this.handleInitialize(request)
      case "tools/list":
        return this.handleListTools(request)
      case "tools/call":
        return this.handleCallTool(request)
      case "resources/list":
        return this.handleListResources(request)
      case "resources/read":
        return this.handleReadResource(request)
      case "prompts/list":
        return this.handleListPrompts(request)
      case "prompts/get":
        return this.handleGetPrompt(request)
      default:
        return this.createError(
          request,
          MCPErrorCodes.METHOD_NOT_FOUND,
          `Method ${request.method} not found`,
        )
    }
  }

  protected handleInitialize(request: MCPRequest): MCPResponse {
    return this.createResponse(request, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {},
      },
      serverInfo: {
        name: this.config.name,
        version: "1.0.0",
      },
    })
  }

  protected handleListTools(request: MCPRequest): MCPResponse {
    return this.createResponse(request, { tools: [] })
  }

  protected handleCallTool(request: MCPRequest): MCPResponse {
    const { name, arguments: args } = request.params || {}
    return this.createResponse(request, {
      content: [
        {
          type: "text",
          text: `Tool ${name} called with arguments: ${JSON.stringify(args)}`,
        },
      ],
    })
  }

  protected handleListResources(request: MCPRequest): MCPResponse {
    return this.createResponse(request, { resources: [] })
  }

  protected handleReadResource(request: MCPRequest): MCPResponse {
    const { uri } = request.params || {}
    return this.createResponse(request, {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `Mock resource content for ${uri}`,
        },
      ],
    })
  }

  protected handleListPrompts(request: MCPRequest): MCPResponse {
    return this.createResponse(request, { prompts: [] })
  }

  protected handleGetPrompt(request: MCPRequest): MCPResponse {
    const { name, arguments: args } = request.params || {}
    return this.createResponse(request, {
      description: `Mock prompt ${name}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Mock prompt content for ${name} with args: ${JSON.stringify(args)}`,
          },
        },
      ],
    })
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return delay(ms)
}

export function shouldFail(rate: number): boolean {
  return Math.random() < rate
}

export function createMockTool(
  name: string,
  description: string,
  properties: Record<string, any> = {},
): any {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties,
      required: Object.keys(properties),
    },
  }
}

export function createMockResource(
  uri: string,
  name: string,
  mimeType = "text/plain",
): any {
  return {
    uri,
    name,
    description: `Mock resource: ${name}`,
    mimeType,
  }
}
