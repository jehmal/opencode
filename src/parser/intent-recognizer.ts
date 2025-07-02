import { CommandIntent } from '../types/command.types';

/**
 * Intent pattern definition
 */
interface IntentPattern {
  intent: string;
  patterns: RegExp[];
  keywords: string[];
  priority: number;
}

/**
 * Intent recognizer for extracting command intent from user input
 */
export class IntentRecognizer {
  private intents: Map<string, IntentPattern> = new Map();

  constructor() {
    this.registerDefaultIntents();
  }

  /**
   * Register default intent patterns
   */
  private registerDefaultIntents(): void {
    // File operations
    this.registerIntent({
      intent: 'file.create',
      patterns: [
        /^create\s+(file|document)\s+(.+)$/i,
        /^new\s+(file|document)\s+(.+)$/i,
        /^touch\s+(.+)$/i,
      ],
      keywords: ['create', 'new', 'make', 'touch', 'file'],
      priority: 10,
    });

    this.registerIntent({
      intent: 'file.read',
      patterns: [
        /^(read|show|display|cat|view)\s+(file\s+)?(.+)$/i,
        /^get\s+contents?\s+of\s+(.+)$/i,
      ],
      keywords: ['read', 'show', 'display', 'cat', 'view', 'get', 'contents'],
      priority: 10,
    });

    this.registerIntent({
      intent: 'file.update',
      patterns: [
        /^(update|edit|modify)\s+(file\s+)?(.+)$/i,
        /^change\s+(.+)\s+to\s+(.+)$/i,
      ],
      keywords: ['update', 'edit', 'modify', 'change', 'write'],
      priority: 10,
    });

    this.registerIntent({
      intent: 'file.delete',
      patterns: [
        /^(delete|remove|rm)\s+(file\s+)?(.+)$/i,
        /^destroy\s+(.+)$/i,
      ],
      keywords: ['delete', 'remove', 'rm', 'destroy', 'unlink'],
      priority: 10,
    });

    // Code operations
    this.registerIntent({
      intent: 'code.generate',
      patterns: [
        /^generate\s+(code|function|class|component)\s+(.+)$/i,
        /^create\s+(function|class|component)\s+(.+)$/i,
        /^implement\s+(.+)$/i,
      ],
      keywords: ['generate', 'create', 'implement', 'build', 'code'],
      priority: 15,
    });

    this.registerIntent({
      intent: 'code.refactor',
      patterns: [
        /^refactor\s+(.+)$/i,
        /^improve\s+(code|function|class)\s+(.+)$/i,
        /^optimize\s+(.+)$/i,
      ],
      keywords: ['refactor', 'improve', 'optimize', 'clean', 'restructure'],
      priority: 15,
    });

    this.registerIntent({
      intent: 'code.analyze',
      patterns: [
        /^analyze\s+(.+)$/i,
        /^check\s+(code|function|class)\s+(.+)$/i,
        /^review\s+(.+)$/i,
      ],
      keywords: ['analyze', 'check', 'review', 'inspect', 'examine'],
      priority: 15,
    });

    // Tool operations
    this.registerIntent({
      intent: 'tool.execute',
      patterns: [
        /^(run|execute|call)\s+tool\s+(.+)$/i,
        /^use\s+(.+)\s+tool$/i,
      ],
      keywords: ['run', 'execute', 'call', 'use', 'tool'],
      priority: 20,
    });

    // Search operations
    this.registerIntent({
      intent: 'search.query',
      patterns: [
        /^(search|find|lookup|query)\s+(.+)$/i,
        /^what\s+(is|are)\s+(.+)$/i,
        /^where\s+(is|are)\s+(.+)$/i,
      ],
      keywords: ['search', 'find', 'lookup', 'query', 'what', 'where'],
      priority: 5,
    });

    // Help operations
    this.registerIntent({
      intent: 'help.request',
      patterns: [
        /^help(\s+(.+))?$/i,
        /^how\s+(to|do\s+I)\s+(.+)$/i,
        /^what\s+can\s+(you|I)\s+do$/i,
      ],
      keywords: ['help', 'how', 'what', 'guide', 'assist'],
      priority: 1,
    });

    // System operations
    this.registerIntent({
      intent: 'system.status',
      patterns: [
        /^(status|health|check)$/i,
        /^system\s+(status|health)$/i,
      ],
      keywords: ['status', 'health', 'check', 'system'],
      priority: 5,
    });

    this.registerIntent({
      intent: 'system.configure',
      patterns: [
        /^(configure|config|set)\s+(.+)$/i,
        /^change\s+setting\s+(.+)$/i,
      ],
      keywords: ['configure', 'config', 'set', 'setting', 'preference'],
      priority: 10,
    });
  }

  /**
   * Register a new intent pattern
   */
  registerIntent(pattern: IntentPattern): void {
    this.intents.set(pattern.intent, pattern);
  }

  /**
   * Recognize intent from user input
   */
  recognize(input: string): CommandIntent {
    const normalizedInput = input.trim().toLowerCase();
    const candidates: Array<{ intent: string; score: number }> = [];

    // Check each registered intent
    for (const [intentName, pattern] of this.intents) {
      let score = 0;

      // Check regex patterns
      for (const regex of pattern.patterns) {
        if (regex.test(input)) {
          score += 50 + pattern.priority;
          break;
        }
      }

      // Check keyword matches
      const keywordMatches = pattern.keywords.filter(keyword =>
        normalizedInput.includes(keyword.toLowerCase())
      ).length;
      score += keywordMatches * 10;

      if (score > 0) {
        candidates.push({ intent: intentName, score });
      }
    }

    // Sort by score
    candidates.sort((a, b) => b.score - a.score);

    // Calculate confidence
    const topScore = candidates[0]?.score || 0;
    const confidence = Math.min(topScore / 100, 1);

    // Get alternative intents
    const alternativeIntents = candidates.slice(1, 4).map(c => ({
      intent: c.intent,
      confidence: Math.min(c.score / 100, 1),
    }));

    // If no intent found, default to unknown
    if (candidates.length === 0) {
      return {
        primary: 'unknown',
        confidence: 0,
        alternativeIntents: [],
      };
    }

    return {
      primary: candidates[0].intent,
      confidence,
      alternativeIntents,
    };
  }

  /**
   * Get all registered intents
   */
  getRegisteredIntents(): string[] {
    return Array.from(this.intents.keys());
  }

  /**
   * Clear all registered intents
   */
  clearIntents(): void {
    this.intents.clear();
  }
}