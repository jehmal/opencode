// Command Parser Implementation

import {
  Command,
  ParsedCommand,
  Intent,
  IntentType,
  Entity,
  EntityType,
  CommandContext
} from './types';

export class CommandParser {
  private patterns: Map<IntentType, RegExp[]>;
  private entityExtractors: Map<EntityType, (text: string) => Entity[]>;

  constructor() {
    this.patterns = this.initializePatterns();
    this.entityExtractors = this.initializeEntityExtractors();
  }

  private initializePatterns(): Map<IntentType, RegExp[]> {
    return new Map([
      [IntentType.FILE_OPERATION, [
        /\b(create|edit|update|delete|remove|rename|move|copy)\s+(file|folder|directory)\b/i,
        /\b(open|close|save|read|write)\s+.*\.(ts|js|py|json|txt|md)/i,
        /\bedit\s+\S+\.(ts|js|py|json|txt|md)/i
      ]],
      [IntentType.CODE_GENERATION, [
        /\b(generate|create|implement|build|make)\s+(function|class|component|module|interface|type)/i,
        /\b(add|create)\s+.*\s+(handler|service|controller|model)/i,
        /\bimplement\s+\w+/i
      ]],
      [IntentType.ANALYSIS, [
        /\b(analyze|inspect|examine|review|check)\s+(code|file|function|class|project)/i,
        /\bfind\s+(issues|problems|bugs|errors)/i,
        /\b(refactor|optimize|improve)\s+/i
      ]],
      [IntentType.TESTING, [
        /\b(test|run\s+tests|execute\s+tests|check\s+tests)/i,
        /\b(unit\s+test|integration\s+test|e2e\s+test)/i,
        /\btest\s+(file|function|class|module)/i
      ]],
      [IntentType.DOCUMENTATION, [
        /\b(document|add\s+docs|write\s+documentation|generate\s+docs)/i,
        /\b(comment|add\s+comments|explain)\s+/i,
        /\bcreate\s+readme/i
      ]],
      [IntentType.SEARCH, [
        /\b(search|find|locate|look\s+for|grep)\s+/i,
        /\bwhere\s+is\s+/i,
        /\bshow\s+.*\s+(references|usages|definitions)/i
      ]],
      [IntentType.SYSTEM_COMMAND, [
        /\b(npm|yarn|pnpm|pip|git|docker)\s+/i,
        /\b(install|build|compile|deploy|push|pull|commit)/i,
        /\b(start|stop|restart|status)\s+/i
      ]],
      [IntentType.AGENT_TASK, [
        /\b(delegate|assign|handoff)\s+to\s+/i,
        /\buse\s+\w+\s+agent/i,
        /\b(complex|multi-step|analyze\s+and)\s+/i
      ]]
    ]);
  }

  private initializeEntityExtractors(): Map<EntityType, (text: string) => Entity[]> {
    return new Map([
      [EntityType.FILE_PATH, (text) => this.extractFilePaths(text)],
      [EntityType.CODE_SNIPPET, (text) => this.extractCodeSnippets(text)],
      [EntityType.COMMAND_FLAG, (text) => this.extractCommandFlags(text)],
      [EntityType.FUNCTION_NAME, (text) => this.extractFunctionNames(text)],
      [EntityType.CLASS_NAME, (text) => this.extractClassNames(text)],
      [EntityType.URL, (text) => this.extractUrls(text)]
    ]);
  }

  parse(command: Command, context: CommandContext): ParsedCommand {
    const intents = this.extractIntents(command.raw);
    const entities = this.extractEntities(command.raw);
    
    return {
      id: command.id,
      intents: this.rankIntents(intents),
      entities,
      context,
      originalCommand: command
    };
  }

