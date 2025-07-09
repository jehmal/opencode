import { execSync } from "child_process"
import { App } from "../app/app"
import { Session } from "../session"
import { Storage } from "../storage/storage"
import { Log } from "../util/log"
import { Identifier } from "../id/id"
import { z } from "zod"
import { FileTime } from "../file/time"
import * as crypto from "crypto"

// Define FileSnapshot schema and type
const FileSnapshotSchema = z.object({
  hash: z.string(),
  mode: z.number(),
})
type FileSnapshot = z.infer<typeof FileSnapshotSchema>

export namespace CheckpointManager {
  const log = Log.create({ service: "checkpoint" })

  // Checkpoint metadata schema
  export const CheckpointInfo = z.object({
    id: z.string(),
    sessionId: Identifier.schema("session"),
    messageId: Identifier.schema("message"),
    gitCommit: z.string().optional(),
    fileSnapshots: z.record(z.string(), FileSnapshotSchema).optional(),
    timestamp: z.number(),
    description: z.string(),
    filesChanged: z.array(z.string()),
    metadata: z.object({
      userPrompt: z.string(),
      modelResponse: z.string().optional(),
      toolsUsed: z.array(z.string()).optional(),
      fileCount: z.number(),
      messageIndex: z.number(),
    }),
  })
  export type CheckpointInfo = z.infer<typeof CheckpointInfo>

  /**
   * Create a checkpoint at a specific message in the conversation
   */
  export async function createCheckpoint(
    sessionId: string,
    messageId: string,
    description?: string,
  ): Promise<CheckpointInfo> {
    const app = App.info()

    // Get all messages up to this point
    const messages = await Session.messages(sessionId)
    const messageIndex = messages.findIndex((m) => m.id === messageId)
    const relevantMessages = messages.slice(0, messageIndex + 1)

    // Extract user prompt and model response
    const userMessage = relevantMessages.filter((m) => m.role === "user").pop()
    const assistantMessage = relevantMessages
      .filter((m) => m.role === "assistant")
      .pop()

    // Check if we're in a git repository
    let gitCommit: string | undefined
    let filesChanged: string[] = []

    try {
      // Check if git is available and we're in a repo
      execSync("git rev-parse --git-dir", { cwd: app.path.root })

      // Get list of changed files
      const gitStatus = execSync("git status --porcelain", {
        cwd: app.path.root,
        encoding: "utf8",
      })

      filesChanged = gitStatus
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => line.substring(3).trim())

      // Create a git commit if there are changes
      if (filesChanged.length > 0) {
        const checkpointMessage = `Checkpoint: ${description || `Session ${sessionId} at message ${messageId}`}
        
Created by DGMO checkpoint system
Session: ${sessionId}
Message: ${messageId}
Timestamp: ${new Date().toISOString()}`

        try {
          execSync(`git add -A`, { cwd: app.path.root })
          execSync(`git commit -m "${checkpointMessage}"`, {
            cwd: app.path.root,
          })
          gitCommit = execSync("git rev-parse HEAD", {
            cwd: app.path.root,
            encoding: "utf8",
          }).trim()

          log.info("Created git commit for checkpoint", { commit: gitCommit })
        } catch (e) {
          log.warn("Failed to create git commit", { error: e })
        }
      }
    } catch (e) {
      log.info(
        "Not in a git repository, creating checkpoint without git integration",
      )
    }

    // Capture file snapshots if not using git
    let fileSnapshots: Record<string, FileSnapshot> | undefined
    if (!gitCommit) {
      fileSnapshots = await captureFileSnapshots(sessionId)
      filesChanged = Object.keys(fileSnapshots)
    }

    // Extract text content from messages
    const getUserText = (msg: typeof userMessage) => {
      if (!msg) return ""
      const textPart = msg.parts.find((p) => p.type === "text")
      return textPart?.text || ""
    }

    const getAssistantText = (msg: typeof assistantMessage) => {
      if (!msg) return ""
      const textPart = msg.parts.find((p) => p.type === "text")
      return textPart?.text || ""
    }

    const getToolsUsed = (msg: typeof assistantMessage) => {
      if (!msg) return []
      return msg.parts
        .filter((p) => p.type === "tool-invocation")
        .map((p) => p.toolInvocation?.toolName || "")
        .filter(Boolean)
    }

    // Create checkpoint info
    const checkpoint: CheckpointInfo = {
      id: Identifier.ascending("checkpoint"),
      sessionId,
      messageId,
      gitCommit,
      fileSnapshots,
      timestamp: Date.now(),
      description: description || `Checkpoint at ${new Date().toISOString()}`,
      filesChanged,
      metadata: {
        userPrompt: getUserText(userMessage),
        modelResponse: getAssistantText(assistantMessage),
        toolsUsed: getToolsUsed(assistantMessage),
        fileCount: filesChanged.length,
        messageIndex: messageIndex,
      },
    }

    // Store checkpoint
    await Storage.writeJSON(`checkpoint/${checkpoint.id}`, checkpoint)

    // Also store a reference in the session
    await Storage.writeJSON(
      `session/checkpoint/${sessionId}/${checkpoint.id}`,
      {
        checkpointId: checkpoint.id,
        messageId,
        timestamp: checkpoint.timestamp,
      },
    )

