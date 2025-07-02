import { PerformanceTracker } from '@opencode/dgm-integration';
import type { Tool } from './tool';
import { Config } from '../config/config';
import { Log } from '../util/log';

/**
 * Wraps a tool with performance tracking capabilities
 * Uses decorator pattern to preserve original functionality
 */
export class PerformanceWrapper {
  private static log = Log.create({ service: 'performance-wrapper' });
  
  /**
   * Wraps a tool's execute function with performance tracking
   * @param tool The tool to wrap
   * @param tracker The performance tracker instance
   * @returns The wrapped tool
   */
  static wrap<T extends Tool.Info>(
    tool: T,
    tracker: PerformanceTracker
  ): T {
    const originalExecute = tool.execute;
    
    // Create wrapped execute function
    const wrappedExecute: typeof tool.execute = async (args, ctx) => {
      const config = await Config.get();
      
      // If performance tracking is disabled, use original function
      if (!config.performance?.enabled) {
        return originalExecute(args, ctx);
      }
      
      // Start performance tracking
      const metric = tracker.startOperation('tool-execution', {
        toolId: tool.id,
        sessionId: ctx.sessionID,
        messageId: ctx.messageID,
        args: JSON.stringify(args).length > 100 
          ? 'large-args' 
          : JSON.stringify(args)
      });
      
      try {
        // Execute original tool
        const result = await originalExecute(args, ctx);
        
        // End tracking with success
        const duration = metric.end();
        
        // Log performance data
        PerformanceWrapper.log.info('tool execution completed', {
          toolId: tool.id,
          duration,
          success: true
        });
        
        // Add performance metadata to result
        return {
          ...result,
          metadata: {
            ...result.metadata,
            performance: {
              duration,
              timestamp: Date.now()
            }
          }
        };
      } catch (error) {
        // End tracking with failure
        const duration = metric.end();
        
        PerformanceWrapper.log.error('tool execution failed', {
          toolId: tool.id,
          duration,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Re-throw to preserve error handling
        throw error;
      }
    };
    
    // Return tool with wrapped execute
    return {
      ...tool,
      execute: wrappedExecute
    };
  }
  
  /**
   * Wraps multiple tools with performance tracking
   * @param tools Array of tools to wrap
   * @param tracker The performance tracker instance
   * @returns Array of wrapped tools
   */
  static wrapAll<T extends Tool.Info>(
    tools: T[],
    tracker: PerformanceTracker
  ): T[] {
    return tools.map(tool => PerformanceWrapper.wrap(tool, tracker));
  }
}