#!/bin/bash
# DGMO wrapper script with error handling

# Save current directory
CURRENT_DIR="$(pwd)"

# The actual dgmo binary location
DGMO_BINARY="/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/bin/dgmo"

# Check if dgmo binary exists
if [ ! -f "$DGMO_BINARY" ]; then
    echo "Error: dgmo binary not found at $DGMO_BINARY" >&2
    exit 1
fi

# Check if binary is executable
if [ ! -x "$DGMO_BINARY" ]; then
    echo "Error: dgmo binary is not executable" >&2
    exit 1
fi

# Execute dgmo from the current directory
# The exec command replaces this script process with dgmo
exec "$DGMO_BINARY" "$@"