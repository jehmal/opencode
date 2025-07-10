#!/bin/bash
# DGMO wrapper script that preserves working directory

# The actual dgmo binary location
DGMO_BINARY="/mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode/bin/dgmo"

# Simply execute dgmo without changing directories
# This preserves the current working directory
exec "$DGMO_BINARY" "$@"