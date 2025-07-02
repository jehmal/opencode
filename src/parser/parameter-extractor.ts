/**
 * Parameter extraction patterns
 */
interface ExtractionPattern {
  name: string;
  pattern: RegExp;
  transform?: (value: string) => any;
}

/**
 * Parameter extractor for parsing command parameters from user input
 */
export class ParameterExtractor {
  private patterns: Map<string, ExtractionPattern[]> = new Map();

  constructor() {
    this.registerDefaultPatterns();
  }

  /**
   * Register default extraction patterns
   */
  private registerDefaultPatterns(): void {
    // File operations patterns
    this.registerPatterns('file.create', [
      {
        name: 'filename',
        pattern: /(?:create|new|touch)\s+(?:file\s+)?([^\s]+)$/i,
        transform: (value) => value.trim(),
      },
      {
        name: 'content',
        pattern: /with\s+content\s+["'](.+)["']$/i,
        transform: (value) => value,
      },
    ]);

    this.registerPatterns('file.read', [
      {
        name: 'filename',
        pattern: /(?:read|show|display|cat|view)\s+(?:file\s+)?([^\s]+)$/i,
        transform: (value) => value.trim(),
      },
      {
        name: 'lines',
        pattern: /(?:first|last)\s+(\d+)\s+lines?/i,
        transform: (value) => parseInt(value, 10),
      },
    ]);

    this.registerPatterns('file.update', [
      {
        name: 'filename',
        pattern: /(?:update|edit|modify)\s+(?:file\s+)?([^\s]+)/i,
        transform: (value) => value.trim(),
      },
      {
        name: 'content',
        pattern: /(?:set|change)\s+content\s+to\s+["'](.+)["']$/i,
        transform: (value) => value,
      },
      {
        name: 'lineNumber',
        pattern: /line\s+(\d+)/i,
        transform: (value) => parseInt(value, 10),
      },
    ]);

    // Code generation patterns
    this.registerPatterns('code.generate', [
      {
        name: 'type',
        pattern: /generate\s+(function|class|component|interface|enum)\s+/i,
        transform: (value) => value.toLowerCase(),
      },
      {
        name: 'name',
        pattern: /(?:function|class|component|interface|enum)\s+([A-Za-z_]\w*)/i,
        transform: (value) => value,
      },
      {
        name: 'language',
        pattern: /in\s+(typescript|javascript|python|java|go|rust)/i,
        transform: (value) => value.toLowerCase(),
      },
      {
        name: 'description',
        pattern: /(?:that|which)\s+(.+)$/i,
        transform: (value) => value.trim(),
      },
    ]);

    // Tool execution patterns
    this.registerPatterns('tool.execute', [
      {
        name: 'toolName',
        pattern: /(?:run|execute|call|use)\s+(?:tool\s+)?([^\s]+)/i,
        transform: (value) => value.trim(),
      },
      {
        name: 'args',
        pattern: /with\s+(?:args|arguments|params)\s+(.+)$/i,
        transform: (value) => this.parseArgs(value),
      },
    ]);

    // Search patterns
    this.registerPatterns('search.query', [
      {
        name: 'query',
        pattern: /(?:search|find|lookup|query)\s+(?:for\s+)?(.+)$/i,
        transform: (value) => value.trim(),
      },
      {
        name: 'scope',
        pattern: /in\s+(files|code|documentation|all)/i,
        transform: (value) => value.toLowerCase(),
      },
      {
        name: 'filter',
        pattern: /(?:where|filter)\s+(.+)$/i,
        transform: (value) => this.parseFilter(value),
      },
    ]);

    // Configuration patterns
    this.registerPatterns('system.configure', [
      {
        name: 'setting',
        pattern: /(?:configure|config|set)\s+([^\s]+)/i,
        transform: (value) => value.trim(),
      },
      {
        name: 'value',
        pattern: /(?:to|=)\s+(.+)$/i,
        transform: (value) => this.parseValue(value),
      },
    ]);
  }

  /**
   * Register extraction patterns for an intent
   */
  registerPatterns(intent: string, patterns: ExtractionPattern[]): void {
    this.patterns.set(intent, patterns);
  }

  /**
   * Extract parameters from input based on intent
   */
  extract(input: string, intent: string): Record<string, any> {
    const patterns = this.patterns.get(intent) || [];
    const parameters: Record<string, any> = {};

    // Extract common parameters
    parameters.flags = this.extractFlags(input);
    parameters.options = this.extractOptions(input);

    // Extract intent-specific parameters
    for (const pattern of patterns) {
      const match = input.match(pattern.pattern);
      if (match && match[1]) {
        const value = pattern.transform ? pattern.transform(match[1]) : match[1];
        parameters[pattern.name] = value;
      }
    }

    // Extract quoted strings
    const quotedStrings = this.extractQuotedStrings(input);
    if (quotedStrings.length > 0 && !parameters.content && !parameters.query) {
      parameters.quotedStrings = quotedStrings;
    }

    // Extract numbers
    const numbers = this.extractNumbers(input);
    if (numbers.length > 0 && !parameters.lineNumber && !parameters.lines) {
      parameters.numbers = numbers;
    }

    // Extract paths
    const paths = this.extractPaths(input);
    if (paths.length > 0 && !parameters.filename) {
      parameters.paths = paths;
    }

    return parameters;
  }

  /**
   * Extract command flags (e.g., -v, --verbose)
   */
  private extractFlags(input: string): string[] {
    const flagPattern = /(?:^|\s)(-[a-zA-Z]|--[a-zA-Z-]+)(?=\s|$)/g;
    const flags: string[] = [];
    let match;

    while ((match = flagPattern.exec(input)) !== null) {
      flags.push(match[1]);
    }

    return flags;
  }

  /**
   * Extract command options (e.g., --timeout=5000)
   */
  private extractOptions(input: string): Record<string, string> {
    const optionPattern = /(?:^|\s)(--[a-zA-Z-]+)=([^\s]+)/g;
    const options: Record<string, string> = {};
    let match;

    while ((match = optionPattern.exec(input)) !== null) {
      options[match[1].substring(2)] = match[2];
    }

    return options;
  }

  /**
   * Extract quoted strings
   */
  private extractQuotedStrings(input: string): string[] {
    const quotedPattern = /["']([^"']+)["']/g;
    const strings: string[] = [];
    let match;

    while ((match = quotedPattern.exec(input)) !== null) {
      strings.push(match[1]);
    }

    return strings;
  }

  /**
   * Extract numbers
   */
  private extractNumbers(input: string): number[] {
    const numberPattern = /\b(\d+(?:\.\d+)?)\b/g;
    const numbers: number[] = [];
    let match;

    while ((match = numberPattern.exec(input)) !== null) {
      numbers.push(parseFloat(match[1]));
    }

    return numbers;
  }

  /**
   * Extract file paths
   */
  private extractPaths(input: string): string[] {
    const pathPattern = /(?:^|\s)([.\/~][^\s]*)/g;
    const paths: string[] = [];
    let match;

    while ((match = pathPattern.exec(input)) !== null) {
      paths.push(match[1]);
    }

    return paths;
  }

  /**
   * Parse arguments string into array or object
   */
  private parseArgs(argsString: string): any {
    try {
      // Try to parse as JSON
      return JSON.parse(argsString);
    } catch {
      // Split by comma or space
      return argsString.split(/[,\s]+/).filter(arg => arg.length > 0);
    }
  }

  /**
   * Parse filter string into object
   */
  private parseFilter(filterString: string): Record<string, any> {
    const filter: Record<string, any> = {};
    const conditions = filterString.split(/\s+and\s+/i);

    for (const condition of conditions) {
      const match = condition.match(/(\w+)\s*(=|!=|>|<|>=|<=|contains|matches)\s*(.+)/i);
      if (match) {
        const [, field, operator, value] = match;
        filter[field] = { operator, value: this.parseValue(value) };
      }
    }

    return filter;
  }

  /**
   * Parse value string into appropriate type
   */
  private parseValue(value: string): any {
    // Remove quotes if present
    const trimmed = value.trim().replace(/^["']|["']$/g, '');

    // Boolean
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;

    // Number
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);

    // Array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Fall through to string
      }
    }

    // Object
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Fall through to string
      }
    }

    return trimmed;
  }
}