/**
 * Type Mapping Utilities between TypeScript and Python
 */

import { z } from 'zod';

// Type mapping configuration
export interface TypeMapping {
  typescript: string;
  python: string;
  jsonSchema: string;
  validator?: z.ZodSchema;
  converter?: (value: any) => any;
}

// Built-in type mappings
export const TYPE_MAPPINGS: TypeMapping[] = [
  {
    typescript: 'string',
    python: 'str',
    jsonSchema: 'string',
    validator: z.string()
  },
  {
    typescript: 'number',
    python: 'float',
    jsonSchema: 'number',
    validator: z.number()
  },
  {
    typescript: 'boolean',
    python: 'bool',
    jsonSchema: 'boolean',
    validator: z.boolean()
  },
  {
    typescript: 'Date',
    python: 'datetime',
    jsonSchema: 'string',
    validator: z.date(),
    converter: (value: any) => {
      if (typeof value === 'string') {
        return new Date(value);
      }
      return value;
    }
  },
  {
    typescript: 'Buffer',
    python: 'bytes',
    jsonSchema: 'string',
    validator: z.instanceof(Buffer),
    converter: (value: any) => {
      if (Array.isArray(value)) {
        return Buffer.from(value);
      }
      if (typeof value === 'string') {
        return Buffer.from(value, 'base64');
      }
      return value;
    }
  },
  {
    typescript: 'Map',
    python: 'Dict',
    jsonSchema: 'object',
    validator: z.instanceof(Map),
    converter: (value: any) => {
      if (Array.isArray(value)) {
        return new Map(value);
      }
      if (typeof value === 'object' && value !== null) {
        return new Map(Object.entries(value));
      }
      return value;
    }
  },
  {
    typescript: 'Set',
    python: 'Set',
    jsonSchema: 'array',
    validator: z.instanceof(Set),
    converter: (value: any) => {
      if (Array.isArray(value)) {
        return new Set(value);
      }
      return value;
    }
  },
  {
    typescript: 'null',
    python: 'None',
    jsonSchema: 'null',
    validator: z.null()
  },
  {
    typescript: 'undefined',
    python: 'None',
    jsonSchema: 'null',
    validator: z.undefined(),
    converter: () => null
  },
  {
    typescript: 'any',
    python: 'Any',
    jsonSchema: {},
    validator: z.any()
  }
];

// Type mapper class
export class TypeMapper {
  private static mappings = new Map<string, TypeMapping>(
    TYPE_MAPPINGS.map(m => [m.typescript, m])
  );
  
  // Register custom type mapping
  static registerMapping(mapping: TypeMapping): void {
    this.mappings.set(mapping.typescript, mapping);
  }
  
  // Get Python type from TypeScript type
  static getPythonType(tsType: string): string {
    const mapping = this.mappings.get(tsType);
    return mapping?.python || 'Any';
  }
  
  // Get TypeScript type from Python type
  static getTypeScriptType(pyType: string): string {
    for (const mapping of this.mappings.values()) {
      if (mapping.python === pyType) {
        return mapping.typescript;
      }
    }
    return 'any';
  }
  
  // Get JSON Schema type
  static getJsonSchemaType(tsType: string): string | object {
    const mapping = this.mappings.get(tsType);
    return mapping?.jsonSchema || {};
  }
  
  // Convert value from TypeScript to Python-compatible format
  static toPython(value: any, tsType?: string): any {
    if (value === null || value === undefined) {
      return null;
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => this.toPython(item));
    }
    
    // Handle dates
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    // Handle buffers
    if (Buffer.isBuffer(value)) {
      return value.toString('base64');
    }
    
    // Handle maps
    if (value instanceof Map) {
      const obj: Record<string, any> = {};
      for (const [k, v] of value) {
        obj[String(k)] = this.toPython(v);
      }
      return obj;
    }
    
    // Handle sets
    if (value instanceof Set) {
      return Array.from(value).map(item => this.toPython(item));
    }
    
    // Handle objects
    if (typeof value === 'object' && value !== null) {
      const converted: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        converted[key] = this.toPython(val);
      }
      return converted;
    }
    
    return value;
  }
  
  // Convert value from Python to TypeScript format
  static fromPython(value: any, tsType?: string): any {
    if (value === null) {
      return null;
    }
    
    // Use converter if available
    if (tsType) {
      const mapping = this.mappings.get(tsType);
      if (mapping?.converter) {
        return mapping.converter(value);
      }
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => this.fromPython(item));
    }
    
    // Handle date strings
    if (typeof value === 'string' && tsType === 'Date') {
      return new Date(value);
    }
    
    // Handle base64 buffers
    if (typeof value === 'string' && tsType === 'Buffer') {
      return Buffer.from(value, 'base64');
    }
    
    // Handle objects that should be Maps
    if (typeof value === 'object' && value !== null && tsType === 'Map') {
      return new Map(Object.entries(value));
    }
    
    // Handle arrays that should be Sets
    if (Array.isArray(value) && tsType === 'Set') {
      return new Set(value);
    }
    
    // Handle objects
    if (typeof value === 'object' && value !== null) {
      const converted: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        converted[key] = this.fromPython(val);
      }
      return converted;
    }
    
    return value;
  }
  
  // Validate value against TypeScript type
  static validate(value: any, tsType: string): boolean {
    const mapping = this.mappings.get(tsType);
    if (!mapping?.validator) {
      return true;
    }
    
    const result = mapping.validator.safeParse(value);
    return result.success;
  }
}

// Generate TypeScript interface from Python-style type annotations
export function generateTypeScriptInterface(
  name: string,
  pythonTypes: Record<string, string>
): string {
  const lines: string[] = [`export interface ${name} {`];
  
  for (const [key, pyType] of Object.entries(pythonTypes)) {
    const tsType = TypeMapper.getTypeScriptType(pyType);
    const optional = pyType.includes('Optional') ? '?' : '';
    lines.push(`  ${key}${optional}: ${tsType};`);
  }
  
  lines.push('}');
  return lines.join('\n');
}

// Generate Python TypedDict from TypeScript interface
export function generatePythonTypedDict(
  name: string,
  tsTypes: Record<string, string>
): string {
  const lines: string[] = [
    `from typing import TypedDict, Optional`,
    '',
    `class ${name}(TypedDict):`
  ];
  
  for (const [key, tsType] of Object.entries(tsTypes)) {
    const pyType = TypeMapper.getPythonType(tsType.replace('?', ''));
    const optional = tsType.includes('?') ? 'Optional[' : '';
    const closing = tsType.includes('?') ? ']' : '';
    lines.push(`    ${key}: ${optional}${pyType}${closing}`);
  }
  
  return lines.join('\n');
}