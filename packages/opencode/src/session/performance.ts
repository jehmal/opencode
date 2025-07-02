import { PerformanceTracker, type PerformanceReport } from '@opencode/dgm-integration';
import { App } from '../app/app';
import { Storage } from '../storage/storage';
import { Log } from '../util/log';

/**
 * Session-scoped performance tracking
 * Manages performance metrics per session
 */
export namespace SessionPerformance {
  const log = Log.create({ service: 'session-performance' });
  
  // Store trackers per session
  const trackers = App.state(
    'session-performance',
    () => new Map<string, PerformanceTracker>(),
    async (state) => {
      // Save performance reports on cleanup
      for (const [sessionId, tracker] of state) {
        try {
          const report = tracker.getReport();
          await saveReport(sessionId, report);
        } catch (error) {
          log.error('Failed to save performance report', { sessionId, error });
        }
      }
    }
  );
  
  /**
   * Get or create a performance tracker for a session
   * @param sessionId The session ID
   * @returns The performance tracker
   */
  export function getTracker(sessionId: string): PerformanceTracker {
    const trackersMap = trackers();
    
    if (!trackersMap.has(sessionId)) {
      trackersMap.set(sessionId, new PerformanceTracker());
    }
    
    return trackersMap.get(sessionId)!;
  }
  
  /**
   * Get performance report for a session
   * @param sessionId The session ID
   * @returns The performance report or null if no tracker exists
   */
  export function getReport(sessionId: string): PerformanceReport | null {
    const tracker = trackers().get(sessionId);
    return tracker ? tracker.getReport() : null;
  }
  
  /**
   * Clear performance data for a session
   * @param sessionId The session ID
   */
  export function clear(sessionId: string): void {
    const tracker = trackers().get(sessionId);
    if (tracker) {
      tracker.clear();
    }
  }
  
  /**
   * Remove tracker for a session
   * @param sessionId The session ID
   */
  export function remove(sessionId: string): void {
    trackers().delete(sessionId);
  }
  
  /**
   * Save performance report to storage
   * @param sessionId The session ID
   * @param report The performance report
   */
  export async function saveReport(
    sessionId: string,
    report: PerformanceReport
  ): Promise<void> {
    await Storage.writeJSON(
      `session/performance/${sessionId}`,
      {
        ...report,
        timestamp: Date.now(),
        sessionId
      }
    );
  }
  
  /**
   * Load performance report from storage
   * @param sessionId The session ID
   * @returns The performance report or null if not found
   */
  export async function loadReport(
    sessionId: string
  ): Promise<PerformanceReport | null> {
    try {
      return await Storage.readJSON<PerformanceReport>(
        `session/performance/${sessionId}`
      );
    } catch {
      return null;
    }
  }
  
  /**
   * Get performance stats for a specific operation type
   * @param sessionId The session ID
   * @param operationType The operation type to get stats for
   * @returns The operation stats or null
   */
  export function getOperationStats(
    sessionId: string,
    operationType: string
  ): any {
    const tracker = trackers().get(sessionId);
    if (!tracker) return null;
    
    return tracker.getOperationStats(operationType as any);
  }
}