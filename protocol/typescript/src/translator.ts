import { z } from 'zod'
import type { JSONSchema } from './types'

export class SchemaTranslator {
  /**
   * Convert JSON Schema to Zod schema
   */
  static jsonSchemaToZod(schema: JSONSchema): z.ZodSchema {
    if (!schema.type && !schema.anyOf && !schema.oneOf && !schema.allOf) {
      return z.any()
    }

    switch (schema.type) {
      case 'string':
        return this.buildStringSchema(schema)
      case 'number':
      case 'integer':
        return this.buildNumberSchema(schema)
      case 'boolean':
        return z.boolean()
      case 'null':
        return z.null()
      case 'array':
        return this.buildArraySchema(schema)
      case 'object':
        return this.buildObjectSchema(schema)
      default:
        if (schema.anyOf) {
          return z.union(schema.anyOf.map(s => this.jsonSchemaToZod(s)) as [z.ZodSchema, z.ZodSchema, ...z.ZodSchema[]])
        }
        if (schema.oneOf) {
          return z.discriminatedUnion('type', schema.oneOf.map(s => this.jsonSchemaToZod(s)) as [z.ZodObject<any>, z.ZodObject<any>, ...z.ZodObject<any>[]])
        }
        if (schema.allOf) {
          return schema.allOf.reduce((acc, s) => acc.and(this.jsonSchemaToZod(s)), z.object({}))
        }
        return z.any()
    }
  }

  /**
   * Convert Zod schema to JSON Schema
   */
  static zodToJsonSchema(schema: z.ZodSchema): JSONSchema {
    const def = (schema as any)._def

    switch (def.typeName) {
      case 'ZodString':
        return this.zodStringToJsonSchema(schema as z.ZodString)
      case 'ZodNumber':
        return this.zodNumberToJsonSchema(schema as z.ZodNumber)
      case 'ZodBoolean':
        return { type: 'boolean' }
      case 'ZodNull':
        return { type: 'null' }
      case 'ZodArray':
        return this.zodArrayToJsonSchema(schema as z.ZodArray<any>)
      case 'ZodObject':
        return this.zodObjectToJsonSchema(schema as z.ZodObject<any>)
      case 'ZodUnion':
        return this.zodUnionToJsonSchema(schema as z.ZodUnion<any>)
      case 'ZodEnum':
        return this.zodEnumToJsonSchema(schema as z.ZodEnum<any>)
      case 'ZodLiteral':
        return { const: def.value }
      case 'ZodOptional':
        return this.zodToJsonSchema(def.innerType)
      case 'ZodNullable':
        return {
          anyOf: [
            this.zodToJsonSchema(def.innerType),
            { type: 'null' }
          ]
        }
      case 'ZodDefault':
        const baseSchema = this.zodToJsonSchema(def.innerType)
        return { ...baseSchema, default: def.defaultValue() }
      default:
        return {}
    }
  }

  private static buildStringSchema(schema: JSONSchema): z.ZodString {
    let zod = z.string()
    if (schema.minLength !== undefined) zod = zod.min(schema.minLength)
    if (schema.maxLength !== undefined) zod = zod.max(schema.maxLength)
    if (schema.pattern !== undefined) zod = zod.regex(new RegExp(schema.pattern))
    if (schema.enum) return z.enum(schema.enum as [string, ...string[]])
    return zod
  }

  private static buildNumberSchema(schema: JSONSchema): z.ZodNumber {
    let zod = z.number()
    if (schema.type === 'integer') zod = zod.int()
    if (schema.minimum !== undefined) zod = zod.min(schema.minimum)
    if (schema.maximum !== undefined) zod = zod.max(schema.maximum)
    return zod
  }

  private static buildArraySchema(schema: JSONSchema): z.ZodArray<any> {
    const items = schema.items ? this.jsonSchemaToZod(schema.items) : z.any()
    return z.array(items)
  }

  private static buildObjectSchema(schema: JSONSchema): z.ZodObject<any> {
    const shape: Record<string, z.ZodSchema> = {}
    
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        let propZod = this.jsonSchemaToZod(propSchema)
        if (!schema.required?.includes(key)) {
          propZod = propZod.optional()
        }
        shape[key] = propZod
      }
    }

    let obj = z.object(shape)
    
    if (schema.additionalProperties === false) {
      obj = obj.strict()
    } else if (typeof schema.additionalProperties === 'object') {
      obj = obj.catchall(this.jsonSchemaToZod(schema.additionalProperties))
    }

    return obj
  }

  private static zodStringToJsonSchema(schema: z.ZodString): JSONSchema {
    const result: JSONSchema = { type: 'string' }
    const checks = (schema as any)._def.checks || []
    
    for (const check of checks) {
      switch (check.kind) {
        case 'min':
          result.minLength = check.value
          break
        case 'max':
          result.maxLength = check.value
          break
        case 'regex':
          result.pattern = check.regex.source
          break
      }
    }
    
    return result
  }

  private static zodNumberToJsonSchema(schema: z.ZodNumber): JSONSchema {
    const result: JSONSchema = { type: 'number' }
    const checks = (schema as any)._def.checks || []
    
    for (const check of checks) {
      switch (check.kind) {
        case 'int':
          result.type = 'integer'
          break
        case 'min':
          result.minimum = check.value
          break
        case 'max':
          result.maximum = check.value
          break
      }
    }
    
    return result
  }

  private static zodArrayToJsonSchema(schema: z.ZodArray<any>): JSONSchema {
    return {
      type: 'array',
      items: this.zodToJsonSchema((schema as any)._def.type)
    }
  }

  private static zodObjectToJsonSchema(schema: z.ZodObject<any>): JSONSchema {
    const shape = schema.shape
    const properties: Record<string, JSONSchema> = {}
    const required: string[] = []
    
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = this.zodToJsonSchema(value as z.ZodSchema)
      if (!((value as any)._def.typeName === 'ZodOptional')) {
        required.push(key)
      }
    }
    
    const result: JSONSchema = {
      type: 'object',
      properties
    }
    
    if (required.length > 0) {
      result.required = required
    }
    
    if ((schema as any)._def.unknownKeys === 'strict') {
      result.additionalProperties = false
    } else if ((schema as any)._def.catchall) {
      result.additionalProperties = this.zodToJsonSchema((schema as any)._def.catchall)
    }
    
    return result
  }

  private static zodUnionToJsonSchema(schema: z.ZodUnion<any>): JSONSchema {
    const options = (schema as any)._def.options
    return {
      anyOf: options.map((opt: z.ZodSchema) => this.zodToJsonSchema(opt))
    }
  }

  private static zodEnumToJsonSchema(schema: z.ZodEnum<any>): JSONSchema {
    return {
      type: 'string',
      enum: (schema as any)._def.values
    }
  }
}