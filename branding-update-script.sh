#!/bin/bash
# DGMO Branding Update Script
# This script systematically replaces all OpenCode references with DGMO

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "\n${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Header
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════╗"
echo "║   DGMO Branding Update Script             ║"
echo "║   Replacing OpenCode references           ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Verify we're in the right directory
if [ ! -d ".git" ]; then
    print_error "Not in a git repository. Please run this script from the DGMSTT-branding worktree root."
    exit 1
fi

# Check if we're in the branding worktree
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != *"branding"* ]]; then
    print_warning "Current branch: $CURRENT_BRANCH"
    read -p "This doesn't appear to be a branding branch. Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create backup tag
print_step "Creating backup tag before changes..."
git tag -f "before-dgmo-branding-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
print_success "Backup tag created"

# Function to update files
update_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        # Create backup
        cp "$file" "$file.bak"
        
        # Perform replacements
        sed -i \
            -e 's/@opencode-dgm/@dgmo/g' \
            -e 's/OpenCode-DGM/DGMO/g' \
            -e 's/OpenCode DGM/DGMO/g' \
            -e 's/opencode-dgm/dgmo/g' \
            -e 's/opencode_dgm/dgmo/g' \
            -e 's/OPENCODE_/DGMO_/g' \
            -e 's/OpenCodeContext/DGMOContext/g' \
            -e 's/setupOpenCodeIntegration/setupDGMOIntegration/g' \
            -e 's/opencode-integration/dgmo-integration/g' \
            -e 's/"opencode"/"dgmo"/g' \
            -e 's/opencode executable/dgmo executable/g' \
            -e 's/opencode --help/dgmo --help/g' \
            -e 's/opencode run/dgmo run/g' \
            -e 's/opencode tui/dgmo tui/g' \
            -e 's/opencode evolve/dgmo evolve/g' \
            -e 's|/opencode/opencode|/opencode/dgmo|g' \
            -e 's|opencode/opencode|opencode/dgmo|g' \
            -e 's/OpenCode + DGM/DGMO/g' \
            -e 's/OpenCode TypeScript Service/DGMO TypeScript Service/g' \
            -e 's/OpenCode launcher/DGMO launcher/g' \
            -e 's/OpenCode is working/DGMO is working/g' \
            -e 's/OpenCode test failed/DGMO test failed/g' \
            -e 's/OpenCode execution failed/DGMO execution failed/g' \
            -e 's/OpenCode help works/DGMO help works/g' \
            -e 's/OpenCode-specific/DGMO-specific/g' \
            -e 's/OpenCode Integration/DGMO Integration/g' \
            -e 's/setup-opencode-dgm/setup-dgmo/g' \
            "$file"
        
        # Check if file was modified
        if ! cmp -s "$file" "$file.bak"; then
            rm "$file.bak"
            print_success "Updated: $description"
        else
            rm "$file.bak"
        fi
    fi
}

# Update package.json files
print_step "Updating package.json files..."
find . -name "package.json" -type f | while read -r file; do
    update_file "$file" "$file"
done

# Update TypeScript files
print_step "Updating TypeScript files..."
find . -name "*.ts" -o -name "*.tsx" | while read -r file; do
    update_file "$file" "$file"
done

# Update JavaScript files
print_step "Updating JavaScript files..."
find . -name "*.js" -o -name "*.jsx" | while read -r file; do
    update_file "$file" "$file"
done

# Update Python files
print_step "Updating Python files..."
find . -name "*.py" | while read -r file; do
    update_file "$file" "$file"
done

# Update Markdown files
print_step "Updating Markdown files..."
find . -name "*.md" | while read -r file; do
    update_file "$file" "$file"
done

# Update shell scripts
print_step "Updating shell scripts..."
find . -name "*.sh" | while read -r file; do
    update_file "$file" "$file"
done

# Update Docker files
print_step "Updating Docker files..."
update_file "docker-compose.yml" "docker-compose.yml"
update_file "docker-compose.dev.yml" "docker-compose.dev.yml"
find . -name "Dockerfile*" | while read -r file; do
    update_file "$file" "$file"
done

# Update configuration files
print_step "Updating configuration files..."
update_file ".env.example" ".env.example"
update_file "Makefile" "Makefile"
update_file "nginx/nginx.dev.conf" "nginx configuration"
update_file "turbo.json" "turbo.json"
update_file "jest.config.js" "jest.config.js"

# Rename files
print_step "Renaming files..."

