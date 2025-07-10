# Sub-Sessions Verification Guide

## Quick Verification Steps

### 1. Check Current State

```bash
# Run the test script
./test-subsessions.sh

# Check for recent sub-sessions manually
find ~/.local/share/opencode/project/*/storage/session/sub-sessions/ -name "*.json" -mtime -1 | wc -l
```

### 2. Live Testing Process

#### Step 1: Start OpenCode

```bash
dgmo run
```

#### Step 2: Monitor Logs

In a separate terminal:

```bash
# Watch for session and sub-session creation
tail -f ~/.local/share/opencode/logs/*.log | grep -E "SESSION|TASK|SUB-SESSION"
```

#### Step 3: Create Test Task

In the dgmo interface, type:

```
Create 3 agents to analyze the performance of this codebase
```

#### Step 4: Check Results

1. Press `/sub-session` in TUI
2. Look for the 3 created agents
3. Check the tree view structure

### 3. Verification Checklist

- [ ] Task tool is available without `/agents` command
- [ ] Sub-sessions are created when using task tool
- [ ] Sub-sessions appear in `/sub-session` dialog
- [ ] Tree view shows parent-child relationships
- [ ] No duplicate project directories created
- [ ] Session IDs are consistent

## Debugging Commands

### Check Tool Availability

```bash
# In dgmo chat, type:
/tools

# Look for "task" in the list
```

### Monitor File Creation

```bash
# Watch for new sub-session files
watch -n 1 'find ~/.local/share/opencode/project/*/storage/session/sub-sessions/ -name "*.json" -mmin -5 | tail -10'
```

### Check Session Context

```bash
# Find current session ID
ls -lt ~/.local/share/opencode/project/*/storage/session/info/*.json | head -1

# Check its content
jq . [path-from-above]
```

## Success Indicators

### Console Output (Expected)

```
[SESSION] Tool filtering check: { sessionID: "ses_xxx", parentID: undefined, isMainSession: true }
[TASK] Creating sub-session with parent: ses_xxx
[TASK] Created sub-session: ses_yyy with parentID: ses_xxx
[SUB-SESSION DEBUG] Creating sub-session: { ... }
[SUB-SESSION DEBUG] Writing to: session/sub-sessions/ses_yyy
[SUB-SESSION DEBUG] Sub-session created successfuly
```

### File System (Expected)

```
~/.local/share/opencode/project/[project-hash]/storage/
├── session/
│   ├── info/
│   │   └── ses_xxx.json (main session)
│   ├── sub-sessions/
│   │   ├── ses_yyy.json (sub-session 1)
│   │   ├── ses_zzz.json (sub-session 2)
│   │   └── ses_aaa.json (sub-session 3)
│   └── sub-session-index/
│       └── ses_xxx.json (contains ["ses_yyy", "ses_zzz", "ses_aaa"])
```

## Common Issues and Solutions

### Issue: "Tool filtered out: task"

**Solution**: Main session is not recognized. Check parentID is undefined for main sessions.

### Issue: Sub-sessions in wrong directory

**Solution**: Project path calculation issue. All components must use same working directory.

### Issue: No sub-sessions created despite task execution

**Solution**: Check console for errors in SubSession.create(). Verify storage permissions.

### Issue: Old sub-sessions shown instead of new ones

**Solution**: Session context mismatch. Ensure current session ID matches storage lookups.

## Performance Verification

### Expected Timings

- Task tool execution: < 1 second to create sub-session
- Sub-session storage: < 100ms
- Dialog retrieval: < 200ms
- Tree view rendering: < 50ms

### Load Test

```bash
# Create multiple tasks rapidly
for i in {1..5}; do
  echo "Create an agent to analyze file $i"
  sleep 2
done
```

## Final Verification

After implementing the fix, the system should:

1. **Allow task tool by default** - No need for `/agents` command
2. **Create sub-sessions immediately** - Files appear in storage
3. **Display in TUI correctly** - `/sub-session` shows all agents
4. **Maintain relationships** - Tree view shows hierarchy
5. **Persist across restarts** - Sub-sessions remain after restart

If all these conditions are met, the sub-sessions feature is working correctly!
