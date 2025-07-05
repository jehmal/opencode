#!/bin/bash

# Script to fix debug output by replacing console.log with Debug utility

echo "Fixing debug output in OpenCode DGMSTT..."

# Navigate to the opencode package directory
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode

# Files to fix based on investigation
FILES_TO_FIX=(
  "src/tool/task.ts"
  "src/tool/task-debug.ts"
  "src/tool/diagnose.ts"
  "src/session/index.ts"
  "src/session/sub-session.ts"
  "src/util/project-path.ts"
  "src/config/agent-config.ts"
  "src/server/server.ts"
)

# First, add import for Debug utility to files that need it
for file in "${FILES_TO_FIX[@]}"; do
  if [ -f "$file" ]; then
    # Check if Debug import already exists
    if ! grep -q "import { Debug }" "$file"; then
      # Add import after the first import statement
      sed -i '0,/^import/s/^import/import { Debug } from "..\/util\/debug"\nimport/' "$file" 2>/dev/null || \
      sed -i '' '0,/^import/s/^import/import { Debug } from "..\/util\/debug"\nimport/' "$file"
    fi
  fi
done

# Replace console.log with Debug.log
for file in "${FILES_TO_FIX[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # Replace console.log with Debug.log
    sed -i 's/console\.log(/Debug.log(/g' "$file" 2>/dev/null || \
    sed -i '' 's/console\.log(/Debug.log(/g' "$file"
    
    # Replace console.error with Debug.error
    sed -i 's/console\.error(/Debug.error(/g' "$file" 2>/dev/null || \
    sed -i '' 's/console\.error(/Debug.error(/g' "$file"
    
    # Replace console.warn with Debug.warn
    sed -i 's/console\.warn(/Debug.warn(/g' "$file" 2>/dev/null || \
    sed -i '' 's/console\.warn(/Debug.warn(/g' "$file"
    
    # Replace console.info with Debug.info
    sed -i 's/console\.info(/Debug.info(/g' "$file" 2>/dev/null || \
    sed -i '' 's/console\.info(/Debug.info(/g' "$file"
  fi
done

# Fix import paths based on file depth
echo "Fixing import paths..."
sed -i 's|from "../util/debug"|from "./debug"|g' src/util/project-path.ts 2>/dev/null || \
sed -i '' 's|from "../util/debug"|from "./debug"|g' src/util/project-path.ts

sed -i 's|from "../util/debug"|from "../util/debug"|g' src/session/*.ts 2>/dev/null || \
sed -i '' 's|from "../util/debug"|from "../util/debug"|g' src/session/*.ts

sed -i 's|from "../util/debug"|from "../../util/debug"|g' src/tool/*.ts 2>/dev/null || \
sed -i '' 's|from "../util/debug"|from "../../util/debug"|g' src/tool/*.ts

echo "Debug output fix complete!"
echo ""
echo "To test:"
echo "1. Production mode (no output): OPENCODE_ENV=production bun run src/index.ts"
echo "2. Development mode (with output): OPENCODE_ENV=development bun run src/index.ts"
echo "3. Force debug: OPENCODE_DEBUG=true bun run src/index.ts"