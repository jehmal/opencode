# DGMO Branding Update Instructions

This directory contains scripts and documentation for updating all OpenCode references to DGMO in the DGMSTT-branding worktree.

## Prerequisites

1. You must be in the `DGMSTT-branding` worktree (branch: `dgmo-branding-update`)
2. Ensure you have committed or stashed any uncommitted changes
3. Have `bash` and `python3` available

## Method 1: Bash Script (Recommended)

The bash script handles all file types and renames:

```bash
# Navigate to the branding worktree
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT-branding

# Copy the script from the main worktree
cp ../DGMSTT/branding-update-script.sh .

# Run the script
./branding-update-script.sh
```

## Method 2: Python Script

The Python script provides additional features like dry-run mode:

```bash
# Navigate to the branding worktree
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT-branding

# Copy the script from the main worktree
cp ../DGMSTT/dgmo_branding_update.py .

# Run in dry-run mode first
python3 dgmo_branding_update.py --dry-run

# If everything looks good, run for real
python3 dgmo_branding_update.py
```

## Manual Verification

After running either script, verify the changes:

1. **Check git diff**:
   ```bash
   git diff --stat
   git diff  # Review actual changes
   ```

2. **Search for remaining references**:
   ```bash
   grep -r "opencode" . --exclude-dir=node_modules --exclude-dir=.git
   grep -r "OpenCode" . --exclude-dir=node_modules --exclude-dir=.git
   ```

3. **Test the build**:
   ```bash
   npm install
   npm run build
   npm test
   ```

4. **Test the executable**:
   ```bash
   ./opencode/dgmo --help
   ```

## What Gets Changed

### Automatic Updates:
- ✅ Package names: `@opencode-dgm/*` → `@dgmo/*`
- ✅ Docker service names: `opencode` → `dgmo`
- ✅ Environment variables: `OPENCODE_*` → `DGMO_*`
- ✅ Database names: `opencode_dgm` → `dgmo`
- ✅ Interface names: `OpenCodeContext` → `DGMOContext`
- ✅ Function names: `setupOpenCodeIntegration` → `setupDGMOIntegration`
- ✅ Commands in docs: `opencode run` → `dgmo run`
- ✅ File renames: `setup-opencode-dgm.sh` → `setup-dgmo.sh`
- ✅ Executable: `opencode/opencode` → `opencode/dgmo`

### Manual Review Needed:
- ⚠️ External URLs or references
- ⚠️ Third-party package configurations
- ⚠️ CI/CD configurations
- ⚠️ Deployment scripts

## Commit the Changes

Once verified, commit the branding updates:

```bash
git add -A
git commit -m "feat: Rebrand from OpenCode to DGMO

- Update all package names from @opencode-dgm to @dgmo
- Rename executables and setup scripts  
- Update Docker service names and configuration
- Update all documentation and examples
- Maintain compatibility with existing directory structure

BREAKING CHANGE: Package names have changed from @opencode-dgm/* to @dgmo/*
Users will need to update their imports and reinstall packages."
```

## Troubleshooting

### If the script fails:
1. Check file permissions
2. Ensure you're in the correct directory
3. Check for conflicting changes in git

### If tests fail after update:
1. Check `node_modules` - may need `rm -rf node_modules && npm install`
2. Clear any build caches
3. Check for hardcoded paths that weren't updated

### To rollback:
```bash
# The script creates a backup tag
git reset --hard before-dgmo-branding-[timestamp]
```

## Files Provided

1. **branding-update-script.sh** - Main bash script for updates
2. **dgmo_branding_update.py** - Python script with dry-run capability
3. **DGMO_BRANDING_CHECKLIST.md** - Detailed checklist of all changes
4. **BRANDING_VISUAL_GUIDE.md** - Visual before/after examples
5. **README_BRANDING_UPDATE.md** - This file

## Support

If you encounter issues, check:
- The git diff to see what changed
- The backup files (*.bak) if created
- The BRANDING_MIGRATION.md file created by the script