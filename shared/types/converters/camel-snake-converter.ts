/**
 * Case Conversion Utilities for TypeScript/Python Interoperability
 */

// Convert camelCase to snake_case
export function camelToSnake(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

// Convert snake_case to camelCase
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Convert PascalCase to snake_case
export function pascalToSnake(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

// Convert snake_case to PascalCase
export function snakeToPascal(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Convert object keys from camelCase to snake_case
export function keysToSnakeCase<T extends Record<string, any>>(obj: T): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(keysToSnakeCase);
  }
  
  if (obj instanceof Date || obj instanceof RegExp) {
    return obj;
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  const converted: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    converted[snakeKey] = keysToSnakeCase(value);
  }
  
  return converted;
}

// Convert object keys from snake_case to camelCase
export function keysToCamelCase<T extends Record<string, any>>(obj: T): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(keysToCamelCase);
  }
  
  if (obj instanceof Date || obj instanceof RegExp) {
    return obj;
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  const converted: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    converted[camelKey] = keysToCamelCase(value);
  }
  
  return converted;
}

// Create a proxy that automatically converts property access
export function createCaseProxy<T extends Record<string, any>>(
  obj: T,
  fromCase: 'camel' | 'snake',
  toCase: 'camel' | 'snake'
): T {
  const converter = fromCase === 'camel' && toCase === 'snake' 
    ? camelToSnake 
    : snakeToCamel;
  
  return new Proxy(obj, {
    get(target, prop) {
      if (typeof prop === 'string') {
        const convertedProp = converter(prop);
        if (convertedProp in target) {
          return target[convertedProp];
        }
      }
      return target[prop as keyof T];
    },
    
    set(target, prop, value) {
      if (typeof prop === 'string') {
        const convertedProp = converter(prop);
        target[convertedProp as keyof T] = value;
      } else {
        target[prop as keyof T] = value;
      }
      return true;
    },
    
    has(target, prop) {
      if (typeof prop === 'string') {
        const convertedProp = converter(prop);
        return convertedProp in target || prop in target;
      }
      return prop in target;
    }
  });
}

// Batch conversion utilities
export class CaseConverter {
  static toSnakeCase(data: any): any {
    return keysToSnakeCase(data);
  }
  
  static toCamelCase(data: any): any {
    return keysToCamelCase(data);
  }
  
  static fromPythonToTypeScript(data: any): any {
    return keysToCamelCase(data);
  }
  
  static fromTypeScriptToPython(data: any): any {
    return keysToSnakeCase(data);
  }
}