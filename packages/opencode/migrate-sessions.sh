#!/bin/bash
# DGMO Session Migration Script
# Consolidates all scattered sessions into unified storage

OPENCODE_DATA="$HOME/.local/share/opencode/project"
UNIFIED_DIR="$OPENCODE_DATA/unified/storage"

echo "DGMO Session Migration Tool"
echo "==========================="
echo "Unified storage: $UNIFIED_DIR"
echo

# Create unified directory
mkdir -p "$UNIFIED_DIR/session"
mkdir -p "$UNIFIED_DIR/performance"

# Find all storage directories
echo "Finding scattered sessions..."
STORAGE_DIRS=$(find "$OPENCODE_DATA" -type d -name "storage" | grep -v "unified")

# Count total sessions
TOTAL_SESSIONS=0
for dir in $STORAGE_DIRS; do
    if [ -d "$dir/session/info" ]; then
        COUNT=$(find "$dir/session/info" -name "*.json" 2>/dev/null | wc -l)
        if [ $COUNT -gt 0 ]; then
            echo "  $(dirname $dir | xargs basename): $COUNT sessions"
            TOTAL_SESSIONS=$((TOTAL_SESSIONS + COUNT))
        fi
    fi
done

echo
echo "Total sessions found: $TOTAL_SESSIONS"
echo

# Migrate sessions
echo "Migrating sessions to unified storage..."
for dir in $STORAGE_DIRS; do
    if [ -d "$dir/session" ]; then
        echo "  Copying from $(dirname $dir | xargs basename)..."
        # Use rsync to merge directories, newer files win
        rsync -av --update "$dir/session/" "$UNIFIED_DIR/session/" 2>/dev/null
    fi
    if [ -d "$dir/performance" ]; then
        rsync -av --update "$dir/performance/" "$UNIFIED_DIR/performance/" 2>/dev/null
    fi
done

# Count migrated sessions
MIGRATED_COUNT=0
if [ -d "$UNIFIED_DIR/session/info" ]; then
    MIGRATED_COUNT=$(find "$UNIFIED_DIR/session/info" -name "*.json" 2>/dev/null | wc -l)
fi

echo
echo "Migration complete!"
echo "Sessions in unified storage: $MIGRATED_COUNT"
echo
echo "Next steps:"
echo "1. Restart DGMO to use the unified storage"
echo "2. All sessions will be accessible from any directory"
echo "3. Test by running 'dgmo' from different directories"
echo
echo "To verify, run:"
echo "  ls -la $UNIFIED_DIR/session/info | wc -l"