  private extractIntents(text: string): Intent[] {
    const intents: Intent[] = [];
    
    for (const [intentType, patterns] of this.patterns) {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          const intent = this.createIntent(intentType, text, match);
          intents.push(intent);
        }
      }
    }

    // If no specific intent found, classify as unknown
    if (intents.length === 0) {
      intents.push({
        type: IntentType.UNKNOWN,
        confidence: 0.1,
        action: 'unknown',
        parameters: { raw: text }
      });
    }

    return intents;
  }

  private createIntent(type: IntentType, text: string, match: RegExpMatchArray): Intent {
    const action = this.extractAction(type, match);
    const parameters = this.extractParameters(type, text, match);
    const confidence = this.calculateConfidence(type, text, match);

    return {
      type,
      confidence,
      action,
      parameters
    };
  }

  private extractAction(type: IntentType, match: RegExpMatchArray): string {
    // Extract the main action verb from the match
    switch (type) {
      case IntentType.FILE_OPERATION:
        return match[1]?.toLowerCase() || 'edit';
      case IntentType.CODE_GENERATION:
        return match[1]?.toLowerCase() || 'generate';
      case IntentType.TESTING:
        return 'test';
      case IntentType.ANALYSIS:
        return match[1]?.toLowerCase() || 'analyze';
      default:
        return match[0]?.split(' ')[0].toLowerCase() || 'unknown';
    }
  }

  private extractParameters(
    type: IntentType,
    text: string,
    match: RegExpMatchArray
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    switch (type) {
      case IntentType.FILE_OPERATION:
        params.operation = match[1]?.toLowerCase();
        params.targetType = match[2]?.toLowerCase();
        // Extract file path if present
        const fileMatch = text.match(/\S+\.(ts|js|py|json|txt|md)/);
        if (fileMatch) {
          params.filePath = fileMatch[0];
        }
        break;

      case IntentType.CODE_GENERATION:
        params.generateType = match[2]?.toLowerCase();
        // Extract name if present
        const nameMatch = text.match(/\b(function|class|component)\s+(\w+)/i);
        if (nameMatch) {
          params.name = nameMatch[2];
        }
        break;

      case IntentType.TESTING:
        const testMatch = text.match(/test\s+(\S+)/i);
        if (testMatch) {
          params.target = testMatch[1];
        }
        break;

      case IntentType.SYSTEM_COMMAND:
        const cmdMatch = text.match(/\b(npm|yarn|git|docker)\s+(.*)/i);
        if (cmdMatch) {
          params.command = cmdMatch[1];
          params.args = cmdMatch[2].split(' ');
        }
        break;
    }

    return params;
  }

  private calculateConfidence(
    type: IntentType,
    text: string,
    match: RegExpMatchArray
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on match quality
    if (match[0].length > text.length * 0.3) {
      confidence += 0.2;
    }

    // Increase confidence for specific intent types
    if (type === IntentType.FILE_OPERATION && text.includes('.')) {
      confidence += 0.1;
    }

    if (type === IntentType.SYSTEM_COMMAND && match[1]) {
      confidence += 0.2;
    }

    // Cap confidence at 0.95
    return Math.min(confidence, 0.95);
  }

  private rankIntents(intents: Intent[]): Intent[] {
    return intents.sort((a, b) => b.confidence - a.confidence);
  }

  private extractEntities(text: string): Entity[] {
    const entities: Entity[] = [];

    for (const [entityType, extractor] of this.entityExtractors) {
      const extracted = extractor(text);
      entities.push(...extracted);
    }

    return entities;
  }

  private extractFilePaths(text: string): Entity[] {
    const entities: Entity[] = [];
    const filePathPattern = /\b[\w\-\/\\]+\.(ts|js|py|json|txt|md|tsx|jsx|css|scss|html)\b/g;
    
    let match;
    while ((match = filePathPattern.exec(text)) !== null) {
      entities.push({
        type: EntityType.FILE_PATH,
        value: match[0],
        position: [match.index, match.index + match[0].length]
      });
    }

    return entities;
  }

  private extractCodeSnippets(text: string): Entity[] {
    const entities: Entity[] = [];
    const codePattern = /```[\s\S]*?```/g;
    
    let match;
    while ((match = codePattern.exec(text)) !== null) {
      entities.push({
        type: EntityType.CODE_SNIPPET,
        value: match[0],
        position: [match.index, match.index + match[0].length]
      });
    }

    return entities;
  }

  private extractCommandFlags(text: string): Entity[] {
    const entities: Entity[] = [];
    const flagPattern = /\s(-{1,2}[\w-]+)(?:\s+|$)/g;
    
    let match;
    while ((match = flagPattern.exec(text)) !== null) {
      entities.push({
        type: EntityType.COMMAND_FLAG,
        value: match[1],
        position: [match.index + 1, match.index + 1 + match[1].length]
      });
    }

    return entities;
  }

  private extractFunctionNames(text: string): Entity[] {
    const entities: Entity[] = [];
    const functionPattern = /\b(function|def|func)\s+(\w+)/g;
    
    let match;
    while ((match = functionPattern.exec(text)) !== null) {
      entities.push({
        type: EntityType.FUNCTION_NAME,
        value: match[2],
        position: [match.index + match[1].length + 1, match.index + match[0].length]
      });
    }

    return entities;
  }

  private extractClassNames(text: string): Entity[] {
    const entities: Entity[] = [];
    const classPattern = /\b(class|interface|type)\s+(\w+)/g;
    
    let match;
    while ((match = classPattern.exec(text)) !== null) {
      entities.push({
        type: EntityType.CLASS_NAME,
        value: match[2],
        position: [match.index + match[1].length + 1, match.index + match[0].length]
      });
    }

    return entities;
  }

  private extractUrls(text: string): Entity[] {
    const entities: Entity[] = [];
    const urlPattern = /https?:\/\/[^\s]+/g;
    
    let match;
    while ((match = urlPattern.exec(text)) !== null) {
      entities.push({
        type: EntityType.URL,
        value: match[0],
        position: [match.index, match.index + match[0].length]
      });
    }

    return entities;
  }
}