import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

const DEBUG_DIR = "/tmp/dgmo-debug"
const DEBUG_FILE = join(DEBUG_DIR, "task-debug.log")

// Ensure debug directory exists
if (!existsSync(DEBUG_DIR)) {
  mkdirSync(DEBUG_DIR, { recursive: true })
}

export function logTaskExecution(sessionId: string, description: string) {
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] Task executed - Session: ${sessionId}, Description: ${description}\n`
  
  try {
    appendFileSync(DEBUG_FILE, logEntry)
  } catch (e) {
    console.error("[TASK-DEBUG] Failed to write log:", e)
  }
}

export function logSubSessionCreation(parentId: string, subSessionId: string, details: any) {
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] Sub-session created - Parent: ${parentId}, SubSession: ${subSessionId}, Details: ${JSON.stringify(details)}\n`
  
  try {
    appendFileSync(DEBUG_FILE, logEntry)
  } catch (e) {
    console.error("[TASK-DEBUG] Failed to write log:", e)
  }
}

export function readDebugLog(): string {
  try {
    if (existsSync(DEBUG_FILE)) {
      return Bun.file(DEBUG_FILE).text()
    }
  } catch (e) {
    console.error("[TASK-DEBUG] Failed to read log:", e)
  }
  return "No debug log found"
}
