# DGMO Checkpoint Implementation Guide

## Overview

Checkpointing in a CLI coding assistant allows users to save specific states of their conversation and code, enabling them to return to those exact points later. This is crucial for experimentation, debugging, and maintaining multiple development branches.

## Industry-Standard Approaches

### 1. **Git-Based Checkpointing (Most Common)**

This approach leverages Git's version control capabilities:

**Advantages:**

- Integrates with existing developer workflows
- Provides full code state restoration
- Supports branching and merging
- Industry-standard tooling

**Implementation:**

```typescript
// When user creates checkpoint:
1. Capture current message ID and session ID
2. Stage all changes: `git add -A`
3. Create commit with metadata: `git commit -m "DGMO Checkpoint: {description}"`
4. Store checkpoint metadata linking message → commit SHA
5. Optional: Create git tag for easy reference
```

### 2. **Hash-Based State Tracking**

Uses content hashing to create unique identifiers:

**How it works:**

```typescript
interface Checkpoint {
  id: string // SHA-256 hash of content
  sessionId: string
  messageId: string
  contentHash: string // Hash of conversation + code state
  timestamp: number
  metadata: {
    files: Map<string, string> // filename → content hash
    conversation: string // Hash of conversation up to this point
  }
}
```

**Benefits:**

- Content-addressable storage
- Deduplication of identical states
- Efficient storage

### 3. **Snapshot-Based Approach**

Creates full snapshots of conversation and file states:

```typescript
interface Snapshot {
  id: string
  timestamp: number
  conversation: {
    messages: Message[]
    currentMessageId: string
  }
  fileSystem: {
    files: Map<string, FileContent>
    deletedFiles: string[]
  }
  metadata: {
    description: string
    tags: string[]
  }
}
```

## Recommended Implementation for DGMO

### Hybrid Approach: Git + Metadata Storage

```typescript
export namespace CheckpointSystem {
  // 1. Create checkpoint
  async function createCheckpoint(
    sessionId: string,
    messageId: string,
    options?: {
      description?: string
      autoCommit?: boolean
      tags?: string[]
    },
  ): Promise<Checkpoint> {
    // Generate unique ID (timestamp + random)
    const checkpointId = `chk_${Date.now()}_${randomId()}`

    // Capture conversation state
    const messages = await Session.messages(sessionId)
    const messageIndex = messages.findIndex((m) => m.id === messageId)

    // Git integration (if available)
    let gitCommit: string | undefined
    if (options?.autoCommit && isGitRepo()) {
      gitCommit = await createGitCommit(checkpointId, options.description)
    }

    // Store checkpoint metadata
    const checkpoint: Checkpoint = {
      id: checkpointId,
      sessionId,
      messageId,
      timestamp: Date.now(),
      gitCommit,
      description: options?.description,
      tags: options?.tags || [],
      conversationHash: hashMessages(messages.slice(0, messageIndex + 1)),
      filesChanged: await getChangedFiles(),
    }

    await Storage.writeJSON(`checkpoint/${checkpointId}`, checkpoint)
    return checkpoint
  }

  // 2. Restore checkpoint
  async function restoreCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = await getCheckpoint(checkpointId)

    // Restore git state if available
    if (checkpoint.gitCommit) {
      await execAsync(`git checkout ${checkpoint.gitCommit}`)
    }

    // Return session context
    return {
      sessionId: checkpoint.sessionId,
      messageId: checkpoint.messageId,
      restoredAt: Date.now(),
    }
  }

  // 3. List checkpoints with filtering
  async function listCheckpoints(
    sessionId?: string,
    options?: {
      tags?: string[]
      since?: Date
      limit?: number
    },
  ): Promise<Checkpoint[]> {
    // Implementation
  }
}
```

## Key Features to Implement

### 1. **Checkpoint Commands**

```bash
# Create checkpoint at current message
dgmo checkpoint create "Before refactoring auth system"

# List checkpoints
dgmo checkpoint list
dgmo checkpoint list --session <sessionId>

# Restore to checkpoint
dgmo checkpoint restore <checkpointId>

# Delete checkpoint
dgmo checkpoint delete <checkpointId>
```

### 2. **Inline Checkpoint Creation**

During conversation:

```
User: Create a checkpoint here before we start the refactoring
Assistant: ✅ Created checkpoint `chk_1234567890_abc` with git commit `a1b2c3d`
```

### 3. **Checkpoint Metadata**

Store rich metadata for each checkpoint:

- User's prompt that triggered the checkpoint
- Assistant's response
- Tools used
- Files modified
- Performance metrics
- Error states (if any)

### 4. **Checkpoint Navigation**

```typescript
// Navigate between checkpoints
dgmo checkpoint prev  // Go to previous checkpoint
dgmo checkpoint next  // Go to next checkpoint
dgmo checkpoint diff <id1> <id2>  // Show differences
```

## Storage Structure

```
~/.local/share/opencode/project/unified/storage/
├── checkpoint/
│   ├── chk_1234567890_abc.json
│   ├── chk_1234567891_def.json
│   └── ...
├── session/
│   └── checkpoint/
│       └── {sessionId}/
│           ├── chk_1234567890_abc.json  // Reference
│           └── ...
```

## Best Practices

1. **Automatic Checkpointing**

   - Before destructive operations
   - After successful test runs
   - At natural conversation breakpoints

2. **Checkpoint Naming**

   - Use descriptive names
   - Include timestamp
   - Add tags for categorization

3. **Storage Optimization**

   - Deduplicate file content
   - Compress old checkpoints
   - Limit checkpoint retention

4. **User Experience**
   - Quick checkpoint creation (one command)
   - Clear restoration feedback
   - Undo/redo functionality

## Integration with DGMO Features

### With Evolution System

- Checkpoint before applying evolutions
- Rollback if evolution fails
- Compare performance across checkpoints

### With Sub-Sessions

- Checkpoint parent session before creating sub-sessions
- Restore to pre-parallel-execution state

### With Performance Tracking

- Include performance metrics in checkpoints
- Compare execution times across checkpoints

## Security Considerations

1. **Sensitive Data**

   - Don't checkpoint files with secrets
   - Exclude .env files
   - Respect .gitignore

2. **Access Control**
   - Checkpoints are user-specific
   - No sharing between users
   - Encrypted storage option

## Implementation Priority

1. **Phase 1: Basic Checkpointing**

   - Create/restore with git integration
   - List and delete operations
   - Session-checkpoint linking

2. **Phase 2: Enhanced Features**

   - Inline checkpoint commands
   - Checkpoint diffing
   - Auto-checkpointing

3. **Phase 3: Advanced Features**
   - Checkpoint branching
   - Remote checkpoint storage
   - Checkpoint sharing

This approach provides a robust, industry-standard checkpointing system that integrates seamlessly with DGMO's existing architecture while maintaining compatibility with developer workflows.
