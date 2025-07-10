#!/bin/bash
# Add working dgmo to bashrc

cat << 'EOF'
# Add this to your ~/.bashrc file:

# DGMO command that works from any directory
dgmo() {
    (cd /mnt/c/Users/jehma/Desktop/DGMSTT/opencode/packages/opencode && bun run src/index.ts "$@")
}

# After adding, run: source ~/.bashrc
EOF