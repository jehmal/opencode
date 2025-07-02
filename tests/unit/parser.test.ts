import { CommandParser } from '../../src/parser/command-parser';
import { IntentRecognizer } from '../../src/parser/intent-recognizer';
import { ParameterExtractor } from '../../src/parser/parameter-extractor';

describe('CommandParser', () => {
  let parser: CommandParser;

  beforeEach(() => {
    parser = new CommandParser();
  });

  describe('parse', () => {
    test('should parse simple file create command', () => {
      const command = parser.parse('create file test.txt');
      
      expect(command.intent.primary).toBe('file.create');
      expect(command.parameters.filename).toBe('test.txt');
      expect(command.rawInput).toBe('create file test.txt');
    });

    test('should parse command with flags', () => {
      const command = parser.parse('read file config.json --async -v');
      
      expect(command.intent.primary).toBe('file.read');
      expect(command.parameters.filename).toBe('config.json');
      expect(command.options.async).toBe(true);
    });

    test('should parse command with options', () => {
      const command = parser.parse('execute tool build --timeout=60000 --priority=high');
      
      expect(command.intent.primary).toBe('tool.execute');
      expect(command.options.timeout).toBe(60000);
      expect(command.options.priority).toBe('high');
    });

    test('should handle empty input', () => {
      expect(() => parser.parse('')).toThrow('Empty command input');
      expect(() => parser.parse('   ')).toThrow('Empty command input');
    });

    test('should extract tags from input', () => {
      const command = parser.parse('create file readme.md #documentation #important');
      
      expect(command.metadata.tags).toContain('documentation');
      expect(command.metadata.tags).toContain('important');
    });

    test('should handle unknown commands', () => {
      const command = parser.parse('blahblahblah something');
      
      expect(command.intent.primary).toBe('unknown');
      expect(command.intent.confidence).toBeLessThan(0.3);
    });
  });

  describe('parseBatch', () => {
    test('should parse multiple commands', () => {
      const commands = parser.parseBatch([
        'create file test1.txt',
        'read file test2.txt',
        'delete file test3.txt',
      ]);

      expect(commands).toHaveLength(3);
      expect(commands[0].intent.primary).toBe('file.create');
      expect(commands[1].intent.primary).toBe('file.read');
      expect(commands[2].intent.primary).toBe('file.delete');
    });
  });

  describe('tryParse', () => {
    test('should return command on success', () => {
      const result = parser.tryParse('create file test.txt');
      
      expect(result.command).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.command?.intent.primary).toBe('file.create');
    });

    test('should return error on failure', () => {
      const result = parser.tryParse('');
      
      expect(result.command).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Empty command input');
    });
  });
});

describe('IntentRecognizer', () => {
  let recognizer: IntentRecognizer;

  beforeEach(() => {
    recognizer = new IntentRecognizer();
  });

  test('should recognize file operations', () => {
    expect(recognizer.recognize('create file test.txt').primary).toBe('file.create');
    expect(recognizer.recognize('read file data.json').primary).toBe('file.read');
    expect(recognizer.recognize('update file config.yml').primary).toBe('file.update');
    expect(recognizer.recognize('delete file temp.log').primary).toBe('file.delete');
  });

  test('should recognize code operations', () => {
    expect(recognizer.recognize('generate function calculateSum').primary).toBe('code.generate');
    expect(recognizer.recognize('refactor UserService class').primary).toBe('code.refactor');
    expect(recognizer.recognize('analyze performance bottlenecks').primary).toBe('code.analyze');
  });

  test('should provide confidence scores', () => {
    const highConfidence = recognizer.recognize('create file test.txt');
    expect(highConfidence.confidence).toBeGreaterThan(0.5);

    const lowConfidence = recognizer.recognize('maybe possibly create something');
    expect(lowConfidence.confidence).toBeLessThan(0.5);
  });

  test('should provide alternative intents', () => {
    const result = recognizer.recognize('find create file patterns');
    
    expect(result.alternativeIntents).toBeDefined();
    expect(result.alternativeIntents!.length).toBeGreaterThan(0);
  });

  test('should handle custom intent registration', () => {
    recognizer.registerIntent({
      intent: 'custom.test',
      patterns: [/^test\s+custom\s+(.+)$/i],
      keywords: ['test', 'custom'],
      priority: 20,
    });

    const result = recognizer.recognize('test custom functionality');
    expect(result.primary).toBe('custom.test');
  });
});

describe('ParameterExtractor', () => {
  let extractor: ParameterExtractor;

  beforeEach(() => {
    extractor = new ParameterExtractor();
  });

  test('should extract file parameters', () => {
    const params = extractor.extract('create file test.txt with content "Hello World"', 'file.create');
    
    expect(params.filename).toBe('test.txt');
    expect(params.content).toBe('Hello World');
  });

  test('should extract flags', () => {
    const params = extractor.extract('command -v --force --timeout=5000', 'unknown');
    
    expect(params.flags).toContain('-v');
    expect(params.flags).toContain('--force');
    expect(params.options.timeout).toBe('5000');
  });

  test('should extract quoted strings', () => {
    const params = extractor.extract('search "hello world" in files', 'search.query');
    
    expect(params.query).toBe('hello world');
  });

  test('should extract numbers', () => {
    const params = extractor.extract('read first 10 lines of file.txt', 'file.read');
    
    expect(params.lines).toBe(10);
  });

  test('should extract paths', () => {
    const params = extractor.extract('read ./src/index.ts', 'file.read');
    
    expect(params.filename).toBe('./src/index.ts');
  });
});