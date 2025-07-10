#!/bin/bash
# Debug wrapper for dgmo

echo "[DEBUG] Current directory: $(pwd)"
echo "[DEBUG] Arguments: $@"
echo "[DEBUG] Running dgmo binary..."

# The actual dgmo binary location
DGMO_BINARY="/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/bin/dgmo"

# Run with explicit environment variables
export DGMO_WORKING_DIR="$(pwd)"
export OPENCODE_WORKING_DIR="$(pwd)"

echo "[DEBUG] DGMO_WORKING_DIR=$DGMO_WORKING_DIR"
echo "[DEBUG] Executing: $DGMO_BINARY $@"

# Execute dgmo and capture exit code
"$DGMO_BINARY" "$@"
EXIT_CODE=$?

echo "[DEBUG] dgmo exited with code: $EXIT_CODE"
exit $EXIT_CODE