/**
 * Cross-language compatibility tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  Command,
  CommandIntent,
  CommandOptions,
  CommandMetadata,
  Agent,
  Tool,
  CaseConverter,
  TypeMapper,
  createValidator,
  CommandSchema
} from '../typescript';

describe('Cross-Language Compatibility', () => {
  describe('Case Conversion', () => {
    it('should convert camelCase to snake_case', () => {
      const input = {
        userId: '123',
        userName: 'John Doe',
        createdAt: '2024-01-01T00:00:00Z',
        isActive: true,
        nestedObject: {
          fieldOne: 'value1',
          fieldTwo: 'value2'
        }
      };

      const output = CaseConverter.toSnakeCase(input);

      expect(output).toEqual({
        user_id: '123',
        user_name: 'John Doe',
        created_at: '2024-01-01T00:00:00Z',
        is_active: true,
        nested_object: {
          field_one: 'value1',
          field_two: 'value2'
        }
      });
    });

    it('should convert snake_case to camelCase', () => {
      const input = {
        user_id: '123',
        user_name: 'John Doe',
        created_at: '2024-01-01T00:00:00Z',
        is_active: true,
        nested_object: {
          field_one: 'value1',
          field_two: 'value2'
        }
      };

      const output = CaseConverter.toCamelCase(input);

      expect(output).toEqual({
        userId: '123',
        userName: 'John Doe',
        createdAt: '2024-01-01T00:00:00Z',
        isActive: true,
        nestedObject: {
          fieldOne: 'value1',
          fieldTwo: 'value2'
        }
      });
    });

    it('should handle round-trip conversion', () => {
      const original: Command = {
        id: 'cmd-001',
        type: 'generation',
        intent: {
          primary: 'generate_code',
          confidence: 0.95
        },
        rawInput: 'Create a function',
        parameters: { language: 'typescript' },
        options: { timeout: 30000 },
        metadata: {
          id: 'meta-001',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          source: 'cli'
        },
        timestamp: new Date().toISOString()
      };

      const pythonFormat = CaseConverter.fromTypeScriptToPython(original);
      const backToTs = CaseConverter.fromPythonToTypeScript(pythonFormat);

      expect(backToTs).toEqual(original);
    });
  });

  describe('Type Mapping', () => {
    it('should convert Date to ISO string for Python', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const pythonValue = TypeMapper.toPython(date);
      
      expect(pythonValue).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should convert ISO string to Date from Python', () => {
      const isoString = '2024-01-01T00:00:00.000Z';
      const tsValue = TypeMapper.fromPython(isoString, 'Date');
      
      expect(tsValue).toBeInstanceOf(Date);
      expect(tsValue.toISOString()).toBe(isoString);
    });

    it('should convert Buffer to base64 for Python', () => {
      const buffer = Buffer.from('hello world', 'utf-8');
      const pythonValue = TypeMapper.toPython(buffer);
      
      expect(pythonValue).toBe(buffer.toString('base64'));
    });

    it('should convert Map to object for Python', () => {
      const map = new Map([
        ['key1', 'value1'],
        ['key2', 'value2']
      ]);
      const pythonValue = TypeMapper.toPython(map);
      
      expect(pythonValue).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should convert Set to array for Python', () => {
      const set = new Set(['item1', 'item2', 'item3']);
      const pythonValue = TypeMapper.toPython(set);
      
      expect(pythonValue).toEqual(['item1', 'item2', 'item3']);
    });
  });

  describe('Validation', () => {
    it('should validate correct data', () => {
      const command: Command = {
        id: 'cmd-001',
        type: 'generation',
        intent: {
          primary: 'test',
          confidence: 0.9
        },
        rawInput: 'test command',
        parameters: {},
        options: {},
        metadata: {
          id: 'meta-001',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          source: 'cli'
        },
        timestamp: new Date().toISOString()
      };

      const validator = createValidator({
        zodSchema: CommandSchema
      });

      const result = validator.validate(command);
      expect(result.valid).toBe(true);
    });

    it('should catch validation errors', () => {
      const invalidCommand = {
        id: 'cmd-001',
        type: 'invalid-type',
        intent: {
          primary: 'test',
          confidence: 1.5 // exceeds max
        },
        rawInput: 'test',
        parameters: {},
        options: {},
        metadata: {
          id: 'meta-001',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          source: 'cli'
        },
        timestamp: new Date().toISOString()
      };

      const validator = createValidator({
        zodSchema: CommandSchema
      });

      const result = validator.validate(invalidCommand);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Type Scenarios', () => {
    it('should handle nested arrays and objects', () => {
      const complex = {
        id: 'test',
        nestedArrays: [
          { itemId: '1', itemName: 'Item 1' },
          { itemId: '2', itemName: 'Item 2' }
        ],
        deeplyNested: {
          levelOne: {
            levelTwo: {
              finalValue: 'deep'
            }
          }
        },
        mixedTypes: {
          stringVal: 'test',
          numberVal: 42,
          boolVal: true,
          nullVal: null,
          dateVal: new Date()
        }
      };

      const pythonFormat = CaseConverter.fromTypeScriptToPython(complex);
      const converted = TypeMapper.toPython(pythonFormat);

      expect(converted.nested_arrays[0].item_id).toBe('1');
      expect(converted.deeply_nested.level_one.level_two.final_value).toBe('deep');
      expect(typeof converted.mixed_types.date_val).toBe('string');
    });

    it('should preserve array order during conversion', () => {
      const data = {
        items: ['first', 'second', 'third'],
        priorities: [Priority.LOW, Priority.NORMAL, Priority.HIGH]
      };

      const pythonFormat = CaseConverter.fromTypeScriptToPython(data);
      const backToTs = CaseConverter.fromPythonToTypeScript(pythonFormat);

      expect(backToTs.items).toEqual(data.items);
      expect(backToTs.priorities).toEqual(data.priorities);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle circular references', () => {
      const obj: any = { id: '1' };
      obj.circular = obj;

      // Should not throw
      expect(() => {
        CaseConverter.fromTypeScriptToPython(obj);
      }).not.toThrow();
    });

    it('should handle undefined values', () => {
      const data = {
        id: '1',
        optional: undefined
      };

      const pythonFormat = CaseConverter.fromTypeScriptToPython(data);
      expect(pythonFormat.optional).toBeNull(); // undefined becomes null
    });
  });
});