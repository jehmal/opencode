import { z } from "zod"
import { Storage } from "../storage/storage"
import { Identifier } from "../id/id"
import { Session } from "./index"

export namespace SubSession {
  // Sub-session metadata
  export const Info = z.object({
    id: Identifier.schema("session"),
    parentSessionId: z.string(),
    agentName: z.string(),
    taskDescription: z.string(),
    status: z.enum(["pending", "running", "completed", "failed"]),
    createdAt: z.number(),
    completedAt: z.number().optional(),
    summary: z.string().optional(),
  })
  export type Info = z.infer<typeof Info>

  // Storage paths
  const SUB_SESSION_PATH = "session/sub-sessions/"
  const SUB_SESSION_INDEX_PATH = "session/sub-session-index/"

  // Create a sub-session record
  export async function create(
    parentSessionId: string,
    sessionId: string,
    agentName: string,
    taskDescription: string,
  ): Promise<Info> {
    console.log("[SUB-SESSION DEBUG] Creating sub-session:", {
      parentSessionId,
      sessionId,
      agentName,
      taskDescription,
    })
    
    // Get storage base path for debugging
    const { Storage } = await import("../storage/storage")
    console.log("[SUB-SESSION] Storage operations for sub-session creation:")
    console.log("[SUB-SESSION] Will write sub-session to:", SUB_SESSION_PATH + sessionId)
    console.log("[SUB-SESSION] Will update index at:", SUB_SESSION_INDEX_PATH + parentSessionId)

    const info: Info = {
      id: sessionId,
      parentSessionId,
      agentName,
      taskDescription,
      status: "pending",
      createdAt: Date.now(),
    }

    // Store sub-session info
    const subSessionPath = SUB_SESSION_PATH + sessionId
    console.log("[SUB-SESSION DEBUG] Writing to:", subSessionPath)
    await Storage.writeJSON(SUB_SESSION_PATH + sessionId, info)

    // Add to parent's sub-session index
    const indexPath = SUB_SESSION_INDEX_PATH + parentSessionId
    console.log("[SUB-SESSION DEBUG] Updating index at:", indexPath)
    const index = await getParentIndex(parentSessionId)
    index.push(sessionId)
    await Storage.writeJSON(indexPath, index)

    console.log("[SUB-SESSION DEBUG] Sub-session created successfully")
    return info
  }

  // Update sub-session status
  export async function update(
    sessionId: string,
    updates: Partial<Omit<Info, "id" | "parentSessionId" | "createdAt">>,
  ): Promise<void> {
    const info = await get(sessionId)
    const updated = { ...info, ...updates }
    await Storage.writeJSON(SUB_SESSION_PATH + sessionId, updated)
  }

  // Get sub-session info
  export async function get(sessionId: string): Promise<Info> {
    return await Storage.readJSON<Info>(SUB_SESSION_PATH + sessionId)
  }

  // Get all sub-sessions for a parent session
  export async function getByParent(parentSessionId: string): Promise<Info[]> {
    console.log(
      "[SUB-SESSION DEBUG] Getting sub-sessions for parent:",
      parentSessionId,
    )
    const index = await getParentIndex(parentSessionId)
    console.log(
      "[SUB-SESSION DEBUG] Found index with",
      index.length,
      "sub-sessions",
    )
    const subSessions: Info[] = []

    for (const id of index) {
      try {
        const info = await get(id)
        subSessions.push(info)
      } catch (e) {
        // Sub-session might have been deleted
        console.log("[SUB-SESSION DEBUG] Failed to get sub-session:", id, e)
        continue
      }
    }

    console.log(
      "[SUB-SESSION DEBUG] Returning",
      subSessions.length,
      "sub-sessions",
    )
    // Sort by creation date
    return subSessions.sort((a, b) => b.createdAt - a.createdAt)
  }

  // Search sub-sessions by task description
  export async function search(query: string): Promise<Info[]> {
    // Convert AsyncGenerator to array
    const allSessions: Session.Info[] = []
    for await (const session of Session.list()) {
      allSessions.push(session)
    }

    const results: Info[] = []

    for (const session of allSessions) {
      const subSessions = await getByParent(session.id)
      for (const sub of subSessions) {
        if (
          sub.taskDescription.toLowerCase().includes(query.toLowerCase()) ||
          sub.agentName.toLowerCase().includes(query.toLowerCase())
        ) {
          results.push(sub)
        }
      }
    }

    return results.sort((a, b) => b.createdAt - a.createdAt)
  }

  // Delete a sub-session
  export async function remove(sessionId: string): Promise<void> {
    try {
      const info = await get(sessionId)

      // Remove from storage
      await Storage.remove(SUB_SESSION_PATH + sessionId)

      // Remove from parent's index
      const indexPath = SUB_SESSION_INDEX_PATH + info.parentSessionId
      const index = await getParentIndex(info.parentSessionId)
      const filtered = index.filter((id) => id !== sessionId)
      await Storage.writeJSON(indexPath, filtered)
    } catch (e) {
      // Already deleted
    }
  }

  // Get parent session's sub-session index
  async function getParentIndex(parentSessionId: string): Promise<string[]> {
    const indexPath = SUB_SESSION_INDEX_PATH + parentSessionId
    console.log("[SUB-SESSION DEBUG] Reading index from:", indexPath)
    try {
      const index = await Storage.readJSON<string[]>(indexPath)
      console.log("[SUB-SESSION DEBUG] Index found with entries:", index)
      return index
    } catch (e) {
      console.log(
        "[SUB-SESSION DEBUG] No index found for parent:",
        parentSessionId,
      )
      return []
    }
  }

  // Mark sub-session as completed with summary
  export async function complete(
    sessionId: string,
    summary: string,
  ): Promise<void> {
    await update(sessionId, {
      status: "completed",
      completedAt: Date.now(),
      summary,
    })
  }

  // Mark sub-session as failed
  export async function fail(sessionId: string, error: string): Promise<void> {
    await update(sessionId, {
      status: "failed",
      completedAt: Date.now(),
      summary: `Failed: ${error}`,
    })
  }

  // Alias for create (for consistency with other namespaces)
  export const store = create

  // List all sub-sessions across all parent sessions
  export async function list(): Promise<Info[]> {
    // Convert AsyncGenerator to array
    const allSessions: Session.Info[] = []
    for await (const session of Session.list()) {
      allSessions.push(session)
    }

    const allSubSessions: Info[] = []

    for (const session of allSessions) {
      const subSessions = await getByParent(session.id)
      allSubSessions.push(...subSessions)
    }

    // Sort by creation date, newest first
    return allSubSessions.sort((a, b) => b.createdAt - a.createdAt)
  }

  // Alias for remove (for consistency)
  export const deleteSubSession = remove

  // Clean up old sub-sessions (optional storage management)
  export async function cleanup(daysToKeep: number = 30): Promise<number> {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000

    // Convert AsyncGenerator to array
    const allSessions: Session.Info[] = []
    for await (const session of Session.list()) {
      allSessions.push(session)
    }

    let deletedCount = 0

    for (const session of allSessions) {
      const subSessions = await getByParent(session.id)
      for (const sub of subSessions) {
        if (sub.createdAt < cutoffTime) {
          await remove(sub.id)
          deletedCount++
        }
      }
    }

    return deletedCount
  }
}