# Rename setup script
if [ -f "setup-opencode-dgm.sh" ]; then
    git mv "setup-opencode-dgm.sh" "setup-dgmo.sh" 2>/dev/null || mv "setup-opencode-dgm.sh" "setup-dgmo.sh"
    print_success "Renamed: setup-opencode-dgm.sh → setup-dgmo.sh"
fi

# Rename example files
if [ -f "examples/opencode-integration.ts" ]; then
    git mv "examples/opencode-integration.ts" "examples/dgmo-integration.ts" 2>/dev/null || mv "examples/opencode-integration.ts" "examples/dgmo-integration.ts"
    print_success "Renamed: examples/opencode-integration.ts → examples/dgmo-integration.ts"
fi

# Rename executable in opencode directory
if [ -f "opencode/opencode" ]; then
    git mv "opencode/opencode" "opencode/dgmo" 2>/dev/null || mv "opencode/opencode" "opencode/dgmo"
    print_success "Renamed: opencode/opencode → opencode/dgmo"
fi

# Update binary references
print_step "Updating binary references..."
if [ -f "opencode/dgmo" ]; then
    update_file "opencode/dgmo" "dgmo executable"
    chmod +x "opencode/dgmo"
fi

# Special case: Update service names in docker-compose
print_step "Updating Docker service names..."
if [ -f "docker-compose.yml" ]; then
    sed -i 's/opencode:/dgmo:/g' docker-compose.yml
    sed -i 's/service: opencode/service: dgmo/g' docker-compose.yml
    sed -i 's/networks:\s*opencode-dgm/networks: dgmo/g' docker-compose.yml
    sed -i 's/opencode-dgm:/dgmo:/g' docker-compose.yml
    print_success "Updated Docker service names"
fi

# Update README if exists
if [ -f "README.md" ]; then
    print_step "Updating README.md with comprehensive branding..."
    sed -i \
        -e 's/OpenCode + DGM/DGMO/g' \
        -e 's/OpenCode-DGM/DGMO/g' \
        -e 's/opencode-dgm/dgmo/g' \
        -e 's/`opencode/`dgmo/g' \
        -e 's/opencode run/dgmo run/g' \
        -e 's/opencode evolve/dgmo evolve/g' \
        -e 's/opencode tui/dgmo tui/g' \
        README.md
    print_success "Updated README.md"
fi

# Create migration notes
print_step "Creating migration notes..."
cat > BRANDING_MIGRATION.md << 'EOF'
# DGMO Branding Migration

This document tracks the branding migration from OpenCode to DGMO.

## Changes Made

### Package Names
- `@opencode-dgm/` → `@dgmo/`
- Package descriptions updated

### File Renames
- `setup-opencode-dgm.sh` → `setup-dgmo.sh`
- `examples/opencode-integration.ts` → `examples/dgmo-integration.ts`
- `opencode/opencode` → `opencode/dgmo` (executable)

### Code Changes
- `OpenCodeContext` → `DGMOContext`
- `setupOpenCodeIntegration` → `setupDGMOIntegration`
- All OpenCode references in comments and documentation

### Configuration
- Docker service names: `opencode` → `dgmo`
- Environment variables: `OPENCODE_*` → `DGMO_*`
- Network names: `opencode-dgm` → `dgmo`
- Database names: `opencode_dgm` → `dgmo`

### Commands
- `opencode run` → `dgmo run`
- `opencode evolve` → `dgmo evolve`
- `opencode tui` → `dgmo tui`

## Verification Steps

1. Run tests: `npm test`
2. Check Docker: `docker-compose config`
3. Test executable: `./opencode/dgmo --help`
4. Build project: `npm run build`

## Rollback

To rollback changes, use the git tag created before migration:
```bash
git reset --hard before-dgmo-branding-[timestamp]
```
EOF
print_success "Created BRANDING_MIGRATION.md"

# Summary
echo
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Branding Update Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo
echo "Summary of changes:"
echo "  - Updated package names and descriptions"
echo "  - Renamed key files and executables"
echo "  - Updated all code references"
echo "  - Updated Docker configuration"
echo "  - Created migration documentation"
echo
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Review changes: git diff"
echo "  2. Run tests to verify functionality"
echo "  3. Commit changes: git commit -am 'feat: Update branding from OpenCode to DGMO'"
echo "  4. Update any external references or documentation"
echo
echo -e "${YELLOW}Note:${NC} The 'opencode' directory name itself was not changed to maintain"
echo "compatibility. Only internal references and the executable were updated."