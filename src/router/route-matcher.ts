import { Route } from '../types/command.types';

/**
 * Route match result
 */
export interface RouteMatch {
  route: Route;
  params: Record<string, string>;
  score: number;
}

/**
 * Route pattern type
 */
type RoutePattern = string | RegExp;

/**
 * Route matcher for matching commands to handlers
 */
export class RouteMatcher {
  private routes: Route[] = [];
  private compiledPatterns: Map<string, RegExp> = new Map();

  /**
   * Register a new route
   */
  register(route: Route): void {
    this.routes.push(route);
    
    // Compile string patterns to RegExp
    if (typeof route.pattern === 'string') {
      const compiled = this.compilePattern(route.pattern);
      this.compiledPatterns.set(route.pattern, compiled);
    }
  }

  /**
   * Register multiple routes
   */
  registerBatch(routes: Route[]): void {
    routes.forEach(route => this.register(route));
  }

  /**
   * Match intent to routes
   */
  match(intent: string): RouteMatch[] {
    const matches: RouteMatch[] = [];

    for (const route of this.routes) {
      const match = this.matchRoute(route, intent);
      if (match) {
        matches.push(match);
      }
    }

    // Sort by score (highest first)
    matches.sort((a, b) => b.score - a.score);

    return matches;
  }

  /**
   * Find the best matching route
   */
  findBest(intent: string): RouteMatch | null {
    const matches = this.match(intent);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Match a single route
   */
  private matchRoute(route: Route, intent: string): RouteMatch | null {
    let pattern: RegExp;
    let params: Record<string, string> = {};
    let score = 0;

    if (typeof route.pattern === 'string') {
      // String pattern
      pattern = this.compiledPatterns.get(route.pattern) || this.compilePattern(route.pattern);
      
      // Exact match gets highest score
      if (route.pattern === intent) {
        score = 100;
      } else {
        // Pattern match
        const match = intent.match(pattern);
        if (!match) return null;
        
        // Extract parameters
        params = this.extractParams(route.pattern, intent, match);
        score = 80 - (Object.keys(params).length * 5); // Deduct points for wildcards
      }
    } else {
      // RegExp pattern
      pattern = route.pattern;
      const match = intent.match(pattern);
      if (!match) return null;
      
      // Extract captured groups as parameters
      match.slice(1).forEach((value, index) => {
        if (value !== undefined) {
          params[`$${index + 1}`] = value;
        }
      });
      
      score = 70; // RegExp matches get medium score
    }

    return {
      route,
      params,
      score,
    };
  }

  /**
   * Compile string pattern to RegExp
   */
  private compilePattern(pattern: string): RegExp {
    // Replace wildcards with regex patterns
    let regexPattern = pattern
      .replace(/\*/g, '([^.]+)')  // * matches one segment
      .replace(/\*\*/g, '(.+)')   // ** matches multiple segments
      .replace(/:/g, '')          // Remove parameter markers
      .replace(/\./g, '\\.');     // Escape dots

    // Handle parameters like :param
    regexPattern = regexPattern.replace(/:(\w+)/g, '(?<$1>[^.]+)');

    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Extract parameters from pattern match
   */
  private extractParams(pattern: string, intent: string, match: RegExpMatchArray): Record<string, string> {
    const params: Record<string, string> = {};
    
    // Extract named parameters
    const paramPattern = /:(\w+)/g;
    const paramNames: string[] = [];
    let paramMatch;
    
    while ((paramMatch = paramPattern.exec(pattern)) !== null) {
      paramNames.push(paramMatch[1]);
    }

    // Map captured groups to parameter names
    paramNames.forEach((name, index) => {
      if (match[index + 1]) {
        params[name] = match[index + 1];
      }
    });

    // Also include named groups if using modern regex
    if (match.groups) {
      Object.assign(params, match.groups);
    }

    return params;
  }

  /**
   * Get all registered routes
   */
  getRoutes(): Route[] {
    return [...this.routes];
  }

  /**
   * Clear all routes
   */
  clear(): void {
    this.routes = [];
    this.compiledPatterns.clear();
  }

  /**
   * Remove a specific route
   */
  remove(pattern: RoutePattern): boolean {
    const initialLength = this.routes.length;
    this.routes = this.routes.filter(route => {
      if (typeof pattern === 'string' && typeof route.pattern === 'string') {
        return route.pattern !== pattern;
      }
      if (pattern instanceof RegExp && route.pattern instanceof RegExp) {
        return route.pattern.source !== pattern.source;
      }
      return true;
    });

    // Clean up compiled patterns
    if (typeof pattern === 'string') {
      this.compiledPatterns.delete(pattern);
    }

    return this.routes.length < initialLength;
  }

  /**
   * Check if a route exists
   */
  has(pattern: RoutePattern): boolean {
    return this.routes.some(route => {
      if (typeof pattern === 'string' && typeof route.pattern === 'string') {
        return route.pattern === pattern;
      }
      if (pattern instanceof RegExp && route.pattern instanceof RegExp) {
        return route.pattern.source === pattern.source;
      }
      return false;
    });
  }
}