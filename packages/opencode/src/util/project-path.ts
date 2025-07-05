import { execSync } from "child_process"
import path from "path"
import fs from "fs"

export namespace ProjectPath {
  // Cache the result for consistency
  let cachedProjectPath: string | null = null
  
  /**
   * Find git root directory from the given path
   */
  function findGitRoot(startPath: string): string | null {
    try {
      const result = execSync("git rev-parse --show-toplevel", {
        cwd: startPath,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"] // Ignore stderr
      }).trim()
      
      if (result && fs.existsSync(result)) {
        console.log("[PROJECT-PATH] Found git root:", result)
        return result
      }
    } catch (e) {
      // Not a git repository or git not available
      console.log("[PROJECT-PATH] Git root not found, falling back to cwd")
    }
    return null
  }
  
  /**
   * Get consistent project path - always returns the same path during a session
   */
  export function getConsistentProjectPath(): string {
    if (cachedProjectPath) {
      return cachedProjectPath
    }
    
    // Try git root first
    const gitRoot = findGitRoot(process.cwd())
    if (gitRoot) {
      cachedProjectPath = gitRoot
      console.log("[PROJECT-PATH] Using git root as project path:", gitRoot)
      return gitRoot
    }
    
    // Fallback to cwd
    cachedProjectPath = process.cwd()
    console.log("[PROJECT-PATH] Using cwd as project path:", cachedProjectPath)
    return cachedProjectPath
  }
  
  /**
   * Reset the cached path (useful for testing)
   */
  export function resetCache() {
    cachedProjectPath = null
  }
}
