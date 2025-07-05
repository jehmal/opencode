# Sub-Sessions Testing Guide

## Quick Test Procedure

### 1. Start DGMO and Create Test Agents
```
Create 3 agents to analyze the current code structure
```

### 2. Check Console Output
You should see enhanced debug logs:
- `[TASK] Creating sub-session with parent: ses_xxx`
- `[TASK] App info paths: {...}`
- `[SUB-SESSION] Storage operations for sub-session creation`
- `[VERIFICATION] Sub-session creation result: {...}`

### 3. Open Sub-Session Dialog
```
/sub-session
```

### 4. What to Expect
- If sub-sessions exist: You'll see them listed with status icons
- If no sub-sessions: You'll see helpful hints and current session ID

## Diagnostic Commands

### Check Storage Files (Windows PowerShell)
```powershell
# List all sub-session files
Get-ChildItem -Path "$env:LOCALAPPDATA\opencode\project\*\storage\session\sub-sessions\" -Filter "*.json" -Recurse

# List all index files  
Get-ChildItem -Path "$env:LOCALAPPDATA\opencode\project\*\storage\session\sub-session-index\" -Filter "*.json" -Recurse

# Watch for new files (run before creating agents)
while($true) { 
    Clear-Host
    Get-ChildItem -Path "$env:LOCALAPPDATA\opencode\project\" -Filter "*.json" -Recurse | 
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-5) } |
    Select-Object FullName, LastWriteTime
    Start-Sleep -Seconds 2
}
```

### Check Storage Files (Linux/WSL)
```bash
# Run the test script
chmod +x test-subsessions.sh
./test-subsessions.sh

# Or manually check
find ~/.local/share/opencode/project -name "*.json" -mmin -5
```

## Common Issues and Solutions

### Issue: "No sub-sessions found" despite creating agents
**Solution**: Check if you're in the correct session. Sub-sessions are parent-specific.

### Issue: Multiple project directories
**Solution**: The enhanced logging will show which project directory is being used.

### Issue: Storage permission errors
**Solution**: Ensure the opencode directory has write permissions.

## Success Indicators

✅ Console shows `[VERIFICATION] verified: true`  
✅ Sub-session dialog displays created agents  
✅ Storage diagnostics show incrementing file counts  
✅ No error messages in console output
