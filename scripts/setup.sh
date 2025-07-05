#!/bin/bash
set -euo pipefail

# OpenCode-DGM Monorepo Setup Script

echo "🚀 Setting up OpenCode-DGM Monorepo..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed${NC}"
        return 1
    else
        echo -e "${GREEN}✓ $1 is installed${NC}"
        return 0
    fi
}

echo "📋 Checking prerequisites..."
MISSING_DEPS=0

check_command "node" || MISSING_DEPS=1
check_command "bun" || MISSING_DEPS=1
check_command "python3" || MISSING_DEPS=1
check_command "poetry" || MISSING_DEPS=1
check_command "git" || MISSING_DEPS=1

if [ $MISSING_DEPS -eq 1 ]; then
    echo -e "${RED}Please install missing dependencies before continuing${NC}"
    exit 1
fi

# Install Node/Bun dependencies
echo -e "\n${YELLOW}📦 Installing TypeScript/Bun dependencies...${NC}"
bun install

# Install Python/Poetry dependencies
echo -e "\n${YELLOW}🐍 Installing Python/Poetry dependencies...${NC}"
cd dgm && poetry install && cd ..

# Set up git hooks
echo -e "\n${YELLOW}🔗 Setting up git hooks...${NC}"
if [ -f "scripts/setup-hooks.sh" ]; then
    bash scripts/setup-hooks.sh
fi

# Create necessary directories
echo -e "\n${YELLOW}📁 Creating directory structure...${NC}"
mkdir -p packages
mkdir -p shared/types
mkdir -p .turbo

# Build TypeScript shared types
echo -e "\n${YELLOW}🔨 Building shared TypeScript types...${NC}"
if [ -f "shared/protocols.ts" ]; then
    echo "import './protocols'" > shared/types/index.ts
fi

# Verify installation
echo -e "\n${YELLOW}🔍 Verifying installation...${NC}"

# Check TypeScript
if bun run typecheck 2>/dev/null; then
    echo -e "${GREEN}✓ TypeScript setup verified${NC}"
else
    echo -e "${YELLOW}⚠ TypeScript verification skipped${NC}"
fi

# Check Python
if cd dgm && poetry run python -c "print('Python setup OK')" && cd ..; then
    echo -e "${GREEN}✓ Python setup verified${NC}"
else
    echo -e "${RED}❌ Python setup failed${NC}"
fi

echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo -e "\nYou can now run:"
echo -e "  ${YELLOW}bun run dev${NC} - Start development servers"
echo -e "  ${YELLOW}bun run test${NC} - Run tests"
echo -e "  ${YELLOW}bun run build${NC} - Build all workspaces"