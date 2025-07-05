/**
 * Cross-language Validation Utilities
 */

import { z } from 'zod';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Create configured AJV instance
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  data?: any;
}

// Validation error
export interface ValidationError {
  path: string;
  message: string;
  keyword?: string;
  params?: any;
}

// Cross-language validator
export class CrossLanguageValidator {
  private zodSchema?: z.ZodSchema;
  private jsonSchema?: object;
  private ajvValidator?: any;
  
  constructor(config: {
    zodSchema?: z.ZodSchema;
    jsonSchema?: object;
  }) {
    this.zodSchema = config.zodSchema;
    this.jsonSchema = config.jsonSchema;
    
    if (this.jsonSchema) {
      this.ajvValidator = ajv.compile(this.jsonSchema);
    }
  }
  
  // Validate with Zod
  validateWithZod(data: any): ValidationResult {
    if (!this.zodSchema) {
      return { valid: true, data };
    }
    
    const result = this.zodSchema.safeParse(data);
    
    if (result.success) {
      return { valid: true, data: result.data };
    }
    
    const errors: ValidationError[] = result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      keyword: err.code,
      params: err
    }));
    
    return { valid: false, errors };
  }
  
  // Validate with JSON Schema
  validateWithJsonSchema(data: any): ValidationResult {
    if (!this.ajvValidator) {
      return { valid: true, data };
    }
    
    const valid = this.ajvValidator(data);
    
    if (valid) {
      return { valid: true, data };
    }
    
    const errors: ValidationError[] = this.ajvValidator.errors.map((err: any) => ({
      path: err.instancePath.replace(/^\//, '').replace(/\//g, '.'),
      message: err.message || 'Validation failed',
      keyword: err.keyword,
      params: err.params
    }));
    
    return { valid: false, errors };
  }
  
  // Validate with both schemas
  validate(data: any): ValidationResult {
    // First validate with Zod if available
    if (this.zodSchema) {
      const zodResult = this.validateWithZod(data);
      if (!zodResult.valid) {
        return zodResult;
      }
      data = zodResult.data; // Use transformed data
    }
    
    // Then validate with JSON Schema if available
    if (this.jsonSchema) {
      return this.validateWithJsonSchema(data);
    }
    
    return { valid: true, data };
  }
}

// Schema converter: Zod to JSON Schema
export function zodToJsonSchema(schema: z.ZodSchema): object {
  // This is a simplified converter - for production use zodToJsonSchema library
  const def = (schema as any)._def;
  
  switch (def.typeName) {
    case 'ZodString':
      return { type: 'string' };
    
    case 'ZodNumber':
      return { type: 'number' };
    
    case 'ZodBoolean':
      return { type: 'boolean' };
    
    case 'ZodNull':
      return { type: 'null' };
    
    case 'ZodArray':
      return {
        type: 'array',
        items: zodToJsonSchema(def.type)
      };
    
    case 'ZodObject':
      const properties: Record<string, any> = {};
      const required: string[] = [];
      
      for (const [key, value] of Object.entries(def.shape())) {
        properties[key] = zodToJsonSchema(value as z.ZodSchema);
        if (!(value as any).isOptional()) {
          required.push(key);
        }
      }
      
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };
    
    case 'ZodUnion':
      return {
        oneOf: def.options.map((opt: z.ZodSchema) => zodToJsonSchema(opt))
      };
    
    case 'ZodEnum':
      return {
        enum: def.values
      };
    
    default:
      return {};
  }
}

// Create validator from multiple sources
export function createValidator(options: {
  zodSchema?: z.ZodSchema;
  jsonSchema?: object;
  pythonSchema?: string;
}): CrossLanguageValidator {
  let jsonSchema = options.jsonSchema;
  
  // Convert Zod schema to JSON Schema if needed
  if (!jsonSchema && options.zodSchema) {
    jsonSchema = zodToJsonSchema(options.zodSchema);
  }
  
  // TODO: Parse Python schema if provided
  
  return new CrossLanguageValidator({
    zodSchema: options.zodSchema,
    jsonSchema
  });
}

// Validate and transform data for cross-language compatibility
export function validateAndTransform(
  data: any,
  schema: z.ZodSchema,
  targetLanguage: 'typescript' | 'python'
): ValidationResult {
  // Validate with Zod
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors: ValidationError[] = result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      keyword: err.code,
      params: err
    }));
    
    return { valid: false, errors };
  }
  
  // Transform for target language
  let transformed = result.data;
  
  if (targetLanguage === 'python') {
    // Convert TypeScript-specific types to Python-compatible
    transformed = transformForPython(transformed);
  }
  
  return { valid: true, data: transformed };
}

// Transform data for Python compatibility
function transformForPython(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }
  
  if (data instanceof Date) {
    return data.toISOString();
  }
  
  if (Buffer.isBuffer(data)) {
    return data.toString('base64');
  }
  
  if (data instanceof Map) {
    const obj: Record<string, any> = {};
    for (const [k, v] of data) {
      obj[String(k)] = transformForPython(v);
    }
    return obj;
  }
  
  if (data instanceof Set) {
    return Array.from(data).map(transformForPython);
  }
  
  if (Array.isArray(data)) {
    return data.map(transformForPython);
  }
  
  if (typeof data === 'object' && data !== null) {
    const transformed: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      transformed[key] = transformForPython(value);
    }
    return transformed;
  }
  
  return data;
}

// Common validation schemas
export const CommonSchemas = {
  uuid: z.string().uuid(),
  email: z.string().email(),
  url: z.string().url(),
  datetime: z.string().datetime(),
  ipv4: z.string().ip({ version: 'v4' }),
  ipv6: z.string().ip({ version: 'v6' }),
  semver: z.string().regex(/^\d+\.\d+\.\d+$/),
  
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive().max(100),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional()
  }),
  
  metadata: z.object({
    id: z.string(),
    version: z.string(),
    timestamp: z.string().datetime(),
    correlationId: z.string().optional(),
    source: z.string(),
    environment: z.string().optional(),
    tags: z.array(z.string()).optional()
  }).passthrough()
};