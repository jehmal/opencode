import { nanoid } from 'nanoid';
import { Command, CommandMetadata, CommandOptions } from '../types/command.types';
import { IntentRecognizer } from './intent-recognizer';
import { ParameterExtractor } from './parameter-extractor';

/**
 * Parser configuration
 */
export interface ParserConfig {
  defaultTimeout?: number;
  defaultPriority?: 'low' | 'normal' | 'high';
  enableFuzzyMatching?: boolean;
  confidenceThreshold?: number;
}

/**
 * Command parser for processing user input into structured commands
 */
export class CommandParser {
  private intentRecognizer: IntentRecognizer;
  private parameterExtractor: ParameterExtractor;
  private config: Required<ParserConfig>;

  constructor(config: ParserConfig = {}) {
    this.intentRecognizer = new IntentRecognizer();
    this.parameterExtractor = new ParameterExtractor();
    this.config = {
      defaultTimeout: config.defaultTimeout || 30000,
      defaultPriority: config.defaultPriority || 'normal',
      enableFuzzyMatching: config.enableFuzzyMatching ?? true,
      confidenceThreshold: config.confidenceThreshold || 0.3,
    };
  }

  /**
   * Parse user input into a command
   */
  parse(input: string, metadata: Partial<CommandMetadata> = {}): Command {
    // Trim and normalize input
    const normalizedInput = input.trim();
    if (!normalizedInput) {
      throw new Error('Empty command input');
    }

    // Recognize intent
    const intent = this.intentRecognizer.recognize(normalizedInput);

    // Check confidence threshold
    if (intent.confidence < this.config.confidenceThreshold) {
      // If fuzzy matching is enabled, try alternative approaches
      if (this.config.enableFuzzyMatching) {
        intent.primary = this.fuzzyMatch(normalizedInput) || 'unknown';
      }
    }

    // Extract parameters
    const parameters = this.parameterExtractor.extract(normalizedInput, intent.primary);

    // Extract options from parameters
    const options = this.extractOptions(parameters);

    // Build command object
    const command: Command = {
      id: nanoid(),
      intent,
      rawInput: normalizedInput,
      parameters: this.cleanParameters(parameters),
      options: {
        ...this.getDefaultOptions(),
        ...options,
      },
      metadata: {
        source: metadata.source || 'cli',
        ...metadata,
        tags: this.extractTags(normalizedInput, metadata.tags),
      },
      timestamp: new Date(),
    };

    return command;
  }

  /**
   * Parse multiple commands from input (for batch processing)
   */
  parseBatch(inputs: string[], metadata: Partial<CommandMetadata> = {}): Command[] {
    return inputs.map(input => this.parse(input, metadata));
  }

  /**
   * Try to parse a command with error recovery
   */
  tryParse(input: string, metadata: Partial<CommandMetadata> = {}): { command?: Command; error?: Error } {
    try {
      const command = this.parse(input, metadata);
      return { command };
    } catch (error) {
      return { error: error as Error };
    }
  }

  /**
   * Fuzzy match command intent
   */
  private fuzzyMatch(input: string): string | null {
    const normalizedInput = input.toLowerCase();

    // Common command aliases
    const aliases: Record<string, string> = {
      'open': 'file.read',
      'save': 'file.update',
      'build': 'code.generate',
      'fix': 'code.refactor',
      'test': 'code.analyze',
      'exec': 'tool.execute',
      'find': 'search.query',
      '?': 'help.request',
      'h': 'help.request',
    };

    // Check aliases
    for (const [alias, intent] of Object.entries(aliases)) {
      if (normalizedInput.startsWith(alias)) {
        return intent;
      }
    }

    // Check for common patterns
    if (normalizedInput.includes('file') || normalizedInput.includes('document')) {
      if (normalizedInput.includes('create') || normalizedInput.includes('new')) {
        return 'file.create';
      }
      if (normalizedInput.includes('read') || normalizedInput.includes('show')) {
        return 'file.read';
      }
    }

    if (normalizedInput.includes('help') || normalizedInput.startsWith('how')) {
      return 'help.request';
    }

    return null;
  }

  /**
   * Extract command options from parameters
   */
  private extractOptions(parameters: Record<string, any>): CommandOptions {
    const options: CommandOptions = {};

    // Check for async flag
    if (parameters.flags?.includes('--async') || parameters.flags?.includes('-a')) {
      options.async = true;
    }

    // Check for timeout option
    if (parameters.options?.timeout) {
      options.timeout = parseInt(parameters.options.timeout, 10);
    }

    // Check for priority
    if (parameters.options?.priority) {
      const priority = parameters.options.priority.toLowerCase();
      if (['low', 'normal', 'high'].includes(priority)) {
        options.priority = priority as 'low' | 'normal' | 'high';
      }
    }

    // Check for retry policy
    if (parameters.options?.retry) {
      const retryValue = parameters.options.retry;
      if (typeof retryValue === 'string') {
        const retryCount = parseInt(retryValue, 10);
        if (!isNaN(retryCount)) {
          options.retryPolicy = {
            maxAttempts: retryCount,
            backoffMs: 1000,
            exponentialBackoff: true,
          };
        }
      }
    }

    return options;
  }

  /**
   * Clean parameters by removing internal fields
   */
  private cleanParameters(parameters: Record<string, any>): Record<string, any> {
    const cleaned = { ...parameters };
    delete cleaned.flags;
    delete cleaned.options;
    return cleaned;
  }

  /**
   * Extract tags from input and merge with existing tags
   */
  private extractTags(input: string, existingTags: string[] = []): string[] {
    const tags = new Set(existingTags);

    // Extract hashtags
    const hashtagPattern = /#(\w+)/g;
    let match;
    while ((match = hashtagPattern.exec(input)) !== null) {
      tags.add(match[1].toLowerCase());
    }

    // Add intent-based tags
    const intent = this.intentRecognizer.recognize(input);
    if (intent.primary !== 'unknown') {
      const [category, action] = intent.primary.split('.');
      tags.add(category);
      if (action) tags.add(action);
    }

    return Array.from(tags);
  }

  /**
   * Get default command options
   */
  private getDefaultOptions(): CommandOptions {
    return {
      timeout: this.config.defaultTimeout,
      priority: this.config.defaultPriority,
    };
  }

  /**
   * Register custom intent pattern
   */
  registerIntent(intent: string, patterns: RegExp[], keywords: string[], priority: number = 10): void {
    this.intentRecognizer.registerIntent({
      intent,
      patterns,
      keywords,
      priority,
    });
  }

  /**
   * Register custom parameter extraction patterns
   */
  registerParameterPatterns(intent: string, patterns: Array<{
    name: string;
    pattern: RegExp;
    transform?: (value: string) => any;
  }>): void {
    this.parameterExtractor.registerPatterns(intent, patterns);
  }
}