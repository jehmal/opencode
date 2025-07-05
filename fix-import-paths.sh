#!/bin/bash

echo "Fixing Debug utility import paths..."

cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode

# Fix imports in tool directory (should be ../util/debug)
echo "Fixing tool directory imports..."
sed -i 's|from "../../util/debug"|from "../util/debug"|g' src/tool/*.ts 2>/dev/null || \
sed -i '' 's|from "../../util/debug"|from "../util/debug"|g' src/tool/*.ts

# Fix imports in session directory (should be ../util/debug)
echo "Fixing session directory imports..."
sed -i 's|from "../util/debug"|from "../util/debug"|g' src/session/*.ts 2>/dev/null || \
sed -i '' 's|from "../util/debug"|from "../util/debug"|g' src/session/*.ts

# Fix imports in config directory (should be ../util/debug)
echo "Fixing config directory imports..."
sed -i 's|from "../util/debug"|from "../util/debug"|g' src/config/*.ts 2>/dev/null || \
sed -i '' 's|from "../util/debug"|from "../util/debug"|g' src/config/*.ts

# Fix imports in server directory (should be ../util/debug)
echo "Fixing server directory imports..."
sed -i 's|from "../util/debug"|from "../util/debug"|g' src/server/*.ts 2>/dev/null || \
sed -i '' 's|from "../util/debug"|from "../util/debug"|g' src/server/*.ts

# Fix imports in util directory (if any self-references)
echo "Fixing util directory imports..."
sed -i 's|from "../util/debug"|from "./debug"|g' src/util/*.ts 2>/dev/null || \
sed -i '' 's|from "../util/debug"|from "./debug"|g' src/util/*.ts

echo "Import paths fixed!"

# Verify the fixes
echo ""
echo "Verifying imports..."
echo "Files with Debug imports:"
find src -name "*.ts" -exec grep -l "from \".*util/debug\"" {} \; | while read file; do
    echo -n "$file: "
    grep "from \".*util/debug\"" "$file" | head -1
done