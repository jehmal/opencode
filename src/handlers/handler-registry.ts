import { CommandHandler } from '../types/command.types';

/**
 * Handler metadata
 */
export interface HandlerMetadata {
  name: string;
  description?: string;
  tags?: string[];
  version?: string;
  capabilities?: string[];
  dependencies?: string[];
}

/**
 * Handler registration entry
 */
interface HandlerEntry {
  handler: CommandHandler;
  metadata: HandlerMetadata;
  enabled: boolean;
}

/**
 * Handler registry for managing command handlers
 */
export class HandlerRegistry {
  private handlers: Map<string, HandlerEntry> = new Map();
  private aliases: Map<string, string> = new Map();

  /**
   * Register a command handler
   */
  register(handler: CommandHandler, metadata?: Partial<HandlerMetadata>): void {
    const fullMetadata: HandlerMetadata = {
      name: handler.name,
      description: handler.description,
      ...metadata,
    };

    this.handlers.set(handler.name, {
      handler,
      metadata: fullMetadata,
      enabled: true,
    });
  }

  /**
   * Register multiple handlers
   */
  registerBatch(handlers: CommandHandler[]): void {
    handlers.forEach(handler => this.register(handler));
  }

  /**
   * Register a handler alias
   */
  alias(alias: string, handlerName: string): void {
    if (!this.handlers.has(handlerName)) {
      throw new Error(`Handler not found: ${handlerName}`);
    }
    this.aliases.set(alias, handlerName);
  }

  /**
   * Get a handler by name
   */
  get(name: string): CommandHandler | undefined {
    // Check aliases first
    const actualName = this.aliases.get(name) || name;
    const entry = this.handlers.get(actualName);
    
    if (entry && entry.enabled) {
      return entry.handler;
    }
    
    return undefined;
  }

  /**
   * Check if a handler exists
   */
  has(name: string): boolean {
    const actualName = this.aliases.get(name) || name;
    const entry = this.handlers.get(actualName);
    return entry !== undefined && entry.enabled;
  }

  /**
   * Get handler metadata
   */
  getMetadata(name: string): HandlerMetadata | undefined {
    const actualName = this.aliases.get(name) || name;
    const entry = this.handlers.get(actualName);
    return entry?.metadata;
  }

  /**
   * Enable a handler
   */
  enable(name: string): boolean {
    const entry = this.handlers.get(name);
    if (entry) {
      entry.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable a handler
   */
  disable(name: string): boolean {
    const entry = this.handlers.get(name);
    if (entry) {
      entry.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * Remove a handler
   */
  remove(name: string): boolean {
    // Remove aliases pointing to this handler
    for (const [alias, target] of this.aliases.entries()) {
      if (target === name) {
        this.aliases.delete(alias);
      }
    }
    
    return this.handlers.delete(name);
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.aliases.clear();
  }

  /**
   * List all registered handlers
   */
  list(): HandlerMetadata[] {
    return Array.from(this.handlers.values())
      .filter(entry => entry.enabled)
      .map(entry => entry.metadata);
  }

  /**
   * Search handlers by criteria
   */
  search(criteria: {
    tags?: string[];
    capabilities?: string[];
    namePattern?: RegExp;
  }): HandlerMetadata[] {
    return this.list().filter(metadata => {
      // Check tags
      if (criteria.tags && criteria.tags.length > 0) {
        const metaTags = metadata.tags || [];
        const hasAllTags = criteria.tags.every(tag => metaTags.includes(tag));
        if (!hasAllTags) return false;
      }

      // Check capabilities
      if (criteria.capabilities && criteria.capabilities.length > 0) {
        const metaCaps = metadata.capabilities || [];
        const hasAllCaps = criteria.capabilities.every(cap => metaCaps.includes(cap));
        if (!hasAllCaps) return false;
      }

      // Check name pattern
      if (criteria.namePattern) {
        if (!criteria.namePattern.test(metadata.name)) return false;
      }

      return true;
    });
  }

  /**
   * Get handler dependencies
   */
  getDependencies(name: string): string[] {
    const metadata = this.getMetadata(name);
    if (!metadata || !metadata.dependencies) {
      return [];
    }

    const allDeps = new Set<string>();
    const toProcess = [...metadata.dependencies];

    while (toProcess.length > 0) {
      const dep = toProcess.pop()!;
      if (!allDeps.has(dep)) {
        allDeps.add(dep);
        
        // Add transitive dependencies
        const depMeta = this.getMetadata(dep);
        if (depMeta && depMeta.dependencies) {
          toProcess.push(...depMeta.dependencies);
        }
      }
    }

    return Array.from(allDeps);
  }

  /**
   * Validate handler dependencies
   */
  validateDependencies(name: string): { valid: boolean; missing: string[] } {
    const deps = this.getDependencies(name);
    const missing = deps.filter(dep => !this.has(dep));
    
    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Get handlers by capability
   */
  getByCapability(capability: string): HandlerMetadata[] {
    return this.list().filter(metadata => 
      metadata.capabilities?.includes(capability) || false
    );
  }

  /**
   * Get handlers by tag
   */
  getByTag(tag: string): HandlerMetadata[] {
    return this.list().filter(metadata => 
      metadata.tags?.includes(tag) || false
    );
  }

  /**
   * Export registry state
   */
  export(): {
    handlers: Array<{ name: string; metadata: HandlerMetadata; enabled: boolean }>;
    aliases: Array<{ alias: string; target: string }>;
  } {
    return {
      handlers: Array.from(this.handlers.entries()).map(([name, entry]) => ({
        name,
        metadata: entry.metadata,
        enabled: entry.enabled,
      })),
      aliases: Array.from(this.aliases.entries()).map(([alias, target]) => ({
        alias,
        target,
      })),
    };
  }

  /**
   * Import registry state
   */
  import(data: {
    handlers: Array<{ name: string; metadata: HandlerMetadata; enabled: boolean }>;
    aliases: Array<{ alias: string; target: string }>;
  }): void {
    // Note: This only imports metadata, not actual handler implementations
    // Handlers must be re-registered with their implementations
    data.aliases.forEach(({ alias, target }) => {
      if (this.handlers.has(target)) {
        this.aliases.set(alias, target);
      }
    });
  }
}