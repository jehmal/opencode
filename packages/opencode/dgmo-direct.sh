#!/bin/bash
# Direct dgmo launcher that preserves working directory

# Save current directory
WORKING_DIR="$(pwd)"

# Find bun executable
BUN_PATH=$(which bun)
if [ -z "$BUN_PATH" ]; then
    echo "Error: bun not found in PATH"
    exit 1
fi

# Path to the TypeScript entry point
DGMO_TS="/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/src/index.ts"

if [ ! -f "$DGMO_TS" ]; then
    echo "Error: dgmo TypeScript file not found at $DGMO_TS"
    exit 1
fi

# Export working directory for the app to use
export DGMO_WORKING_DIR="$WORKING_DIR"
export OPENCODE_WORKING_DIR="$WORKING_DIR"

# Change to the opencode directory (required for imports)
cd "/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode"

# Run dgmo with bun, passing all arguments
exec "$BUN_PATH" run "$DGMO_TS" "$@"