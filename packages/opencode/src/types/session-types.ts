// Type definitions for session/index.ts

export interface EnhancedPrompt {
  content: string;
  metadata?: {
    techniques?: string[];
    [key: string]: unknown;
  };
}

export interface PromptMetadata {
  anthropic?: {
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
    [key: string]: unknown;
  };
  bedrock?: {
    usage?: {
      cacheWriteInputTokens?: number;
      cacheReadInputTokens?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}