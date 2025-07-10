# DGMO Unified Storage Fix

## Problem Solved

Sessions and sub-sessions were being stored in different directories based on where DGMO was launched from, causing them to appear "lost" when the app was run from different locations.

## Root Cause

The storage path was calculated using either:

1. Git root directory (if in a git repo)
2. Current working directory (if not in a git repo)

This path was then sanitized into a directory name, creating different storage locations:

- `/home/jehma/.local/share/opencode/project/mnt-c-Users-jehma-Desktop-AI-DGMSTT/`
- `/home/jehma/.local/share/opencode/project/mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode/`
- `/home/jehma/.local/share/opencode/project/global/`
- etc.

## Solution Implemented

### 1. Code Change

Modified `src/app/app.ts` to always use a unified storage location:

```typescript
// Before (problematic):
const data = path.join(
  Global.Path.data,
  "project",
  git ? directory(git) : "global",
)

// After (fixed):
const data = path.join(
  Global.Path.data,
  "project",
  "unified", // Always use "unified" instead of directory-specific paths
)
```

### 2. Data Migration

Created `migrate-sessions.sh` script that:

- Found all scattered sessions (273 total across 4 directories)
- Consolidated them into the unified storage location
- Preserved all session data, messages, and performance metrics

### 3. Results

- ✅ All 273 sessions migrated successfuly
- ✅ Sessions now accessible from any directory
- ✅ No more "lost" sessions
- ✅ Sub-sessions properly linked to parent sessions

## Unified Storage Location

All sessions are now stored in:

```
~/.local/share/opencode/project/unified/storage/
├── session/
│   ├── info/          # Session metadata
│   ├── message/       # Chat messages
│   ├── sub-sessions/  # Sub-session data
│   └── sub-session-index/ # Parent-child mappings
└── performance/       # Performance metrics
```

## Benefits

1. **Consistency**: Same storage location regardless of launch directory
2. **Reliability**: Sessions never get "lost"
3. **Simplicity**: No need to track multiple storage locations
4. **Compatibility**: Works with existing session format

## Testing

Run DGMO from any directory and your sessions will be available:

```bash
# From home directory
cd ~ && dgmo

# From project root
cd /path/to/project && dgmo

# From any random directory
cd /tmp && dgmo
```

All will use the same unified storage location.

## Cleanup (Optional)

After verifying everything works, you can remove old storage directories:

```bash
# List old directories (excluding unified)
find ~/.local/share/opencode/project -type d -name "storage" | grep -v "unified"

# Remove them (after verification)
# rm -rf ~/.local/share/opencode/project/mnt-c-Users-jehma-Desktop-AI-DGMSTT/storage
# etc.
```

## Technical Notes

- The `directory()` function that sanitized paths is no longer used
- The unified approach ensures consistent behavior across all environments
- Migration script uses rsync to handle conflicts (newer files win)
- All existing functionality remains intact
