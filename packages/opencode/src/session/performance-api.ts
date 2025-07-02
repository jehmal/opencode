import { z } from 'zod';
import { SessionPerformance } from './performance';
import { Session } from './index';
import type { PerformanceReport } from '@opencode/dgm-integration';

/**
 * API endpoints for performance data
 */
export namespace PerformanceAPI {
  
  /**
   * Get performance report for a session
   */
  export const GetReportSchema = z.object({
    sessionId: z.string().describe('Session ID to get performance report for')
  });
  
  export async function getReport(params: z.infer<typeof GetReportSchema>): Promise<PerformanceReport | null> {
    // Verify session exists
    await Session.get(params.sessionId);
    
    // Try to get live report first
    let report = SessionPerformance.getReport(params.sessionId);
    
    // If no live report, try to load from storage
    if (!report) {
      report = await SessionPerformance.loadReport(params.sessionId);
    }
    
    return report;
  }
  
  /**
   * Get operation-specific stats
   */
  export const GetOperationStatsSchema = z.object({
    sessionId: z.string().describe('Session ID'),
    operationType: z.enum([
      'memory-search',
      'memory-store', 
      'memory-update',
      'tool-execution',
      'bridge-init',
      'bridge-call'
    ]).describe('Type of operation to get stats for')
  });
  
  export async function getOperationStats(
    params: z.infer<typeof GetOperationStatsSchema>
  ): Promise<any> {
    // Verify session exists
    await Session.get(params.sessionId);
    
    return SessionPerformance.getOperationStats(
      params.sessionId,
      params.operationType
    );
  }
  
  /**
   * Clear performance data for a session
   */
  export const ClearPerformanceSchema = z.object({
    sessionId: z.string().describe('Session ID to clear performance data for')
  });
  
  export async function clearPerformance(
    params: z.infer<typeof ClearPerformanceSchema>
  ): Promise<void> {
    // Verify session exists
    await Session.get(params.sessionId);
    
    SessionPerformance.clear(params.sessionId);
  }
  
  /**
   * List sessions with performance data
   */
  export async function listSessionsWithPerformance(): Promise<string[]> {
    const sessions: string[] = [];
    
    for await (const session of Session.list()) {
      const report = SessionPerformance.getReport(session.id);
      if (report && report.totalOperations > 0) {
        sessions.push(session.id);
      }
    }
    
    return sessions;
  }
}