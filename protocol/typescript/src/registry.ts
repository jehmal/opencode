import { ToolRegistration, Language, ToolHandler, JSONSchema } from './types'
import { SchemaTranslator } from './translator'
import { z } from 'zod'

export class ToolRegistry {
  private static tools = new Map<string, ToolRegistration>()
  
  /**
   * Register a tool
   */
  static register(registration: ToolRegistration): void {
    const key = `${registration.language}:${registration.id}`
    this.tools.set(key, registration)
  }

  /**
   * Get a tool by ID and language
   */
  static get(id: string, language: Language): ToolRegistration | undefined {
    return this.tools.get(`${language}:${id}`)
  }

  /**
   * Get all tools
   */
  static getAll(): ToolRegistration[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get tools by language
   */
  static getByLanguage(language: Language): ToolRegistration[] {
    return Array.from(this.tools.values()).filter(tool => tool.language === language)
  }

  /**
   * Clear all registrations
   */
  static clear(): void {
    this.tools.clear()
  }

  /**
   * Register a TypeScript tool (OpenCode style)
   */
  static registerTypeScriptTool(tool: {
    id: string
    description: string
    parameters: z.ZodSchema
    execute: (params: any, ctx: any) => Promise<{ metadata: any; output: string }>
  }): void {
    const schema = SchemaTranslator.zodToJsonSchema(tool.parameters)
    
    const handler: ToolHandler = async (params, context) => {
      // Create OpenCode-compatible context
      const opcContext = {
        sessionID: context.sessionId,
        messageID: context.messageId,
        abort: context.abort,
        metadata: (meta: any) => {
          for (const [key, value] of Object.entries(meta)) {
            context.metadata.set(key, value)
          }
        }
      }

      // Validate parameters
      const validated = tool.parameters.parse(params)
      
      // Execute tool
      const result = await tool.execute(validated, opcContext)
      
      // Add any collected metadata
      for (const [key, value] of context.metadata) {
        result.metadata[key] = value
      }
      
      return result
    }

    this.register({
      id: tool.id,
      description: tool.description,
      language: 'typescript',
      schema,
      handler
    })
  }

  /**
   * Register a Python tool adapter
   */
  static registerPythonTool(toolInfo: {
    name: string
    description: string
    input_schema: JSONSchema
  }, handler: ToolHandler): void {
    this.register({
      id: toolInfo.name,
      description: toolInfo.description,
      language: 'python',
      schema: toolInfo.input_schema,
      handler
    })
  }

  /**
   * Get tool schema by ID and language
   */
  static getSchema(id: string, language: Language): JSONSchema | undefined {
    const tool = this.get(id, language)
    return tool?.schema
  }

  /**
   * Validate parameters against tool schema
   */
  static async validateParameters(
    id: string, 
    language: Language, 
    params: any
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const tool = this.get(id, language)
    if (!tool) {
      return { valid: false, errors: [`Tool ${id} not found for ${language}`] }
    }

    try {
      // Convert to Zod and validate
      const zodSchema = SchemaTranslator.jsonSchemaToZod(tool.schema)
      zodSchema.parse(params)
      return { valid: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          valid: false, 
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }
      }
      return { valid: false, errors: [String(error)] }
    }
  }

  /**
   * List all available tools with their metadata
   */
  static list(): Array<{
    id: string
    language: Language
    description: string
    schema: JSONSchema
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      id: tool.id,
      language: tool.language,
      description: tool.description,
      schema: tool.schema
    }))
  }
}