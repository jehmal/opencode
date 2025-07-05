import { Command, Route, Middleware } from '../types/command.types';
import { RouteMatcher, RouteMatch } from './route-matcher';

/**
 * Router configuration
 */
export interface RouterConfig {
  caseSensitive?: boolean;
  strict?: boolean;
  fallbackHandler?: string;
}

/**
 * Router event types
 */
export type RouterEvent = 
  | { type: 'route.matched'; route: Route; command: Command }
  | { type: 'route.notfound'; command: Command }
  | { type: 'middleware.start'; middleware: string; command: Command }
  | { type: 'middleware.complete'; middleware: string; command: Command }
  | { type: 'middleware.error'; middleware: string; command: Command; error: Error };

/**
 * Command router for routing commands to handlers
 */
export class CommandRouter {
  private matcher: RouteMatcher;
  private middleware: Map<string, Middleware> = new Map();
  private config: Required<RouterConfig>;
  private eventHandlers: Map<string, Set<(event: RouterEvent) => void>> = new Map();

  constructor(config: RouterConfig = {}) {
    this.matcher = new RouteMatcher();
    this.config = {
      caseSensitive: config.caseSensitive ?? false,
      strict: config.strict ?? false,
      fallbackHandler: config.fallbackHandler || 'defaultHandler',
    };
  }

  /**
   * Register a route
   */
  route(pattern: string | RegExp, handler: string, options: Partial<Route> = {}): this {
    const route: Route = {
      pattern,
      handler,
      middleware: options.middleware || [],
      description: options.description,
      examples: options.examples,
    };

    this.matcher.register(route);
    return this;
  }

  /**
   * Register multiple routes
   */
  routes(routes: Route[]): this {
    this.matcher.registerBatch(routes);
    return this;
  }

  /**
   * Register middleware
   */
  use(middleware: Middleware): this {
    this.middleware.set(middleware.name, middleware);
    return this;
  }

  /**
   * Find matching route for a command
   */
  async resolve(command: Command): Promise<RouteMatch | null> {
    const intent = this.normalizeIntent(command.intent.primary);
    
    // Emit route matching start
    this.emit({ type: 'route.matched', route: null as any, command });

    // Find best matching route
    const match = this.matcher.findBest(intent);

    if (match) {
      // Emit route matched event
      this.emit({ type: 'route.matched', route: match.route, command });
      return match;
    }

    // Emit route not found event
    this.emit({ type: 'route.notfound', command });

    // Return fallback if configured
    if (this.config.fallbackHandler) {
      return {
        route: {
          pattern: '*',
          handler: this.config.fallbackHandler,
          middleware: [],
        },
        params: {},
        score: 0,
      };
    }

    return null;
  }

  /**
   * Execute middleware chain
   */
  async executeMiddleware(
    command: Command,
    middlewareNames: string[],
    finalHandler: () => Promise<any>
  ): Promise<any> {
    let index = 0;

    const next = async (): Promise<any> => {
      if (index >= middlewareNames.length) {
        return finalHandler();
      }

      const middlewareName = middlewareNames[index++];
      const middleware = this.middleware.get(middlewareName);

      if (!middleware) {
        throw new Error(`Middleware not found: ${middlewareName}`);
      }

      // Emit middleware start event
      this.emit({ type: 'middleware.start', middleware: middlewareName, command });

      try {
        const result = await middleware.execute(command, next);
        
        // Emit middleware complete event
        this.emit({ type: 'middleware.complete', middleware: middlewareName, command });
        
        return result;
      } catch (error) {
        // Emit middleware error event
        this.emit({ 
          type: 'middleware.error', 
          middleware: middlewareName, 
          command, 
          error: error as Error 
        });
        throw error;
      }
    };

    return next();
  }

  /**
   * Get all routes
   */
  getRoutes(): Route[] {
    return this.matcher.getRoutes();
  }

  /**
   * Get route by pattern
   */
  getRoute(pattern: string | RegExp): Route | undefined {
    return this.getRoutes().find(route => {
      if (typeof pattern === 'string' && typeof route.pattern === 'string') {
        return route.pattern === pattern;
      }
      if (pattern instanceof RegExp && route.pattern instanceof RegExp) {
        return route.pattern.source === pattern.source;
      }
      return false;
    });
  }

  /**
   * Remove a route
   */
  removeRoute(pattern: string | RegExp): boolean {
    return this.matcher.remove(pattern);
  }

  /**
   * Clear all routes
   */
  clearRoutes(): void {
    this.matcher.clear();
  }

  /**
   * Get middleware by name
   */
  getMiddleware(name: string): Middleware | undefined {
    return this.middleware.get(name);
  }

  /**
   * Remove middleware
   */
  removeMiddleware(name: string): boolean {
    return this.middleware.delete(name);
  }

  /**
   * Clear all middleware
   */
  clearMiddleware(): void {
    this.middleware.clear();
  }

  /**
   * Subscribe to router events
   */
  on(event: RouterEvent['type'], handler: (event: RouterEvent) => void): this {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return this;
  }

  /**
   * Unsubscribe from router events
   */
  off(event: RouterEvent['type'], handler: (event: RouterEvent) => void): this {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
    return this;
  }

  /**
   * Emit router event
   */
  private emit(event: RouterEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }

  /**
   * Normalize intent based on router config
   */
  private normalizeIntent(intent: string): string {
    let normalized = intent;

    if (!this.config.caseSensitive) {
      normalized = normalized.toLowerCase();
    }

    if (this.config.strict) {
      // Remove trailing dots in strict mode
      normalized = normalized.replace(/\.$/, '');
    }

    return normalized;
  }

  /**
   * Create a sub-router with a prefix
   */
  createSubRouter(prefix: string): SubRouter {
    return new SubRouter(this, prefix);
  }
}

/**
 * Sub-router for namespaced routes
 */
export class SubRouter {
  constructor(
    private parent: CommandRouter,
    private prefix: string
  ) {}

  /**
   * Register a route with prefix
   */
  route(pattern: string, handler: string, options: Partial<Route> = {}): this {
    const prefixedPattern = `${this.prefix}.${pattern}`;
    this.parent.route(prefixedPattern, handler, options);
    return this;
  }

  /**
   * Register multiple routes with prefix
   */
  routes(routes: Route[]): this {
    const prefixedRoutes = routes.map(route => ({
      ...route,
      pattern: typeof route.pattern === 'string' 
        ? `${this.prefix}.${route.pattern}`
        : route.pattern,
    }));
    this.parent.routes(prefixedRoutes);
    return this;
  }
}