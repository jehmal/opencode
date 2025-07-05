import { Storage } from "../storage/storage"
import { SubSession } from "./sub-session"

export namespace SessionDiagnostics {
  /**
   * Verify sub-sessions are properly stored and indexed
   */
  export async function verifySubSessions(parentSessionId: string) {
    const results = {
      parentId: parentSessionId,
      subSessionCount: 0,
      indexFound: false,
      indexEntries: [] as string[],
      subSessionDetails: [] as any[],
      errors: [] as string[],
      totalInStorage: 0,
    }

    try {
      // Check the index
      const indexPath = `session/sub-session-index/${parentSessionId}`
      try {
        const index = await Storage.readJSON<string[]>(indexPath)
        results.indexFound = true
        results.indexEntries = index
        results.subSessionCount = index.length
      } catch (e) {
        results.errors.push(`No index found at ${indexPath}`)
      }

      // Get sub-sessions via the SubSession module
      try {
        const subSessions = await SubSession.getByParent(parentSessionId)
        results.subSessionDetails = subSessions.map(s => ({
          id: s.id,
          agent: s.agentName,
          status: s.status,
          created: new Date(s.createdAt).toISOString()
        }))
      } catch (e) {
        results.errors.push(`Error getting sub-sessions: ${e}`)
      }

      // Count total sub-sessions in storage
      let count = 0
      for await (const file of Storage.list("session/sub-sessions")) {
        count++
      }
      results.totalInStorage = count

    } catch (e) {
      results.errors.push(`General error: ${e}`)
    }

    return results
  }

  /**
   * List all sub-session index files
   */
  export async function listAllIndexes() {
    const indexes = []
    for await (const file of Storage.list("session/sub-session-index")) {
      indexes.push(file)
    }
    return indexes
  }

  /**
   * Debug storage paths
   */
  export async function debugStoragePaths() {
    const { App } = await import("../app/app")
    const appInfo = App.info()
    
    return {
      dataPath: appInfo.path.data,
      storagePath: `${appInfo.path.data}/storage`,
      sessionPath: `${appInfo.path.data}/storage/session`,
      subSessionPath: `${appInfo.path.data}/storage/session/sub-sessions`,
      indexPath: `${appInfo.path.data}/storage/session/sub-session-index`,
    }
  }
}
