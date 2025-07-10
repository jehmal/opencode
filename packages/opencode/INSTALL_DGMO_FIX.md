# DGMO Working Directory Fix

## Quick Fix (Recommended)

Replace your current dgmo command with this simple wrapper:

```bash
# 1. Make the wrapper executable
chmod +x /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-wrapper.sh

# 2. Create an alias in your shell config (~/.bashrc or ~/.zshrc)
echo 'alias dgmo="/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/dgmo-wrapper.sh"' >> ~/.bashrc

# 3. Reload your shell config
source ~/.bashrc
```

## Alternative: Direct Binary Usage

You can also use the dgmo binary directly:

```bash
# Add this alias to your ~/.bashrc or ~/.zshrc
alias dgmo='/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/bin/dgmo'
```

## What This Fixes

- ✅ dgmo will start in the directory where you run the command
- ✅ All functionality remains exactly the same
- ✅ No changes to the core application
- ✅ Works with all existing features

## Testing

After installation, test it:

```bash
cd /mnt/c/Users/jehma/Desktop/test
dgmo
# Should open with working directory: /mnt/c/Users/jehma/Desktop/test
```
