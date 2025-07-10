#!/bin/bash
# Final dgmo wrapper that properly preserves working directory

# Save the current working directory
export DGMO_WORKING_DIR="$(pwd)"
export OPENCODE_WORKING_DIR="$(pwd)"

# Change to opencode directory (needed for imports)
cd /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode

# Run dgmo with bun
exec bun run src/index.ts "$@"