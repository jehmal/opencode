#!/bin/bash
# Wrapper script to ensure venv is properly activated

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../../../.."
DGM_DIR="$PROJECT_ROOT/dgm"

# Activate the virtual environment
source "$DGM_DIR/venv/bin/activate"

# Run the bridge.py script
exec python "$SCRIPT_DIR/bridge.py"