    return checkpoint
  }

  /**
   * Get all tracked files for a session
   */
  async function getTrackedFiles(sessionId: string): Promise<string[]> {
    const trackedFiles = new Set<string>()
    const { read } = FileTime.state()

    // Get files from this session
    const sessionFiles = read[sessionId] || {}
    Object.keys(sessionFiles).forEach((file) => trackedFiles.add(file))

    // Also check sub-sessions
    const sessions = await Session.list()
    for await (const sessionInfo of sessions) {
      if (sessionInfo.parentID === sessionId) {
        const subSessionFiles = read[sessionInfo.id] || {}
        Object.keys(subSessionFiles).forEach((file) => trackedFiles.add(file))
      }
    }

    return Array.from(trackedFiles)
  }

  /**
   * Capture file snapshots for non-git checkpoints
   */
  async function captureFileSnapshots(
    sessionId: string,
  ): Promise<Record<string, FileSnapshot>> {
    const snapshots: Record<string, FileSnapshot> = {}
    const trackedFiles = await getTrackedFiles(sessionId)

    for (const filepath of trackedFiles) {
      try {
        const file = Bun.file(filepath)
        if (await file.exists()) {
          const content = await file.text()
          const hash = crypto.createHash("sha256").update(content).digest("hex")

          // Store content in content-addressable storage
          await Storage.writeJSON(`checkpoint/objects/${hash}`, { content })

          snapshots[filepath] = {
            hash,
            mode: (await file.stat()).mode,
          }
        }
      } catch (e) {
        log.warn(`Failed to capture snapshot for ${filepath}`, { error: e })
      }
    }

    return snapshots
  }

  /**
   * Restore file snapshots
   */
  async function restoreFileSnapshots(
    snapshots: Record<string, FileSnapshot>,
  ): Promise<void> {
    for (const [filepath, snapshot] of Object.entries(snapshots)) {
      try {
        const stored = await Storage.readJSON<{ content: string }>(
          `checkpoint/objects/${snapshot.hash}`,
        )
        await Bun.write(filepath, stored.content)

        // Note: File permissions restoration not supported in Bun yet
        // This would require using fs.chmod from Node.js
      } catch (e) {
        log.error(`Failed to restore file ${filepath}`, { error: e })
      }
    }
  }

  /**
   * Truncate messages after a specific message
   */
  async function truncateMessages(
    sessionId: string,
    messageId: string,
  ): Promise<void> {
    const messages = await Session.messages(sessionId)
    const messageIndex = messages.findIndex((m) => m.id === messageId)

    if (messageIndex === -1) return

    // Delete all messages after the checkpoint
    const messagesToDelete = messages.slice(messageIndex + 1)
    for (const msg of messagesToDelete) {
      await Storage.remove(`session/message/${sessionId}/${msg.id}`)
    }

    log.info(`Truncated ${messagesToDelete.length} messages after checkpoint`)
  }

  /**
   * List all checkpoints for a session
   */
  export async function listCheckpoints(
    sessionId: string,
  ): Promise<CheckpointInfo[]> {
    const checkpoints: CheckpointInfo[] = []

    try {
      for await (const file of Storage.list(
        `session/checkpoint/${sessionId}`,
      )) {
        const ref = await Storage.readJSON<{ checkpointId: string }>(file)
        const checkpoint = await Storage.readJSON<CheckpointInfo>(
          `checkpoint/${ref.checkpointId}`,
        )
        checkpoints.push(checkpoint)
      }
    } catch (e) {
      log.error("Failed to list checkpoints", { error: e })
    }

    return checkpoints.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Restore to a specific checkpoint
   */
  export async function restoreCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = await Storage.readJSON<CheckpointInfo>(
      `checkpoint/${checkpointId}`,
    )
    const app = App.info()

    if (checkpoint.gitCommit) {
      try {
        // Stash any current changes
        execSync(
          "git stash push -m 'DGMO: Stashing before checkpoint restore'",
          {
            cwd: app.path.root,
          },
        )

        // Checkout the commit
        execSync(`git checkout ${checkpoint.gitCommit}`, {
          cwd: app.path.root,
        })

        log.info("Restored to git checkpoint", {
          commit: checkpoint.gitCommit,
          description: checkpoint.description,
        })
      } catch (e) {
        log.error("Failed to restore git checkpoint", { error: e })
        throw new Error(`Failed to restore checkpoint: ${e}`)
      }
    } else if (checkpoint.fileSnapshots) {
      // Restore from file snapshots
      await restoreFileSnapshots(checkpoint.fileSnapshots)
      log.info("Restored from file snapshots", {
        fileCount: Object.keys(checkpoint.fileSnapshots).length,
        description: checkpoint.description,
      })
    } else {
      log.warn(
        "Checkpoint has no git commit or file snapshots, cannot restore file state",
      )
    }

    // Truncate messages to checkpoint
    await truncateMessages(checkpoint.sessionId, checkpoint.messageId)

    // Update session metadata
    await Session.update(checkpoint.sessionId, (draft) => {
      draft.time.updated = Date.now()
    })
  }

  /**
   * Create a lightweight checkpoint (without git commit)
   */
  export async function createQuickCheckpoint(
    sessionId: string,
    messageId: string,
  ): Promise<string> {
    const checkpoint = await createCheckpoint(
      sessionId,
      messageId,
      "Quick checkpoint",
    )
    return checkpoint.id
  }

  /**
   * Get checkpoint details
   */
  export async function getCheckpoint(
    checkpointId: string,
  ): Promise<CheckpointInfo> {
    return Storage.readJSON<CheckpointInfo>(`checkpoint/${checkpointId}`)
  }

  /**
   * Delete a checkpoint
   */
  export async function deleteCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = await getCheckpoint(checkpointId)
    await Storage.remove(`checkpoint/${checkpointId}`)
    await Storage.remove(
      `session/checkpoint/${checkpoint.sessionId}/${checkpointId}`,
    )
  }
}
