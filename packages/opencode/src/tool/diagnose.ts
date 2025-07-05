import { Tool } from "./tool"
import { z } from "zod"
import { Storage } from "../storage/storage"
import { Session } from "../session"
import { SubSession } from "../session/sub-session"
import { App } from "../app/app"

export const DiagnoseTool = Tool.define({
  id: "diagnose_subsessions",
  description: "Diagnose sub-sessions storage and display diagnostic information",
  parameters: z.object({}),
  async execute(params, ctx) {
    console.log("\n=== SUB-SESSION DIAGNOSTIC TOOL ===")
    
    // Get app info
    const appInfo = App.info()
    console.log("App paths:", appInfo.path)
    
    // Get current session
    const currentSession = await Session.get(ctx.sessionID)
    console.log("\nCurrent session:", {
      id: currentSession.id,
      parentID: currentSession.parentID,
      title: currentSession.title
    })
    
    // Check for sub-sessions
    console.log("\n--- Checking Sub-Sessions ---")
    try {
      const subSessions = await SubSession.getByParent(ctx.sessionID)
      console.log(`Found ${subSessions.length} sub-sessions for current session`)
      
      if (subSessions.length > 0) {
        subSessions.forEach((sub, idx) => {
          console.log(`\nSub-session ${idx + 1}:`, {
            id: sub.id,
            status: sub.status,
            agentName: sub.agentName,
            task: sub.taskDescription,
            created: new Date(sub.createdAt).toISOString()
          })
        })
      }
    } catch (e) {
      console.error("Error getting sub-sessions:", e)
    }
    
    // Check storage directly
    console.log("\n--- Direct Storage Check ---")
    try {
      // List all sub-session files
      let allSubSessions = []
      for await (const file of Storage.list("session/sub-sessions")) {
        allSubSessions.push(file)
      }
      console.log(`Total sub-session files in storage: ${allSubSessions.length}`)
      
      // List all index files
      let allIndexFiles = []
      for await (const file of Storage.list("session/sub-session-index")) {
        allIndexFiles.push(file)
      }
      console.log(`Total index files in storage: ${allIndexFiles.length}`)
      
      // Check for current session's index
      const indexPath = `session/sub-session-index/${ctx.sessionID}`
      try {
        const index = await Storage.readJSON(indexPath)
        console.log(`\nIndex for current session exists with ${Array.isArray(index) ? index.length : 0} entries`)
        if (Array.isArray(index) && index.length > 0) {
          console.log("Sub-session IDs in index:", index)
        }
      } catch (e) {
        console.log(`\nNo index file found for current session at: ${indexPath}`)
      }
      
      // Show recent sub-sessions (last 5)
      if (allSubSessions.length > 0) {
        console.log("\n--- Recent Sub-Sessions (last 5) ---")
        const recent = allSubSessions.slice(-5)
        for (const file of recent) {
          try {
            const data = await Storage.readJSON(file)
            console.log(`\n${file}:`, {
              id: data.id,
              parentSessionId: data.parentSessionId,
              status: data.status,
              created: new Date(data.createdAt).toISOString()
            })
          } catch (e) {
            console.log(`Error reading ${file}:`, e.message)
          }
        }
      }
      
    } catch (e) {
      console.error("Error checking storage:", e)
    }
    
    // Return diagnostic summary
    const summary = {
      currentSessionId: ctx.sessionID,
      appPaths: appInfo.path,
      timestamp: new Date().toISOString()
    }
    
    console.log("\n=== END DIAGNOSTIC ===\n")
    
    return {
      output: JSON.stringify(summary, null, 2),
      metadata: {
        title: "Sub-session Diagnostics",
        summary: summary
      }
    }
  }
})
