/**
 * JSON Serialization/Deserialization Utilities
 */

import { z } from 'zod';

// Custom JSON replacer for special types
export function jsonReplacer(key: string, value: any): any {
  // Handle Date objects
  if (value instanceof Date) {
    return { __type: 'Date', value: value.toISOString() };
  }
  
  // Handle Buffer/Uint8Array
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return { __type: 'Buffer', value: Array.from(value) };
  }
  
  // Handle Map
  if (value instanceof Map) {
    return { __type: 'Map', value: Array.from(value.entries()) };
  }
  
  // Handle Set
  if (value instanceof Set) {
    return { __type: 'Set', value: Array.from(value) };
  }
  
  // Handle RegExp
  if (value instanceof RegExp) {
    return { __type: 'RegExp', source: value.source, flags: value.flags };
  }
  
  // Handle undefined (JSON doesn't support undefined)
  if (value === undefined) {
    return { __type: 'undefined' };
  }
  
  // Handle functions (store as string)
  if (typeof value === 'function') {
    return { __type: 'function', value: value.toString() };
  }
  
  return value;
}

// Custom JSON reviver for special types
export function jsonReviver(key: string, value: any): any {
  if (value && typeof value === 'object' && '__type' in value) {
    switch (value.__type) {
      case 'Date':
        return new Date(value.value);
      
      case 'Buffer':
        return Buffer.from(value.value);
      
      case 'Map':
        return new Map(value.value);
      
      case 'Set':
        return new Set(value.value);
      
      case 'RegExp':
        return new RegExp(value.source, value.flags);
      
      case 'undefined':
        return undefined;
      
      case 'function':
        // Note: This is potentially dangerous and should be used carefully
        // Consider using a safe function parser or whitelist
        console.warn('Deserializing function from JSON - use with caution');
        return eval(`(${value.value})`);
    }
  }
  
  return value;
}

// Safe JSON stringify
export function safeStringify(obj: any, indent?: number): string {
  try {
    return JSON.stringify(obj, jsonReplacer, indent);
  } catch (error) {
    // Handle circular references
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return jsonReplacer(key, value);
    }, indent);
  }
}

// Safe JSON parse
export function safeParse<T = any>(json: string): T | null {
  try {
    return JSON.parse(json, jsonReviver);
  } catch (error) {
    console.error('JSON parse error:', error);
    return null;
  }
}

// Type-safe JSON serialization with Zod
export function createJsonSerializer<T>(schema: z.ZodSchema<T>) {
  return {
    serialize: (data: T): string => {
      const validated = schema.parse(data);
      return safeStringify(validated);
    },
    
    deserialize: (json: string): T => {
      const parsed = safeParse(json);
      if (parsed === null) {
        throw new Error('Failed to parse JSON');
      }
      return schema.parse(parsed);
    },
    
    tryDeserialize: (json: string): T | null => {
      try {
        return this.deserialize(json);
      } catch {
        return null;
      }
    }
  };
}

// Binary serialization utilities
export class BinarySerializer {
  static encode(data: any): Buffer {
    const json = safeStringify(data);
    return Buffer.from(json, 'utf-8');
  }
  
  static decode<T = any>(buffer: Buffer): T {
    const json = buffer.toString('utf-8');
    const result = safeParse<T>(json);
    if (result === null) {
      throw new Error('Failed to decode binary data');
    }
    return result;
  }
  
  static encodeBase64(data: any): string {
    const buffer = this.encode(data);
    return buffer.toString('base64');
  }
  
  static decodeBase64<T = any>(base64: string): T {
    const buffer = Buffer.from(base64, 'base64');
    return this.decode<T>(buffer);
  }
}

// Message pack-like compact encoding (simplified)
export class CompactEncoder {
  static encode(data: any): Buffer {
    // This is a simplified version - in production, use msgpack
    const json = JSON.stringify(data);
    const compressed = Buffer.from(json); // In real impl, compress this
    return compressed;
  }
  
  static decode<T = any>(buffer: Buffer): T {
    // This is a simplified version - in production, use msgpack
    const json = buffer.toString();
    return JSON.parse(json);
  }
}